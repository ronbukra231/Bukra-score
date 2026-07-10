"""
Causal Intelligence Engine — Bukra thinks in chains of consequences,
not isolated news.

The causal graph maps how the world influences markets:
    strait_of_hormuz_closure → oil_supply(-) → oil_prices(+) → inflation(+)
    → interest_rates(+) → consumer_spending(-) → ...

Seeded with canonical, well-established macro relationships. Learned edges
are added at runtime (append-only, with confidence) as the Learning Loop
confirms or rejects causal hypotheses.
"""

import json
import os
import threading
from datetime import datetime, timezone

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
_PATH     = os.path.join(_DATA_DIR, "causal_graph.json")
_lock     = threading.Lock()

# Canonical seed edges: (cause, effect, polarity, strength 0-1, note)
# polarity +1: cause increase → effect increase; -1: cause increase → effect decrease
SEED_EDGES = [
    ("oil_supply_disruption", "oil_prices",          +1, 0.9, "supply shock raises prices"),
    ("oil_prices",            "inflation",           +1, 0.8, "energy feeds through CPI"),
    ("inflation",             "interest_rates",      +1, 0.8, "central banks respond to inflation"),
    ("interest_rates",        "consumer_spending",   -1, 0.7, "borrowing costs suppress demand"),
    ("interest_rates",        "equity_valuations",   -1, 0.7, "discount rates compress multiples"),
    ("consumer_spending",     "consumer_cyclical",   +1, 0.8, "discretionary revenue follows demand"),
    ("supply_chain_disruption", "input_costs",       +1, 0.8, "scarcity raises input costs"),
    ("input_costs",           "corporate_margins",   -1, 0.7, "costs compress margins"),
    ("ai_breakthrough",       "semiconductor_demand", +1, 0.8, "AI capex drives chip demand"),
    ("ai_breakthrough",       "labor_automation",    +1, 0.6, "capability shifts labor economics"),
    ("geopolitical_conflict", "defense_spending",    +1, 0.8, "conflict raises defense budgets"),
    ("geopolitical_conflict", "supply_chain_disruption", +1, 0.6, "conflict disrupts trade routes"),
    ("regulation_tightening", "compliance_costs",    +1, 0.8, "rules raise cost of doing business"),
    ("rate_cuts",             "equity_valuations",   +1, 0.7, "easing expands multiples"),
    ("currency_devaluation",  "export_competitiveness", +1, 0.6, "weaker currency helps exporters"),
]

MAX_CHAIN_DEPTH = 6


def _load() -> dict:
    try:
        with open(_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"edges": [], "learned": []}


def _dump(data: dict) -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    tmp = _PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, _PATH)


def get_edges() -> list:
    """All causal edges: canonical seeds + runtime-learned."""
    seeds = [
        {"cause": c, "effect": e, "polarity": p, "strength": s, "note": n, "origin": "seed"}
        for c, e, p, s, n in SEED_EDGES
    ]
    return seeds + _load().get("learned", [])


def add_learned_edge(cause: str, effect: str, polarity: int, strength: float,
                     note: str, source_event: str = "") -> dict:
    """Append a causal relationship the Learning Loop discovered. Never removes seeds."""
    edge = {
        "cause": cause, "effect": effect, "polarity": polarity,
        "strength": round(strength, 2), "note": note, "origin": "learned",
        "sourceEvent": source_event,
        "learnedAt": datetime.now(timezone.utc).isoformat(),
    }
    with _lock:
        data = _load()
        data.setdefault("learned", []).append(edge)
        _dump(data)
    return edge


def trace_consequences(cause: str, max_depth: int = MAX_CHAIN_DEPTH) -> list:
    """
    Follow chains of consequences from a cause node.
    Returns chains: [{"path": [nodes], "polarity": ±1, "strength": compound}]
    Strength decays multiplicatively along the chain — distant consequences
    are inherently less certain.
    """
    edges = get_edges()
    by_cause: dict = {}
    for e in edges:
        by_cause.setdefault(e["cause"], []).append(e)

    chains = []

    def walk(node, path, polarity, strength, depth):
        if depth >= max_depth:
            return
        for e in by_cause.get(node, []):
            if e["effect"] in path:          # no cycles
                continue
            new_pol      = polarity * e["polarity"]
            new_strength = strength * e["strength"]
            new_path     = path + [e["effect"]]
            chains.append({"path": new_path, "polarity": new_pol,
                           "strength": round(new_strength, 3)})
            walk(e["effect"], new_path, new_pol, new_strength, depth + 1)

    walk(cause, [cause], +1, 1.0, 0)
    return sorted(chains, key=lambda c: -c["strength"])
