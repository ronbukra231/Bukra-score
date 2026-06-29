"""Bukra Intelligence Engine — API endpoints."""
import logging
from fastapi import APIRouter, Request
from limiter import limiter
from services.scan_history import get_radar_signals, get_previous_snapshot

logger = logging.getLogger("bukra.intelligence")
router = APIRouter(prefix="/api", tags=["intelligence"])


@router.get("/intelligence/radar")
@limiter.limit("30/minute")
def radar(request: Request):
    """Aggregated market signals from the last intelligence scan."""
    return get_radar_signals()


@router.get("/intelligence/snapshot/{symbol}")
@limiter.limit("30/minute")
def snapshot(request: Request, symbol: str):
    """Previous intelligence snapshot for a symbol (used for score-change comparison)."""
    snap = get_previous_snapshot(symbol.upper())
    return snap or {"symbol": symbol.upper(), "score": None, "breakdown": {}}
