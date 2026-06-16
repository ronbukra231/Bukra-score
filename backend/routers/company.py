import time
import threading
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger("bukra.company")
from services.yahoo_finance import get_company_info, get_five_year_financials, search_companies
from services.bukra_score import compute_bukra_score
from services.bukra_rules import compute_bukra_rules
from services.ai_explanation import get_hebrew_explanation
from services.analyst_summary import generate_smart_analyst_summary
from services.accuracy_db import save_snapshot

router = APIRouter(prefix="/api", tags=["company"])

# ── 24-hour page cache ────────────────────────────────────────────────────────
# Caches the full /page response per symbol. Survives within a single process
# lifetime. On Render free tier (cold starts), first request is always slow;
# subsequent requests within 24 h are instant.

_PAGE_CACHE: dict = {}
_PAGE_TTL = 86_400  # 24 hours in seconds
_page_lock = threading.Lock()


def _page_get(symbol: str):
    entry = _PAGE_CACHE.get(symbol)
    if entry and (time.time() - entry["ts"]) < _PAGE_TTL:
        return entry["data"]
    return None


def _page_set(symbol: str, data: dict):
    with _page_lock:
        _PAGE_CACHE[symbol] = {"ts": time.time(), "data": data}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _save_snapshot_bg(info: dict, score_data: dict):
    """Fire-and-forget: save a score snapshot without blocking the response."""
    def _run():
        try:
            score = score_data.get("score")
            if score is None:
                return
            save_snapshot(
                ticker=info.get("symbol", ""),
                company_name=info.get("name", ""),
                sector=info.get("sector", ""),
                bukra_score=int(score),
                price_at_score=info.get("price"),
            )
        except Exception as e:
            print(f"[accuracy] snapshot save failed: {e}")
    threading.Thread(target=_run, daemon=True).start()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/search")
def search(q: str = Query(..., min_length=1)):
    results = search_companies(q)
    if not results:
        raise HTTPException(status_code=404, detail="לא נמצאו תוצאות")
    return results


@router.get("/company/{symbol}/page")
def company_page(symbol: str):
    """
    Single optimised endpoint for the frontend company page.
    Returns info + financials + score + rules + AI explanation in one request.
    Cached per symbol for 24 hours.
    """
    sym = symbol.upper()

    t0     = time.monotonic()
    cached = _page_get(sym)
    if cached:
        logger.info("[page] %s | cache=HIT | score=%s", sym, cached.get("score", {}).get("score"))
        return {**cached, "from_cache": True}

    # Fetch info + financials in parallel to cut latency roughly in half
    with ThreadPoolExecutor(max_workers=2) as pool:
        info_fut = pool.submit(get_company_info, sym)
        fin_fut  = pool.submit(get_five_year_financials, sym)
        info       = info_fut.result()
        financials = fin_fut.result()

    if not info.get("name"):
        raise HTTPException(status_code=404, detail=f"הסימבול {sym} לא נמצא")
    score_data  = compute_bukra_score(financials, info)
    rules_data  = compute_bukra_rules(financials)

    _save_snapshot_bg(info, score_data)

    # AI explanation — never crashes the response if unavailable
    explanation       = None
    explanation_error = None
    try:
        explanation = get_hebrew_explanation(info, financials, score_data)
    except Exception as e:
        explanation_error = str(e)
        print(f"[company/page] AI explanation failed for {sym}: {e}")

    # Smart analyst summary — deterministic fallback always available
    analyst_summary = None
    try:
        analyst_summary = generate_smart_analyst_summary(info, score_data, financials, rules_data)
    except Exception as e:
        print(f"[company/page] analyst summary failed for {sym}: {e}")

    elapsed_ms = round((time.monotonic() - t0) * 1000)
    breakdown  = score_data.get("breakdown", {})
    logger.info(
        "[page] %s | cache=MISS | score=%s | growth=%s prof=%s cf=%s stab=%s debt=%s | elapsed=%sms",
        sym,
        score_data.get("score"),
        breakdown.get("growth"),
        breakdown.get("profitability"),
        breakdown.get("cash_flow"),
        breakdown.get("stability"),
        breakdown.get("debt"),
        elapsed_ms,
    )

    result = {
        "info":              info,
        "financials":        financials,
        "score":             score_data,
        "rules":             rules_data,
        "explanation":       explanation,
        "explanation_error": explanation_error,
        "analyst_summary":   analyst_summary,
        "from_cache":        False,
        "perf":              {"totalMs": elapsed_ms},
    }

    # Only cache when we have real financial data — don't bake in empty financials
    has_financials = bool(financials.get("history"))
    if info.get("name") and has_financials:
        _page_set(sym, result)
    elif info.get("name") and not has_financials:
        logger.warning("[page] %s | NOT caching — financials empty (source=%s)", sym, financials.get("source"))

    return result


# ── Legacy endpoints (kept for backward compatibility) ─────────────────────────

@router.get("/company/{symbol}")
def company_overview(symbol: str):
    info = get_company_info(symbol)
    if not info.get("name"):
        raise HTTPException(status_code=404, detail=f"הסימבול {symbol} לא נמצא")
    return info


@router.get("/company/{symbol}/financials")
def company_financials(symbol: str):
    data = get_five_year_financials(symbol)
    if not data or not data.get("history"):
        raise HTTPException(status_code=404, detail="אין נתונים פיננסיים")
    return data


@router.get("/company/{symbol}/score")
def company_score(symbol: str):
    info = get_company_info(symbol)
    financials = get_five_year_financials(symbol)
    return compute_bukra_score(financials, info)


@router.get("/company/{symbol}/explain")
def company_explain(symbol: str):
    info = get_company_info(symbol)
    financials = get_five_year_financials(symbol)
    score_data = compute_bukra_score(financials, info)
    return get_hebrew_explanation(info, financials, score_data)


@router.get("/company/{symbol}/full")
def company_full(symbol: str):
    info = get_company_info(symbol)
    financials = get_five_year_financials(symbol)
    score_data = compute_bukra_score(financials, info)
    _save_snapshot_bg(info, score_data)
    return {
        "info":      info,
        "financials": financials,
        "score":     score_data,
    }
