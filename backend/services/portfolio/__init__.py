"""
Portfolio Office — read-only broker architecture.

    UI (Portfolio Office cockpit)
      ↓  view.py — one aggregated view across all connected brokers,
      ↓            enriched with Bukra Score / Future Relevance / Conviction
      ↓  registry.py — supported brokers + adapter registration
      ↓  base.py — BrokerAdapter contract (read-only, no order methods ever)
      ↓  models.py — Holding / PortfolioSnapshot

Bukra never places trades. Execution always happens at the broker.
"""

from services.portfolio.registry import SUPPORTED_BROKERS, get_adapter, connected_snapshots
from services.portfolio.base import BrokerAdapter
from services.portfolio.models import Holding, PortfolioSnapshot
from services.portfolio.view import build_portfolio_view

__all__ = [
    "SUPPORTED_BROKERS", "get_adapter", "connected_snapshots",
    "BrokerAdapter", "Holding", "PortfolioSnapshot", "build_portfolio_view",
]
