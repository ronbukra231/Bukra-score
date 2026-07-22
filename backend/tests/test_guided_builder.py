"""
Guided Portfolio Builder — one-recommendation-at-a-time engine and API.

Run: venv/bin/python -m pytest tests/test_guided_builder.py -q   (from backend/)
"""

import os
import sys
import time
import uuid
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-for-pytest")
os.environ.pop("SUPABASE_URL", None)

import jwt
import pytest
from fastapi.testclient import TestClient

import main
from services.simulator import service, recommendations as reco_engine
from services.simulator.store import _path

client = TestClient(main.app)


def make_token(user_id: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {"sub": user_id, "aud": "authenticated", "exp": now + 3600, "iat": now},
        os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256",
    )


def auth(user_id: str) -> dict:
    return {"Authorization": f"Bearer {make_token(user_id)}"}


@pytest.fixture
def user_id():
    uid = f"pytest-guided-{uuid.uuid4().hex[:10]}"
    yield uid
    try:
        os.remove(_path(uid))
    except FileNotFoundError:
        pass


def make_portfolio(user_id, capital=100000.0, risk="balanced"):
    return service.create_portfolio(user_id, name="Test", base_currency="USD",
                                    initial_capital=capital, risk_profile=risk,
                                    benchmark_symbol=None, lang="en")


SCANNER = [
    {"ticker": "AAA", "sector": "Technology", "bukra_score": 80},
    {"ticker": "BBB", "sector": "Healthcare", "bukra_score": 78},
    {"ticker": "CCC", "sector": "Technology", "bukra_score": 60},
]


def _analysis(ticker, score, valuation_score, bubble_risk, confidence=70, base_per_share=120.0, price=100.0):
    return {
        "info": {"name": ticker, "sector": "Technology"},
        "score": {"score": score},
        "valuation": {
            "available": True, "valuationScore": valuation_score, "bubbleRisk": bubble_risk,
            "valuationConfidence": {"score": confidence, "label": "medium"},
            "currentPrice": price,
            "fairValueRange": {"bearPerShare": 80.0, "basePerShare": base_per_share, "bullPerShare": 160.0},
            "dataQuality": {"level": "sufficient"},
        },
    }


def _fake_analyze(overrides):
    def _inner(ticker, lang):
        return overrides.get(ticker)
    return _inner


# 1 — Picks the higher Portfolio Opportunity Score, not just the higher Bukra Score
def test_picks_highest_opportunity_score(user_id):
    make_portfolio(user_id)
    analyses = {
        # AAA: high Bukra Score but poor valuation / high bubble risk
        "AAA": _analysis("AAA", score=80, valuation_score=30, bubble_risk=80, base_per_share=95.0),
        # BBB: slightly lower Bukra Score but much better valuation, safety margin, low bubble risk
        "BBB": _analysis("BBB", score=78, valuation_score=85, bubble_risk=10, base_per_share=180.0),
    }
    with patch("services.simulator.recommendations._scanner_universe", return_value=SCANNER[:2]), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)):
        rec = service.generate_guided_recommendation(user_id, lang="en")
    assert rec is not None
    assert rec["ticker"] == "BBB"
    assert rec["metadata"]["guided"] is True
    assert 0 <= rec["metadata"]["opportunityScore"] <= 100


# 2 — Never recommends the same ticker twice in one guided session
def test_excludes_tickers_already_shown(user_id):
    make_portfolio(user_id)
    analyses = {
        "AAA": _analysis("AAA", score=80, valuation_score=70, bubble_risk=20),
        "BBB": _analysis("BBB", score=78, valuation_score=68, bubble_risk=25),
    }
    with patch("services.simulator.recommendations._scanner_universe", return_value=SCANNER[:2]), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)):
        first = service.generate_guided_recommendation(user_id, lang="en")
        second = service.generate_guided_recommendation(user_id, exclude_tickers=[first["ticker"]], lang="en")
    assert second is not None
    assert second["ticker"] != first["ticker"]


# 3 — No candidate clears the quality bar → intentionally leaves cash uninvested
def test_no_qualifying_candidate_returns_none(user_id):
    make_portfolio(user_id)
    analyses = {"AAA": _analysis("AAA", score=80, valuation_score=5, bubble_risk=95)}
    with patch("services.simulator.recommendations._scanner_universe", return_value=SCANNER[:1]), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)):
        rec = service.generate_guided_recommendation(user_id, lang="en")
    assert rec is None


# 4 — Empty scanner universe never crashes, just returns None
def test_empty_universe_returns_none(user_id):
    make_portfolio(user_id)
    with patch("services.simulator.recommendations._scanner_universe", return_value=[]):
        rec = service.generate_guided_recommendation(user_id, lang="en")
    assert rec is None


# 5 — Allocation sizing respects the 3-10% guardrails from the opportunity score
def test_position_sizing_tiers():
    assert reco_engine._guided_position_pct(40) == pytest.approx(0.03 + (40 / 85) * 0.03, abs=1e-4)
    assert 0.03 <= reco_engine._guided_position_pct(0) <= 0.06
    assert reco_engine._guided_position_pct(85) == 0.08
    assert reco_engine._guided_position_pct(92) == 0.10
    assert reco_engine._guided_position_pct(100) == 0.10


# 6 — API: /builder/next returns a recommendation, then {"done": true} once excluded
def test_builder_next_endpoint(user_id):
    make_portfolio(user_id)
    analyses = {"AAA": _analysis("AAA", score=80, valuation_score=70, bubble_risk=20)}
    with patch("services.simulator.recommendations._scanner_universe", return_value=SCANNER[:1]), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)):
        res = client.post("/api/simulator/builder/next?lang=en", headers=auth(user_id), json={"excludeTickers": []})
        assert res.status_code == 200
        body = res.json()
        assert body["ticker"] == "AAA"

        res2 = client.post("/api/simulator/builder/next?lang=en", headers=auth(user_id),
                           json={"excludeTickers": ["AAA"]})
        assert res2.status_code == 200
        assert res2.json() == {"done": True}


# 7 — Investing via the existing approve endpoint updates cash/holdings, and
#     the next guided call excludes the now-held ticker automatically.
def test_invest_then_next_excludes_held_ticker(user_id):
    make_portfolio(user_id, capital=100000)
    analyses = {
        "AAA": _analysis("AAA", score=80, valuation_score=70, bubble_risk=20, price=50.0),
        "BBB": _analysis("BBB", score=75, valuation_score=65, bubble_risk=25, price=60.0),
    }
    with patch("services.simulator.recommendations._scanner_universe", return_value=SCANNER[:2]), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)), \
         patch("services.simulator.pricing.get_company_info", return_value={"symbol": "AAA", "name": "AAA",
               "sector": "Technology", "price": 50.0, "currency": "USD", "market_cap": 1e9}):
        rec = service.generate_guided_recommendation(user_id, lang="en")
        assert rec["ticker"] in ("AAA", "BBB")
        result = service.approve_recommendation(user_id, rec["id"], True, lang="en")
        assert result["recommendation"]["recommendationStatus"] == "SIMULATED_EXECUTED"

        nxt = service.generate_guided_recommendation(user_id, lang="en")
        assert nxt is None or nxt["ticker"] != rec["ticker"]
