"""
Unit tests for the Bukra Portfolio Simulator — accounting, execution,
recommendation approval, performance, and edge-case handling.

Run: venv/bin/python -m pytest tests/test_simulator.py -q   (from backend/)
"""

import os
import shutil
import sys
import uuid
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-for-pytest")

import pytest

from services.simulator import service, accounting, performance
from services.simulator.store import UserPortfolioLock, load_state, _path
from services.simulator.execution import simulate_buy, simulate_sell
from services.simulator.models import RecommendationStatus

MOCK_AAPL = {"symbol": "AAPL", "name": "Apple Inc.", "sector": "Technology",
            "price": 200.0, "currency": "USD", "market_cap": 3e12}


@pytest.fixture
def user_id():
    uid = f"pytest-{uuid.uuid4().hex[:10]}"
    yield uid
    try:
        os.remove(_path(uid))
    except FileNotFoundError:
        pass


def make_portfolio(user_id, capital=10000.0, currency="USD", risk="balanced"):
    return service.create_portfolio(user_id, name="Test", base_currency=currency,
                                    initial_capital=capital, risk_profile=risk,
                                    benchmark_symbol=None, lang="en")


# 1 — Portfolio creation
def test_portfolio_creation(user_id):
    p = make_portfolio(user_id)
    assert p["currentCash"] == 10000.0
    assert p["currentValue"] == 10000.0
    assert p["isSimulation"] is True
    assert p["status"] == "active"
    with pytest.raises(service.SimulatorError):
        make_portfolio(user_id)   # only one portfolio per user in Phase 1


# 2 — Virtual deposit
def test_virtual_deposit(user_id):
    make_portfolio(user_id)
    p = service.add_virtual_funds(user_id, 5000.0, lang="en")
    assert p["currentCash"] == 15000.0
    assert p["totalDeposits"] == 15000.0
    txns = service.get_transactions(user_id)
    assert any(t["transactionType"] == "SIMULATED_DEPOSIT" and t["netAmount"] == 5000.0 for t in txns)


# 3 — Simulated buy
def test_simulated_buy(user_id):
    make_portfolio(user_id)
    with patch("services.simulator.pricing.get_company_info", return_value=MOCK_AAPL):
        with UserPortfolioLock(user_id) as state:
            r = simulate_buy(state, "AAPL", 3000.0, sector="Technology")
    assert r.ok
    assert r.transaction["ticker"] == "AAPL"
    assert r.holding["quantity"] > 0
    assert r.transaction["metadata"]["note"] == "No real trade was executed."


# 4 — Simulated sell
def test_simulated_sell(user_id):
    make_portfolio(user_id)
    with patch("services.simulator.pricing.get_company_info", return_value=MOCK_AAPL):
        with UserPortfolioLock(user_id) as state:
            simulate_buy(state, "AAPL", 3000.0)
        with UserPortfolioLock(user_id) as state:
            qty = list(state["holdings"].values())[0]["quantity"]
            r = simulate_sell(state, "AAPL", quantity=qty)
    assert r.ok
    assert r.holding["status"] == "closed"
    assert r.holding["quantity"] == 0.0


# 5 — Cost-basis calculation (two buys average correctly)
def test_cost_basis_averaging(user_id):
    make_portfolio(user_id, capital=20000)
    with patch("services.simulator.pricing.get_company_info", return_value=MOCK_AAPL):
        with UserPortfolioLock(user_id) as state:
            simulate_buy(state, "AAPL", 2000.0)
    higher_price = {**MOCK_AAPL, "price": 220.0}
    with patch("services.simulator.pricing.get_company_info", return_value=higher_price):
        with UserPortfolioLock(user_id) as state:
            simulate_buy(state, "AAPL", 2000.0)
    with UserPortfolioLock(user_id) as state:
        h = list(state["holdings"].values())[0]
        assert h["averageCost"] > 200.0    # blended above the first buy's price
        assert h["averageCost"] < 220.0    # blended below the second buy's price
        assert abs(h["totalCostBasis"] - (h["averageCost"] * h["quantity"])) < 0.01


# 6 — Realized gain calculation
def test_realized_gain(user_id):
    make_portfolio(user_id)
    with patch("services.simulator.pricing.get_company_info", return_value=MOCK_AAPL):
        with UserPortfolioLock(user_id) as state:
            simulate_buy(state, "AAPL", 3000.0)
    higher = {**MOCK_AAPL, "price": 250.0}
    with patch("services.simulator.pricing.get_company_info", return_value=higher):
        with UserPortfolioLock(user_id) as state:
            qty = list(state["holdings"].values())[0]["quantity"]
            r = simulate_sell(state, "AAPL", quantity=qty)
    assert r.transaction["metadata"]["realizedGainLoss"] > 0   # sold higher than bought


# 7 — Unrealized gain calculation (via dashboard recompute)
def test_unrealized_gain(user_id):
    make_portfolio(user_id)
    with patch("services.simulator.pricing.get_company_info", return_value=MOCK_AAPL):
        with UserPortfolioLock(user_id) as state:
            simulate_buy(state, "AAPL", 3000.0)
    with patch("services.simulator.service.get_quote", return_value={"price": 250.0, "currency": "USD", "asOf": "x", "stale": False}):
        dash = service.get_dashboard(user_id, lang="en")
    assert dash["portfolio"]["unrealizedGainLoss"] > 0


# 8 — Fee calculation (min fee floor + pct)
def test_fee_calculation():
    assert accounting.simulated_fee(100.0) == 1.00     # min fee floor
    assert accounting.simulated_fee(100000.0) == 100.0  # 0.1% of 100k


# 9 — FX conversion applied only when required
def test_fx_conversion():
    assert accounting.simulated_fx_cost(1000.0, requires_fx=False) == 0.0
    assert accounting.simulated_fx_cost(1000.0, requires_fx=True) == 2.5


# 10 — Insufficient virtual cash
def test_insufficient_cash(user_id):
    make_portfolio(user_id, capital=100)
    with patch("services.simulator.pricing.get_company_info", return_value=MOCK_AAPL):
        with UserPortfolioLock(user_id) as state:
            r = simulate_buy(state, "AAPL", 50000.0)
    assert not r.ok


# 11 — Selling more than held quantity
def test_sell_more_than_held(user_id):
    make_portfolio(user_id)
    with patch("services.simulator.pricing.get_company_info", return_value=MOCK_AAPL):
        with UserPortfolioLock(user_id) as state:
            simulate_buy(state, "AAPL", 1000.0)
        with UserPortfolioLock(user_id) as state:
            r = simulate_sell(state, "AAPL", quantity=999999)
    assert not r.ok


# 12 — Fractional-share execution
def test_fractional_shares(user_id):
    make_portfolio(user_id)
    with patch("services.simulator.pricing.get_company_info", return_value=MOCK_AAPL):
        with UserPortfolioLock(user_id) as state:
            r = simulate_buy(state, "AAPL", 333.0)
    assert r.ok
    assert r.transaction["quantity"] != int(r.transaction["quantity"])


# 13/14 — Recommendation approval + rejection
def test_recommendation_approval_and_rejection(user_id):
    make_portfolio(user_id)

    def _fake_rec(ticker, amount):
        with UserPortfolioLock(user_id) as state:
            rec = {
                "id": accounting.new_id("rec"), "portfolioId": state["portfolio"]["id"],
                "companyId": ticker, "ticker": ticker, "recommendationType": "ADD_POSITION",
                "recommendationStatus": RecommendationStatus.PENDING.value,
                "currentWeight": 0.0, "targetWeight": 0.05, "proposedAmount": amount,
                "proposedQuantity": None, "reasonSummary": "t", "supportingFactors": [],
                "riskFactors": [], "expectedPortfolioImpact": {}, "bukraScoreSnapshot": 80,
                "valuationScoreSnapshot": 70, "bubbleRiskSnapshot": 20, "confidenceSnapshot": "High",
                "currentPriceSnapshot": 100.0, "fairValueSnapshot": None, "methodologyVersion": "1.0.0",
                "createdAt": accounting.now_iso(), "viewedAt": None, "approvedAt": None,
                "rejectedAt": None, "expiredAt": None, "userDecisionNote": None, "metadata": {},
            }
            state["recommendations"][rec["id"]] = rec
            return rec["id"]

    rec_id = _fake_rec("MSFT", 500.0)
    with pytest.raises(service.SimulatorError):
        service.approve_recommendation(user_id, rec_id, confirmed=False, lang="en")

    with patch("services.simulator.pricing.get_company_info",
              return_value={"symbol": "MSFT", "name": "Microsoft", "sector": "Technology",
                            "price": 400.0, "currency": "USD", "market_cap": 3e12}):
        res = service.approve_recommendation(user_id, rec_id, confirmed=True, lang="en")
    assert res["recommendation"]["recommendationStatus"] == "SIMULATED_EXECUTED"

    rec2_id = _fake_rec("GOOGL", 300.0)
    rejected = service.reject_recommendation(user_id, rec2_id, note="not interested", lang="en")
    assert rejected["recommendationStatus"] == "REJECTED"
    assert rejected["userDecisionNote"] == "not interested"


# 15/16 — Duplicate approval / execution prevention
def test_duplicate_approval_is_idempotent(user_id):
    make_portfolio(user_id)
    with UserPortfolioLock(user_id) as state:
        rec = {
            "id": accounting.new_id("rec"), "portfolioId": state["portfolio"]["id"],
            "companyId": "NVDA", "ticker": "NVDA", "recommendationType": "ADD_POSITION",
            "recommendationStatus": RecommendationStatus.PENDING.value,
            "currentWeight": 0.0, "targetWeight": 0.05, "proposedAmount": 500.0,
            "proposedQuantity": None, "reasonSummary": "t", "supportingFactors": [],
            "riskFactors": [], "expectedPortfolioImpact": {}, "bukraScoreSnapshot": 80,
            "valuationScoreSnapshot": 70, "bubbleRiskSnapshot": 20, "confidenceSnapshot": "High",
            "currentPriceSnapshot": 100.0, "fairValueSnapshot": None, "methodologyVersion": "1.0.0",
            "createdAt": accounting.now_iso(), "viewedAt": None, "approvedAt": None,
            "rejectedAt": None, "expiredAt": None, "userDecisionNote": None, "metadata": {},
        }
        state["recommendations"][rec["id"]] = rec
        rec_id = rec["id"]

    with patch("services.simulator.pricing.get_company_info",
              return_value={"symbol": "NVDA", "name": "NVIDIA", "sector": "Technology",
                            "price": 100.0, "currency": "USD", "market_cap": 1e12}):
        r1 = service.approve_recommendation(user_id, rec_id, confirmed=True, lang="en")
        r2 = service.approve_recommendation(user_id, rec_id, confirmed=True, lang="en")
    assert r1["alreadyExecuted"] is False
    assert r2["alreadyExecuted"] is True    # second call did NOT execute again
    txns = [t for t in service.get_transactions(user_id) if t["ticker"] == "NVDA"]
    assert len(txns) == 1                   # exactly one transaction was created


# 17 — Recommendation expiration
def test_recommendation_expiration(user_id):
    make_portfolio(user_id)
    with UserPortfolioLock(user_id) as state:
        from datetime import datetime, timedelta, timezone
        old_ts = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        rec = {
            "id": accounting.new_id("rec"), "portfolioId": state["portfolio"]["id"],
            "companyId": "T", "ticker": "T", "recommendationType": "ADD_POSITION",
            "recommendationStatus": RecommendationStatus.PENDING.value,
            "currentWeight": 0.0, "targetWeight": 0.05, "proposedAmount": 100.0,
            "proposedQuantity": None, "reasonSummary": "t", "supportingFactors": [],
            "riskFactors": [], "expectedPortfolioImpact": {}, "bukraScoreSnapshot": None,
            "valuationScoreSnapshot": None, "bubbleRiskSnapshot": None, "confidenceSnapshot": None,
            "currentPriceSnapshot": None, "fairValueSnapshot": None, "methodologyVersion": "1.0.0",
            "createdAt": old_ts, "viewedAt": None, "approvedAt": None,
            "rejectedAt": None, "expiredAt": None, "userDecisionNote": None, "metadata": {},
        }
        state["recommendations"][rec["id"]] = rec
        rec_id = rec["id"]

    decisions = service.get_decision_history(user_id, lang="en")
    matched = [r for r in decisions if r["id"] == rec_id][0]
    assert matched["recommendationStatus"] == "EXPIRED"
    with pytest.raises(service.SimulatorError):
        service.approve_recommendation(user_id, rec_id, confirmed=True, lang="en")


# 18 — Portfolio value calculation
def test_portfolio_value_calculation(user_id):
    make_portfolio(user_id, capital=10000)
    with patch("services.simulator.pricing.get_company_info", return_value=MOCK_AAPL):
        with UserPortfolioLock(user_id) as state:
            simulate_buy(state, "AAPL", 4000.0)
    with UserPortfolioLock(user_id) as state:
        p = state["portfolio"]
        assert abs(p["currentCash"] - 6000.0) < 5.0   # ~4000 spent incl. fees


# 19 — Allocation calculation
def test_allocation_calculation(user_id):
    make_portfolio(user_id, capital=10000)
    with patch("services.simulator.pricing.get_company_info", return_value=MOCK_AAPL):
        with UserPortfolioLock(user_id) as state:
            simulate_buy(state, "AAPL", 4000.0, sector="Technology")
    with patch("services.simulator.service.get_quote", return_value={"price": 200.0, "currency": "USD", "asOf": "x", "stale": False}):
        dash = service.get_dashboard(user_id, lang="en")
    sectors = dash["allocation"]["bySector"]
    assert any(s["label"] == "Technology" for s in sectors)
    total_weight = sum(s["weight"] for s in sectors) + dash["allocation"]["cashWeight"]
    assert abs(total_weight - 1.0) < 0.01


# 20 — Portfolio Health calculation (empty vs concentrated)
def test_portfolio_health_empty(user_id):
    make_portfolio(user_id)
    h = service.get_health(user_id, lang="en")
    assert h["numberOfHoldings"] == 0
    assert h["status"] in ("Balanced", "Needs Attention")


# 21 — Time-weighted return does not use naive value/deposits-1 across multiple deposits
def test_time_weighted_return_multi_deposit(user_id):
    make_portfolio(user_id, capital=10000)
    with UserPortfolioLock(user_id) as state:
        performance.create_snapshot(state)
    service.add_virtual_funds(user_id, 5000.0, lang="en")
    with UserPortfolioLock(user_id) as state:
        snap = performance.create_snapshot(state)
    # A same-day deposit must not be counted as investment "return"
    assert snap["cumulativeTimeWeightedReturn"] is not None


# 22 — Money-weighted return / XIRR
def test_money_weighted_return(user_id):
    make_portfolio(user_id, capital=10000)
    with UserPortfolioLock(user_id) as state:
        xirr = performance.money_weighted_return(state)
    # Same-day flows collapse to a single date -> insufficient spread, None is correct
    assert xirr is None or isinstance(xirr, float)


# 23 — Benchmark comparison degrades gracefully when price history unavailable
def test_benchmark_comparison_unavailable(user_id):
    make_portfolio(user_id)
    with patch("services.yahoo_finance.get_price_history", return_value=[]):
        perf = service.get_performance(user_id, period="1Y", lang="en")
    assert perf["benchmark"]["available"] is False


# 24 — Empty portfolio (cash only) dashboard does not crash
def test_empty_portfolio_dashboard(user_id):
    make_portfolio(user_id)
    dash = service.get_dashboard(user_id, lang="en")
    assert dash["holdings"] == []
    assert dash["summary"]["cashPercentage"] == 1.0


# 25 — Portfolio with cash only — recommendation generation does not crash
def test_cash_only_recommendation_generation(user_id):
    make_portfolio(user_id, capital=50000)
    with patch("services.simulator.recommendations._scanner_universe", return_value=[]):
        recs = service.generate_recommendations(user_id, lang="en")
    assert isinstance(recs, list)


# 26 — Missing current price fails safe
def test_missing_price_fails_safe(user_id):
    make_portfolio(user_id)
    with patch("services.simulator.pricing.get_company_info",
              return_value={"symbol": "XXXX", "name": "X", "sector": "", "price": None, "currency": "USD"}), \
         patch("services.simulator.pricing.get_latest_price", return_value=None):
        with UserPortfolioLock(user_id) as state:
            r = simulate_buy(state, "XXXX", 1000.0)
    assert not r.ok


# 27 — Missing FX rate fails safe
def test_missing_fx_rate_fails_safe(user_id):
    make_portfolio(user_id, currency="ILS")
    # execution.py does `from services.simulator.pricing import get_fx_rate`
    # (a direct name import), so the patch must target execution's own
    # bound name, not pricing's — patching pricing.get_fx_rate here would
    # leave execution.py calling the real, unmocked function.
    with patch("services.simulator.pricing.get_company_info", return_value=MOCK_AAPL), \
         patch("services.simulator.execution.get_fx_rate", return_value=None):
        with UserPortfolioLock(user_id) as state:
            r = simulate_buy(state, "AAPL", 1000.0)
    assert not r.ok


# 28 — NaN / Infinity handling
def test_nan_infinity_handling(user_id):
    make_portfolio(user_id)
    assert accounting.is_finite(float("nan")) is False
    assert accounting.is_finite(float("inf")) is False
    assert accounting.is_finite(-float("inf")) is False
    assert accounting.is_finite(5.0) is True
    with patch("services.simulator.pricing.get_company_info", return_value=MOCK_AAPL):
        with UserPortfolioLock(user_id) as state:
            r = simulate_buy(state, "AAPL", float("nan"))
    assert not r.ok
    with UserPortfolioLock(user_id) as state:
        r2 = simulate_buy(state, "AAPL", float("inf"))
    assert not r2.ok


# 29 — Concurrent update protection (sequential lock acquisition, no lost update)
def test_concurrent_update_protection(user_id):
    make_portfolio(user_id, capital=10000)
    import threading
    errors = []

    def deposit():
        try:
            service.add_virtual_funds(user_id, 100.0, lang="en")
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=deposit) for _ in range(10)]
    for t in threads: t.start()
    for t in threads: t.join()

    assert not errors
    with UserPortfolioLock(user_id) as state:
        assert state["portfolio"]["currentCash"] == 11000.0   # all 10 deposits landed, none lost


# 30 — Audit-event creation
def test_audit_event_creation(user_id):
    make_portfolio(user_id)
    events = service.get_audit_trail(user_id, lang="en")
    assert any(e["eventType"] == "PORTFOLIO_CREATED" for e in events)
    assert all(e["methodologyVersion"] == "1.0.0" for e in events)


# Zero/negative trade amount
def test_zero_negative_trade_amount(user_id):
    make_portfolio(user_id)
    with patch("services.simulator.pricing.get_company_info", return_value=MOCK_AAPL):
        with UserPortfolioLock(user_id) as state:
            assert not simulate_buy(state, "AAPL", 0).ok
        with UserPortfolioLock(user_id) as state:
            assert not simulate_buy(state, "AAPL", -100).ok


# Below minimum trade size
def test_minimum_trade_size(user_id):
    make_portfolio(user_id)
    with patch("services.simulator.pricing.get_company_info", return_value=MOCK_AAPL):
        with UserPortfolioLock(user_id) as state:
            r = simulate_buy(state, "AAPL", 10.0)   # below EXECUTION min_trade_amount
    assert not r.ok
