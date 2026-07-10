"""
World Intelligence — the global layer above company analysis.

    World Intelligence
    ↓  Global Events        (global_events.py — permanent, append-only)
    ↓  Causal Intelligence  (causal_graph.py — chains of consequences)
    ↓  Industries
    ↓  Companies            (future_relevance engine consumes this context)
    ↓  Portfolios
    ↓  Individual Investor

Components:
    themes.py         Living World Model — state/confidence/direction/momentum
                      per global theme, with permanent historical evolution
    causal_graph.py   Causal Intelligence Engine — seeded + learned causal
                      edges; trace_consequences() follows chains with decay
    global_events.py  Global Event Memory — every meaningful event stored
                      forever; resolution appends outcome + lessons
    patterns.py       Pattern Recognition — historical analogue library with
                      base rates ("what usually follows this?")
    triage.py         Adaptive Intelligence — nothing / minor / major triage

Companies are never analyzed in isolation: the future_relevance engine reads
this layer for macro stability, causal context, and historical base rates.

Note: services/world_model.py (company scan patterns) and event_memory.py
(business-event lifecycle) remain the company-level layers below this one.
"""

from services.world_intelligence.themes import get_world_model, get_theme, update_theme, THEMES
from services.world_intelligence.causal_graph import trace_consequences, get_edges, add_learned_edge
from services.world_intelligence.global_events import record_event, resolve_event, get_events, lessons_learned
from services.world_intelligence.patterns import find_analogues, add_analogue, PATTERN_TYPES
from services.world_intelligence.triage import classify_information, TriageVerdict

__all__ = [
    "get_world_model", "get_theme", "update_theme", "THEMES",
    "trace_consequences", "get_edges", "add_learned_edge",
    "record_event", "resolve_event", "get_events", "lessons_learned",
    "find_analogues", "add_analogue", "PATTERN_TYPES",
    "classify_information", "TriageVerdict",
]
