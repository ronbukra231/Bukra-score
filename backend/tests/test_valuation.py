"""
Unit tests for the Bukra Valuation Engine.

Fixtures are synthetic financial structures used to exercise calculation
paths — they are test inputs, never displayed product data.

Run: venv/bin/python -m pytest tests/test_valuation.py -q   (from backend/)
"""

import math
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.valuation import compute_valuation
from services.valuation.inputs import normalize_inputs
from services.valuation.classify import classify
from services.valuation.dcf import dcf_enterprise_value, reverse_dcf, build_discount_rate
from services.valuation.scoring import weighted_score
from services.valuation.methodology import VALUATION_WEIGHTS, DCF_BOUNDS


def make_info(**kw):
    base = {"symbol": "TEST", "name": "Test Co", "sector": "Technology",
            "industry": "Software—Infrastructure", "market_cap": 50e9, "price": 100.0,
            "pe_ratio": 25.0, "currency": "USD", "returnOnEquity": 0.25}
    base.update(kw)
    return base


def make_financials(rows):
    return {"years": [r["year"] for r in rows], "history": rows, "raw": {}, "source": "test"}


def year(y, revenue, ni, fcf, debt=1e9, cash=2e9, equity=10e9):
    return {"year": y, "revenue": revenue, "net_income": ni, "net_margin": None,
            "gross_profit": None, "free_cash_flow": fcf, "total_debt": debt,
            "cash": cash, "total_assets": None, "stockholders_equity": equity}


STABLE_ROWS = [year(2021 + i, 10e9 * 1.08 ** i, 2e9 * 1.08 ** i, 2.2e9 * 1.08 ** i) for i in range(5)]


def run(info=None, rows=None, lang="en"):
    return compute_valuation("TEST", info or make_info(),
                             make_financials(rows if rows is not None else STABLE_ROWS),
                             lang=lang, bukra_score=75, persist=False)


# 1 — profitable, stable positive FCF
def test_profitable_stable():
    r = run()
    assert r["available"] is True
    assert 0 <= r["valuationScore"] <= 100
    assert r["fairValueRange"]["basePerShare"] is not None
    assert r["scenarios"]["bear"]["fairEquityValue"] < r["scenarios"]["bull"]["fairEquityValue"]
    assert r["reverseDcf"] is not None
    assert r["marginOfSafety"] is not None


# 2 — high growth, negative FCF
def test_high_growth_negative_fcf():
    rows = [year(2021 + i, 1e9 * 1.5 ** i, -0.2e9, -0.3e9, debt=0.1e9, cash=3e9) for i in range(4)]
    r = run(make_info(market_cap=30e9, pe_ratio=None), rows)
    assert r["available"] is True
    assert r["companyType"] == "high_growth"
    assert r["valuationConfidence"]["label"] in ("Low", "Medium")
    # transition-to-profitability scenarios carry explicit margin assumptions
    assert r["scenarios"]["base"]["assumptions"]["marginMultiplier"] == 1.0


# 3 — high debt lowers balance-sheet score; debt above enterprise value fails safely
def test_high_debt():
    rows = [year(2021 + i, 10e9, 1e9, 1.1e9, debt=8e9, cash=0.5e9) for i in range(5)]
    r = run(rows=rows)
    clean = run()
    assert r["scoreBreakdown"]["componentScores"]["balance_sheet_risk"] < \
           clean["scoreBreakdown"]["componentScores"]["balance_sheet_risk"]
    # Net debt exceeding the DCF enterprise value → structured insufficiency, no fabricated range
    extreme = run(rows=[year(2021 + i, 10e9, 1e9, 1.1e9, debt=60e9, cash=0.5e9) for i in range(5)])
    assert extreme["available"] is False


# 4 — net cash position raises balance-sheet score
def test_net_cash():
    rows = [year(2021 + i, 10e9, 2e9, 2e9, debt=0.2e9, cash=20e9) for i in range(5)]
    r = run(rows=rows)
    assert r["scoreBreakdown"]["componentScores"]["balance_sheet_risk"] >= 80


# 5 — very limited data
def test_limited_data():
    r = run(rows=[year(2025, 5e9, 0.5e9, 0.6e9)])
    assert r["dataQuality"]["level"] in ("limited", "partial", "insufficient")
    assert "sufficient_financial_history" in r["dataQuality"]["missingInputs"]


# 6 — trading below the fair range → high valuation score, positive MoS
def test_trading_below_range():
    r = run(make_info(market_cap=8e9, price=20.0))
    assert r["marginOfSafety"] is not None and r["marginOfSafety"] > 0
    assert r["valuationScore"] >= 65


# 7 — trading far above the range → low score, downside, elevated bubble risk
def test_trading_far_above_range():
    r = run(make_info(market_cap=400e9, price=800.0, pe_ratio=200.0))
    assert r["valuationScore"] <= 35
    assert r["estimatedUpsideDownside"] < 0
    assert r["bubbleRisk"] >= 50
    assert r["expectationsGap"] >= 50


# 8 — missing components trigger weight normalization
def test_weight_normalization():
    res = weighted_score({"price_vs_fair_value": 80.0, "fcf_quality": 60.0,
                          "reverse_dcf": None, "relative_valuation": None,
                          "balance_sheet_risk": None}, VALUATION_WEIGHTS)
    assert res["missingComponents"] == ["reverse_dcf", "relative_valuation", "balance_sheet_risk"]
    assert abs(sum(res["normalizedWeights"].values()) - 1.0) < 1e-6
    expected = 80 * (0.35 / 0.45) + 60 * (0.10 / 0.45)
    assert abs(res["score"] - round(expected)) <= 1


# 9 — NaN / Infinity are sanitized, never propagate
def test_nan_infinity():
    rows = [year(2021 + i, float("nan"), float("inf"), 2e9) for i in range(3)]
    rows += STABLE_ROWS[3:]
    info = make_info(market_cap=float("inf"), price=float("nan"))
    r = compute_valuation("TEST", info, make_financials(rows), lang="en", persist=False)
    assert r["available"] is False           # structured insufficiency, no crash
    n = normalize_inputs(info, make_financials(rows))
    assert n.market_cap is None and n.price is None


# 10 — financial institution: justified P/B, sector note, no blind FCF-DCF
def test_financial_institution():
    info = make_info(sector="Financial Services", industry="Banks—Diversified",
                     market_cap=40e9, price=50.0, returnOnEquity=0.12)
    rows = [year(2021 + i, 8e9, 2e9, None, debt=None, cash=None, equity=30e9) for i in range(5)]
    r = compute_valuation("TEST", info, make_financials(rows), lang="en", persist=False)
    assert r["companyType"] == "financial"
    assert r["available"] is True
    assert "justified_price_to_book" in r["valuationMethodsUsed"]
    assert r["sectorModelNote"] is not None
    assert r["reverseDcf"] is None


# 11 — REIT: flagged, cautious note, lowered confidence
def test_reit():
    info = make_info(sector="Real Estate", industry="REIT—Retail")
    r = compute_valuation("TEST", info, make_financials(STABLE_ROWS), lang="en", persist=False)
    assert r["companyType"] == "reit"
    assert r["sectorModelNote"] is not None
    assert r["valuationConfidence"]["score"] <= 60


# 12 — cyclical: classified, uses normalized multi-year FCF
def test_cyclical():
    info = make_info(sector="Energy", industry="Oil & Gas E&P")
    rows = [year(2021, 10e9, 3e9, 4e9), year(2022, 6e9, 0.5e9, 0.5e9),
            year(2023, 12e9, 4e9, 5e9), year(2024, 8e9, 1e9, 1.5e9), year(2025, 9e9, 2e9, 2e9)]
    r = compute_valuation("TEST", info, make_financials(rows), lang="en", persist=False)
    assert r["companyType"] == "cyclical"
    n = normalize_inputs(info, make_financials(rows))
    assert n.normalized_fcf == 2e9           # median, not the 5e9 peak


# 13 — cash burn with short runway is surfaced as a risk factor
def test_dilution_cash_burn():
    rows = [year(2021 + i, 2e9 * 1.3 ** i, -0.5e9, -0.8e9, debt=0.1e9, cash=1.5e9) for i in range(4)]
    r = run(make_info(market_cap=20e9), rows)
    assert any("runway" in f or "financing" in f for f in r["riskFactors"])


# 14 — currency is carried from provider info, never assumed
def test_currency_consistency():
    r = run(make_info(currency="ILS"))
    assert r["currency"] == "ILS"


# 15 — discount rate <= terminal growth is repaired, never divides to infinity
def test_discount_vs_terminal():
    r = dcf_enterprise_value(1e9, 0.05, discount_rate=0.02, terminal_growth=0.03)
    assert r is not None and math.isfinite(r["ev"]) and r["ev"] > 0


# 16 — unstable/negative FCF history → structured insufficiency for base case
def test_negative_unstable_fcf():
    rows = [year(2021 + i, 5e9, -1e9, -1e9 if i % 2 == 0 else -0.2e9, cash=0.5e9) for i in range(5)]
    r = run(make_info(market_cap=10e9, revenue=None), rows)
    # high_growth path excluded (low growth) → standard with no positive FCF
    assert r["available"] is False or r["valuationConfidence"]["label"] == "Low"


# 17 — wide scenario dispersion lowers confidence vs a tight range
def test_method_dispersion():
    volatile = [year(2021, 10e9, 1e9, 0.5e9), year(2022, 14e9, 3e9, 4e9),
                year(2023, 9e9, 0.2e9, 0.3e9), year(2024, 16e9, 4e9, 5e9), year(2025, 11e9, 1e9, 1e9)]
    r_vol = run(rows=volatile)
    r_stable = run()
    assert r_vol["valuationConfidence"]["score"] < r_stable["valuationConfidence"]["score"]


# 18 — insufficient data: no price/market cap → structured result, no range
def test_insufficient():
    r = compute_valuation("TEST", make_info(market_cap=None, price=None),
                          make_financials(STABLE_ROWS), lang="he", persist=False)
    assert r["available"] is False
    assert r["dataQuality"]["level"] == "insufficient"
    assert "insufficientReason" in r and r["conclusion"]
    assert "fairValueRange" not in r         # no fabricated range


# Pre-revenue: refuses to invent a valuation
def test_pre_revenue():
    rows = [year(2024, 0, -0.1e9, -0.1e9), year(2025, 0, -0.2e9, -0.2e9)]
    r = compute_valuation("TEST", make_info(), make_financials(rows), lang="en", persist=False)
    assert classify(normalize_inputs(make_info(), make_financials(rows))) == "pre_revenue"
    assert r["available"] is False


# Reverse DCF caps at the solver ceiling for absurd prices
def test_reverse_dcf_cap():
    info = make_info(market_cap=5000e9, price=5000.0)
    n = normalize_inputs(info, make_financials(STABLE_ROWS))
    rd = reverse_dcf(n, build_discount_rate(n))
    assert rd["solver_capped"] is True
    assert rd["implied_fcf_growth"] == DCF_BOUNDS["implied_growth_max"]


# Bilingual output
def test_hebrew_output():
    r = run(lang="he")
    assert "המדד" in r["conclusion"] or "תרחיש" in r["conclusion"] or "טווח" in r["conclusion"]
    assert "ייעוץ השקעות" in r["disclaimer"]
