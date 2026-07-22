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
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from typing import Optional

from services.data_service import get_company_info, get_five_year_financials
from services.bukra_score import compute_bukra_score
from services.valuation import compute_valuation
from services.future_relevance import compute_future_relevance
from services.simulator import accounting
from services.simulator.config import RISK_PROFILES, RECOMMENDATION_RULES, RECOMMENDATION_EXPIRY_DAYS, METHODOLOGY_VERSION
from services.simulator.models import RecommendationType, RecommendationStatus

logger = logging.getLogger("bukra.simulator.recommendations")

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
_SCANNER_CACHE = os.path.join(_DATA_DIR, "scanner_cache.json")

# ── Provider resilience ──────────────────────────────────────────────────────
# get_company_info / get_five_year_financials never raise (they swallow their
# own network errors and return an "unavailable" sentinel or an empty shell),
# and the underlying yfinance fallback path has no timeout of its own. A
# thread-bounded timeout + a short retry on the explicit "unavailable"
# sentinel is what actually gives this pipeline a finite worst-case latency
# per candidate and a way to tell "transient provider hiccup" apart from
# "this company's data is genuinely insufficient" (the latter is a real,
# permanent rejection — never retried).
_PROVIDER_TIMEOUT_S = 8
_PROVIDER_MAX_RETRIES = 1
_PROVIDER_RETRY_BACKOFF_S = 0.4
_analysis_executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="sim-analyze")

# Short-lived in-process cache so repeated builder calls in the same guided
# session (next / suggest-another) don't re-hit the provider for a ticker
# that was already analyzed moments ago. Deliberately short — this is on top
# of, not a replacement for, the provider's own longer-lived cache.
_ANALYSIS_CACHE_TTL_S = 120
_analysis_cache: dict[tuple, tuple] = {}


class _ProviderUnavailable(Exception):
    """Raised internally when a provider returned its explicit 'unavailable'
    sentinel — a transient failure worth retrying, as opposed to a
    permanent data gap (no history at all), which is not retried."""


def _scanner_universe() -> list[dict]:
    try:
        with open(_SCANNER_CACHE, encoding="utf-8") as f:
            return json.load(f).get("results", [])
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _info_fetch_failed(info: dict) -> bool:
    """
    get_company_info's total-failure fallback (every provider unreachable)
    still sets info["name"] to the ticker symbol itself — so a plain
    `not info.get("name")` check never catches it. Every other meaningful
    field being null is what a genuine fetch failure actually looks like;
    this is distinct from a real, thinly-covered company (which the scanner
    cache already filtered to include a sector).
    """
    return info.get("price") is None and info.get("market_cap") is None and not info.get("sector")


def _fetch_analysis(ticker: str, lang: str) -> Optional[dict]:
    """The actual network-bound work for one ticker. Runs inside the bounded
    executor so a slow/hanging provider call can't stall the whole pipeline."""
    info = get_company_info(ticker)
    fin = get_five_year_financials(ticker)
    if fin.get("source") == "unavailable":
        raise _ProviderUnavailable(f"financials unavailable for {ticker}")
    if _info_fetch_failed(info):
        raise _ProviderUnavailable(f"company info unavailable for {ticker}")
    if not info.get("name") or not fin.get("history"):
        return None   # a real, permanent data gap — not a provider hiccup
    score_data = compute_bukra_score(fin, info)
    if score_data.get("score") is None:
        # Every candidate reaching this function already carries a valid
        # CACHED Bukra Score (that's how it entered the pool) — a fresh
        # computation coming back empty on the same history almost always
        # means this fetch attempt was degraded, not that the company
        # suddenly has no financial history. Treat it as retryable.
        raise _ProviderUnavailable(f"bukra score recomputation empty for {ticker}")
    valuation = compute_valuation(ticker, info, fin, lang=lang,
                                  bukra_score=score_data.get("score"), persist=False)
    future_relevance = None
    try:
        future_relevance = compute_future_relevance(ticker, info, score_data, lang=lang)
    except Exception as e:
        # Future Relevance is not fail-safe internally (same pattern as
        # routers/company.py) — never let it take the whole candidate down;
        # the Opportunity Score simply redistributes its weight below.
        logger.info("[recommendations] future relevance unavailable for %s: %s", ticker, type(e).__name__)
    return {"info": info, "score": score_data, "valuation": valuation, "futureRelevance": future_relevance}


def _analyze_ticker(ticker: str, lang: str, *, fail_log: Optional[list] = None) -> Optional[dict]:
    """
    Fresh Bukra Score + Valuation + Future Relevance for one ticker, with a
    finite per-call timeout and one bounded retry on a transient provider
    failure. A genuine, permanent data gap (no financial history, no usable
    score) returns None immediately with no retry. When `fail_log` is
    passed, a (ticker, reason) pair is appended on every provider failure —
    used by the guided builder to tell "the market had nothing good today"
    apart from "the data provider was unreachable today".
    """
    cache_key = (ticker, lang)
    cached = _analysis_cache.get(cache_key)
    if cached and (time.monotonic() - cached[0]) < _ANALYSIS_CACHE_TTL_S:
        return cached[1]

    last_reason = None
    for attempt in range(_PROVIDER_MAX_RETRIES + 1):
        future = _analysis_executor.submit(_fetch_analysis, ticker, lang)
        try:
            result = future.result(timeout=_PROVIDER_TIMEOUT_S)
            _analysis_cache[cache_key] = (time.monotonic(), result)
            return result
        except FutureTimeoutError:
            last_reason = "timeout"
        except _ProviderUnavailable:
            last_reason = "provider_unavailable"
        except Exception as e:
            logger.warning("[recommendations] analysis failed for %s: %s", ticker, type(e).__name__)
            last_reason = f"error:{type(e).__name__}"
            break   # an unexpected error — retrying won't fix a bug, only a timeout/outage
        if attempt < _PROVIDER_MAX_RETRIES:
            time.sleep(_PROVIDER_RETRY_BACKOFF_S * (attempt + 1))

    if fail_log is not None:
        fail_log.append((ticker, last_reason or "unknown"))
    # Deliberately not cached — a transient hiccup should not stick around
    # for the cache TTL and keep failing the next call too.
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


# ── Portfolio Opportunity Score ──────────────────────────────────────────────
# Positive-component weights sum to 1.0; bubble risk is a separate penalty
# subtracted afterward, not part of the weighted pool. When Future Relevance
# is unavailable for a company, its weight is redistributed proportionally
# across the remaining components (never assigned an invented score), and
# the effective weights actually used are returned alongside the score so
# callers/diagnostics can see exactly what was applied.
_OPPORTUNITY_WEIGHTS = {
    "bukra":            0.25,
    "valuation":        0.20,
    "future_relevance": 0.15,
    "margin_of_safety": 0.15,
    "confidence":       0.10,
    "diversification":  0.15,
}
_BUBBLE_PENALTY_WEIGHT = 0.15


def _opportunity_score(analysis: dict, sector: str, state: dict) -> tuple[float, dict]:
    """
    Portfolio Opportunity Score — 0-100, separate from the Bukra Score.
    The Bukra Score measures standalone business quality; this measures how
    good an addition the stock is FOR THIS PORTFOLIO right now: quality,
    valuation, margin of safety, confidence, Future Relevance, and how much
    it improves diversification, penalized for bubble risk.

    Returns (score, meta) where meta carries the effective per-component
    weights used (post-redistribution if Future Relevance was unavailable)
    and whether Future Relevance was actually available for this company.
    """
    score = analysis["score"]["score"] or 0
    val = analysis["valuation"]
    valuation_score = val.get("valuationScore") or 0
    bubble = val.get("bubbleRisk") or 0
    confidence = val.get("valuationConfidence", {}).get("score") or 0

    fv = val.get("fairValueRange") or {}
    base, price = fv.get("basePerShare"), val.get("currentPrice")
    margin_of_safety = max(0.0, min(100.0, (base - price) / base * 100)) if (base and price and base > 0) else 50.0

    current_sector_w = _sector_weight(state, sector)
    diversification_bonus = max(0.0, min(100.0, 100.0 - current_sector_w * 200.0))

    components = {
        "bukra": score, "valuation": valuation_score, "margin_of_safety": margin_of_safety,
        "confidence": confidence, "diversification": diversification_bonus,
    }

    future_relevance = analysis.get("futureRelevance")
    fr_score = future_relevance.get("score") if isinstance(future_relevance, dict) else None
    weights = dict(_OPPORTUNITY_WEIGHTS)
    if fr_score is not None:
        components["future_relevance"] = fr_score
    else:
        # No invented score — redistribute its weight proportionally across
        # the components that ARE available, so the score stays on a 0-100
        # scale without pretending Future Relevance said anything.
        missing_weight = weights.pop("future_relevance")
        remaining_total = sum(weights.values())
        weights = {k: w + (w / remaining_total) * missing_weight for k, w in weights.items()}

    weighted_sum = sum(components[k] * weights[k] for k in weights)
    opp = max(0.0, min(100.0, weighted_sum - bubble * _BUBBLE_PENALTY_WEIGHT))
    meta = {"weights": {k: round(w, 4) for k, w in weights.items()},
            "futureRelevanceAvailable": fr_score is not None}
    return opp, meta


def _guided_position_pct(opportunity_score: float) -> float:
    """Typical 3-6%, exceptional up to 8%, very high conviction up to 10%. Never more."""
    if opportunity_score >= 92:
        return 0.10
    if opportunity_score >= 85:
        return 0.08
    return round(0.03 + (min(opportunity_score, 85) / 85) * 0.03, 4)


def generate_guided_candidate(state: dict, lang: str = "he",
                              exclude_tickers: Optional[list[str]] = None) -> tuple[Optional[dict], dict]:
    """
    One recommendation at a time for the Guided Portfolio Builder.

    Ranks every eligible candidate in the configured pool by the Portfolio
    Opportunity Score, then walks the ranking best-first: the first
    candidate whose proposed position ALSO clears the minimum trade-size /
    cash-availability check is returned. A high-scoring candidate that
    happens to size too small no longer blocks a lower-ranked candidate
    that would size fine — every eligible candidate is tried before
    reporting that nothing can be recommended.

    Live analysis keeps expanding through the configured candidate pool
    (not a fixed small slice of it) until either enough valid candidates
    have been found to rank confidently, or the pool is exhausted. A
    provider timeout, rate limit, or outage on one candidate does not stop
    the scan — it is logged and the scan continues with the next candidate.

    Returns (recommendation_or_None, diagnostics). `diagnostics` is an
    internal-only structure — universe/pool sizes, per-gate rejection
    counts, provider failures, the final ranking, and the exact reason a
    recommendation could not be produced — meant for server logs, never
    returned to the client as-is.
    """
    p = state["portfolio"]
    rules = RISK_PROFILES.get(p["riskProfile"], RISK_PROFILES["balanced"])
    rr = RECOMMENDATION_RULES
    exclude = {t.upper() for t in (exclude_tickers or [])}

    diag = {
        "universeSize": 0, "prefilterPassCount": 0, "liveAttempted": 0,
        "rejectedByGate": {}, "providerFailures": [], "rankedCandidates": [],
        "sizingFailures": [], "doneReason": None,
    }

    def _reject(gate: str) -> None:
        diag["rejectedByGate"][gate] = diag["rejectedByGate"].get(gate, 0) + 1

    if p["currentCash"] < rr["min_cash_for_add_position"]:
        diag["doneReason"] = "cash_below_minimum"
        return None, diag

    pending_tickers = {
        r["ticker"] for r in state["recommendations"].values()
        if r["recommendationStatus"] == RecommendationStatus.PENDING.value
    }
    held_tickers = {h["ticker"] for h in state["holdings"].values() if h["status"] == "open"}

    universe = _scanner_universe()
    diag["universeSize"] = len(universe)

    prefiltered = [r for r in universe
                  if r["ticker"] not in held_tickers and r["ticker"] not in pending_tickers
                  and r["ticker"] not in exclude and (r.get("bukra_score") or 0) >= rules["min_bukra_score"]]
    diag["prefilterPassCount"] = len(prefiltered)
    prefiltered.sort(key=lambda r: -(r.get("bukra_score") or 0))

    pool = prefiltered[:rr["add_candidate_pool_size"]]
    target_valid = min(rr["guided_min_valid_candidates"], len(pool))
    budget_s = rr["guided_wall_time_budget_s"]

    fail_log: list = []
    scored: list[tuple[float, dict, dict, str, dict]] = []
    started = time.monotonic()

    for cand in pool:
        if (time.monotonic() - started) > budget_s:
            diag["doneReason"] = "time_budget_exceeded_mid_scan"
            break
        ticker, sector = cand["ticker"], cand.get("sector", "")
        if _sector_weight(state, sector) >= rules["max_sector_pct"]:
            _reject("sector_cap")
            continue

        diag["liveAttempted"] += 1
        analysis = _analyze_ticker(ticker, lang, fail_log=fail_log)
        if analysis is None:
            # Either a genuine, permanent data gap, or a provider failure
            # already recorded in fail_log — either way, move on to the
            # next candidate rather than giving up on the whole scan.
            continue

        val = analysis["valuation"]
        if not val.get("available"):
            _reject("valuation_unavailable")
            continue
        if (val.get("valuationScore") or 0) < rules["min_valuation_score"]:
            _reject("valuation_score")
            continue
        if (val.get("bubbleRisk") or 100) > rules["max_bubble_risk"]:
            _reject("bubble_risk")
            continue
        if val["valuationConfidence"]["score"] < rules["min_valuation_conf"]:
            _reject("valuation_confidence")
            continue
        if val["dataQuality"]["level"] == "insufficient":
            _reject("data_quality")
            continue

        opp, opp_meta = _opportunity_score(analysis, sector, state)
        scored.append((opp, analysis, cand, sector, opp_meta))
        if len(scored) >= target_valid:
            break

    diag["providerFailures"] = [{"ticker": t, "reason": r} for t, r in fail_log]
    scored.sort(key=lambda t: -t[0])
    diag["rankedCandidates"] = [
        {"ticker": c["ticker"], "opportunityScore": round(o, 1), "bukraScore": a["score"]["score"],
        "valuationScore": a["valuation"].get("valuationScore"), "bubbleRisk": a["valuation"].get("bubbleRisk"),
        "futureRelevanceAvailable": m["futureRelevanceAvailable"]}
        for o, a, c, s, m in scored[:20]
    ]

    for opp_score, analysis, cand, sector, opp_meta in scored:
        ticker = cand["ticker"]
        pct = _guided_position_pct(opp_score)
        target_position_value = min(
            p["currentValue"] * pct,
            p["currentCash"] * 0.5,
            max(0.0, rules["max_sector_pct"] - _sector_weight(state, sector)) * p["currentValue"],
        )
        if target_position_value < rr["min_cash_for_add_position"]:
            diag["sizingFailures"].append({"ticker": ticker, "targetValue": round(target_position_value, 2)})
            continue   # this candidate sized too small — try the next-ranked one, don't give up

        price = analysis["valuation"].get("currentPrice")
        qty = round(target_position_value / price, 4) if price else None

        positive, risk = _reason_factors(lang, analysis, rules)
        positive.append(_txt(lang, "הפוזיציה המוצעת אינה מוחזקת כיום בתיק — עשויה לשפר פיזור.",
                             "The proposed position is not currently held — may improve diversification."))
        if opp_score >= 92:
            conviction = _txt(lang, "רמת ביטחון גבוהה במיוחד", "very high conviction")
        elif opp_score >= 85:
            conviction = _txt(lang, "הזדמנות יוצאת דופן", "an exceptional opportunity")
        else:
            conviction = _txt(lang, "התאמה טובה לאסטרטגיה שנבחרה", "a solid fit for the selected strategy")
        reason = _txt(lang,
            f"המדד דירג את {ticker} כהזדמנות המובילה כעת עבור בניית התיק — {conviction}.",
            f"The Index ranked {ticker} as the top opportunity for building the portfolio right now — {conviction}.")

        rec = _new_recommendation(
            state, ticker, RecommendationType.ADD_POSITION.value, 0.0,
            round(target_position_value / max(p["currentValue"], 1e-9), 4),
            round(target_position_value, 2), qty, reason, positive, risk,
            _impact(state, ticker, sector, target_position_value, 0.0),
            analysis, lang,
        )
        rec["metadata"]["opportunityScore"] = round(opp_score, 1)
        rec["metadata"]["opportunityWeights"] = opp_meta["weights"]
        rec["metadata"]["futureRelevanceAvailable"] = opp_meta["futureRelevanceAvailable"]
        rec["metadata"]["guided"] = True
        state["recommendations"][rec["id"]] = rec
        diag["doneReason"] = None
        return rec, diag

    if diag["doneReason"] is None:
        attempted = diag["liveAttempted"]
        failures = len(diag["providerFailures"])
        if attempted > 0 and not scored and failures >= max(1, attempted) * 0.5:
            # Half or more of everything we tried failed at the provider
            # level, not the quality bar — this is "the data was
            # unreachable today", never reported as "no good investments".
            diag["doneReason"] = "provider_degraded"
        elif diag["sizingFailures"]:
            diag["doneReason"] = "all_candidates_too_small_to_size"
        elif diag["rejectedByGate"]:
            diag["doneReason"] = "no_candidate_passed_quality_gates"
        elif diag["prefilterPassCount"] == 0:
            diag["doneReason"] = "no_candidate_passed_cached_threshold"
        else:
            diag["doneReason"] = "no_opportunities"
    return None, diag


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
