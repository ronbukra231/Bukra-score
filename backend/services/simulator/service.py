"""
Portfolio Simulator — orchestration layer.

This is the only module the router talks to. It owns transaction boundaries
(via store.UserPortfolioLock), enforces the approval-before-execution
ordering, and is where every cross-cutting concern (audit logging,
idempotency, recalculation) is wired together. Individual concerns
(accounting, execution, recommendations, performance, benchmark, health,
dividends) stay in their own modules and know nothing about HTTP.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from services.data_service import get_company_info, get_five_year_financials
from services.bukra_score import compute_bukra_score
from services.valuation import compute_valuation
from services.simulator import accounting, audit, execution, recommendations as reco_engine
from services.simulator import performance, benchmark as bench_mod, health as health_mod, dividends as div_mod
from services.simulator.config import (
    METHODOLOGY_VERSION, SUPPORTED_CURRENCIES, DEFAULT_RISK_PROFILE, RISK_PROFILES,
    DEFAULT_BENCHMARK, RECOMMENDATION_EXPIRY_DAYS,
)
from services.simulator.models import (
    TransactionType, RecommendationStatus, AuditEventType,
)
from services.simulator.pricing import get_quote
from services.simulator.store import UserPortfolioLock, load_state

logger = logging.getLogger("bukra.simulator.service")


class SimulatorError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _txt(lang, he, en):
    return he if lang == "he" else en


# ── Portfolio lifecycle ─────────────────────────────────────────────────────────

def create_portfolio(user_id: str, *, name: str, base_currency: str, initial_capital: float,
                     risk_profile: str, benchmark_symbol: Optional[str], lang: str = "he") -> dict:
    if base_currency not in SUPPORTED_CURRENCIES:
        raise SimulatorError(_txt(lang, "מטבע אינו נתמך.", "Unsupported currency."))
    if risk_profile not in RISK_PROFILES:
        raise SimulatorError(_txt(lang, "פרופיל סיכון אינו תקין.", "Invalid risk profile."))
    if not accounting.is_finite(initial_capital) or initial_capital <= 0:
        raise SimulatorError(_txt(lang, "סכום ההון הראשוני אינו תקין.", "Invalid initial capital amount."))

    with UserPortfolioLock(user_id) as state:
        if state["portfolio"] is not None:
            raise SimulatorError(_txt(lang, "כבר קיים תיק סימולציה עבור משתמש זה.",
                                      "A simulation portfolio already exists for this user."), 409)
        ts = accounting.now_iso()
        pid = accounting.new_id("pf")
        benchmark = benchmark_symbol or DEFAULT_BENCHMARK.get(base_currency, "SPY")
        portfolio = {
            "id": pid, "userId": user_id, "name": name.strip()[:80] or "Bukra Simulation Portfolio",
            "baseCurrency": base_currency, "benchmarkSymbol": benchmark, "riskProfile": risk_profile,
            "initialCapital": round(initial_capital, 2), "currentCash": round(initial_capital, 2),
            "totalDeposits": round(initial_capital, 2), "totalWithdrawals": 0.0,
            "realizedGainLoss": 0.0, "unrealizedGainLoss": 0.0, "dividendIncome": 0.0,
            "totalFees": 0.0, "currentValue": round(initial_capital, 2),
            "createdAt": ts, "updatedAt": ts, "status": "active",
            "isSimulation": True, "methodologyVersion": METHODOLOGY_VERSION,
        }
        state["portfolio"] = portfolio
        txn = {
            "id": accounting.new_id("txn"), "portfolioId": pid, "holdingId": None, "recommendationId": None,
            "transactionType": TransactionType.SIMULATED_DEPOSIT.value, "ticker": None,
            "quantity": None, "requestedPrice": None, "executedPrice": None,
            "grossAmount": round(initial_capital, 2), "simulatedFee": 0.0, "simulatedFxCost": 0.0,
            "netAmount": round(initial_capital, 2), "transactionCurrency": base_currency,
            "portfolioCurrency": base_currency, "fxRate": 1.0, "status": "SIMULATED_EXECUTED",
            "createdAt": ts, "approvedByUser": True, "approvedAt": ts, "simulatedExecutedAt": ts,
            "metadata": {"note": "Initial virtual capital. No real deposit was made."},
        }
        state["transactions"].append(txn)
        audit.log(state, AuditEventType.PORTFOLIO_CREATED.value,
                  _txt(lang, f"נוצר תיק סימולציה וירטואלי בהון התחלתי {initial_capital:,.0f} {base_currency}.",
                       f"A virtual simulation portfolio was created with {initial_capital:,.0f} {base_currency} initial capital."),
                  actor_type="user", actor_id=user_id, after=portfolio)
        performance.create_snapshot(state)
        return portfolio


def add_virtual_funds(user_id: str, amount: float, lang: str = "he") -> dict:
    if not accounting.is_finite(amount) or amount <= 0:
        raise SimulatorError(_txt(lang, "סכום ההפקדה הווירטואלית אינו תקין.", "Invalid virtual deposit amount."))
    with UserPortfolioLock(user_id) as state:
        p = _require_portfolio(state, lang)
        before_cash = p["currentCash"]
        p["currentCash"] = round(p["currentCash"] + amount, 2)
        p["totalDeposits"] = round(p["totalDeposits"] + amount, 2)
        p["currentValue"] = round(p["currentValue"] + amount, 2)
        p["updatedAt"] = accounting.now_iso()
        ts = accounting.now_iso()
        txn = {
            "id": accounting.new_id("txn"), "portfolioId": p["id"], "holdingId": None, "recommendationId": None,
            "transactionType": TransactionType.SIMULATED_DEPOSIT.value, "ticker": None,
            "quantity": None, "requestedPrice": None, "executedPrice": None,
            "grossAmount": round(amount, 2), "simulatedFee": 0.0, "simulatedFxCost": 0.0,
            "netAmount": round(amount, 2), "transactionCurrency": p["baseCurrency"],
            "portfolioCurrency": p["baseCurrency"], "fxRate": 1.0, "status": "SIMULATED_EXECUTED",
            "createdAt": ts, "approvedByUser": True, "approvedAt": ts, "simulatedExecutedAt": ts,
            "metadata": {"note": "Simulated deposit. No real funds were transferred."},
        }
        state["transactions"].append(txn)
        audit.log(state, AuditEventType.VIRTUAL_FUNDS_ADDED.value,
                  _txt(lang, f"נוספו {amount:,.0f} {p['baseCurrency']} וירטואליים ליתרת המזומן.",
                       f"{amount:,.0f} {p['baseCurrency']} virtual funds were added to the cash balance."),
                  actor_type="user", actor_id=user_id, transaction_id=txn["id"],
                  before={"currentCash": before_cash}, after={"currentCash": p["currentCash"]})
        return p


def _require_portfolio(state: dict, lang: str) -> dict:
    if state["portfolio"] is None:
        raise SimulatorError(_txt(lang, "לא נמצא תיק סימולציה. יש ליצור תיק תחילה.",
                                  "No simulation portfolio found. Create one first."), 404)
    return state["portfolio"]


def set_risk_profile(user_id: str, risk_profile: str, lang: str = "he") -> dict:
    if risk_profile not in RISK_PROFILES:
        raise SimulatorError(_txt(lang, "פרופיל סיכון אינו תקין.", "Invalid risk profile."))
    with UserPortfolioLock(user_id) as state:
        p = _require_portfolio(state, lang)
        before = p["riskProfile"]
        p["riskProfile"] = risk_profile
        p["updatedAt"] = accounting.now_iso()
        audit.log(state, AuditEventType.USER_RISK_PROFILE_UPDATED.value,
                  _txt(lang, f"פרופיל הסיכון עודכן מ-{before} ל-{risk_profile}.",
                       f"Risk profile updated from {before} to {risk_profile}."),
                  actor_type="user", actor_id=user_id,
                  before={"riskProfile": before}, after={"riskProfile": risk_profile})
        return p


# ── Price refresh / recalculation ───────────────────────────────────────────────

def _refresh_prices_and_value(state: dict) -> None:
    prices = {}
    for h in state["holdings"].values():
        if h["status"] != "open":
            continue
        q = get_quote(h["ticker"])
        if q["price"] is not None:
            fx = 1.0
            if q["currency"] != state["portfolio"]["baseCurrency"]:
                from services.simulator.pricing import get_fx_rate
                fx = get_fx_rate(q["currency"], state["portfolio"]["baseCurrency"]) or 1.0
            prices[h["ticker"]] = round(q["price"] * fx, 6)
    accounting.recompute_portfolio_valuation(state, prices)


def _expire_stale_recommendations(state: dict) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RECOMMENDATION_EXPIRY_DAYS)
    for r in state["recommendations"].values():
        if r["recommendationStatus"] == RecommendationStatus.PENDING.value:
            created = datetime.fromisoformat(r["createdAt"])
            if created < cutoff:
                r["recommendationStatus"] = RecommendationStatus.EXPIRED.value
                r["expiredAt"] = accounting.now_iso()


# ── Dashboard / read models ──────────────────────────────────────────────────────

def get_dashboard(user_id: str, lang: str = "he") -> dict:
    with UserPortfolioLock(user_id) as state:
        p = _require_portfolio(state, lang)
        _refresh_prices_and_value(state)
        _expire_stale_recommendations(state)
        div_mod.process_dividends(state)
        snap = performance.create_snapshot(state)
        ret = performance.total_return(state)
        xirr = performance.money_weighted_return(state)

        holdings = [h for h in state["holdings"].values() if h["status"] == "open"]
        holdings.sort(key=lambda h: -(h["currentMarketValue"] or 0))

        by_sector: dict = {}
        for h in holdings:
            by_sector[h.get("sector", "")] = by_sector.get(h.get("sector", ""), 0) + h["currentMarketValue"]
        total = max(p["currentValue"], 1e-9)

        best = max(holdings, key=lambda h: h["unrealizedGainLossPercent"] or -1e9, default=None)
        worst = min(holdings, key=lambda h: h["unrealizedGainLossPercent"] or 1e9, default=None)

        pending_count = sum(1 for r in state["recommendations"].values()
                            if r["recommendationStatus"] == RecommendationStatus.PENDING.value)

        return {
            "portfolio": p,
            "return": {**ret, "timeWeightedReturnPct": round((snap["cumulativeTimeWeightedReturn"] or 0) * 100, 2)
                       if snap["cumulativeTimeWeightedReturn"] is not None else None,
                       "moneyWeightedReturnPct": round(xirr * 100, 2) if xirr is not None else None},
            "holdings": holdings,
            "allocation": {
                "bySector": [{"label": k or _txt(lang, "לא מסווג", "Unclassified"), "value": round(v, 2),
                             "weight": round(v / total, 4)} for k, v in sorted(by_sector.items(), key=lambda kv: -kv[1])],
                "cashWeight": round(p["currentCash"] / total, 4) if total else 0.0,
            },
            "summary": {
                "numberOfHoldings": len(holdings),
                "largestPosition": holdings[0]["ticker"] if holdings else None,
                "largestSector": max(by_sector, key=by_sector.get) if by_sector else None,
                "cashPercentage": round(p["currentCash"] / total, 4) if total else 0.0,
                "bestPerformer": best["ticker"] if best else None,
                "worstPerformer": worst["ticker"] if worst else None,
                "totalDividends": p["dividendIncome"], "totalFees": p["totalFees"],
            },
            "pendingRecommendations": pending_count,
            "isSimulation": True,
            "generatedAt": accounting.now_iso(),
        }


def get_performance(user_id: str, period: str = "1Y", lang: str = "he") -> dict:
    with UserPortfolioLock(user_id) as state:
        p = _require_portfolio(state, lang)
        bench = bench_mod.compare_to_benchmark(p["createdAt"], p["benchmarkSymbol"], period)
        snapshots = sorted(state["snapshots"], key=lambda s: s["snapshotDate"])
        base_value = snapshots[0]["portfolioValue"] if snapshots else p["initialCapital"]
        portfolio_series = [
            {"date": s["snapshotDate"], "portfolioIndex": round((s["portfolioValue"] / base_value - 1) * 100, 3)
             if base_value else 0.0}
            for s in snapshots
        ]
        return {
            "portfolioSeries": portfolio_series,
            "benchmark": bench,
            "period": period,
            "isSimulation": True,
            "calculatedAt": accounting.now_iso(),
        }


def get_health(user_id: str, lang: str = "he") -> dict:
    with UserPortfolioLock(user_id) as state:
        p = _require_portfolio(state, lang)
        _refresh_prices_and_value(state)
        scores = {}
        for h in state["holdings"].values():
            if h["status"] != "open":
                continue
            try:
                info = get_company_info(h["ticker"])
                fin = get_five_year_financials(h["ticker"])
                sd = compute_bukra_score(fin, info) if fin.get("history") else {"score": None}
                val = compute_valuation(h["ticker"], info, fin, lang=lang,
                                        bukra_score=sd.get("score"), persist=False) if fin.get("history") else {"available": False}
                above_fv = None
                if val.get("available") and val.get("fairValueRange", {}).get("baseMarketCap") and info.get("market_cap"):
                    above_fv = info["market_cap"] > val["fairValueRange"]["baseMarketCap"]
                scores[h["ticker"]] = {
                    "bukraScore": sd.get("score"),
                    "valuationScore": val.get("valuationScore") if val.get("available") else None,
                    "bubbleRisk": val.get("bubbleRisk") if val.get("available") else None,
                    "confidence": val.get("valuationConfidence", {}).get("score") if val.get("available") else None,
                    "dataQuality": val.get("dataQuality", {}).get("level") if val.get("available") else "insufficient",
                    "aboveFairValue": above_fv,
                }
            except Exception as e:
                logger.warning("[health] scoring failed for %s: %s", h["ticker"], e)
                scores[h["ticker"]] = {}
        result = health_mod.compute_health(state, scores)
        result["isSimulation"] = True
        result["calculatedAt"] = accounting.now_iso()
        return result


def get_activity(user_id: str, limit: int = 100, lang: str = "he") -> list[dict]:
    with UserPortfolioLock(user_id) as state:
        _require_portfolio(state, lang)
        events = sorted(state["auditEvents"], key=lambda e: e["eventTimestamp"], reverse=True)
        return events[:limit]


def get_audit_trail(user_id: str, lang: str = "he") -> list[dict]:
    with UserPortfolioLock(user_id) as state:
        _require_portfolio(state, lang)
        return sorted(state["auditEvents"], key=lambda e: e["eventTimestamp"])


def get_decision_history(user_id: str, status: Optional[str] = None, ticker: Optional[str] = None,
                         rtype: Optional[str] = None, lang: str = "he") -> list[dict]:
    with UserPortfolioLock(user_id) as state:
        _require_portfolio(state, lang)
        _expire_stale_recommendations(state)
        recs = list(state["recommendations"].values())
        if status:
            recs = [r for r in recs if r["recommendationStatus"] == status]
        if ticker:
            recs = [r for r in recs if r["ticker"] == ticker.upper()]
        if rtype:
            recs = [r for r in recs if r["recommendationType"] == rtype]
        recs.sort(key=lambda r: r["createdAt"], reverse=True)
        return recs


def get_transactions(user_id: str, lang: str = "he") -> list[dict]:
    with UserPortfolioLock(user_id) as state:
        _require_portfolio(state, lang)
        return sorted(state["transactions"], key=lambda t: t["createdAt"], reverse=True)


# ── Recommendations ──────────────────────────────────────────────────────────────

def generate_recommendations(user_id: str, lang: str = "he") -> list[dict]:
    with UserPortfolioLock(user_id) as state:
        p = _require_portfolio(state, lang)
        _refresh_prices_and_value(state)
        _expire_stale_recommendations(state)
        created = reco_engine.generate_recommendations(state, lang=lang)
        for rec in created:
            audit.log(state, AuditEventType.RECOMMENDATION_CREATED.value,
                      _txt(lang, f"המדד זיהה פוטנציאל להמלצה מסוג {rec['recommendationType']} עבור {rec['ticker']}.",
                           f"The Index identified a potential {rec['recommendationType']} recommendation for {rec['ticker']}."),
                      recommendation_id=rec["id"],
                      source_data_timestamp=accounting.now_iso())
        return created


def generate_guided_recommendation(user_id: str, exclude_tickers: Optional[list[str]] = None,
                                   lang: str = "he") -> tuple[Optional[dict], Optional[str]]:
    """
    One-at-a-time recommendation for the Guided Portfolio Builder.

    Returns (recommendation, done_reason). done_reason is None when a
    recommendation was found; otherwise a short internal code (e.g.
    "provider_degraded", "no_opportunities", "all_candidates_too_small_to_size")
    that the router maps to a user-facing message — this code, and the full
    diagnostics behind it, are logged here but never returned to the client.
    """
    with UserPortfolioLock(user_id) as state:
        _require_portfolio(state, lang)
        _refresh_prices_and_value(state)
        _expire_stale_recommendations(state)
        rec, diag = reco_engine.generate_guided_candidate(state, lang=lang, exclude_tickers=exclude_tickers)
        logger.info(
            "[guided-builder] user=%s universe=%d prefilter=%d attempted=%d rejected=%s "
            "providerFailures=%d ranked=%d doneReason=%s",
            user_id, diag["universeSize"], diag["prefilterPassCount"], diag["liveAttempted"],
            diag["rejectedByGate"], len(diag["providerFailures"]), len(diag["rankedCandidates"]), diag["doneReason"],
        )
        logger.debug("[guided-builder] full diagnostics user=%s: %s", user_id, diag)
        if rec is not None:
            audit.log(state, AuditEventType.RECOMMENDATION_CREATED.value,
                      _txt(lang, f"המדד זיהה הזדמנות מובילה לבניית התיק: {rec['ticker']}.",
                           f"The Index identified the top portfolio-building opportunity: {rec['ticker']}."),
                      recommendation_id=rec["id"], source_data_timestamp=accounting.now_iso())
        return rec, diag.get("doneReason")


def get_recommendations(user_id: str, status: Optional[str] = None, lang: str = "he") -> list[dict]:
    with UserPortfolioLock(user_id) as state:
        _require_portfolio(state, lang)
        _expire_stale_recommendations(state)
        recs = list(state["recommendations"].values())
        if status:
            recs = [r for r in recs if r["recommendationStatus"] == status]
        recs.sort(key=lambda r: r["createdAt"], reverse=True)
        return recs


def view_recommendation(user_id: str, rec_id: str, lang: str = "he") -> dict:
    with UserPortfolioLock(user_id) as state:
        _require_portfolio(state, lang)
        rec = state["recommendations"].get(rec_id)
        if rec is None:
            raise SimulatorError(_txt(lang, "ההמלצה לא נמצאה.", "Recommendation not found."), 404)
        if rec["recommendationStatus"] == RecommendationStatus.PENDING.value:
            rec["recommendationStatus"] = RecommendationStatus.VIEWED.value
            rec["viewedAt"] = accounting.now_iso()
            audit.log(state, AuditEventType.RECOMMENDATION_VIEWED.value,
                      _txt(lang, "ההמלצה נצפתה על ידי המשתמש.", "The recommendation was viewed by the user."),
                      actor_type="user", actor_id=user_id, recommendation_id=rec_id)
        return rec


def reject_recommendation(user_id: str, rec_id: str, note: Optional[str] = None, lang: str = "he") -> dict:
    with UserPortfolioLock(user_id) as state:
        _require_portfolio(state, lang)
        rec = state["recommendations"].get(rec_id)
        if rec is None:
            raise SimulatorError(_txt(lang, "ההמלצה לא נמצאה.", "Recommendation not found."), 404)
        if rec["recommendationStatus"] in (RecommendationStatus.APPROVED.value, RecommendationStatus.SIMULATED_EXECUTED.value):
            raise SimulatorError(_txt(lang, "ההמלצה כבר אושרה ולא ניתן לדחות אותה.",
                                      "The recommendation was already approved and cannot be rejected."), 409)
        if rec["recommendationStatus"] == RecommendationStatus.REJECTED.value:
            return rec   # idempotent — already rejected
        rec["recommendationStatus"] = RecommendationStatus.REJECTED.value
        rec["rejectedAt"] = accounting.now_iso()
        if note:
            rec["userDecisionNote"] = note[:500]
        audit.log(state, AuditEventType.RECOMMENDATION_REJECTED.value,
                  _txt(lang, "המשתמש דחה את ההמלצה. לא בוצעה פעולה בתיק.",
                       "The user rejected the recommendation. No portfolio action was taken."),
                  actor_type="user", actor_id=user_id, recommendation_id=rec_id)
        return rec


def approve_recommendation(user_id: str, rec_id: str, confirmed: bool, lang: str = "he") -> dict:
    """
    Approval and simulated execution as one guarded, idempotent operation:
    both happen inside the same portfolio lock so a duplicate/concurrent
    request can never execute twice. Requires the explicit confirmation
    checkbox to be true — the API layer must not default it.
    """
    if not confirmed:
        raise SimulatorError(_txt(lang,
            "יש לאשר את תיבת הסימון לפני אישור הפעולה הווירטואלית.",
            "The confirmation checkbox must be checked before approving the virtual action."))

    with UserPortfolioLock(user_id) as state:
        p = _require_portfolio(state, lang)
        rec = state["recommendations"].get(rec_id)
        if rec is None:
            raise SimulatorError(_txt(lang, "ההמלצה לא נמצאה.", "Recommendation not found."), 404)

        if rec["recommendationStatus"] == RecommendationStatus.SIMULATED_EXECUTED.value:
            return {"recommendation": rec, "transaction": None, "alreadyExecuted": True}
        if rec["recommendationStatus"] == RecommendationStatus.REJECTED.value:
            raise SimulatorError(_txt(lang, "ההמלצה נדחתה קודם לכן ולא ניתן לאשר אותה.",
                                      "The recommendation was already rejected and cannot be approved."), 409)
        if rec["recommendationStatus"] == RecommendationStatus.EXPIRED.value:
            raise SimulatorError(_txt(lang, "ההמלצה פגה ואינה ניתנת לאישור עוד.",
                                      "The recommendation has expired and can no longer be approved."), 409)

        _refresh_prices_and_value(state)
        before_snapshot = {"currentCash": p["currentCash"], "currentValue": p["currentValue"]}

        rec["recommendationStatus"] = RecommendationStatus.APPROVED.value
        rec["approvedAt"] = accounting.now_iso()
        audit.log(state, AuditEventType.RECOMMENDATION_APPROVED.value,
                  _txt(lang, "המשתמש אישר את הפעולה הווירטואלית המוצעת.",
                       "The user approved the proposed virtual action."),
                  actor_type="user", actor_id=user_id, recommendation_id=rec_id,
                  metadata={"confirmationCheckbox": True})

        rtype = rec["recommendationType"]
        result = None
        if rtype in ("ADD_POSITION", "INCREASE_POSITION"):
            amount = rec["proposedAmount"] or 0.0
            result = execution.simulate_buy(state, rec["ticker"], amount,
                                            reason=rec["reasonSummary"], recommendation_id=rec_id)
        elif rtype in ("REDUCE_POSITION", "EXIT_POSITION"):
            holding = accounting.find_open_holding(state, rec["ticker"])
            qty = holding["quantity"] if (rtype == "EXIT_POSITION" and holding) else (
                abs(rec["proposedQuantity"]) if rec["proposedQuantity"] else None)
            if holding is None:
                result = execution.ExecutionResult(False, _txt(lang, "אין החזקה פתוחה למכירה.", "No open holding to sell."))
            else:
                result = execution.simulate_sell(state, rec["ticker"], quantity=qty, recommendation_id=rec_id)
        else:
            result = execution.ExecutionResult(False, _txt(lang, "סוג המלצה זה אינו דורש ביצוע עסקה.",
                                                            "This recommendation type does not require a trade."))

        audit.log(state, AuditEventType.SIMULATED_ORDER_CREATED.value,
                  _txt(lang, f"נוצרה בקשת ביצוע מדומה עבור {rec['ticker']}.",
                       f"A simulated execution request was created for {rec['ticker']}."),
                  actor_type="system", recommendation_id=rec_id)

        if not result.ok:
            audit.log(state, AuditEventType.SIMULATED_ORDER_FAILED.value,
                      _txt(lang, f"הביצוע המדומה נכשל: {result.reason}", f"Simulated execution failed: {result.reason}"),
                      actor_type="system", recommendation_id=rec_id)
            raise SimulatorError(result.reason or _txt(lang, "הביצוע המדומה נכשל.", "Simulated execution failed."))

        rec["recommendationStatus"] = RecommendationStatus.SIMULATED_EXECUTED.value
        txn = result.transaction
        holding = result.holding
        after_snapshot = {"currentCash": p["currentCash"], "currentValue": p["currentValue"]}

        audit.log(state, AuditEventType.SIMULATED_ORDER_EXECUTED.value,
                  _txt(lang,
                       f"בהתאם לאישורך, התיק הווירטואלי עודכן: {txn['transactionType']} {txn['quantity']:.4f} מניות של {rec['ticker']} במחיר ביצוע מדומה {txn['executedPrice']:.2f}. לא בוצעה עסקה אמיתית.",
                       f"Following your approval, the virtual portfolio was updated: {txn['transactionType']} {txn['quantity']:.4f} shares of {rec['ticker']} at a simulated execution price of {txn['executedPrice']:.2f}. No real trade was executed."),
                  actor_type="system", recommendation_id=rec_id, transaction_id=txn["id"],
                  before=before_snapshot, after=after_snapshot,
                  metadata={"simulatedFee": txn["simulatedFee"], "simulatedFxCost": txn["simulatedFxCost"],
                           "executionPrice": txn["executedPrice"], "note": "No real transaction was executed."})

        event_type = AuditEventType.HOLDING_CREATED.value if (holding and holding["quantity"] == txn["quantity"] and txn["transactionType"] == "SIMULATED_BUY") \
            else (AuditEventType.HOLDING_CLOSED.value if holding and holding["status"] == "closed" else AuditEventType.HOLDING_UPDATED.value)
        audit.log(state, event_type,
                  _txt(lang, "ההחזקה בתיק הווירטואלי עודכנה.", "The holding in the virtual portfolio was updated."),
                  actor_type="system", recommendation_id=rec_id, transaction_id=txn["id"],
                  after=holding)

        _refresh_prices_and_value(state)
        audit.log(state, AuditEventType.PORTFOLIO_RECALCULATED.value,
                  _txt(lang, "ביצועי התיק הווירטואלי חושבו מחדש.", "Virtual portfolio performance was recalculated."),
                  actor_type="system")
        performance.create_snapshot(state)

        return {"recommendation": rec, "transaction": txn, "holding": holding, "alreadyExecuted": False}
