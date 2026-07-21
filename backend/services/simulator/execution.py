"""
Simulated Execution Engine.

Receives an APPROVED recommendation and turns it into a simulated
transaction. This module never calls a brokerage API, never creates a real
order, and never runs before explicit user approval — approval and
execution are separate service calls (service.py enforces the ordering);
this module only performs the execution half.

Idempotent by construction: a recommendation can only be executed once
because it is only ever called from inside service.approve_recommendation()
while holding the user's portfolio lock, and it flips recommendationStatus
to SIMULATED_EXECUTED as its last state change — a second call sees that
status and is rejected before this module runs again.
"""

from dataclasses import dataclass
from typing import Optional

from services.simulator import accounting
from services.simulator.config import EXECUTION
from services.simulator.pricing import get_quote, get_fx_rate
from services.simulator.models import TransactionType


@dataclass
class ExecutionResult:
    ok: bool
    reason: Optional[str] = None          # failure reason (never raised as an exception)
    transaction: Optional[dict] = None
    holding: Optional[dict] = None


def _stale_reason(quote: dict) -> Optional[str]:
    if quote["price"] is None:
        return "מחיר שוק אינו זמין כרגע."
    return None


def simulate_buy(state: dict, ticker: str, amount_portfolio_ccy: float,
                 sector: str = "", reason: str = "",
                 recommendation_id: Optional[str] = None) -> ExecutionResult:
    """Simulate spending `amount_portfolio_ccy` of virtual cash on `ticker`."""
    p = state["portfolio"]
    if not accounting.is_finite(amount_portfolio_ccy) or amount_portfolio_ccy <= 0:
        return ExecutionResult(False, "סכום עסקה לא תקין.")
    if amount_portfolio_ccy < EXECUTION["min_trade_amount"]:
        return ExecutionResult(False, f"סכום העסקה נמוך מהמינימום המותר לסימולציה ({EXECUTION['min_trade_amount']}).")
    if amount_portfolio_ccy > p["currentCash"] + 1e-6:
        return ExecutionResult(False, "אין מספיק מזומן וירטואלי זמין לפעולה זו.")

    quote = get_quote(ticker)
    stale = _stale_reason(quote)
    if stale:
        return ExecutionResult(False, stale)

    fx_rate = get_fx_rate(quote["currency"], p["baseCurrency"])
    if fx_rate is None:
        return ExecutionResult(False, "שער המרה נדרש אינו זמין כרגע.")

    exec_price_native = accounting.apply_slippage_and_spread(quote["price"], "BUY")
    exec_price_portfolio = round(exec_price_native * fx_rate, 6)
    requires_fx = quote["currency"] != p["baseCurrency"]

    fee = accounting.simulated_fee(amount_portfolio_ccy)
    fx_cost = accounting.simulated_fx_cost(amount_portfolio_ccy, requires_fx)
    investable = amount_portfolio_ccy - fee - fx_cost
    if investable <= 0:
        return ExecutionResult(False, "העמלות המדומות גבוהות מהסכום המבוקש.")

    quantity = investable / exec_price_portfolio if exec_price_portfolio > 0 else 0
    if not EXECUTION["fractional_shares"]:
        quantity = float(int(quantity))
    if quantity <= 0:
        return ExecutionResult(False, "לא ניתן לחשב כמות מניות תקינה.")

    holding = accounting.apply_buy(
        state, ticker, quantity, exec_price_portfolio, fee, fx_cost,
        trading_currency=quote["currency"], sector=sector, reason=reason,
    )

    ts = accounting.now_iso()
    txn = {
        "id": accounting.new_id("txn"), "portfolioId": p["id"],
        "holdingId": holding["id"], "recommendationId": recommendation_id,
        "transactionType": TransactionType.SIMULATED_BUY.value, "ticker": ticker,
        "quantity": round(quantity, 8), "requestedPrice": quote["price"],
        "executedPrice": exec_price_portfolio, "grossAmount": round(quantity * exec_price_portfolio, 2),
        "simulatedFee": fee, "simulatedFxCost": fx_cost,
        "netAmount": round(amount_portfolio_ccy, 2),
        "transactionCurrency": quote["currency"], "portfolioCurrency": p["baseCurrency"],
        "fxRate": fx_rate, "status": "SIMULATED_EXECUTED", "createdAt": ts,
        "approvedByUser": True, "approvedAt": ts, "simulatedExecutedAt": ts,
        "metadata": {"note": "No real trade was executed."},
    }
    state["transactions"].append(txn)
    return ExecutionResult(True, transaction=txn, holding=holding)


def simulate_sell(state: dict, ticker: str, quantity: Optional[float] = None,
                  fraction: Optional[float] = None,
                  recommendation_id: Optional[str] = None) -> ExecutionResult:
    """Simulate selling `quantity` shares (or `fraction` of the position) of `ticker`."""
    p = state["portfolio"]
    holding = accounting.find_open_holding(state, ticker)
    if holding is None:
        return ExecutionResult(False, "אין החזקה פתוחה במניה זו בתיק הווירטואלי.")

    sell_qty = quantity if quantity is not None else (holding["quantity"] * (fraction or 1.0))
    if not accounting.is_finite(sell_qty) or sell_qty <= 0:
        return ExecutionResult(False, "כמות מכירה לא תקינה.")
    if sell_qty > holding["quantity"] + 1e-8:
        return ExecutionResult(False, "לא ניתן למכור כמות גדולה מההחזקה הווירטואלית הקיימת.")

    quote = get_quote(ticker)
    stale = _stale_reason(quote)
    if stale:
        return ExecutionResult(False, stale)

    fx_rate = get_fx_rate(quote["currency"], p["baseCurrency"])
    if fx_rate is None:
        return ExecutionResult(False, "שער המרה נדרש אינו זמין כרגע.")

    exec_price_native = accounting.apply_slippage_and_spread(quote["price"], "SELL")
    exec_price_portfolio = round(exec_price_native * fx_rate, 6)
    requires_fx = quote["currency"] != p["baseCurrency"]

    gross = sell_qty * exec_price_portfolio
    fee = accounting.simulated_fee(gross)
    fx_cost = accounting.simulated_fx_cost(gross, requires_fx)

    result = accounting.apply_sell(state, holding, sell_qty, exec_price_portfolio, fee, fx_cost)

    ts = accounting.now_iso()
    txn = {
        "id": accounting.new_id("txn"), "portfolioId": p["id"],
        "holdingId": holding["id"], "recommendationId": recommendation_id,
        "transactionType": TransactionType.SIMULATED_SELL.value, "ticker": ticker,
        "quantity": round(sell_qty, 8), "requestedPrice": quote["price"],
        "executedPrice": exec_price_portfolio, "grossAmount": round(gross, 2),
        "simulatedFee": fee, "simulatedFxCost": fx_cost,
        "netAmount": result["netProceeds"],
        "transactionCurrency": quote["currency"], "portfolioCurrency": p["baseCurrency"],
        "fxRate": fx_rate, "status": "SIMULATED_EXECUTED", "createdAt": ts,
        "approvedByUser": True, "approvedAt": ts, "simulatedExecutedAt": ts,
        "metadata": {"note": "No real trade was executed.", "realizedGainLoss": result["realizedGainLoss"]},
    }
    state["transactions"].append(txn)
    return ExecutionResult(True, transaction=txn, holding=holding)
