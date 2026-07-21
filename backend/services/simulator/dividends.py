"""
Simulated dividends — credited only when the provider has real ex-dividend
data for a period the portfolio actually held the position through. No
placeholder amounts; a stock with no reliable dividend history produces
no dividend events, silently and correctly.
"""

from services.simulator import accounting
from services.yahoo_finance import get_dividend_history
from services.simulator.models import TransactionType


def process_dividends(state: dict) -> list[dict]:
    """
    For each open holding, credit any ex-dividend events that occurred
    between openedAt and now that have not already been recorded (checked
    via transaction metadata to stay idempotent across repeated calls).
    Returns the newly created dividend transactions.
    """
    p = state["portfolio"]
    already = {
        (t["ticker"], t["metadata"].get("exDate"))
        for t in state["transactions"]
        if t["transactionType"] == TransactionType.SIMULATED_DIVIDEND.value
    }
    created = []
    for h in state["holdings"].values():
        if h["status"] != "open" or h["quantity"] <= 0:
            continue
        events = get_dividend_history(h["ticker"])
        if not events:
            continue
        opened_date = h["openedAt"][:10]
        for ev in events:
            if ev["date"] < opened_date:
                continue
            if (h["ticker"], ev["date"]) in already:
                continue
            amount = round(ev["amount"] * h["quantity"], 2)
            if amount <= 0:
                continue
            ts = accounting.now_iso()
            p["currentCash"] = round(p["currentCash"] + amount, 2)
            p["dividendIncome"] = round(p["dividendIncome"] + amount, 2)
            p["updatedAt"] = ts
            txn = {
                "id": accounting.new_id("txn"), "portfolioId": p["id"],
                "holdingId": h["id"], "recommendationId": None,
                "transactionType": TransactionType.SIMULATED_DIVIDEND.value,
                "ticker": h["ticker"], "quantity": h["quantity"],
                "requestedPrice": None, "executedPrice": ev["amount"],
                "grossAmount": amount, "simulatedFee": 0.0, "simulatedFxCost": 0.0,
                "netAmount": amount, "transactionCurrency": h["tradingCurrency"],
                "portfolioCurrency": p["baseCurrency"], "fxRate": 1.0,
                "status": "SIMULATED_EXECUTED", "createdAt": ts,
                "approvedByUser": False, "approvedAt": None, "simulatedExecutedAt": ts,
                "metadata": {"exDate": ev["date"], "perShare": ev["amount"],
                            "note": "No real dividend was received."},
            }
            state["transactions"].append(txn)
            created.append(txn)
    return created
