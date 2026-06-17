"""
Bukra Scanner — cache-first architecture.

Endpoints:
  GET  /api/scanner/latest   — return cached results instantly (never triggers scan)
  POST /api/scanner/refresh  — start background scan, return immediately
  GET  /api/scanner/status   — live progress while scan is running
  GET  /api/scanner/top      — legacy: same as /latest (kept for backward compat)
"""

import json
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Request
from limiter import limiter
from services.yahoo_finance import get_company_info, get_five_year_financials
from services.bukra_score import compute_bukra_score
from services.bukra_rules import compute_bukra_rules
from services.accuracy_db import save_snapshot

logger = logging.getLogger("bukra.scanner")
router = APIRouter(prefix="/api", tags=["scanner"])

# ── Paths ─────────────────────────────────────────────────────────────────────

_DATA_DIR      = os.path.join(os.path.dirname(__file__), "..", "data")
_UNIVERSE_PATH = os.path.join(_DATA_DIR, "stock_universe.json")
_CACHE_PATH    = os.path.join(_DATA_DIR, "scanner_cache.json")


def _load_universe() -> list[dict]:
    with open(_UNIVERSE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# ── Persistent cache (disk) ───────────────────────────────────────────────────

def _read_cache() -> Optional[dict]:
    """Read scanner_cache.json from disk. Returns None if file missing/corrupt."""
    try:
        with open(_CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def _write_cache(results: list, errors: list, started_at: str, completed_at: str, duration_s: float):
    universe = _load_universe()
    payload = {
        "results":               results,
        "last_updated":          completed_at,
        "universe_size":         len(universe),
        "scanned_count":         len(results) + len(errors),
        "failed_tickers":        errors,
        "scan_duration_seconds": round(duration_s, 1),
    }
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"[scanner] Cache saved → {_CACHE_PATH}  ({len(results)} companies)")


# ── In-memory scan state (progress tracking only) ────────────────────────────

_scan_state: dict = {
    "status":    "idle",    # idle | running | completed | failed
    "progress":  0,
    "total":     0,
    "started_at": None,
}
_scan_lock   = threading.Lock()
_refresh_lock = threading.Lock()   # prevents concurrent scans


# ── Score one ticker ──────────────────────────────────────────────────────────

def _score_ticker(entry: dict) -> Optional[dict]:
    ticker         = entry["ticker"]
    universe_name  = entry.get("name", ticker)
    universe_sector = entry.get("sector", "")
    try:
        info = get_company_info(ticker)
        name = info.get("name", "")
        if not name or name == ticker:
            return None

        financials = get_five_year_financials(ticker)
        if not financials.get("history"):
            return None

        score_data = compute_bukra_score(financials, info)
        if score_data.get("score") is None:
            return None

        rules_data   = compute_bukra_rules(financials)
        breakdown    = score_data.get("breakdown", {})
        max_scores   = score_data.get("max_scores", {})
        explanations = score_data.get("explanations", {})

        main_strength_key = main_risk_key = None
        if breakdown:
            pcts = {k: v / max_scores.get(k, 25) for k, v in breakdown.items()}
            main_strength_key = max(pcts, key=pcts.get)
            worst = min(pcts, key=pcts.get)
            if pcts[worst] < 0.5:
                main_risk_key = worst

        return {
            "ticker":            ticker,
            "company_name":      name or universe_name,
            "sector":            info.get("sector") or universe_sector,
            "industry":          info.get("industry", ""),
            "price":             info.get("price"),
            "market_cap":        info.get("market_cap"),
            "pe_ratio":          info.get("pe_ratio"),
            "dividend_yield":    info.get("dividend_yield"),
            "bukra_score":       score_data["score"],
            "rules_passed":      rules_data["rules_passed"],
            "rules_available":   rules_data["rules_available"],
            "investment_status": rules_data["investment_status"],
            "main_strength_key": main_strength_key,
            "main_risk_key":     main_risk_key,
            "strength_detail":   explanations.get(main_strength_key, "") if main_strength_key else "",
        }
    except Exception as e:
        print(f"[scanner] {ticker} failed: {e}")
        return None


# ── Background scan ───────────────────────────────────────────────────────────

def _run_scan():
    """
    Background scan — always releases _refresh_lock in a finally block so that
    even if an unexpected exception escapes the function, the lock is freed and
    future scans can run.
    """
    universe   = _load_universe()
    started_at = datetime.now(timezone.utc).isoformat()
    t0         = time.monotonic()

    with _scan_lock:
        _scan_state.update({
            "status":     "running",
            "progress":   0,
            "total":      len(universe),
            "started_at": started_at,
        })

    results: list[dict] = []
    errors:  list[str]  = []

    try:
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(_score_ticker, e): e["ticker"] for e in universe}
            done = 0
            for future in as_completed(futures):
                done += 1
                with _scan_lock:
                    _scan_state["progress"] = done

                ticker = futures[future]
                try:
                    result = future.result()
                    if result:
                        results.append(result)
                    else:
                        errors.append(ticker)
                except Exception as e:
                    errors.append(ticker)
                    logger.error("[scanner] future error %s: %s", ticker, e)

        results.sort(key=lambda x: x["bukra_score"], reverse=True)
        duration = time.monotonic() - t0
        completed_at = datetime.now(timezone.utc).isoformat()

        try:
            _write_cache(results, errors, started_at, completed_at, duration)
        except Exception as e:
            logger.error("[scanner] cache write failed: %s", e)

        with _scan_lock:
            _scan_state.update({
                "status":   "completed",
                "progress": len(universe),
            })

        # Save accuracy snapshots for top 30
        def _save_snapshots():
            for r in results[:30]:
                try:
                    save_snapshot(
                        ticker=r["ticker"],
                        company_name=r.get("company_name", ""),
                        sector=r.get("sector", ""),
                        bukra_score=int(r["bukra_score"]),
                        price_at_score=r.get("price"),
                    )
                except Exception as e:
                    logger.warning("[accuracy] snapshot failed %s: %s", r["ticker"], e)

        threading.Thread(target=_save_snapshots, daemon=True).start()
        logger.info("[scanner] Done in %.0fs — %d scored, %d failed", time.monotonic() - t0, len(results), len(errors))

    except Exception as e:
        logger.error("[scanner] scan crashed: %s", e)
        with _scan_lock:
            _scan_state["status"] = "failed"
    finally:
        # Always release the lock — prevents permanent deadlock on unexpected exceptions
        _refresh_lock.release()


# ── Public helper (used by scheduler in main.py) ─────────────────────────────

def trigger_scan_if_idle() -> bool:
    """Start a background scan if none is currently running. Returns True if started."""
    acquired = _refresh_lock.acquire(blocking=False)
    if not acquired:
        print("[scanner] trigger_scan_if_idle: scan already running, skipped")
        return False
    print("[scanner] trigger_scan_if_idle: starting background scan")
    threading.Thread(target=_run_scan, daemon=True).start()
    return True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/scanner/latest")
@limiter.limit("30/minute")
def scanner_latest(request: Request):
    """
    Return cached results from disk immediately.
    Never triggers a scan. Returns has_cache=False if no cache exists yet.
    """
    cache = _read_cache()
    if not cache:
        return {
            "has_cache":   False,
            "results":     [],
            "last_updated": None,
            "universe_size": 0,
            "scanned_count": 0,
            "failed_tickers": [],
            "scan_duration_seconds": None,
        }
    return {"has_cache": True, **cache}


@router.post("/scanner/refresh")
@limiter.limit("3/minute")
def scanner_refresh(request: Request):
    """
    Start a background scan. Returns immediately.
    If a scan is already running, returns status='already_running'.
    Rate-limited to 3/minute to prevent triggering expensive scans repeatedly.
    """
    acquired = _refresh_lock.acquire(blocking=False)
    if not acquired:
        with _scan_lock:
            return {"status": "already_running", "progress": _scan_state["progress"], "total": _scan_state["total"]}

    threading.Thread(target=_run_scan, daemon=True).start()
    return {"status": "started"}


@router.get("/scanner/status")
@limiter.limit("60/minute")
def scanner_status(request: Request):
    """Live scan progress. Safe to poll every 2 seconds."""
    with _scan_lock:
        s = dict(_scan_state)

    cache = _read_cache()
    return {
        "status":       s["status"],           # idle | running | completed | failed
        "progress":     s["progress"],
        "total":        s["total"],
        "started_at":   s.get("started_at"),
        "last_updated": cache.get("last_updated") if cache else None,
        "scanned_count": cache.get("scanned_count") if cache else None,
    }


@router.get("/scanner/top")
@limiter.limit("20/minute")
def scanner_top(request: Request, force: bool = False):
    """
    Legacy endpoint kept for backward compatibility.
    Now simply returns cached results (same as /latest).
    force=true triggers a refresh but still returns current cache immediately.
    """
    if force:
        acquired = _refresh_lock.acquire(blocking=False)
        if acquired:
            threading.Thread(target=_run_scan, daemon=True).start()

    cache = _read_cache()
    if not cache:
        with _scan_lock:
            return dict(_scan_state) | {"results": [], "errors": [], "completed_at": None}

    with _scan_lock:
        live = dict(_scan_state)

    return {
        "status":       live["status"] if live["status"] == "running" else "done",
        "progress":     live["progress"],
        "total":        live["total"],
        "results":      cache.get("results", []),
        "errors":       cache.get("failed_tickers", []),
        "completed_at": cache.get("last_updated"),
        "error_msg":    None,
    }
