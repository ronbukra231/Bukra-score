"""
Prediction Ledger — Bukra's institutional memory of every prediction.

Every research run records a prediction: what Bukra believed, with what
confidence and conviction, over what horizon. Later, reality is observed and
the prediction is resolved — never edited. Calibration is measured from the
gap between conviction and outcome.

Statuses: still_unknown → resolved | partially_correct | incorrect
"""

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
_PATH     = os.path.join(_DATA_DIR, "prediction_ledger.json")
_lock     = threading.Lock()

STATUSES = ("still_unknown", "resolved", "partially_correct", "incorrect")


def _load() -> list:
    try:
        with open(_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _dump(entries: list) -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    tmp = _PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False)
    os.replace(tmp, _PATH)


def record_prediction(*, symbol: str, prediction: str, score: int,
                      confidence: str, conviction: int, horizon: str,
                      engine_version: str, module_scores: dict) -> dict:
    """Store what Bukra believes, permanently. Returns the ledger entry."""
    entry = {
        "id":            uuid.uuid4().hex[:12],
        "symbol":        symbol.upper(),
        "date":          datetime.now(timezone.utc).isoformat(),
        "prediction":    prediction,
        "score":         score,
        "confidence":    confidence,
        "conviction":    conviction,
        "horizon":       horizon,
        "engineVersion": engine_version,
        "moduleScores":  module_scores,
        "status":        "still_unknown",
        "outcome":       None,
        "accuracy":      None,
        "lessonsLearned": [],
        "resolvedAt":    None,
    }
    with _lock:
        entries = _load()
        entries.append(entry)
        _dump(entries)
    return entry


def resolve_prediction(prediction_id: str, *, status: str, outcome: str,
                       accuracy: float, lessons: list) -> Optional[dict]:
    """
    Append reality to a prediction. The original belief stays untouched.
    accuracy: 0.0–1.0 — how right the prediction turned out.
    """
    assert status in ("resolved", "partially_correct", "incorrect")
    with _lock:
        entries = _load()
        for e in entries:
            if e["id"] == prediction_id:
                e["status"]         = status
                e["outcome"]        = outcome
                e["accuracy"]       = accuracy
                e["lessonsLearned"] = e.get("lessonsLearned", []) + lessons
                e["resolvedAt"]     = datetime.now(timezone.utc).isoformat()
                _dump(entries)
                return e
    return None


def get_ledger(symbol: str = None, status: str = None) -> list:
    entries = _load()
    if symbol:
        entries = [e for e in entries if e["symbol"] == symbol.upper()]
    if status:
        entries = [e for e in entries if e["status"] == status]
    return entries


def calibration() -> dict:
    """
    Conviction calibration: for each conviction bucket, how often was Bukra
    actually right? Perfect calibration = 70% conviction → right ~70% of the
    time. The objective is calibration, not overconfidence.
    """
    resolved = [e for e in _load() if e["status"] != "still_unknown" and e.get("accuracy") is not None]
    buckets: dict = {}
    for e in resolved:
        b = f"{(e['conviction'] // 20) * 20}-{(e['conviction'] // 20) * 20 + 19}"
        buckets.setdefault(b, []).append(e["accuracy"])

    return {
        "resolvedPredictions": len(resolved),
        "pendingPredictions":  len(get_ledger(status="still_unknown")),
        "buckets": {
            b: {
                "predictions":     len(accs),
                "meanAccuracy":    round(sum(accs) / len(accs), 2),
                "impliedConviction": f"{b}%",
            }
            for b, accs in sorted(buckets.items())
        },
    }


def historical_hit_rate(symbol: str = None) -> Optional[float]:
    """Mean accuracy of resolved predictions (feeds the Conviction Engine)."""
    resolved = [e for e in get_ledger(symbol=symbol)
                if e["status"] != "still_unknown" and e.get("accuracy") is not None]
    if len(resolved) < 3:
        return None      # not enough evidence to trust our own track record
    return round(sum(e["accuracy"] for e in resolved) / len(resolved), 2)
