"""
Prediction Accuracy System — API endpoints.
GET  /api/accuracy/summary      — full performance dashboard data
GET  /api/accuracy/history      — paginated snapshot history
POST /api/accuracy/recalculate  — resolve pending snapshots (background)
GET  /api/debug/data-status     — pipeline health: snapshot counts, data mode, last scan
"""

import json
import os
import threading
from datetime import datetime, timezone, timedelta
from typing import Optional

import yfinance as yf
from fastapi import APIRouter, Query

from services.accuracy_db import (
    get_summary_stats,
    get_all_snapshots,
    get_pending_snapshots,
    update_outcome,
)

router       = APIRouter(tags=["accuracy"])
_recalc_lock = threading.Lock()
_last_recalc: Optional[str] = None

_DATA_DIR     = os.path.join(os.path.dirname(__file__), "..", "data")
_HISTORY_PATH = os.path.join(_DATA_DIR, "intelligence_history.json")


# ── Debug endpoint ────────────────────────────────────────────────────────────

@router.get("/api/debug/data-status")
def data_status():
    """
    Pipeline health check. Returns snapshot counts, data mode, and last scan times.
    Use this to verify that real data is flowing through the system.
    """
    # Intelligence history (radar / per-company comparison)
    try:
        with open(_HISTORY_PATH, "r", encoding="utf-8") as f:
            intel = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        intel = {}

    intel_companies = list(intel.keys())
    intel_last_scan = None
    if intel:
        intel_last_scan = max(v.get("saved_at", "") for v in intel.values()) or None

    # Accuracy DB
    stats = get_summary_stats()

    return {
        "intelligence_history": {
            "company_count": len(intel_companies),
            "companies":     intel_companies,
            "last_scan":     intel_last_scan,
            "storage_path":  _HISTORY_PATH,
        },
        "accuracy_db": {
            "total_snapshots":  stats["completed_count"] + stats["pending_count"],
            "real_snapshots":   stats["real_count"],
            "sample_snapshots": stats["sample_count"],
            "pending":          stats["pending_count"],
            "data_mode":        stats["data_mode"],
            "last_real_scan":   stats.get("last_real_scan"),
            "minimum_for_accuracy": stats["minimum_for_accuracy"],
            "has_real_data":    stats["has_real_data"],
        },
        "pipeline": {
            "snapshot_saves_on_company_search": True,
            "snapshot_saves_on_scanner":        True,
            "radar_source":                     "intelligence_history.json (real scans only)",
            "accuracy_source":                  "accuracy.db (real rows only when available)",
            "how_to_grow_data":                 "Search more companies or run the scanner",
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Price helpers ─────────────────────────────────────────────────────────────

def _fetch_price(ticker: str, date_iso: str) -> Optional[float]:
    """Closing price of ticker on or just after date_iso (up to 10 trading days)."""
    try:
        start = datetime.fromisoformat(date_iso).date()
        end   = start + timedelta(days=10)
        hist  = yf.Ticker(ticker).history(start=start.isoformat(), end=end.isoformat())
        if hist.empty:
            return None
        return float(hist["Close"].iloc[0])
    except Exception as e:
        print(f"[accuracy] price fetch failed {ticker} @ {date_iso}: {e}")
        return None


# ── Resolution logic ──────────────────────────────────────────────────────────

def _resolve_pending():
    """Fetch 3-month-out prices for snapshots that have aged past 90 days."""
    global _last_recalc
    pending  = get_pending_snapshots()
    resolved = 0

    for snap in pending:
        snap_date    = snap["snapshot_date"]
        resolve_date = (datetime.fromisoformat(snap_date).date() + timedelta(days=91)).isoformat()

        base_price = snap.get("price_at_score")
        spy_base   = snap.get("spy_price_at")
        if not base_price or not spy_base:
            continue

        ticker_price = _fetch_price(snap["ticker"], resolve_date)
        spy_price    = _fetch_price("SPY", resolve_date)
        if ticker_price is None or spy_price is None:
            continue

        ret_3m     = round((ticker_price - base_price) / base_price * 100, 2)
        spy_ret_3m = round((spy_price    - spy_base)   / spy_base   * 100, 2)
        alpha_3m   = round(ret_3m - spy_ret_3m, 2)
        beat_spy   = 1 if ret_3m > spy_ret_3m else 0

        update_outcome(
            snapshot_id=snap["id"],
            price_3m=ticker_price,
            spy_price_3m=spy_price,
            return_3m=ret_3m,
            spy_return_3m=spy_ret_3m,
            beat_spy_3m=beat_spy,
            alpha_3m=alpha_3m,
        )
        resolved += 1
        print(
            f"[accuracy] resolved {snap['ticker']} snap={snap_date}: "
            f"ret={ret_3m}% spy={spy_ret_3m}% alpha={alpha_3m}% beat={bool(beat_spy)}"
        )

    _last_recalc = datetime.now(timezone.utc).isoformat()
    return resolved


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/api/accuracy/summary")
def accuracy_summary():
    stats = get_summary_stats()
    stats["last_recalc"]  = _last_recalc
    stats["last_updated"] = datetime.now(timezone.utc).isoformat()
    return stats


@router.get("/api/accuracy/history")
def accuracy_history(
    limit:          int           = Query(100, ge=1, le=500),
    offset:         int           = Query(0,   ge=0),
    include_sample: bool          = Query(True),
    status:         Optional[str] = Query(None),
):
    rows = get_all_snapshots(include_sample=include_sample)
    if status:
        rows = [r for r in rows if r.get("outcome_status") == status]
    total = len(rows)
    return {"total": total, "offset": offset, "limit": limit, "rows": rows[offset: offset + limit]}


@router.post("/api/accuracy/recalculate")
def recalculate():
    """Kick off background resolution of eligible pending snapshots."""
    if not _recalc_lock.acquire(blocking=False):
        return {"status": "already_running"}

    def _run():
        try:
            n = _resolve_pending()
            print(f"[accuracy] recalculate done: {n} resolved")
        finally:
            _recalc_lock.release()

    threading.Thread(target=_run, daemon=True).start()
    return {"status": "started"}
