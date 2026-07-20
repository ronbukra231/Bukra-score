"""
Valuation Engine orchestrator.

compute_valuation(symbol, info, financials, lang) → structured analysis dict.
Fails safe: any invalid input path degrades to a structured
insufficient-data result; it never raises into the page pipeline.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from services.valuation.methodology import (
    METHODOLOGY_VERSION, VALUATION_WEIGHTS, VALUATION_BANDS, EXPECTATIONS_BANDS,
    BUBBLE_BANDS, CONFIDENCE_LEVELS, band_label, DCF_BOUNDS,
)
from services.valuation.inputs import normalize_inputs, NormalizedInputs, PROVIDER_UNAVAILABLE
from services.valuation.classify import classify
from services.valuation.dcf import build_discount_rate, reverse_dcf, clamp
from services.valuation.scenarios import build_scenarios
from services.valuation import scoring
from services.valuation.conclusions import build_factors, build_conclusion
from services.valuation.store import save_analysis

logger = logging.getLogger("bukra.valuation")

COST_OF_EQUITY_FINANCIAL = 0.10        # cost of equity for the justified-P/B model
FINANCIAL_GROWTH_BOUNDS = (0.02, 0.04)


def _financial_scenarios(n: NormalizedInputs) -> Optional[dict]:
    """
    Banks/insurers: justified price-to-book from the excess-return identity
    fair P/B = (ROE - g) / (k - g). Requires equity and ROE; otherwise the
    model reports itself as not yet optimized for financial institutions.
    """
    if not n.equity or n.equity <= 0 or n.return_on_equity is None:
        return None
    k = COST_OF_EQUITY_FINANCIAL
    out = {}
    for name, roe_mult, g in (("bear", 0.80, FINANCIAL_GROWTH_BOUNDS[0]),
                              ("base", 1.00, sum(FINANCIAL_GROWTH_BOUNDS) / 2),
                              ("bull", 1.15, FINANCIAL_GROWTH_BOUNDS[1])):
        roe = clamp(n.return_on_equity * roe_mult, -0.5, 0.6)
        pb = max((roe - g) / (k - g), 0.0)
        equity_value = n.equity * pb
        scenario = {
            "assumptions": {
                "model": "justified price-to-book (excess return)",
                "returnOnEquity": round(roe, 4),
                "costOfEquity": k,
                "longTermGrowth": g,
                "justifiedPB": round(pb, 2),
            },
            "fairEquityValue": round(equity_value, 0) if equity_value > 0 else None,
            "fairValuePerShare": None,
            "upsideDownsidePct": None,
            "terminalValuePct": None,
            "available": equity_value > 0,
        }
        if scenario["available"]:
            if n.shares_outstanding:
                scenario["fairValuePerShare"] = round(equity_value / n.shares_outstanding, 2)
            if n.market_cap:
                scenario["upsideDownsidePct"] = round((equity_value / n.market_cap - 1) * 100, 1)
        out[name] = scenario
    return out


def _insufficient_result(n: NormalizedInputs, company_type: str, lang: str, reason_he: str, reason_en: str) -> dict:
    quality = scoring.data_quality(n)
    return {
        "available": False,
        "symbol": n.symbol,
        "companyType": company_type,
        "methodologyVersion": METHODOLOGY_VERSION,
        "calculatedAt": datetime.now(timezone.utc).isoformat(),
        "dataQuality": quality,
        "valuationConfidence": {"score": min(15, 100), "label": "Low"},
        "insufficientReason": reason_he if lang == "he" else reason_en,
        "missingInputs": quality["missingInputs"],
        "providerUnavailableFields": PROVIDER_UNAVAILABLE,
        "currency": n.currency,
        "currentPrice": n.price,
        "currentMarketCap": n.market_cap,
        "conclusion": build_conclusion(lang, n, None, None, "Low", {}, insufficient=True),
        "disclaimer": _disclaimer(lang),
    }


def _disclaimer(lang: str) -> str:
    return ("הערכת השווי מבוססת על נתונים היסטוריים, הנחות ותרחישים ואינה מהווה ייעוץ השקעות או הבטחת תשואה. "
            "שווי המניה בפועל עשוי להיות שונה מהותית מהטווח המחושב.") if lang == "he" else (
            "Valuation estimates are based on historical data, assumptions, and scenarios and do not constitute "
            "investment advice or a guarantee of returns. Actual market value may differ materially from the calculated range.")


def compute_valuation(symbol: str, info: dict, financials: dict,
                      lang: str = "he", bukra_score: Optional[int] = None,
                      persist: bool = True) -> dict:
    try:
        return _compute(symbol, info, financials, lang, bukra_score, persist)
    except Exception as e:
        logger.error("[valuation] failed for %s: %s", symbol, e, exc_info=True)
        n = NormalizedInputs(symbol=symbol.upper())
        return _insufficient_result(n, "unknown", lang,
                                    "אירעה שגיאה בחישוב ההערכה.",
                                    "The valuation computation encountered an error.")


def _compute(symbol, info, financials, lang, bukra_score, persist) -> dict:
    n = normalize_inputs(info, financials)
    company_type = classify(n)

    # Hard insufficiency gates — no fabricated ranges
    if n.price is None or n.market_cap is None or n.market_cap <= 0:
        return _insufficient_result(n, company_type, lang,
            "מחיר שוק או שווי שוק נוכחיים אינם זמינים.",
            "Current market price or market capitalization is unavailable.")
    if company_type == "pre_revenue":
        return _insufficient_result(n, company_type, lang,
            "לחברה אין עדיין הכנסות משמעותיות — לא ניתן לחשב טווח שווי הוגן אמין.",
            "The company has no meaningful revenue yet — a reliable fair value range cannot be calculated.")
    if n.years_of_history == 0:
        return _insufficient_result(n, company_type, lang,
            "לא נמצאו דוחות כספיים היסטוריים.",
            "No historical financial statements were found.")

    discount_rate = build_discount_rate(n)

    # ── Scenarios + methods by company type ──────────────────────────────────
    methods_used = []
    sector_note_he = sector_note_en = None
    if company_type == "financial":
        scenarios = _financial_scenarios(n)
        if scenarios is None:
            return _insufficient_result(n, company_type, lang,
                "מודל הערכת השווי המלא עדיין אינו מותאם למוסדות פיננסיים, ונתוני הון/תשואה על ההון חסרים.",
                "The complete valuation model is not yet optimized for financial institutions, and equity/ROE data is missing.")
        methods_used = ["justified_price_to_book", "excess_return"]
        sector_note_he = "מודל הערכת השווי המלא עדיין אינו מותאם באופן מלא למוסדות פיננסיים — הטווח מבוסס על מודל מכפיל הון מוצדק בלבד."
        sector_note_en = "The complete valuation model is not yet fully optimized for financial institutions — the range is based on a justified price-to-book model only."
        rdcf = None
    else:
        scenarios = build_scenarios(n, company_type, discount_rate)
        rdcf = reverse_dcf(n, discount_rate)
        if scenarios["base"]["available"]:
            methods_used.append("dcf_scenarios")
        if rdcf:
            methods_used.append("reverse_dcf")
        if n.pe_ratio or (n.enterprise_value and n.normalized_fcf and n.normalized_fcf > 0):
            methods_used.append("justified_multiples")
        if company_type == "reit":
            sector_note_he = "נתוני FFO/AFFO אינם זמינים מספק הנתונים הנוכחי — עבור REIT יש להתייחס לטווח בזהירות מוגברת."
            sector_note_en = "FFO/AFFO data is unavailable from the current provider — treat the range for a REIT with added caution."
        if company_type == "cyclical":
            sector_note_he = "החברה מסווגת כמחזורית — ההערכה משתמשת בתזרים ובמרווחים מנורמלים על פני מספר שנים, לא בשנת שיא או שפל בודדת."
            sector_note_en = "The company is classified as cyclical — the estimate uses multi-year normalized cash flow and margins, not a single peak or trough year."

    if not scenarios.get("base", {}).get("available"):
        return _insufficient_result(n, company_type, lang,
            "לא ניתן לבסס תרחיש בסיס אמין מהנתונים הזמינים (תזרים מזומנים חופשי חסר או שלילי לאורך זמן).",
            "A reliable base case cannot be established from the available data (free cash flow missing or persistently negative).")

    # ── Scores ───────────────────────────────────────────────────────────────
    components = {
        "price_vs_fair_value": scoring.score_price_vs_fair(n, scenarios),
        "reverse_dcf":         scoring.score_reverse_dcf(n, rdcf),
        "relative_valuation":  scoring.score_relative_valuation(n, discount_rate),
        "fcf_quality":         scoring.score_fcf_quality(n),
        "balance_sheet_risk":  scoring.score_balance_sheet(n),
    }
    val = scoring.weighted_score(components, VALUATION_WEIGHTS)
    gap = scoring.expectations_gap(n, rdcf)
    bubble = scoring.bubble_risk(n, scenarios, rdcf)
    quality = scoring.data_quality(n)
    conf_score = scoring.valuation_confidence(n, company_type, scenarios, methods_used, rdcf)
    conf_label = band_label(conf_score, [(70, "High"), (40, "Medium"), (0, "Low")])

    # ── Fair value range / margin of safety ──────────────────────────────────
    base = scenarios["base"]
    margin_of_safety = None
    if base.get("fairEquityValue") and n.market_cap:
        margin_of_safety = round((base["fairEquityValue"] - n.market_cap) / base["fairEquityValue"] * 100, 1)

    factors = build_factors(lang, n, scenarios, rdcf, bubble)
    conclusion = build_conclusion(lang, n, val["score"] if val else None,
                                  bukra_score, conf_label, scenarios, insufficient=False)

    hist_growth = n.revenue_cagr if n.revenue_cagr is not None else n.fcf_cagr

    result = {
        "available": True,
        "symbol": n.symbol,
        "companyType": company_type,
        "methodologyVersion": METHODOLOGY_VERSION,
        "calculatedAt": datetime.now(timezone.utc).isoformat(),
        "currency": n.currency,

        "valuationScore": (val or {}).get("score"),
        "valuationScoreLabel": band_label((val or {}).get("score", 0), VALUATION_BANDS),
        "scoreBreakdown": val,

        "expectationsGap": (gap or {}).get("score"),
        "expectationsGapLabel": band_label((gap or {}).get("score", 0), EXPECTATIONS_BANDS) if gap else None,
        "expectationsGapComponents": (gap or {}).get("components"),

        "bubbleRisk": (bubble or {}).get("score"),
        "bubbleRiskLabel": band_label((bubble or {}).get("score", 0), BUBBLE_BANDS) if bubble else None,
        "bubbleRiskBreakdown": bubble,

        "valuationConfidence": {"score": conf_score, "label": conf_label},
        "dataQuality": quality,

        "currentPrice": n.price,
        "currentMarketCap": n.market_cap,
        "enterpriseValue": n.enterprise_value,
        "sharesOutstandingEstimated": round(n.shares_outstanding, 0) if n.shares_outstanding else None,

        "fairValueRange": {
            "bearPerShare": scenarios["bear"].get("fairValuePerShare"),
            "basePerShare": scenarios["base"].get("fairValuePerShare"),
            "bullPerShare": scenarios["bull"].get("fairValuePerShare"),
            "bearMarketCap": scenarios["bear"].get("fairEquityValue"),
            "baseMarketCap": scenarios["base"].get("fairEquityValue"),
            "bullMarketCap": scenarios["bull"].get("fairEquityValue"),
        },
        "marginOfSafety": margin_of_safety,
        "estimatedUpsideDownside": base.get("upsideDownsidePct"),

        "reverseDcf": None if not rdcf else {
            "impliedFcfGrowth": rdcf["implied_fcf_growth"],
            "impliedFcfMargin": rdcf["implied_fcf_margin"],
            "historicalGrowth": round(hist_growth, 4) if hist_growth is not None else None,
            "historicalFcfMargin": round(n.fcf_margin_median, 4) if n.fcf_margin_median is not None else None,
            "requiredRevenueAtHorizon": rdcf["required_revenue_at_horizon"],
            "requiredFcfAtHorizon": rdcf["final_fcf_required"],
            "discountRate": rdcf["discount_rate"],
            "terminalGrowth": rdcf["terminal_growth"],
            "terminalValuePct": rdcf["terminal_value_pct"],
            "forecastYears": rdcf["forecast_years"],
            "solverCapped": rdcf["solver_capped"],
            "fcfProxyUsed": rdcf["fcf_proxy_used"],
        },

        "scenarios": scenarios,
        "positiveFactors": factors["positive"],
        "riskFactors": factors["risk"],
        "valuationMethodsUsed": methods_used,
        "missingInputs": quality["missingInputs"],
        "estimatedInputs": quality["estimatedInputs"],
        "providerUnavailableFields": PROVIDER_UNAVAILABLE,
        "sectorModelNote": sector_note_he if lang == "he" else sector_note_en,
        "assumptions": {
            "discountRate": round(discount_rate, 4),
            "forecastYears": DCF_BOUNDS["forecast_years"],
        },
        "sourceTimestamps": {"financialsSource": financials.get("source"), "years": financials.get("years")},
        "conclusion": conclusion,
        "disclaimer": _disclaimer(lang),
    }

    if persist:
        save_analysis(n.symbol, result)
    return result
