"""
Event Intelligence API — Mission Alpha 2.5

Endpoints for business event ingestion, company thesis, market themes,
and cross-sector relationship visualization.

The Bukra Score is NEVER modified by these endpoints.
Events create hypotheses; financial statements confirm or reject them.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException

import services.event_engine as engine
import services.event_memory as memory
import services.news_ingestion as ingestion

logger = logging.getLogger("bukra.events")
router = APIRouter(tags=["events"])


# ── Company event intelligence ────────────────────────────────────────────────

@router.get("/api/events/company/{symbol}")
def company_events(symbol: str, status: Optional[str] = None):
    """
    All events for a company + derived business thesis.
    ?status=Monitoring,Confirmed  — comma-separated filter
    """
    sym = symbol.upper()
    status_filter = [s.strip() for s in status.split(",")] if status else None
    events = memory.get_company_events(sym, status_filter)
    thesis = engine.derive_thesis(events)
    return {
        "symbol": sym,
        "events": events,
        "thesis": thesis,
        "event_count": len(events),
    }


# ── Market-wide views ─────────────────────────────────────────────────────────

@router.get("/api/events/market")
def market_events(limit: int = 50):
    """All recent events across all companies, newest first."""
    return {"events": memory.get_all_events(limit)}


@router.get("/api/events/themes")
def market_themes():
    """
    Aggregated theme intelligence for the Market Intelligence page.
    Shows confirmation rates, company spread, and sentiment distribution per category.
    """
    return memory.get_market_themes()


@router.get("/api/events/relationships")
def cross_sector_relationships():
    """
    Events that affect multiple companies — used for chain/tree visualization.
    Example: Nvidia AI infrastructure expansion → networking suppliers → power companies.
    """
    return {"relationships": memory.get_cross_sector_relationships()}


@router.get("/api/events/stats")
def event_stats():
    return memory.get_stats()


@router.get("/api/events/providers")
def list_providers():
    """Which news providers are registered and available."""
    return {"providers": ingestion.list_providers()}


# ── Ingestion ─────────────────────────────────────────────────────────────────

@router.post("/api/events/ingest")
def ingest_event(payload: dict):
    """
    Manual event ingestion — for testing and future provider integrations.
    Required fields: symbol, company, headline, summary, source, url,
                     category, importance, sentiment, confidence
    """
    required = ["symbol", "company", "headline", "summary", "source",
                "url", "category", "importance", "sentiment", "confidence"]
    missing = [f for f in required if f not in payload]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing fields: {missing}")

    event = engine.build_event(**{k: payload[k] for k in payload if k in [
        "symbol", "company", "headline", "summary", "source", "url",
        "category", "importance", "sentiment", "confidence",
        "affected_segments", "affected_companies", "expected_financial_effects",
        "time_horizon", "requires_confirmation", "timestamp",
    ]})
    eid = memory.store_event(event)
    logger.info("[events] ingested event %s for %s", eid, payload.get("symbol"))
    return {"id": eid, "status": "stored"}


# ── Lifecycle management ──────────────────────────────────────────────────────

@router.post("/api/events/{event_id}/advance")
def advance_event(event_id: str, payload: dict):
    """
    Advance an event's lifecycle status.
    Body: { "status": "Confirmed"|"Rejected"|"Monitoring"|"Analyzing", "evidence": "..." }
    """
    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(status_code=422, detail="status required")
    ok = memory.advance_status(event_id, new_status, payload.get("evidence"))
    if not ok:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"success": True, "event_id": event_id, "new_status": new_status}


@router.post("/api/events/{event_id}/evidence")
def add_evidence(event_id: str, payload: dict):
    """Add supporting or contradicting evidence to an event."""
    evidence = payload.get("evidence")
    supports = payload.get("supports", True)
    if not evidence:
        raise HTTPException(status_code=422, detail="evidence required")
    ok = memory.add_evidence(event_id, evidence, supports)
    if not ok:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"success": True}
