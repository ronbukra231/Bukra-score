"""
BrokerAdapter — the contract every future broker integration implements.

Read-only by design: the interface exposes holdings, cash and history.
It has no method for placing, modifying or cancelling orders, and none may
ever be added — Bukra never trades.

To integrate a broker (future sprint):
  1. Subclass BrokerAdapter, implement the three read methods.
  2. Handle the broker's OAuth/API-key flow inside the adapter.
  3. Register it in registry.py with status "available".
Nothing above the adapter changes.
"""

from abc import ABC, abstractmethod

from services.portfolio.models import PortfolioSnapshot


class BrokerAdapter(ABC):
    broker_id: str = ""

    @abstractmethod
    def is_connected(self) -> bool:
        """Whether valid credentials exist for this user."""
        ...

    @abstractmethod
    def fetch_snapshot(self) -> PortfolioSnapshot:
        """Current holdings + cash. Raises if not connected."""
        ...

    @abstractmethod
    def fetch_history(self, days: int = 365) -> list:
        """Historical portfolio values: [{date, totalValue}]. Read-only."""
        ...
