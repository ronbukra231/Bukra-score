"""
Global Event Memory — every meaningful global event becomes permanent knowledge.

Append-only. An event's record is never overwritten: resolution (actual
outcome, prediction accuracy, lessons learned) is appended to the same record,
turning every event into training data for future reasoning.
"""

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
_PATH     = os.path.join(_DATA_DIR, "global_events.json")
_lock     = threading.Lock()


def _load() -> list:
    try:
        with open(_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _dump(events: list) -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    tmp = _PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(events, f, ensure_ascii=False)
    os.replace(tmp, _PATH)


def record_event(*, title: str, facts: list, sources: list, confidence: str,
                 expected_consequences: list, affected_industries: list,
                 affected_companies: list, affected_countries: list,
                 time_horizon: str, probability_estimates: Optional[dict] = None,
                 risk_scenarios: Optional[list] = None) -> dict:
    """Store a global event permanently. Returns the stored record (with id)."""
    event = {
        "id":                   uuid.uuid4().hex[:12],
        "title":                title,
        "timestamp":            datetime.now(timezone.utc).isoformat(),
        "facts":                facts,
        "sources":              sources,
        "confidence":           confidence,
        "expectedConsequences": expected_consequences,
        "affectedIndustries":   affected_industries,
        "affectedCompanies":    affected_companies,
        "affectedCountries":    affected_countries,
        "timeHorizon":          time_horizon,
        "probabilityEstimates": probability_estimates or {},
        "riskScenarios":        risk_scenarios or [],
        # Filled by resolve_event() once reality is observable — never before
        "actualOutcome":        None,
        "predictionAccuracy":   None,
        "lessonsLearned":       [],
        "resolvedAt":           None,
    }
    with _lock:
        events = _load()
        events.append(event)
        _dump(events)
    return event


def resolve_event(event_id: str, *, actual_outcome: str,
                  prediction_accuracy: str, lessons: list) -> Optional[dict]:
    """
    Append reality to an event record: what actually happened, how accurate
    the expectations were, and what was learned. History is never rewritten —
    the original expectations stay exactly as recorded.
    """
    with _lock:
        events = _load()
        for ev in events:
            if ev["id"] == event_id:
                ev["actualOutcome"]      = actual_outcome
                ev["predictionAccuracy"] = prediction_accuracy
                ev["lessonsLearned"]     = ev.get("lessonsLearned", []) + lessons
                ev["resolvedAt"]         = datetime.now(timezone.utc).isoformat()
                _dump(events)
                return ev
    return None


def get_events(resolved: Optional[bool] = None) -> list:
    """All events, optionally filtered by resolution state. Chronological."""
    events = _load()
    if resolved is None:
        return events
    return [e for e in events if (e.get("resolvedAt") is not None) == resolved]


def lessons_learned() -> list:
    """Every lesson Bukra has ever learned from resolved events."""
    return [
        {"event": e["title"], "date": e["resolvedAt"], "lesson": lesson}
        for e in _load() if e.get("resolvedAt")
        for lesson in e.get("lessonsLearned", [])
    ]
