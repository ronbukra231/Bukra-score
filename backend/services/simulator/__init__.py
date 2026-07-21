"""
Bukra Portfolio Simulator — Phase 1.

Virtual-money-only portfolio management: creation, recommendations, an
explicit approval workflow, simulated execution, performance tracking,
benchmark comparison, Portfolio Health, and a permanent audit trail.

    NO real broker connection.
    NO real trades.
    NO real deposits or withdrawals.
    NO payment flows.

Modules:
    config.py           central, versioned simulation methodology
    models.py            typed dataclasses / enums (API + persistence contract)
    store.py             per-user JSON persistence + per-user lock (ownership
                          boundary + concurrency guard in one)
    accounting.py         cost basis, realized/unrealized gains, fees, FX
    pricing.py            real market price / FX lookups (existing provider only)
    execution.py          simulated execution engine — never calls a broker
    recommendations.py    deterministic, rule-based recommendation generation
    performance.py        snapshots, time-weighted return, XIRR
    benchmark.py           normalized benchmark comparison
    health.py             Portfolio Health diagnostic
    dividends.py           simulated dividend crediting from real ex-div data
    audit.py               append-only audit trail
    service.py             orchestration layer — the router's only import
"""

from services.simulator.service import (
    SimulatorError, create_portfolio, add_virtual_funds, set_risk_profile,
    get_dashboard, get_performance, get_health, get_activity, get_audit_trail,
    get_decision_history, get_transactions, generate_recommendations,
    get_recommendations, view_recommendation, reject_recommendation, approve_recommendation,
)
from services.simulator.config import METHODOLOGY_VERSION

__all__ = [
    "SimulatorError", "create_portfolio", "add_virtual_funds", "set_risk_profile",
    "get_dashboard", "get_performance", "get_health", "get_activity", "get_audit_trail",
    "get_decision_history", "get_transactions", "generate_recommendations",
    "get_recommendations", "view_recommendation", "reject_recommendation", "approve_recommendation",
    "METHODOLOGY_VERSION",
]
