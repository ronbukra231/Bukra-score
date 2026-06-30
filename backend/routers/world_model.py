"""World Model & Knowledge Graph — API endpoints."""

import logging
from fastapi import APIRouter

import services.world_model   as wm
import services.knowledge_graph as kg

logger = logging.getLogger("bukra.world_model")
router = APIRouter(tags=["world-model"])


@router.get("/api/world-model/stats")
def world_model_stats():
    """
    High-level view of what the world model has learned so far.
    Returns pattern counts, observation totals, confidence distribution,
    recently strengthened/weakened beliefs.
    """
    wm_stats = wm.get_stats()
    kg_stats = kg.get_stats()
    return {**wm_stats, "graph": kg_stats}


@router.get("/api/world-model/patterns")
def world_model_patterns():
    """
    All patterns Bukra has observed, sorted by confidence descending.
    Each pattern contains its signature, companies, frequency, success_rate,
    supporting and contradicting evidence.
    """
    patterns = wm.get_all_patterns()
    return {
        "patterns": patterns,
        "total":    len(patterns),
    }


@router.get("/api/world-model/company/{symbol}")
def company_world_model(symbol: str):
    """
    Which world-model patterns this company's scans have contributed observations to.
    Enables the question: 'This company resembles Pattern #184 seen in 17 others.'
    """
    sym      = symbol.upper()
    patterns = wm.get_company_patterns(sym)
    return {
        "symbol":   sym,
        "patterns": patterns,
        "total":    len(patterns),
    }


@router.get("/api/world-model/knowledge")
def knowledge_graph():
    """
    Full knowledge graph: nodes (patterns, sectors, signals, outcomes, score tiers)
    and edges (relationships built from real scans, weighted by observation count).
    """
    return kg.get_graph()
