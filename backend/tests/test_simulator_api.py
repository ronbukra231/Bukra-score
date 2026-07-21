"""
Integration tests — the Simulator REST API, including auth enforcement and
cross-user isolation. Data providers are patched; no live network calls.
"""

import os
import sys
import uuid
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-for-pytest")

import jwt
import pytest
from fastapi.testclient import TestClient

import main
from services.simulator.store import _path

client = TestClient(main.app)


def make_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id}, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256")


def auth(user_id: str) -> dict:
    return {"Authorization": f"Bearer {make_token(user_id)}"}


@pytest.fixture
def user_id():
    uid = f"pytest-api-{uuid.uuid4().hex[:10]}"
    yield uid
    try:
        os.remove(_path(uid))
    except FileNotFoundError:
        pass


def test_requires_auth():
    res = client.get("/api/simulator/dashboard")
    assert res.status_code == 401


def test_rejects_bad_token():
    res = client.get("/api/simulator/dashboard", headers={"Authorization": "Bearer garbage"})
    assert res.status_code == 401


def test_create_and_dashboard(user_id):
    res = client.post("/api/simulator/portfolio?lang=en", headers=auth(user_id), json={
        "name": "My Sim", "baseCurrency": "USD", "initialCapital": 10000,
        "riskProfile": "balanced", "benchmarkSymbol": None,
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["currentCash"] == 10000
    assert body["isSimulation"] is True

    dash = client.get("/api/simulator/dashboard?lang=en", headers=auth(user_id))
    assert dash.status_code == 200
    assert dash.json()["isSimulation"] is True
    assert dash.json()["holdings"] == []


def test_duplicate_portfolio_rejected(user_id):
    body = {"name": "P1", "baseCurrency": "USD", "initialCapital": 5000,
           "riskProfile": "balanced", "benchmarkSymbol": None}
    r1 = client.post("/api/simulator/portfolio?lang=en", headers=auth(user_id), json=body)
    assert r1.status_code == 200
    r2 = client.post("/api/simulator/portfolio?lang=en", headers=auth(user_id), json=body)
    assert r2.status_code == 409


def test_cross_user_isolation(user_id):
    other = f"other-{uuid.uuid4().hex[:8]}"
    try:
        client.post("/api/simulator/portfolio?lang=en", headers=auth(user_id), json={
            "name": "Mine", "baseCurrency": "USD", "initialCapital": 10000,
            "riskProfile": "balanced", "benchmarkSymbol": None,
        })
        # A different authenticated user has no portfolio of their own yet
        res = client.get("/api/simulator/dashboard?lang=en", headers=auth(other))
        assert res.status_code == 404
        # And their dashboard never contains the first user's data
    finally:
        try:
            os.remove(_path(other))
        except FileNotFoundError:
            pass


def test_deposit_and_risk_profile(user_id):
    client.post("/api/simulator/portfolio?lang=en", headers=auth(user_id), json={
        "name": "P", "baseCurrency": "USD", "initialCapital": 10000,
        "riskProfile": "balanced", "benchmarkSymbol": None,
    })
    res = client.post("/api/simulator/deposit?lang=en", headers=auth(user_id), json={"amount": 2500})
    assert res.status_code == 200
    assert res.json()["currentCash"] == 12500

    res2 = client.put("/api/simulator/risk-profile?lang=en", headers=auth(user_id),
                      json={"riskProfile": "growth"})
    assert res2.status_code == 200
    assert res2.json()["riskProfile"] == "growth"


def test_approval_requires_checkbox(user_id):
    client.post("/api/simulator/portfolio?lang=en", headers=auth(user_id), json={
        "name": "P", "baseCurrency": "USD", "initialCapital": 10000,
        "riskProfile": "balanced", "benchmarkSymbol": None,
    })
    # Manufacture a recommendation directly via the service layer for a
    # deterministic API-level approval test.
    from services.simulator import accounting
    from services.simulator.store import UserPortfolioLock
    from services.simulator.models import RecommendationStatus
    with UserPortfolioLock(user_id) as state:
        rec = {
            "id": accounting.new_id("rec"), "portfolioId": state["portfolio"]["id"],
            "companyId": "AAPL", "ticker": "AAPL", "recommendationType": "ADD_POSITION",
            "recommendationStatus": RecommendationStatus.PENDING.value,
            "currentWeight": 0.0, "targetWeight": 0.05, "proposedAmount": 500.0,
            "proposedQuantity": None, "reasonSummary": "t", "supportingFactors": [],
            "riskFactors": [], "expectedPortfolioImpact": {}, "bukraScoreSnapshot": 80,
            "valuationScoreSnapshot": 70, "bubbleRiskSnapshot": 20, "confidenceSnapshot": "High",
            "currentPriceSnapshot": 200.0, "fairValueSnapshot": None, "methodologyVersion": "1.0.0",
            "createdAt": accounting.now_iso(), "viewedAt": None, "approvedAt": None,
            "rejectedAt": None, "expiredAt": None, "userDecisionNote": None, "metadata": {},
        }
        state["recommendations"][rec["id"]] = rec
        rec_id = rec["id"]

    res = client.post(f"/api/simulator/recommendations/{rec_id}/approve?lang=en",
                      headers=auth(user_id), json={"confirmed": False})
    assert res.status_code == 400

    with patch("services.simulator.pricing.get_company_info",
              return_value={"symbol": "AAPL", "name": "Apple", "sector": "Technology",
                            "price": 200.0, "currency": "USD", "market_cap": 3e12}):
        res2 = client.post(f"/api/simulator/recommendations/{rec_id}/approve?lang=en",
                           headers=auth(user_id), json={"confirmed": True})
    assert res2.status_code == 200
    assert res2.json()["recommendation"]["recommendationStatus"] == "SIMULATED_EXECUTED"


def test_audit_and_activity_endpoints(user_id):
    client.post("/api/simulator/portfolio?lang=en", headers=auth(user_id), json={
        "name": "P", "baseCurrency": "USD", "initialCapital": 10000,
        "riskProfile": "balanced", "benchmarkSymbol": None,
    })
    audit = client.get("/api/simulator/audit?lang=en", headers=auth(user_id))
    assert audit.status_code == 200
    assert any(e["eventType"] == "PORTFOLIO_CREATED" for e in audit.json())

    activity = client.get("/api/simulator/activity?lang=en", headers=auth(user_id))
    assert activity.status_code == 200

    decisions = client.get("/api/simulator/decisions?lang=en", headers=auth(user_id))
    assert decisions.status_code == 200
