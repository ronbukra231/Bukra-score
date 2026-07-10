"""
Pattern Recognition — Bukra becomes better because history exists.

A library of recurring historical patterns (oil shocks, rate cycles, wars,
pandemics...). When a similar situation appears, retrieve previous analogues,
compare outcomes, and use base rates to ground probability estimates.

Seed analogues are canonical, well-documented episodes. Runtime analogues are
appended as Global Event Memory resolves — history compounds.
"""

import json
import os
import threading

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
_PATH     = os.path.join(_DATA_DIR, "historical_patterns.json")
_lock     = threading.Lock()

# Pattern taxonomy — mirrors change_detection + global event categories
PATTERN_TYPES = [
    "war", "oil_shock", "trade_war", "supply_chain_disruption", "bank_failure",
    "inflation_cycle", "interest_rate_cycle", "ai_revolution",
    "technology_disruption", "pandemic", "financial_crisis", "commodity_shock",
]

# Canonical seed analogues: minimal, factual, well-documented episodes
SEED_ANALOGUES = [
    {"type": "oil_shock", "episode": "1973 OPEC embargo",
     "outcome": "Oil quadrupled; stagflation; energy stocks outperformed for years",
     "marketImpact": "severe", "recoveryYears": 6},
    {"type": "oil_shock", "episode": "1990 Gulf War spike",
     "outcome": "Oil doubled briefly; recession; prices normalized within a year",
     "marketImpact": "moderate", "recoveryYears": 1},
    {"type": "pandemic", "episode": "COVID-19 (2020)",
     "outcome": "Fastest bear market ever, then fastest recovery on stimulus; digital adoption pulled forward years",
     "marketImpact": "severe", "recoveryYears": 1},
    {"type": "financial_crisis", "episode": "2008 global financial crisis",
     "outcome": "Banking system near-collapse; -50% equities; decade of low rates followed",
     "marketImpact": "severe", "recoveryYears": 4},
    {"type": "bank_failure", "episode": "2023 regional bank failures (SVB)",
     "outcome": "Contained by rapid intervention; flight to large banks; minimal broad-market damage",
     "marketImpact": "mild", "recoveryYears": 0},
    {"type": "interest_rate_cycle", "episode": "2022–2023 fastest hiking cycle in 40 years",
     "outcome": "Growth multiples compressed sharply; profitable quality companies recovered first",
     "marketImpact": "moderate", "recoveryYears": 2},
    {"type": "inflation_cycle", "episode": "1970s US inflation",
     "outcome": "Real equity returns negative for a decade; pricing-power businesses defended best",
     "marketImpact": "severe", "recoveryYears": 8},
    {"type": "ai_revolution", "episode": "Internet buildout (1995–2002)",
     "outcome": "Real revolution + valuation bubble; infrastructure overbuilt; enduring winners emerged post-crash",
     "marketImpact": "severe", "recoveryYears": 5},
    {"type": "trade_war", "episode": "2018–2019 US–China tariffs",
     "outcome": "Supply chains rerouted; specific sectors hit; broad market absorbed it",
     "marketImpact": "mild", "recoveryYears": 1},
    {"type": "technology_disruption", "episode": "Smartphone displacement of incumbents (2007–2013)",
     "outcome": "Category leaders (Nokia, BlackBerry) lost dominance within 5 years despite strong financials",
     "marketImpact": "moderate", "recoveryYears": 0},
    {"type": "supply_chain_disruption", "episode": "2021 global chip shortage",
     "outcome": "Auto/electronics production cut; chip capex boom followed; normalized in ~2 years",
     "marketImpact": "moderate", "recoveryYears": 2},
]


def _load() -> list:
    try:
        with open(_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _dump(learned: list) -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    tmp = _PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(learned, f, ensure_ascii=False)
    os.replace(tmp, _PATH)


def add_analogue(pattern_type: str, episode: str, outcome: str,
                 market_impact: str, recovery_years: float,
                 source_event: str = "") -> dict:
    """Append a newly resolved episode to the analogue library."""
    analogue = {"type": pattern_type, "episode": episode, "outcome": outcome,
                "marketImpact": market_impact, "recoveryYears": recovery_years,
                "sourceEvent": source_event, "origin": "learned"}
    with _lock:
        learned = _load()
        learned.append(analogue)
        _dump(learned)
    return analogue


def find_analogues(pattern_type: str) -> dict:
    """
    Retrieve historical analogues for a situation type, with base rates.
    The comparison grounds probability estimates in what actually happened
    before, instead of intuition.
    """
    all_analogues = [a for a in SEED_ANALOGUES + _load() if a["type"] == pattern_type]
    if not all_analogues:
        return {"type": pattern_type, "analogues": [], "baseRates": None}

    impacts = [a["marketImpact"] for a in all_analogues]
    recov   = [a["recoveryYears"] for a in all_analogues]
    return {
        "type":      pattern_type,
        "analogues": all_analogues,
        "baseRates": {
            "episodes":            len(all_analogues),
            "severeShare":         round(impacts.count("severe") / len(impacts), 2),
            "medianRecoveryYears": sorted(recov)[len(recov) // 2],
        },
    }
