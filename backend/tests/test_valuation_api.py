"""
Integration test — the company page endpoint carries the valuation payload.
Data providers are patched so no live network requests are made.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import patch
from fastapi.testclient import TestClient

import main
import routers.company as company_router
from tests.test_valuation import make_info, make_financials, STABLE_ROWS

client = TestClient(main.app)


def test_page_includes_valuation():
    info = make_info(symbol="TSTV", name="Test Valuation Co")
    fin = make_financials(STABLE_ROWS)
    with patch.object(company_router, "get_company_info", return_value=info), \
         patch.object(company_router, "get_five_year_financials", return_value=fin):
        res = client.get("/api/company/TSTV/page?lang=en")
    assert res.status_code == 200
    body = res.json()
    v = body.get("valuation")
    assert v is not None and v["available"] is True
    # Response schema essentials
    for key in ("valuationScore", "expectationsGap", "bubbleRisk", "valuationConfidence",
                "dataQuality", "fairValueRange", "marginOfSafety", "scenarios",
                "reverseDcf", "positiveFactors", "riskFactors", "missingInputs",
                "valuationMethodsUsed", "assumptions", "calculatedAt",
                "methodologyVersion", "conclusion", "disclaimer"):
        assert key in v, f"missing {key}"
    # Existing payload untouched
    for key in ("score", "rules", "future_relevance", "info", "financials"):
        assert key in body


def test_page_valuation_insufficient_is_safe():
    info = make_info(symbol="TSTX", market_cap=None, price=None, pe_ratio=None)
    fin = make_financials(STABLE_ROWS)
    with patch.object(company_router, "get_company_info", return_value=info), \
         patch.object(company_router, "get_five_year_financials", return_value=fin):
        res = client.get("/api/company/TSTX/page?lang=he")
    assert res.status_code == 200
    v = res.json()["valuation"]
    assert v["available"] is False
    assert v["insufficientReason"]
