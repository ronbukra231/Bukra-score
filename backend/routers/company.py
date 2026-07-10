import re
import time
import threading
import logging
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, HTTPException, Query, Request

logger = logging.getLogger("bukra.company")
from limiter import limiter
from services.data_service import get_company_info, get_five_year_financials, search_companies
from services.bukra_score import compute_bukra_score
from services.bukra_rules import compute_bukra_rules
from services.ai_explanation import get_hebrew_explanation
from services.future_relevance import compute_future_relevance, build_timeline
from services.analyst_summary import generate_smart_analyst_summary
from services.accuracy_db import save_snapshot
from services.intelligence import build_company_intelligence
from services.scan_history import get_previous_snapshot, save_intelligence_snapshot
import services.world_model   as world_model
import services.knowledge_graph as knowledge_graph

router = APIRouter(prefix="/api", tags=["company"])

# ── Symbol validation ──────────────────────────────────────────────────────────
_SYMBOL_RE = re.compile(r'^[A-Z0-9.\-]{1,10}$')

def _validate_symbol(symbol: str) -> str:
    """Uppercase and validate a ticker symbol. Raises 400 on invalid input."""
    sym = symbol.upper().strip()
    if not _SYMBOL_RE.match(sym):
        raise HTTPException(status_code=400, detail="סימבול לא תקין")
    return sym


# ── 24-hour page cache ────────────────────────────────────────────────────────
_PAGE_CACHE: dict = {}
_PAGE_CACHE_MAX = 200        # max symbols to hold in memory
_PAGE_TTL = 86_400           # 24 hours
_page_lock = threading.Lock()


def _page_get(symbol: str):
    entry = _PAGE_CACHE.get(symbol)
    if entry and (time.time() - entry["ts"]) < _PAGE_TTL:
        return entry["data"]
    return None


def _page_set(symbol: str, data: dict):
    with _page_lock:
        # Evict oldest entry when at capacity
        if len(_PAGE_CACHE) >= _PAGE_CACHE_MAX and symbol not in _PAGE_CACHE:
            oldest = min(_PAGE_CACHE, key=lambda k: _PAGE_CACHE[k]["ts"])
            del _PAGE_CACHE[oldest]
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
            logger.warning("[accuracy] snapshot save failed: %s", e)
    threading.Thread(target=_run, daemon=True).start()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/search")
@limiter.limit("40/minute")
def search(request: Request, q: str = Query(..., min_length=1, max_length=100)):
    results = search_companies(q)
    if not results:
        raise HTTPException(status_code=404, detail="לא נמצאו תוצאות")
    return results


@router.get("/company/{symbol}/page")
@limiter.limit("30/minute")
def company_page(request: Request, symbol: str, lang: str = Query("he", pattern="^(he|en)$")):
    """
    Single optimised endpoint for the frontend company page.
    Returns info + financials + score + rules + AI explanation in one request.
    Cached per (symbol, lang) for 24 hours — Future Relevance content is
    generated in the active UI language.
    """
    sym       = _validate_symbol(symbol)
    cache_key = f"{sym}:{lang}"

    t0     = time.monotonic()
    cached = _page_get(cache_key)
    if cached:
        logger.info("[page] %s | cache=HIT | score=%s", sym, cached.get("score", {}).get("score"))
        return {**cached, "from_cache": True}

    # Fetch info + financials in parallel. Hard 35-second wall-clock timeout
    # prevents a hung yfinance/yahooquery call from blocking the response forever.
    with ThreadPoolExecutor(max_workers=2) as pool:
        info_fut = pool.submit(get_company_info, sym)
        fin_fut  = pool.submit(get_five_year_financials, sym)
        try:
            info = info_fut.result(timeout=35)
        except Exception as e:
            logger.error("[page] %s | info fetch timed out or failed: %s", sym, e)
            raise HTTPException(status_code=503, detail="הנתונים אינם זמינים כרגע. אנא נסה שוב.")
        try:
            financials = fin_fut.result(timeout=35)
        except Exception as e:
            logger.warning("[page] %s | financials fetch failed, continuing with empty: %s", sym, e)
            financials = {"years": [], "history": [], "raw": {}, "source": "timeout"}

    if not info.get("name"):
        raise HTTPException(status_code=404, detail=f"הסימבול {sym} לא נמצא")

    score_data  = compute_bukra_score(financials, info)
    rules_data  = compute_bukra_rules(financials)

    _save_snapshot_bg(info, score_data)

    # Intelligence layer — confidence, trend, signals, score change
    prev_snap    = get_previous_snapshot(sym)
    intelligence = build_company_intelligence(info, financials, score_data, prev_snap)

    # Persist snapshot and update world model in background
    def _save_intel():
        try:
            snap = save_intelligence_snapshot(sym, score_data, intelligence, info)
            # World model: observe this company's financial pattern
            snapshot_for_wm = {
                "symbol":  sym,
                "sector":  info.get("sector", ""),
                "score":   score_data.get("score"),
                "trend":   intelligence.get("trend", {}),
                "signals": intelligence.get("signals", []),
            }
            sig = world_model.observe(snapshot_for_wm)
            knowledge_graph.update_from_scan(snapshot_for_wm, sig)
        except Exception as e:
            logger.warning("[world-model] update failed for %s: %s", sym, e)
    threading.Thread(target=_save_intel, daemon=True).start()

    # AI explanation — never crashes the response if unavailable
    explanation       = None
    explanation_error = None
    try:
        explanation = get_hebrew_explanation(info, financials, score_data)
    except Exception as e:
        # Log internally; never expose raw error strings to clients
        logger.error("[company/page] AI explanation failed for %s: %s", sym, e)
        explanation_error = "הסבר AI אינו זמין כרגע"

    # Smart analyst summary — deterministic fallback always available
    analyst_summary = None
    try:
        analyst_summary = generate_smart_analyst_summary(info, score_data, financials, rules_data)
    except Exception as e:
        logger.error("[company/page] analyst summary failed for %s: %s", sym, e)

    # Future Relevance — multi-analyst research engine (never blocks response)
    future_relevance = None
    try:
        future_relevance = compute_future_relevance(sym, info, score_data, lang=lang)
    except Exception as e:
        logger.error("[company/page] future relevance failed for %s: %s", sym, e)

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
        "intelligence":      intelligence,
        "future_relevance":  future_relevance,
        "from_cache":        False,
        "perf":              {"totalMs": elapsed_ms},
    }

    # Only cache when we have real financial data — don't bake in empty financials
    has_financials = bool(financials.get("history"))
    if info.get("name") and has_financials:
        _page_set(cache_key, result)
    elif info.get("name") and not has_financials:
        logger.warning("[page] %s | NOT caching — financials empty (source=%s)", sym, financials.get("source"))

    return result


@router.get("/company/{symbol}/future-relevance/timeline")
@limiter.limit("30/minute")
def future_relevance_timeline(request: Request, symbol: str):
    """
    Research Timeline — how the Future Relevance assessment of this company
    evolved over time. Built from permanent Research Memory.
    """
    sym = _validate_symbol(symbol)
    return {"symbol": sym, "timeline": build_timeline(sym)}


# ── Legacy endpoints — kept for backward compatibility, rate-limited ───────────

@router.get("/company/{symbol}")
@limiter.limit("20/minute")
def company_overview(request: Request, symbol: str):
    sym = _validate_symbol(symbol)
    info = get_company_info(sym)
    if not info.get("name"):
        raise HTTPException(status_code=404, detail=f"הסימבול {sym} לא נמצא")
    return info


@router.get("/company/{symbol}/financials")
@limiter.limit("20/minute")
def company_financials(request: Request, symbol: str):
    sym = _validate_symbol(symbol)
    data = get_five_year_financials(sym)
    if not data or not data.get("history"):
        raise HTTPException(status_code=404, detail="אין נתונים פיננסיים")
    return data


@router.get("/company/{symbol}/score")
@limiter.limit("20/minute")
def company_score(request: Request, symbol: str):
    sym = _validate_symbol(symbol)
    info = get_company_info(sym)
    financials = get_five_year_financials(sym)
    return compute_bukra_score(financials, info)


@router.get("/company/{symbol}/explain")
@limiter.limit("10/minute")
def company_explain(request: Request, symbol: str):
    sym = _validate_symbol(symbol)
    info = get_company_info(sym)
    financials = get_five_year_financials(sym)
    score_data = compute_bukra_score(financials, info)
    return get_hebrew_explanation(info, financials, score_data)


@router.get("/company/{symbol}/full")
@limiter.limit("20/minute")
def company_full(request: Request, symbol: str):
    sym = _validate_symbol(symbol)
    info = get_company_info(sym)
    financials = get_five_year_financials(sym)
    score_data = compute_bukra_score(financials, info)
    _save_snapshot_bg(info, score_data)
    return {
        "info":       info,
        "financials": financials,
        "score":      score_data,
    }
