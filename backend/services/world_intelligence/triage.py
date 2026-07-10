"""
Adaptive Intelligence — triage every new piece of information.

Bukra never requires manual retraining. Each incoming signal is classified:

    NOTHING_CHANGED   → ignore silently (noise must never become work)
    MINOR_UPDATE      → adjust confidence/notes, no full re-analysis
    MAJOR_REANALYSIS  → trigger the full research engine

Only meaningful events produce new intelligence.
"""

from enum import Enum


class TriageVerdict(str, Enum):
    NOTHING_CHANGED  = "nothing_changed"
    MINOR_UPDATE     = "minor_update"
    MAJOR_REANALYSIS = "major_reanalysis"


# Baseline severity per information type. Magnitude can promote/demote one level.
_BASE_SEVERITY = {
    "earnings":               TriageVerdict.MINOR_UPDATE,
    "macro_data":             TriageVerdict.MINOR_UPDATE,
    "interest_rates":         TriageVerdict.MINOR_UPDATE,
    "inflation":              TriageVerdict.MINOR_UPDATE,
    "war":                    TriageVerdict.MAJOR_REANALYSIS,
    "government_decision":    TriageVerdict.MINOR_UPDATE,
    "regulation":             TriageVerdict.MINOR_UPDATE,
    "ai_breakthrough":        TriageVerdict.MAJOR_REANALYSIS,
    "acquisition":            TriageVerdict.MAJOR_REANALYSIS,
    "management_change":      TriageVerdict.MAJOR_REANALYSIS,
    "technology_announcement": TriageVerdict.MINOR_UPDATE,
    "supply_chain_event":     TriageVerdict.MINOR_UPDATE,
    "trade_agreement":        TriageVerdict.MINOR_UPDATE,
    "geopolitical_event":     TriageVerdict.MINOR_UPDATE,
    "major_lawsuit":          TriageVerdict.MINOR_UPDATE,
    "consumer_trend":         TriageVerdict.NOTHING_CHANGED,
    "competitive_move":       TriageVerdict.MINOR_UPDATE,
}

_ORDER = [TriageVerdict.NOTHING_CHANGED, TriageVerdict.MINOR_UPDATE, TriageVerdict.MAJOR_REANALYSIS]


def classify_information(info_type: str, magnitude: str = "normal") -> dict:
    """
    Decide how much intelligence a new signal deserves.
    magnitude: "low" | "normal" | "high" — promotes or demotes one level.
    """
    base = _BASE_SEVERITY.get(info_type, TriageVerdict.NOTHING_CHANGED)
    idx  = _ORDER.index(base)
    if magnitude == "high":
        idx = min(idx + 1, len(_ORDER) - 1)
    elif magnitude == "low":
        idx = max(idx - 1, 0)
    verdict = _ORDER[idx]
    return {
        "verdict":  verdict.value,
        "infoType": info_type,
        "magnitude": magnitude,
        "reanalyze": verdict is TriageVerdict.MAJOR_REANALYSIS,
    }
