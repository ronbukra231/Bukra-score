"""
Intelligence scan history — JSON-backed persistent storage.
Stores the latest intelligence snapshot per symbol.
Replace with a real DB (PostgreSQL/SQLite) when scaling beyond ~500 symbols.
"""

import json
import logging
import os
import threading
import time
from typing import Optional

logger = logging.getLogger("bukra.scan_history")

_DATA_DIR     = os.path.join(os.path.dirname(__file__), "..", "data")
_HISTORY_PATH = os.path.join(_DATA_DIR, "intelligence_history.json")
_lock = threading.Lock()


def _read_all() -> dict:
    try:
        with open(_HISTORY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _write_all(data: dict):
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(_HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_intelligence_snapshot(
    symbol: str,
    score_data: dict,
    intelligence: dict,
    info: dict,
):
    """Persist the latest intelligence snapshot for a symbol."""
    entry = {
        "symbol":      symbol.upper(),
        "name":        info.get("name", symbol),
        "sector":      info.get("sector", ""),
        "price":       info.get("price"),
        "score":       score_data.get("score"),
        "breakdown":   score_data.get("breakdown", {}),
        "confidence":  intelligence.get("confidence", {}),
        "trend":       intelligence.get("trend", {}),
        "signals":     intelligence.get("signals", []),
        "saved_at":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    with _lock:
        data = _read_all()
        data[symbol.upper()] = entry
        _write_all(data)


def get_previous_snapshot(symbol: str) -> Optional[dict]:
    """Return the last saved snapshot for a symbol, or None."""
    data = _read_all()
    return data.get(symbol.upper())


def get_all_snapshots() -> dict:
    return _read_all()


# ── Radar aggregation ─────────────────────────────────────────────────────────

_CATEGORY_MAP = {
    "QualityUpgrade":   "quality_upgrades",
    "QualityDowngrade": "quality_downgrades",
    "ValuationWarning": "valuation_warnings",
    "MarginPressure":   "margin_pressure",
    "RevenueMomentum":  "revenue_momentum",
    "DebtAlert":        "debt_alerts",
    "PriceOpportunity": "price_opportunities",
    "DataWarning":      "data_warnings",
}

_SEVERITY_ORDER = {"High": 0, "Medium": 1, "Low": 2}


def get_radar_signals() -> dict:
    """
    Aggregate all company intelligence snapshots into Radar signal categories.
    Returns structured signal lists ready for the Radar page.
    """
    data = _read_all()

    categories = {v: [] for v in _CATEGORY_MAP.values()}
    categories["high_quality_watchlist"] = []

    total_signals = 0
    last_scan     = None

    for symbol, snap in data.items():
        score      = snap.get("score")
        name       = snap.get("name", symbol)
        sector     = snap.get("sector", "")
        signals    = snap.get("signals", [])
        saved_at   = snap.get("saved_at", "")
        trend      = snap.get("trend", {})
        confidence = snap.get("confidence", {})

        if last_scan is None or saved_at > last_scan:
            last_scan = saved_at

        for sig in signals:
            cat_key = _CATEGORY_MAP.get(sig.get("category", ""))
            if cat_key:
                categories[cat_key].append({
                    "symbol":   symbol,
                    "name":     name,
                    "sector":   sector,
                    "signal":   sig["signal"],
                    "severity": sig.get("severity", "Low"),
                    "category": sig.get("category", ""),
                    "score":    score,
                    "saved_at": saved_at,
                })
                total_signals += 1

        # High quality watchlist
        if (
            score is not None and score >= 75
            and confidence.get("level") in ("High", "Medium")
            and trend.get("direction") in ("Improving", "Stable")
        ):
            categories["high_quality_watchlist"].append({
                "symbol":     symbol,
                "name":       name,
                "sector":     sector,
                "score":      score,
                "trend":      trend.get("direction"),
                "confidence": confidence.get("level"),
                "saved_at":   saved_at,
            })

    # Sort: High severity first, then by score descending
    for key, items in categories.items():
        if key == "high_quality_watchlist":
            items.sort(key=lambda x: -(x.get("score") or 0))
        else:
            items.sort(
                key=lambda x: (
                    _SEVERITY_ORDER.get(x.get("severity", "Low"), 2),
                    -(x.get("score") or 0),
                )
            )

    return {
        **categories,
        "total_signals":           total_signals,
        "total_companies_scanned": len(data),
        "last_scan":               last_scan,
    }
