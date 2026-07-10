"""
Research Memory — the engine never forgets a previous analysis.

Every completed research run is persisted to the company's permanent research
history. Each stored report contains: timestamp, engine version, overall
score, confidence, module (analyst) scores, assumptions, reasoning,
opportunities, risks, scenarios, and sources used.

Storage: backend/data/future_relevance_memory.json — same JSON-store pattern
as scan_history / world_model. Swap for a real database later by replacing
only this module.
"""

import json
import logging
import os
import threading

logger = logging.getLogger("bukra.future_relevance")

_DATA_DIR    = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
_MEMORY_PATH = os.path.join(_DATA_DIR, "future_relevance_memory.json")
_lock = threading.Lock()

MAX_REPORTS_PER_SYMBOL = 100

# A new report is only appended if this much time passed since the previous
# one, or if the score/confidence changed — page views must not spam memory.
MIN_HOURS_BETWEEN_REPORTS = 12


def _load() -> dict:
    try:
        with open(_MEMORY_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _dump(data: dict) -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    tmp = _MEMORY_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, _MEMORY_PATH)


def get_history(symbol: str) -> list[dict]:
    """Full research history for a company, oldest first."""
    return _load().get(symbol.upper(), [])


def save_report(symbol: str, report: dict) -> bool:
    """
    Append a research report to the company's permanent timeline.
    Returns True if stored, False if deduplicated against the latest report.
    """
    from datetime import datetime, timezone

    sym = symbol.upper()
    with _lock:
        data    = _load()
        history = data.get(sym, [])

        if history:
            last = history[-1]
            try:
                last_ts = datetime.fromisoformat(last["timestamp"])
                age_h   = (datetime.now(timezone.utc) - last_ts).total_seconds() / 3600
            except (KeyError, ValueError):
                age_h = MIN_HOURS_BETWEEN_REPORTS + 1
            unchanged = (last.get("score") == report.get("score")
                         and last.get("confidence") == report.get("confidence"))
            if unchanged and age_h < MIN_HOURS_BETWEEN_REPORTS:
                return False

        history.append(report)
        data[sym] = history[-MAX_REPORTS_PER_SYMBOL:]
        try:
            _dump(data)
        except OSError as e:
            logger.warning("[fr-memory] failed to persist report for %s: %s", sym, e)
            return False
    return True


def build_memory_record(symbol: str, *, engine_version: str, verdict: dict,
                        confidence: str, reports: list, scenarios: list,
                        summary: str, generated_at: str) -> dict:
    """Shape a completed research run into its permanent memory record."""
    return {
        "symbol":        symbol.upper(),
        "timestamp":     generated_at,
        "engineVersion": engine_version,
        "score":         verdict["score"],
        "status":        verdict["status"],
        "confidence":    confidence,
        "moduleScores":  {r.analyst_key: r.score for r in reports},
        "assumptions":   sorted({a for r in reports for a in r.assumptions}),
        "reasoning":     summary,
        "opportunities": verdict["drivers"],
        "risks":         verdict["risks"],
        "scenarios":     scenarios,
        "sources":       sorted({s for r in reports for s in r.sources}),
    }
