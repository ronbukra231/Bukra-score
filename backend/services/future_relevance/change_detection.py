"""
Change Detection — decides when the world changed enough to re-research.

The engine assumes today's conclusion can become obsolete tomorrow. When a
meaningful change is observed for a company, this module recommends a
re-analysis, which appends a new report to Research Memory.

Currently a stub: event ingestion (news, filings, announcements) is not wired
yet. The event taxonomy and the recommendation contract are final; a future
sprint connects real event feeds (see services/event_engine.py) to this API.
"""

from enum import Enum


class ChangeEventType(str, Enum):
    EARNINGS_REPORT     = "earnings_report"
    MANAGEMENT_CHANGE   = "management_change"
    PRODUCT_LAUNCH      = "product_launch"
    REGULATION          = "regulation"
    AI_ANNOUNCEMENT     = "ai_announcement"
    LAWSUIT             = "lawsuit"
    TECH_BREAKTHROUGH   = "tech_breakthrough"
    INDUSTRY_DISRUPTION = "industry_disruption"
    MACRO_EVENT         = "macro_event"
    GEOPOLITICAL_EVENT  = "geopolitical_event"
    MAJOR_ACQUISITION   = "major_acquisition"
    COMPETITIVE_MOVE    = "competitive_move"


# Events that always justify a fresh analysis regardless of recency
_ALWAYS_REANALYZE = {
    ChangeEventType.MAJOR_ACQUISITION,
    ChangeEventType.MANAGEMENT_CHANGE,
    ChangeEventType.INDUSTRY_DISRUPTION,
    ChangeEventType.TECH_BREAKTHROUGH,
}


def recommend_reanalysis(symbol: str, events: list[dict]) -> dict:
    """
    Given observed change events for a company, decide whether a re-analysis
    is warranted.

    Each event: {"type": ChangeEventType value, "description": str, "date": iso}

    Returns {"reanalyze": bool, "reasons": [str], "triggeredBy": [event type strs]}
    """
    triggered = []
    for ev in events:
        try:
            ev_type = ChangeEventType(ev.get("type"))
        except ValueError:
            continue
        if ev_type in _ALWAYS_REANALYZE:
            triggered.append(ev)
        # Placeholder: lesser events will be scored for materiality once real
        # event feeds are connected; for now only always-reanalyze events fire.

    return {
        "reanalyze":   bool(triggered),
        "reasons":     [ev.get("description", "") for ev in triggered],
        "triggeredBy": [ev.get("type") for ev in triggered],
    }
