"""
Valuation persistence — versioned, append-only.

Same JSON-store pattern as the platform's other data layers
(future_relevance memory, scan history). Each analysis keeps its
methodologyVersion; a future methodology update appends new records and
never overwrites or invalidates historical analyses.
"""

import json
import logging
import os
import threading
from datetime import datetime, timezone

logger = logging.getLogger("bukra.valuation")

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
_PATH     = os.path.join(_DATA_DIR, "valuation_history.json")
_lock     = threading.Lock()

MAX_ANALYSES_PER_SYMBOL = 60

# One stored analysis per symbol per this many hours (page views must not spam)
MIN_HOURS_BETWEEN = 12


def _load() -> dict:
    try:
        with open(_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _dump(data: dict) -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    tmp = _PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, _PATH)


def get_history(symbol: str) -> list:
    return _load().get(symbol.upper(), [])


def save_analysis(symbol: str, analysis: dict) -> bool:
    """Append a versioned analysis. Dedupes rapid recomputes of the same day."""
    sym = symbol.upper()
    try:
        with _lock:
            data = _load()
            history = data.get(sym, [])
            if history:
                last = history[-1]
                try:
                    last_ts = datetime.fromisoformat(last.get("calculatedAt", ""))
                    age_h = (datetime.now(timezone.utc) - last_ts).total_seconds() / 3600
                except ValueError:
                    age_h = MIN_HOURS_BETWEEN + 1
                same = (last.get("valuationScore") == analysis.get("valuationScore")
                        and last.get("methodologyVersion") == analysis.get("methodologyVersion"))
                if same and age_h < MIN_HOURS_BETWEEN:
                    return False
            history.append(analysis)
            data[sym] = history[-MAX_ANALYSES_PER_SYMBOL:]
            _dump(data)
        return True
    except OSError as e:
        logger.warning("[valuation-store] persist failed for %s: %s", sym, e)
        return False
