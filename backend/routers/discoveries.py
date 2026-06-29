"""Bukra Discoveries API — serves the Research Journal page."""
from fastapi import APIRouter, Request
from limiter import limiter
from services.knowledge_base import get_all_discoveries, get_research_notes

router = APIRouter(prefix="/api", tags=["discoveries"])


@router.get("/discoveries")
@limiter.limit("30/minute")
def discoveries(request: Request):
    """
    Returns all discoveries and recent research notes.
    Used by the Research Journal page.
    """
    all_disc   = get_all_discoveries()
    notes      = get_research_notes(limit=15)
    active     = [d for d in all_disc if d.get("status") in ("emerging", "confirmed")]
    confirmed  = [d for d in all_disc if d.get("status") == "confirmed"]
    emerging   = [d for d in all_disc if d.get("status") == "emerging"]
    historical = [d for d in all_disc if d.get("status") == "historical"]

    # Sort active: importance High first, then by confidence descending
    _importance_order = {"High": 0, "Medium": 1, "Low": 2}
    active.sort(key=lambda d: (
        _importance_order.get(d.get("importance", "Low"), 2),
        -(d.get("confidence") or 0),
    ))

    return {
        "discoveries":           all_disc,
        "active_discoveries":    active,
        "confirmed_discoveries": confirmed,
        "emerging_discoveries":  emerging,
        "historical_discoveries": historical,
        "research_notes":        list(reversed(notes)),
        "stats": {
            "total":            len(all_disc),
            "active":           len(active),
            "confirmed":        len(confirmed),
            "emerging":         len(emerging),
            "historical":       len(historical),
            "scans_analyzed":   len(notes),
        },
    }
