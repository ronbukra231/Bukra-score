"""
Bukra Portfolio Simulator API — virtual-money-only.

Every endpoint requires a verified Supabase user (get_current_user_id) and
operates only on that user's own portfolio file — there is no portfolioId
path parameter anywhere, so a user cannot even address another user's data.
All financial calculations happen server-side; the client never supplies a
quantity, price, fee, or portfolio value that gets trusted directly.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from limiter import limiter
from services.auth import get_current_user_id
from services.simulator import (
    SimulatorError, create_portfolio, add_virtual_funds, set_risk_profile,
    get_dashboard, get_performance, get_health, get_activity, get_audit_trail,
    get_decision_history, get_transactions, generate_recommendations, generate_guided_recommendation,
    get_recommendations, view_recommendation, reject_recommendation, approve_recommendation,
)
from services.simulator.config import RISK_PROFILES, SUPPORTED_CURRENCIES, EXECUTION, DEFAULT_BENCHMARK

logger = logging.getLogger("bukra.simulator.router")
router = APIRouter(prefix="/api/simulator", tags=["simulator"])


def _lang(request: Request) -> str:
    l = request.query_params.get("lang", "he")
    return l if l in ("he", "en") else "he"


def _handle(fn, _err_lang, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except SimulatorError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


# ── Request schemas ───────────────────────────────────────────────────────────

class CreatePortfolioBody(BaseModel):
    name: str = Field(default="Bukra Simulation Portfolio", max_length=80)
    baseCurrency: str = Field(pattern="^(USD|ILS)$")
    initialCapital: float = Field(gt=0, le=100_000_000)
    riskProfile: str
    benchmarkSymbol: Optional[str] = Field(default=None, max_length=20)


class AddFundsBody(BaseModel):
    amount: float = Field(gt=0, le=100_000_000)


class RiskProfileBody(BaseModel):
    riskProfile: str


class ApproveBody(BaseModel):
    confirmed: bool = Field(description="Must be true — the explicit simulation checkbox.")


class RejectBody(BaseModel):
    note: Optional[str] = Field(default=None, max_length=500)


class GuidedNextBody(BaseModel):
    excludeTickers: list[str] = Field(default_factory=list, max_length=200)


# ── Config (public, read-only) ────────────────────────────────────────────────

@router.get("/config")
@limiter.limit("30/minute")
def simulator_config(request: Request):
    return {
        "riskProfiles": list(RISK_PROFILES.keys()),
        "supportedCurrencies": list(SUPPORTED_CURRENCIES),
        "defaultBenchmark": DEFAULT_BENCHMARK,
        "minTradeAmount": EXECUTION["min_trade_amount"],
        "isSimulation": True,
    }


# ── Portfolio lifecycle ─────────────────────────────────────────────────────────

@router.post("/portfolio")
@limiter.limit("10/minute")
def create_portfolio_endpoint(request: Request, body: CreatePortfolioBody,
                              user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(create_portfolio, lang, user_id, name=body.name, base_currency=body.baseCurrency,
                   initial_capital=body.initialCapital, risk_profile=body.riskProfile,
                   benchmark_symbol=body.benchmarkSymbol, lang=lang)


@router.get("/dashboard")
@limiter.limit("30/minute")
def dashboard_endpoint(request: Request, user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(get_dashboard, lang, user_id, lang=lang)


@router.post("/deposit")
@limiter.limit("20/minute")
def deposit_endpoint(request: Request, body: AddFundsBody, user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(add_virtual_funds, lang, user_id, body.amount, lang=lang)


@router.put("/risk-profile")
@limiter.limit("20/minute")
def risk_profile_endpoint(request: Request, body: RiskProfileBody, user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(set_risk_profile, lang, user_id, body.riskProfile, lang=lang)


# ── Performance / health / allocation ────────────────────────────────────────────

@router.get("/performance")
@limiter.limit("30/minute")
def performance_endpoint(request: Request, period: str = Query("1Y", pattern="^(1D|1W|1M|3M|1Y|ALL)$"),
                         user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(get_performance, lang, user_id, period=period, lang=lang)


@router.get("/health")
@limiter.limit("20/minute")
def health_endpoint(request: Request, user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(get_health, lang, user_id, lang=lang)


# ── Recommendations / Decision Center ────────────────────────────────────────────

@router.post("/recommendations/generate")
@limiter.limit("10/minute")
def generate_recommendations_endpoint(request: Request, user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(generate_recommendations, lang, user_id, lang=lang)


@router.post("/builder/next")
@limiter.limit("30/minute")
def guided_builder_next_endpoint(request: Request, body: GuidedNextBody,
                                 user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    rec = _handle(generate_guided_recommendation, lang, user_id,
                  exclude_tickers=body.excludeTickers, lang=lang)
    return rec if rec is not None else {"done": True}


@router.get("/recommendations")
@limiter.limit("30/minute")
def list_recommendations_endpoint(request: Request, status: Optional[str] = None,
                                  user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(get_recommendations, lang, user_id, status=status, lang=lang)


@router.post("/recommendations/{rec_id}/view")
@limiter.limit("60/minute")
def view_recommendation_endpoint(request: Request, rec_id: str, user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(view_recommendation, lang, user_id, rec_id, lang=lang)


@router.post("/recommendations/{rec_id}/approve")
@limiter.limit("20/minute")
def approve_recommendation_endpoint(request: Request, rec_id: str, body: ApproveBody,
                                    user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(approve_recommendation, lang, user_id, rec_id, body.confirmed, lang=lang)


@router.post("/recommendations/{rec_id}/reject")
@limiter.limit("20/minute")
def reject_recommendation_endpoint(request: Request, rec_id: str, body: RejectBody,
                                   user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(reject_recommendation, lang, user_id, rec_id, note=body.note, lang=lang)


# ── Activity / audit / decision history / transactions ───────────────────────────

@router.get("/activity")
@limiter.limit("30/minute")
def activity_endpoint(request: Request, limit: int = Query(100, ge=1, le=500),
                      user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(get_activity, lang, user_id, limit=limit, lang=lang)


@router.get("/audit")
@limiter.limit("20/minute")
def audit_endpoint(request: Request, user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(get_audit_trail, lang, user_id, lang=lang)


@router.get("/decisions")
@limiter.limit("30/minute")
def decisions_endpoint(request: Request, status: Optional[str] = None, ticker: Optional[str] = None,
                       recommendationType: Optional[str] = None,
                       user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(get_decision_history, lang, user_id, status=status, ticker=ticker,
                   rtype=recommendationType, lang=lang)


@router.get("/transactions")
@limiter.limit("30/minute")
def transactions_endpoint(request: Request, user_id: str = Depends(get_current_user_id)):
    lang = _lang(request)
    return _handle(get_transactions, lang, user_id, lang=lang)
