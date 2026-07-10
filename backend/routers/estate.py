"""
Estate rooms API — read-only endpoints for the Research Estate.

  /api/estate/portfolio  → Portfolio Office (read-only cockpit)
  /api/estate/world      → World Intelligence Center (themes + events)
  /api/estate/library    → The Library (every company ever researched)
  /api/estate/brain      → The Strategy Room (how Bukra thinks)

Exposes finished intelligence only — never internal prompts, judge weights,
or intermediate calculations.
"""

import logging

from fastapi import APIRouter, Request, Query

from limiter import limiter
from services.portfolio import build_portfolio_view
from services.world_intelligence import (
    get_world_model, get_events, trace_consequences, find_analogues, PATTERN_TYPES,
)
from services.future_relevance import memory as fr_memory
from services.future_relevance import build_timeline
from services.future_relevance.ledger import calibration, get_ledger
from services.world_intelligence.causal_graph import get_edges

logger = logging.getLogger("bukra.estate")
router = APIRouter(prefix="/api/estate", tags=["estate"])


@router.get("/portfolio")
@limiter.limit("30/minute")
def portfolio_office(request: Request):
    """Read-only portfolio cockpit. Bukra never places trades."""
    return build_portfolio_view()


@router.get("/world")
@limiter.limit("30/minute")
def world_intelligence(request: Request):
    """Living world model + global event memory for the map room."""
    return {
        "themes": get_world_model(),
        "events": get_events()[-100:],       # most recent first is client-side
        "patternTypes": PATTERN_TYPES,
    }


@router.get("/world/chains")
@limiter.limit("30/minute")
def causal_chains(request: Request, cause: str = Query(..., max_length=60)):
    """Chains of consequences from a cause node, plus historical analogues."""
    chains = trace_consequences(cause)
    return {"cause": cause, "chains": chains[:25]}


@router.get("/world/analogues")
@limiter.limit("30/minute")
def historical_analogues(request: Request, pattern: str = Query(..., max_length=40)):
    """What usually happened historically in situations like this."""
    return find_analogues(pattern)


@router.get("/library")
@limiter.limit("30/minute")
def library(request: Request):
    """
    Every company Bukra has ever researched: latest conclusion, thesis
    version, and how many research passes exist. Knowledge, not files.
    """
    shelf = []
    for symbol, history in fr_memory._load().items():
        if not history:
            continue
        latest = history[-1]
        shelf.append({
            "symbol":        symbol,
            "reports":       len(history),
            "firstResearched": history[0].get("timestamp"),
            "lastResearched":  latest.get("timestamp"),
            "score":         latest.get("score"),
            "confidence":    latest.get("confidence"),
            "status":        latest.get("status"),
            "thesisVersion": (latest.get("thesis") or {}).get("version"),
        })
    shelf.sort(key=lambda b: b["lastResearched"] or "", reverse=True)
    return {"companies": shelf}


@router.get("/library/{symbol}")
@limiter.limit("30/minute")
def library_book(request: Request, symbol: str):
    """One company's full research book: timeline + evolving thesis."""
    sym     = symbol.upper()
    history = fr_memory.get_history(sym)
    latest  = history[-1] if history else None
    return {
        "symbol":   sym,
        "timeline": build_timeline(sym),
        "thesis":   (latest or {}).get("thesis"),
        "predictions": [
            {"date": p["date"], "score": p["score"], "confidence": p["confidence"],
             "conviction": p["conviction"], "status": p["status"], "horizon": p["horizon"]}
            for p in get_ledger(symbol=sym)
        ],
    }


@router.get("/brain")
@limiter.limit("30/minute")
def strategy_room(request: Request):
    """
    How Bukra thinks — causal graph, calibration, and learning-loop state.
    Finished intelligence only; internal engine parameters stay internal.
    """
    edges = get_edges()
    cal   = calibration()
    return {
        "causalGraph": {
            "edges": [{"cause": e["cause"], "effect": e["effect"],
                       "polarity": e["polarity"], "strength": e["strength"],
                       "origin": e["origin"]} for e in edges],
        },
        "calibration": cal,
        "learning": {
            "pendingPredictions":  cal["pendingPredictions"],
            "resolvedPredictions": cal["resolvedPredictions"],
        },
    }
