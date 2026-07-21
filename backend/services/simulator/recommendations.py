"""
Recommendation generation — deterministic, rule-based, zero LLM involvement.

Every recommendation is derived from the same real scoring engines the rest
of the platform uses (Bukra Score, Valuation Score, Bubble Risk, Valuation
Confidence) plus the portfolio's own current state (weights, sector
exposure, cash). Nothing here is random and nothing is fabricated: a
candidate with unavailable data is simply skipped, never guessed.

This module only CREATES recommendations. It never executes anything.
"""

import json
import logging
import os
from typing import Optional

from services.data_service import get_company_info, get_five_year_financials
from services.bukra_score import compute_bukra_score
from services.valuation import compute_valuation
from services.simulator import accounting
from services.simulator.config import RISK_PROFILES, RECOMMENDATION_RULES, RECOMMENDATION_EXPIRY_DAYS, METHODOLOGY_VERSION
from services.simulator.models import RecommendationType, RecommendationStatus

logger = logging.getLogger("bukra.simulator.recommendations")

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
_SCANNER_CACHE = os.path.join(_DATA_DIR, "scanner_cache.json")


def _scanner_universe() -> list[dict]:
    try:
        with open(_SCANNER_CACHE, encoding="utf-8") as f:
            return json.load(f).get("results", [])
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _analyze_ticker(ticker: str, lang: str) -> Optional[dict]:
    """Fresh Bukra Score + Valuation for one ticker. None if data unusable."""
    try:
        info = get_company_info(ticker)
        fin = get_five_year_financials(ticker)
        if not info.get("name") or not fin.get("history"):
            return None
        score_data = compute_bukra_score(fin, info)
        if score_data.get("score") is None:
            return None
        valuation = compute_valuation(ticker, info, fin, lang=lang,
                                      bukra_score=score_data.get("score"), persist=False)
        return {"info": info, "score": score_data, "valuation": valuation}
    except Exception as e:
        logger.warning("[recommendations] analysis failed for %s: %s", ticker, e)
        return None


def _sector_weight(state: dict, sector: str, exclude_ticker: str = None) -> float:
    p = state["portfolio"]
    if p["currentValue"] <= 0:
        return 0.0
    total = sum(
        h["currentMarketValue"] for h in state["holdings"].values()
        if h["status"] == "open" and h.get("sector") == sector and h["ticker"] != exclude_ticker
    )
    return total / p["currentValue"]


def _txt(lang, he, en):
    return he if lang == "he" else en


def _reason_factors(lang: str, analysis: dict, rules: dict) -> tuple[list, list]:
    score = analysis["score"]["score"]
    val = analysis["valuation"]
    positive, risk = [], []

    if score >= rules["min_bukra_score"]:
        positive.append(_txt(lang, "ציון בוקרה גבוה מעיד על איכות עסקית חזקה.",
                             "A high Bukra Score reflects strong business quality."))
    if val.get("available") and (val.get("valuationScore") or 0) >= rules["min_valuation_score"]:
        positive.append(_txt(lang, "המדד זיהה תמחור אטרקטיבי במחיר הנוכחי.",
                             "The Index identified an attractive valuation at the current price."))
    if val.get("available") and (val.get("bubbleRisk") or 100) < rules["max_bubble_risk"]:
        positive.append(_txt(lang, "רמת סיכון תמחור ספקולטיבי נמוכה יחסית.",
                             "Relatively low speculative valuation risk."))
    if val.get("available") and val["valuationConfidence"]["score"] >= rules["min_valuation_conf"]:
        positive.append(_txt(lang, "רמת ביטחון גבוהה בנתונים הזמינים.",
                             "High confidence in the available data."))

    if val.get("available") and (val.get("bubbleRisk") or 0) >= 50:
        risk.append(_txt(lang, "התמחור הנוכחי רגיש להנחות צמיחה עתידיות.",
                         "The current valuation remains sensitive to future growth assumptions."))
    if val.get("dataQuality", {}).get("level") in ("limited", "partial"):
        risk.append(_txt(lang, "רמת ביטחון בהערכת השווי מוגבלת.",
                         "Limited confidence in the valuation estimate."))
    if not risk:
        risk.append(_txt(lang, "כל השקעה כרוכה באי-ודאות ותנודתיות מחיר.",
                         "Every position carries uncertainty and price volatility."))
    return positive, risk


def _impact(state: dict, ticker: str, sector: str, proposed_amount: float,
           current_weight: float) -> dict:
    p = state["portfolio"]
    total = max(p["currentValue"], 1e-9)
    target_weight = round((current_weight * total + proposed_amount) / total, 4) if total else 0.0
    current_sector_w = _sector_weight(state, sector, exclude_ticker=ticker)
    n_open = sum(1 for h in state["holdings"].values() if h["status"] == "open")
    already_held = accounting.find_open_holding(state, ticker) is not None
    return {
        "currentWeight": round(current_weight, 4),
        "proposedWeight": target_weight,
        "currentSectorWeight": round(current_sector_w, 4),
        "proposedSectorWeight": round(current_sector_w + proposed_amount / total, 4),
        "currentCash": round(p["currentCash"], 2),
        "cashAfterExecution": round(p["currentCash"] - proposed_amount, 2),
        "currentHoldingsCount": n_open,
        "holdingsCountAfter": n_open if already_held else n_open + 1,
    }


def _snapshot_fields(analysis: dict) -> dict:
    val = analysis["valuation"]
    return {
        "bukraScoreSnapshot": analysis["score"]["score"],
        "valuationScoreSnapshot": val.get("valuationScore"),
        "bubbleRiskSnapshot": val.get("bubbleRisk"),
        "confidenceSnapshot": val.get("valuationConfidence", {}).get("label"),
        "currentPriceSnapshot": val.get("currentPrice"),
        "fairValueSnapshot": val.get("fairValueRange"),
    }


def _new_recommendation(state: dict, ticker: str, rtype: str, current_weight: float,
                        target_weight: float, proposed_amount, proposed_qty,
                        reason: str, positive: list, risk: list, impact: dict,
                        analysis: Optional[dict], lang: str) -> dict:
    snap = _snapshot_fields(analysis) if analysis else {
        "bukraScoreSnapshot": None, "valuationScoreSnapshot": None, "bubbleRiskSnapshot": None,
        "confidenceSnapshot": None, "currentPriceSnapshot": None, "fairValueSnapshot": None,
    }
    return {
        "id": accounting.new_id("rec"), "portfolioId": state["portfolio"]["id"],
        "companyId": ticker, "ticker": ticker, "recommendationType": rtype,
        "recommendationStatus": RecommendationStatus.PENDING.value,
        "currentWeight": round(current_weight, 4), "targetWeight": round(target_weight, 4),
        "proposedAmount": proposed_amount, "proposedQuantity": proposed_qty,
        "reasonSummary": reason, "supportingFactors": positive, "riskFactors": risk,
        "expectedPortfolioImpact": impact, "methodologyVersion": METHODOLOGY_VERSION,
        "createdAt": accounting.now_iso(), "viewedAt": None, "approvedAt": None,
        "rejectedAt": None, "expiredAt": None, "userDecisionNote": None,
        "metadata": {"expiryDays": RECOMMENDATION_EXPIRY_DAYS},
        **snap,
    }


def generate_recommendations(state: dict, lang: str = "he", max_new: Optional[int] = None) -> list[dict]:
    """
    Deterministic pass over held positions (REDUCE/EXIT/REVIEW candidates)
    and the cached scanner universe (ADD_POSITION candidates). Returns the
    newly created recommendation dicts; also appends them to state.
    """
    p = state["portfolio"]
    rules = RISK_PROFILES.get(p["riskProfile"], RISK_PROFILES["balanced"])
    rr = RECOMMENDATION_RULES
    max_new = max_new or rr["max_new_recommendations_per_run"]

    # Avoid duplicate PENDING recommendations for the same ticker
    pending_tickers = {
        r["ticker"] for r in state["recommendations"].values()
        if r["recommendationStatus"] == RecommendationStatus.PENDING.value
    }

    created = []

    # ── Existing holdings: REDUCE / EXIT / REVIEW ─────────────────────────────
    for h in list(state["holdings"].values()):
        if h["status"] != "open" or h["ticker"] in pending_tickers:
            continue
        analysis = _analyze_ticker(h["ticker"], lang)
        weight = h.get("portfolioWeight") or 0.0
        sector = h.get("sector", "")

        if analysis is None:
            rec = _new_recommendation(
                state, h["ticker"], RecommendationType.EXIT_POSITION.value, weight, 0.0,
                -h["currentMarketValue"], -h["quantity"],
                _txt(lang, "לא ניתן לאמת נתונים פיננסיים אמינים עבור החזקה זו.",
                     "Reliable financial data could not be verified for this holding."),
                [], [_txt(lang, "איכות הנתונים אינה מספקת להערכה שוטפת.",
                          "Data quality is insufficient for ongoing evaluation.")],
                _impact(state, h["ticker"], sector, -h["currentMarketValue"], weight),
                None, lang,
            )
            state["recommendations"][rec["id"]] = rec
            created.append(rec)
            continue

        score = analysis["score"]["score"]
        val = analysis["valuation"]
        positive, risk = _reason_factors(lang, analysis, rules)

        if (score is not None and score < rr["exit_bukra_score_critical"]) or \
           val.get("dataQuality", {}).get("level") == rr["exit_data_quality"]:
            reason = _txt(lang,
                "ציון בוקרה ירד מתחת לסף הקריטי, או שאיכות הנתונים אינה אמינה — תזת ההשקעה המקורית נשחקה.",
                "The Bukra Score fell below the critical threshold, or data quality is unreliable — the original thesis has deteriorated materially.")
            rec = _new_recommendation(state, h["ticker"], RecommendationType.EXIT_POSITION.value,
                                      weight, 0.0, -h["currentMarketValue"], -h["quantity"],
                                      reason, positive, risk,
                                      _impact(state, h["ticker"], sector, -h["currentMarketValue"], weight),
                                      analysis, lang)
        elif (weight > rules["max_position_pct"] + rr["reduce_weight_overshoot_pct"]) or \
             (val.get("available") and val.get("bubbleRisk") and val["bubbleRisk"] >= rules["max_bubble_risk"]) or \
             (val.get("available") and val.get("fairValueRange", {}).get("bullPerShare") and
              val["currentPrice"] and val["currentPrice"] > val["fairValueRange"]["bullPerShare"] * (1 + rr["reduce_price_over_bull_pct"])):
            reduce_amount = round(h["currentMarketValue"] * 0.30, 2)
            reduce_qty = round(h["quantity"] * 0.30, 8)
            reason = _txt(lang,
                "המשקל בתיק חורג מהמגבלה שהוגדרה בפרופיל הסיכון, או שהמחיר הנוכחי גבוה מהותית מהערכת תרחיש האופטימי.",
                "The position weight exceeds the risk-profile limit, or the current price is materially above the Bull Case estimate.")
            rec = _new_recommendation(state, h["ticker"], RecommendationType.REDUCE_POSITION.value,
                                      weight, round(weight - reduce_amount / max(p["currentValue"], 1e-9), 4),
                                      reduce_amount, reduce_qty, reason, positive, risk,
                                      _impact(state, h["ticker"], sector, -reduce_amount, weight),
                                      analysis, lang)
        else:
            continue   # HOLD implicitly — no recommendation created for a fine position

        state["recommendations"][rec["id"]] = rec
        created.append(rec)

    # ── New candidates: ADD_POSITION ──────────────────────────────────────────
    if len(created) < max_new and p["currentCash"] >= rr["min_cash_for_add_position"]:
        held_tickers = {h["ticker"] for h in state["holdings"].values() if h["status"] == "open"}
        universe = [r for r in _scanner_universe()
                   if r["ticker"] not in held_tickers and r["ticker"] not in pending_tickers
                   and (r.get("bukra_score") or 0) >= rules["min_bukra_score"]]
        universe.sort(key=lambda r: -(r.get("bukra_score") or 0))
        candidates = universe[:rr["add_candidate_pool_size"]]

        for cand in candidates:
            if len(created) >= max_new:
                break
            ticker, sector = cand["ticker"], cand.get("sector", "")
            if _sector_weight(state, sector) >= rules["max_sector_pct"]:
                continue
            analysis = _analyze_ticker(ticker, lang)
            if analysis is None:
                continue
            val = analysis["valuation"]
            if not val.get("available"):
                continue
            if (val.get("valuationScore") or 0) < rules["min_valuation_score"]:
                continue
            if (val.get("bubbleRisk") or 100) > rules["max_bubble_risk"]:
                continue
            if val["valuationConfidence"]["score"] < rules["min_valuation_conf"]:
                continue
            if val["dataQuality"]["level"] == "insufficient":
                continue

            target_position_value = min(
                p["currentValue"] * rules["max_position_pct"] * 0.6,
                p["currentCash"] * 0.5,
            )
            if target_position_value < rr["min_cash_for_add_position"]:
                continue
            price = val.get("currentPrice")
            qty = round(target_position_value / price, 4) if price else None

            positive, risk = _reason_factors(lang, analysis, rules)
            positive.append(_txt(lang, "הפוזיציה המוצעת אינה מוחזקת כיום בתיק — עשויה לשפר פיזור.",
                                 "The proposed position is not currently held — may improve diversification."))
            reason = _txt(lang,
                f"המדד זיהה הזדמנות פוטנציאלית: איכות עסקית וציון תמחור התואמים את פרופיל הסיכון שנבחר.",
                f"The Index identified a potential opportunity: business quality and valuation consistent with the selected risk profile.")

            rec = _new_recommendation(
                state, ticker, RecommendationType.ADD_POSITION.value, 0.0,
                round(target_position_value / max(p["currentValue"], 1e-9), 4),
                round(target_position_value, 2), qty, reason, positive, risk,
                _impact(state, ticker, sector, target_position_value, 0.0),
                analysis, lang,
            )
            state["recommendations"][rec["id"]] = rec
            created.append(rec)

    return created
