"""
Portfolio data model — read-only by construction.

There is deliberately NO order, trade, or transfer type anywhere in this
package. Bukra advises; execution always happens at the broker. The absence
of write models is a security guarantee, not an omission.
"""

from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class Holding:
    symbol: str
    name: str
    quantity: float
    avg_cost: Optional[float]        # per share, account currency
    market_value: Optional[float]    # current, account currency
    currency: str = "USD"
    sector: str = ""
    country: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class PortfolioSnapshot:
    """One broker account, read at one moment in time."""
    broker_id: str
    account_label: str               # display only — never the real account number
    as_of: str                       # ISO timestamp
    holdings: list = field(default_factory=list)   # [Holding]
    cash: float = 0.0
    currency: str = "USD"

    def to_dict(self) -> dict:
        return {
            "brokerId":     self.broker_id,
            "accountLabel": self.account_label,
            "asOf":         self.as_of,
            "holdings":     [h.to_dict() for h in self.holdings],
            "cash":         self.cash,
            "currency":     self.currency,
        }
