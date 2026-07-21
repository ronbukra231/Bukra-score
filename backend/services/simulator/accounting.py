"""
Portfolio accounting — cost basis, realized/unrealized gains, fees, FX.

Pure functions over the plain-dict state shape used by store.py, so they are
trivially unit-testable without touching the filesystem. Every mutation
happens here, never inline in the router or the execution engine.
"""

import math
import uuid
from datetime import datetime, timezone
from typing import Optional

from services.simulator.config import EXECUTION


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def is_finite(x) -> bool:
    return x is not None and isinstance(x, (int, float)) and math.isfinite(x)


def clamp_positive(x: float) -> float:
    return max(0.0, x) if is_finite(x) else 0.0


def simulated_fee(notional: float) -> float:
    fee = notional * EXECUTION["fee_pct"]
    return round(max(fee, EXECUTION["min_fee"]), 2)


def simulated_fx_cost(notional: float, requires_fx: bool) -> float:
    if not requires_fx:
        return 0.0
    return round(notional * EXECUTION["fx_conversion_pct"], 2)


def apply_slippage_and_spread(price: float, side: str) -> float:
    """
    Buys execute slightly above quote (spread + slippage), sells slightly
    below — the standard conservative simulation convention.
    """
    adj = EXECUTION["spread_pct"] / 2 + EXECUTION["slippage_pct"]
    if side == "BUY":
        return round(price * (1 + adj), 4)
    return round(price * (1 - adj), 4)


def find_open_holding(state: dict, ticker: str) -> Optional[dict]:
    for h in state["holdings"].values():
        if h["ticker"] == ticker and h["status"] == "open":
            return h
    return None


def apply_buy(state: dict, ticker: str, quantity: float, executed_price_portfolio_ccy: float,
             fee: float, fx_cost: float, trading_currency: str,
             sector: str = "", reason: str = "") -> dict:
    """
    Mutates state in place: deducts cash, opens/adds to a holding, recomputes
    weighted-average cost basis. `executed_price_portfolio_ccy` and all cost
    figures are already expressed in the portfolio's base currency — FX
    conversion happens once, in the execution engine, before this is called.
    Returns the holding dict.
    """
    p = state["portfolio"]
    gross = quantity * executed_price_portfolio_ccy
    total_cost = gross + fee + fx_cost

    holding = find_open_holding(state, ticker)
    ts = now_iso()
    if holding is None:
        holding = {
            "id": new_id("hld"), "portfolioId": p["id"], "companyId": ticker,
            "ticker": ticker, "quantity": 0.0, "averageCost": 0.0,
            "totalCostBasis": 0.0, "currentPrice": executed_price_portfolio_ccy,
            "currentMarketValue": 0.0, "unrealizedGainLoss": 0.0,
            "unrealizedGainLossPercent": 0.0, "realizedGainLoss": 0.0,
            "portfolioWeight": 0.0, "tradingCurrency": trading_currency,
            "openedAt": ts, "updatedAt": ts, "reasonForHolding": reason,
            "closedAt": None, "status": "open", "sector": sector,
        }
        state["holdings"][holding["id"]] = holding

    new_qty = holding["quantity"] + quantity
    new_cost_basis = holding["totalCostBasis"] + total_cost
    holding["quantity"] = round(new_qty, 8)
    holding["totalCostBasis"] = round(new_cost_basis, 2)
    holding["averageCost"] = round(new_cost_basis / new_qty, 6) if new_qty > 0 else 0.0
    holding["updatedAt"] = ts
    if reason:
        holding["reasonForHolding"] = reason

    p["currentCash"] = round(p["currentCash"] - total_cost, 2)
    p["totalFees"] = round(p["totalFees"] + fee, 2)
    p["updatedAt"] = ts
    return holding


def apply_sell(state: dict, holding: dict, quantity: float, executed_price_portfolio_ccy: float,
              fee: float, fx_cost: float) -> dict:
    """
    Mutates state in place: realizes gain/loss on the sold quantity (weighted-
    average cost basis), credits cash, reduces or closes the holding.
    Returns {"realizedGainLoss": ..., "netProceeds": ...}.
    """
    p = state["portfolio"]
    ts = now_iso()

    avg_cost = holding["averageCost"]
    proceeds_gross = quantity * executed_price_portfolio_ccy
    net_proceeds = proceeds_gross - fee - fx_cost
    cost_of_sold = avg_cost * quantity
    realized = round(net_proceeds - cost_of_sold, 2)

    holding["quantity"] = round(holding["quantity"] - quantity, 8)
    holding["totalCostBasis"] = round(holding["totalCostBasis"] - cost_of_sold, 2)
    holding["realizedGainLoss"] = round(holding.get("realizedGainLoss", 0.0) + realized, 2)
    holding["updatedAt"] = ts
    if holding["quantity"] <= 1e-8:
        holding["quantity"] = 0.0
        holding["status"] = "closed"
        holding["closedAt"] = ts

    p["currentCash"] = round(p["currentCash"] + net_proceeds, 2)
    p["totalFees"] = round(p["totalFees"] + fee, 2)
    p["realizedGainLoss"] = round(p["realizedGainLoss"] + realized, 2)
    p["updatedAt"] = ts
    return {"realizedGainLoss": realized, "netProceeds": round(net_proceeds, 2)}


def recompute_portfolio_valuation(state: dict, prices: dict[str, float]) -> None:
    """
    Refresh currentMarketValue / unrealizedGainLoss / portfolioWeight for
    every open holding, and roll up currentValue / unrealizedGainLoss on the
    portfolio, from a caller-supplied {ticker: price} map (server-fetched —
    never trusted from the client).
    """
    p = state["portfolio"]
    open_holdings = [h for h in state["holdings"].values() if h["status"] == "open"]
    holdings_value = 0.0
    for h in open_holdings:
        price = prices.get(h["ticker"])
        if is_finite(price) and price > 0:
            h["currentPrice"] = price
        mv = (h["currentPrice"] or 0.0) * h["quantity"]
        h["currentMarketValue"] = round(mv, 2)
        h["unrealizedGainLoss"] = round(mv - h["totalCostBasis"], 2)
        h["unrealizedGainLossPercent"] = (
            round((mv / h["totalCostBasis"] - 1.0) * 100, 2) if h["totalCostBasis"] > 0 else 0.0
        )
        holdings_value += mv
        h["updatedAt"] = now_iso()

    total_value = round(holdings_value + p["currentCash"], 2)
    for h in open_holdings:
        h["portfolioWeight"] = round(h["currentMarketValue"] / total_value, 4) if total_value > 0 else 0.0

    p["currentValue"] = total_value
    p["unrealizedGainLoss"] = round(sum(h["unrealizedGainLoss"] for h in open_holdings), 2)
    p["updatedAt"] = now_iso()
