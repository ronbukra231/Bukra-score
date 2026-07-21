"""
Performance accounting: daily snapshots, time-weighted return (TWR), and
money-weighted return (XIRR). Never computes return as a naive
currentValue/totalDeposits-1 when multiple cash flows exist at different
dates — that formula silently misattributes deposit timing as performance.
"""

import math
from datetime import datetime, date, timezone
from typing import Optional

from services.simulator import accounting
from services.simulator.models import TransactionType


def _external_cashflow_for_day(state: dict, day: str) -> float:
    """Deposits minus withdrawals executed on `day` (YYYY-MM-DD) — the only
    flows that are external to portfolio performance. Dividends and trades
    are internal and must not be subtracted from the day's value change."""
    total = 0.0
    for t in state["transactions"]:
        if t["createdAt"][:10] != day:
            continue
        if t["transactionType"] == TransactionType.SIMULATED_DEPOSIT.value:
            total += t["netAmount"]
        elif t["transactionType"] == TransactionType.SIMULATED_WITHDRAWAL.value:
            total -= t["netAmount"]
    return total


def create_snapshot(state: dict, benchmark_value: Optional[float] = None,
                    benchmark_return: Optional[float] = None) -> dict:
    """
    Appends today's snapshot (idempotent per calendar day — replaces an
    existing snapshot for today rather than duplicating it) and returns it.
    """
    p = state["portfolio"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    holdings_value = round(p["currentValue"] - p["currentCash"], 2)

    prior = [s for s in state["snapshots"] if s["snapshotDate"] < today]
    prior_twr = prior[-1]["cumulativeTimeWeightedReturn"] if prior else 0.0
    prior_value = prior[-1]["portfolioValue"] if prior else p["initialCapital"]

    cashflow_today = _external_cashflow_for_day(state, today)
    daily_return = None
    if prior_value and prior_value > 0:
        adj_end = p["currentValue"] - cashflow_today
        daily_return = round(adj_end / prior_value - 1.0, 6) if prior else None

    cum_twr = None
    if daily_return is not None and prior_twr is not None:
        cum_twr = round((1 + prior_twr) * (1 + daily_return) - 1, 6)
    elif not prior:
        cum_twr = round(p["currentValue"] / p["initialCapital"] - 1.0, 6) if p["initialCapital"] > 0 else 0.0

    snap = {
        "portfolioId": p["id"], "snapshotDate": today,
        "portfolioValue": p["currentValue"], "cashValue": p["currentCash"],
        "holdingsValue": holdings_value, "totalDeposits": p["totalDeposits"],
        "totalWithdrawals": p["totalWithdrawals"], "cumulativeFees": p["totalFees"],
        "cumulativeDividends": p["dividendIncome"], "dailyReturn": daily_return,
        "cumulativeTimeWeightedReturn": cum_twr,
        "benchmarkValue": benchmark_value, "benchmarkReturn": benchmark_return,
    }
    state["snapshots"] = [s for s in state["snapshots"] if s["snapshotDate"] != today] + [snap]
    return snap


def _xirr_cashflows(state: dict) -> list[tuple[date, float]]:
    """External cash flows for XIRR: deposits negative, withdrawals positive,
    current value as a final positive flow at today's date."""
    flows = []
    for t in state["transactions"]:
        d = datetime.fromisoformat(t["createdAt"]).date()
        if t["transactionType"] == TransactionType.SIMULATED_DEPOSIT.value:
            flows.append((d, -t["netAmount"]))
        elif t["transactionType"] == TransactionType.SIMULATED_WITHDRAWAL.value:
            flows.append((d, t["netAmount"]))
    flows.append((datetime.now(timezone.utc).date(), state["portfolio"]["currentValue"]))
    return flows


def money_weighted_return(state: dict) -> Optional[float]:
    """
    XIRR via Newton's method with a bisection fallback. Requires at least
    two distinct cash-flow dates (an initial deposit and today); returns
    None otherwise — never a fabricated rate.
    """
    flows = _xirr_cashflows(state)
    if len(flows) < 2 or len({d for d, _ in flows}) < 2:
        return None
    t0 = flows[0][0]
    times = [(d - t0).days / 365.0 for d, _ in flows]
    amounts = [a for _, a in flows]

    def npv(rate):
        try:
            return sum(a / ((1 + rate) ** t) for a, t in zip(amounts, times))
        except (OverflowError, ZeroDivisionError):
            return float("nan")

    rate = 0.1
    for _ in range(100):
        h = 1e-6
        f = npv(rate)
        fp = (npv(rate + h) - f) / h
        if not math.isfinite(f) or not math.isfinite(fp) or abs(fp) < 1e-12:
            break
        new_rate = rate - f / fp
        if not math.isfinite(new_rate) or new_rate <= -0.999:
            break
        if abs(new_rate - rate) < 1e-8:
            rate = new_rate
            break
        rate = new_rate
    else:
        rate = None

    if rate is None or not math.isfinite(rate) or abs(npv(rate)) > max(1.0, abs(amounts[-1]) * 0.01):
        # Bisection fallback over a sane range
        lo, hi = -0.99, 10.0
        f_lo, f_hi = npv(lo), npv(hi)
        if math.isfinite(f_lo) and math.isfinite(f_hi) and f_lo * f_hi < 0:
            for _ in range(200):
                mid = (lo + hi) / 2
                f_mid = npv(mid)
                if not math.isfinite(f_mid):
                    return None
                if f_lo * f_mid <= 0:
                    hi = mid
                else:
                    lo, f_lo = mid, f_mid
            rate = (lo + hi) / 2
        else:
            return None
    return round(rate, 6)


def total_return(state: dict) -> dict:
    p = state["portfolio"]
    net_invested = p["totalDeposits"] - p["totalWithdrawals"]
    gross = p["realizedGainLoss"] + p["unrealizedGainLoss"] + p["dividendIncome"]
    net = gross - p["totalFees"]
    return {
        "grossReturn": round(gross, 2),
        "netReturn": round(net, 2),
        "netReturnPct": round(net / net_invested * 100, 2) if net_invested > 0 else None,
        "netInvested": round(net_invested, 2),
    }
