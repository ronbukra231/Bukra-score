"""
Strongly-typed data model for the Portfolio Simulator.

Dataclasses double as the persistence shape (to_dict/from_dict) and the API
contract. All financial state lives server-side; the client never supplies
quantities, prices, fees or portfolio values that get trusted directly.
"""

from dataclasses import dataclass, field, asdict
from typing import Optional, Any
from enum import Enum


class TransactionType(str, Enum):
    SIMULATED_DEPOSIT      = "SIMULATED_DEPOSIT"
    SIMULATED_WITHDRAWAL   = "SIMULATED_WITHDRAWAL"
    SIMULATED_BUY          = "SIMULATED_BUY"
    SIMULATED_SELL         = "SIMULATED_SELL"
    SIMULATED_DIVIDEND     = "SIMULATED_DIVIDEND"
    SIMULATED_FEE          = "SIMULATED_FEE"
    SIMULATED_FX_CONVERSION = "SIMULATED_FX_CONVERSION"


class RecommendationType(str, Enum):
    ADD_POSITION       = "ADD_POSITION"
    INCREASE_POSITION  = "INCREASE_POSITION"
    REDUCE_POSITION    = "REDUCE_POSITION"
    EXIT_POSITION      = "EXIT_POSITION"
    HOLD_POSITION      = "HOLD_POSITION"
    REVIEW_POSITION    = "REVIEW_POSITION"
    ADD_CASH           = "ADD_CASH"
    REBALANCE          = "REBALANCE"


class RecommendationStatus(str, Enum):
    PENDING            = "PENDING"
    VIEWED             = "VIEWED"
    APPROVED           = "APPROVED"
    REJECTED           = "REJECTED"
    EXPIRED            = "EXPIRED"
    SIMULATED_EXECUTED = "SIMULATED_EXECUTED"
    CANCELLED          = "CANCELLED"


class AuditEventType(str, Enum):
    PORTFOLIO_CREATED           = "PORTFOLIO_CREATED"
    VIRTUAL_FUNDS_ADDED         = "VIRTUAL_FUNDS_ADDED"
    RECOMMENDATION_CREATED      = "RECOMMENDATION_CREATED"
    RECOMMENDATION_VIEWED       = "RECOMMENDATION_VIEWED"
    RECOMMENDATION_APPROVED     = "RECOMMENDATION_APPROVED"
    RECOMMENDATION_REJECTED     = "RECOMMENDATION_REJECTED"
    SIMULATED_ORDER_CREATED     = "SIMULATED_ORDER_CREATED"
    SIMULATED_ORDER_EXECUTED    = "SIMULATED_ORDER_EXECUTED"
    SIMULATED_ORDER_FAILED      = "SIMULATED_ORDER_FAILED"
    HOLDING_CREATED             = "HOLDING_CREATED"
    HOLDING_UPDATED             = "HOLDING_UPDATED"
    HOLDING_CLOSED               = "HOLDING_CLOSED"
    PORTFOLIO_RECALCULATED      = "PORTFOLIO_RECALCULATED"
    PERFORMANCE_SNAPSHOT_CREATED = "PERFORMANCE_SNAPSHOT_CREATED"
    BENCHMARK_UPDATED           = "BENCHMARK_UPDATED"
    DIVIDEND_SIMULATED          = "DIVIDEND_SIMULATED"
    FEE_SIMULATED               = "FEE_SIMULATED"
    USER_RISK_PROFILE_UPDATED   = "USER_RISK_PROFILE_UPDATED"


def _to_dict(obj) -> dict:
    d = asdict(obj)
    for k, v in list(d.items()):
        if isinstance(v, Enum):
            d[k] = v.value
    return d


@dataclass
class Portfolio:
    id: str
    userId: str
    name: str
    baseCurrency: str
    benchmarkSymbol: str
    riskProfile: str
    initialCapital: float
    currentCash: float
    totalDeposits: float
    totalWithdrawals: float
    realizedGainLoss: float
    unrealizedGainLoss: float
    dividendIncome: float
    totalFees: float
    currentValue: float
    createdAt: str
    updatedAt: str
    status: str = "active"
    isSimulation: bool = True
    methodologyVersion: str = "1.0.0"

    def to_dict(self) -> dict:
        return _to_dict(self)


@dataclass
class PortfolioHolding:
    id: str
    portfolioId: str
    companyId: str          # ticker used as the company identifier (no company table exists)
    ticker: str
    quantity: float
    averageCost: float
    totalCostBasis: float
    currentPrice: Optional[float]
    currentMarketValue: Optional[float]
    unrealizedGainLoss: Optional[float]
    unrealizedGainLossPercent: Optional[float]
    realizedGainLoss: float
    portfolioWeight: Optional[float]
    tradingCurrency: str
    openedAt: str
    updatedAt: str
    reasonForHolding: str = ""
    closedAt: Optional[str] = None
    status: str = "open"     # open | closed

    def to_dict(self) -> dict:
        return _to_dict(self)


@dataclass
class PortfolioTransaction:
    id: str
    portfolioId: str
    transactionType: str
    ticker: Optional[str]
    quantity: Optional[float]
    requestedPrice: Optional[float]
    executedPrice: Optional[float]
    grossAmount: float
    simulatedFee: float
    simulatedFxCost: float
    netAmount: float
    transactionCurrency: str
    portfolioCurrency: str
    fxRate: float
    status: str
    createdAt: str
    holdingId: Optional[str] = None
    recommendationId: Optional[str] = None
    approvedByUser: bool = False
    approvedAt: Optional[str] = None
    simulatedExecutedAt: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return _to_dict(self)


@dataclass
class PortfolioRecommendation:
    id: str
    portfolioId: str
    companyId: str
    ticker: str
    recommendationType: str
    recommendationStatus: str
    currentWeight: float
    targetWeight: float
    proposedAmount: Optional[float]
    proposedQuantity: Optional[float]
    reasonSummary: str
    supportingFactors: list
    riskFactors: list
    expectedPortfolioImpact: dict
    bukraScoreSnapshot: Optional[int]
    valuationScoreSnapshot: Optional[int]
    bubbleRiskSnapshot: Optional[int]
    confidenceSnapshot: Optional[str]
    currentPriceSnapshot: Optional[float]
    fairValueSnapshot: Optional[dict]
    methodologyVersion: str
    createdAt: str
    viewedAt: Optional[str] = None
    approvedAt: Optional[str] = None
    rejectedAt: Optional[str] = None
    expiredAt: Optional[str] = None
    userDecisionNote: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return _to_dict(self)


@dataclass
class PortfolioAuditEvent:
    id: str
    portfolioId: str
    eventType: str
    actorType: str          # "user" | "system"
    actorId: str
    eventTimestamp: str
    explanation: str
    methodologyVersion: str
    recommendationId: Optional[str] = None
    transactionId: Optional[str] = None
    beforeState: dict = field(default_factory=dict)
    afterState: dict = field(default_factory=dict)
    sourceDataTimestamp: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return _to_dict(self)


@dataclass
class PortfolioSnapshot:
    portfolioId: str
    snapshotDate: str
    portfolioValue: float
    cashValue: float
    holdingsValue: float
    totalDeposits: float
    totalWithdrawals: float
    cumulativeFees: float
    cumulativeDividends: float
    dailyReturn: Optional[float] = None
    cumulativeTimeWeightedReturn: Optional[float] = None
    benchmarkValue: Optional[float] = None
    benchmarkReturn: Optional[float] = None

    def to_dict(self) -> dict:
        return _to_dict(self)
