"""
Financial input normalization for the Valuation Engine.

Takes the raw provider payloads already used by the platform
(get_company_info / get_five_year_financials) and produces one sanitized
NormalizedInputs object. Every derived value is a documented calculation on
real provider data; anything unavailable is recorded in missing_inputs and
never silently invented.
"""

import math
from dataclasses import dataclass, field
from typing import Optional


def _num(v) -> Optional[float]:
    """Sanitize a provider value: reject None/NaN/Inf/non-numeric."""
    if v is None or isinstance(v, bool):
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def _cagr(first: Optional[float], last: Optional[float], years: int) -> Optional[float]:
    """Compound annual growth; only defined for positive endpoints."""
    if not first or not last or years <= 0 or first <= 0 or last <= 0:
        return None
    try:
        return (last / first) ** (1.0 / years) - 1.0
    except (OverflowError, ZeroDivisionError):
        return None


def _median(vals: list) -> Optional[float]:
    vals = [v for v in vals if v is not None]
    if not vals:
        return None
    vals = sorted(vals)
    n = len(vals)
    mid = n // 2
    return vals[mid] if n % 2 else (vals[mid - 1] + vals[mid]) / 2.0


@dataclass
class NormalizedInputs:
    symbol: str
    currency: str = "USD"
    # Market
    price: Optional[float] = None
    market_cap: Optional[float] = None
    shares_outstanding: Optional[float] = None     # derived: market_cap / price
    pe_ratio: Optional[float] = None
    # Latest fundamentals
    revenue: Optional[float] = None
    net_income: Optional[float] = None
    fcf: Optional[float] = None
    normalized_fcf: Optional[float] = None         # multi-year median (cycle-adjusted)
    total_debt: Optional[float] = None
    cash: Optional[float] = None
    equity: Optional[float] = None
    return_on_equity: Optional[float] = None
    enterprise_value: Optional[float] = None       # market_cap + debt - cash
    # History-derived
    years_of_history: int = 0
    revenue_cagr: Optional[float] = None
    fcf_cagr: Optional[float] = None
    net_margin_median: Optional[float] = None      # fraction, e.g. 0.21
    net_margin_peak: Optional[float] = None
    fcf_margin_median: Optional[float] = None
    fcf_margin_latest: Optional[float] = None
    revenue_volatility: Optional[float] = None     # coefficient of variation of YoY growth
    fcf_positive_years: int = 0
    fcf_negative_years: int = 0
    fcf_history: list = field(default_factory=list)
    revenue_history: list = field(default_factory=list)
    # Classification signals
    sector: str = ""
    industry: str = ""
    # Bookkeeping
    missing_inputs: list = field(default_factory=list)
    estimated_inputs: list = field(default_factory=list)   # derived values, explicitly labeled


# Inputs the engine would like but the current provider does not supply.
PROVIDER_UNAVAILABLE = [
    "operating_income", "ebitda", "capital_expenditures_history",
    "diluted_share_count", "share_count_history", "analyst_growth_forecasts",
    "historical_valuation_multiples", "peer_valuation_multiples",
    "historical_price_series", "ffo", "affo",
]


def normalize_inputs(info: dict, financials: dict) -> NormalizedInputs:
    sym = (info.get("symbol") or "").upper()
    n = NormalizedInputs(symbol=sym)
    n.currency = info.get("currency") or "USD"
    n.sector   = info.get("sector") or ""
    n.industry = info.get("industry") or ""

    n.price      = _num(info.get("price"))
    n.market_cap = _num(info.get("market_cap"))
    n.pe_ratio   = _num(info.get("pe_ratio"))
    n.return_on_equity = _num(info.get("returnOnEquity"))

    if n.market_cap and n.price and n.price > 0:
        n.shares_outstanding = n.market_cap / n.price
        n.estimated_inputs.append("shares_outstanding=market_cap/price")
    else:
        n.missing_inputs.append("share_count")

    history = [h for h in (financials.get("history") or []) if isinstance(h, dict)]
    history = sorted(history, key=lambda h: h.get("year") or 0)
    n.years_of_history = len(history)

    if history:
        latest = history[-1]
        n.revenue    = _num(latest.get("revenue"))
        n.net_income = _num(latest.get("net_income"))
        n.fcf        = _num(latest.get("free_cash_flow"))
        n.total_debt = _num(latest.get("total_debt"))
        n.cash       = _num(latest.get("cash"))
        n.equity     = _num(latest.get("stockholders_equity"))

        n.revenue_history = [_num(h.get("revenue")) for h in history]
        n.fcf_history     = [_num(h.get("free_cash_flow")) for h in history]

        revs = [r for r in n.revenue_history if r is not None]
        if len(revs) >= 2:
            n.revenue_cagr = _cagr(revs[0], revs[-1], len(revs) - 1)
            yoy = [(revs[i] / revs[i - 1] - 1.0) for i in range(1, len(revs)) if revs[i - 1] > 0]
            if len(yoy) >= 2:
                mean = sum(yoy) / len(yoy)
                var = sum((g - mean) ** 2 for g in yoy) / len(yoy)
                n.revenue_volatility = math.sqrt(var)

        fcfs = [f for f in n.fcf_history if f is not None]
        if fcfs:
            n.normalized_fcf = _median(fcfs)
            n.fcf_positive_years = sum(1 for f in fcfs if f > 0)
            n.fcf_negative_years = sum(1 for f in fcfs if f <= 0)
            if len(fcfs) >= 2:
                n.fcf_cagr = _cagr(fcfs[0], fcfs[-1], len(fcfs) - 1)

        margins = []
        fcf_margins = []
        for h in history:
            rev, ni = _num(h.get("revenue")), _num(h.get("net_income"))
            f = _num(h.get("free_cash_flow"))
            if rev and rev > 0 and ni is not None:
                margins.append(ni / rev)
            if rev and rev > 0 and f is not None:
                fcf_margins.append(f / rev)
        if margins:
            n.net_margin_median = _median(margins)
            n.net_margin_peak   = max(margins)
        if fcf_margins:
            n.fcf_margin_median = _median(fcf_margins)
            n.fcf_margin_latest = fcf_margins[-1]

    # Enterprise value: documented derivation from real data
    if n.market_cap is not None:
        debt = n.total_debt or 0.0
        cash = n.cash or 0.0
        n.enterprise_value = n.market_cap + debt - cash
        if n.total_debt is None or n.cash is None:
            n.estimated_inputs.append("enterprise_value=market_cap+debt-cash (partial balance data)")

    # Record what is genuinely absent
    for name, val in [("current_price", n.price), ("market_cap", n.market_cap),
                      ("revenue", n.revenue), ("free_cash_flow", n.fcf),
                      ("total_debt", n.total_debt), ("cash", n.cash)]:
        if val is None:
            n.missing_inputs.append(name)
    if n.years_of_history < 3:
        n.missing_inputs.append("sufficient_financial_history")

    return n
