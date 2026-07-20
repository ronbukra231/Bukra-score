"""
Scoring — Valuation Score, Expectations Gap, Bubble Risk, Confidence,
Data Quality. Component-based, with weight normalization when a component
cannot be computed (a missing input never scores zero).
"""

from typing import Optional

from services.valuation.methodology import VALUATION_WEIGHTS, BUBBLE_WEIGHTS
from services.valuation.inputs import NormalizedInputs
from services.valuation.dcf import clamp


def weighted_score(components: dict, weights: dict) -> Optional[dict]:
    """
    components: {name: score 0-100 or None}. Missing (None) components are
    dropped and remaining weights re-normalized.
    """
    available = {k: v for k, v in components.items() if v is not None and k in weights}
    if not available:
        return None
    total_w = sum(weights[k] for k in available)
    normalized = {k: round(weights[k] / total_w, 4) for k in available}
    score = sum(available[k] * normalized[k] for k in available)
    return {
        "score": round(clamp(score, 0, 100)),
        "componentScores": {k: round(v, 1) for k, v in available.items()},
        "missingComponents": [k for k in weights if k not in available],
        "originalWeights": dict(weights),
        "normalizedWeights": normalized,
    }


# ── Valuation Score components ────────────────────────────────────────────────

def score_price_vs_fair(n: NormalizedInputs, scenarios: dict) -> Optional[float]:
    """Map current market cap position within the bear-bull equity range to 0-100."""
    base = scenarios.get("base", {})
    bear = scenarios.get("bear", {})
    bull = scenarios.get("bull", {})
    if not (base.get("available") and n.market_cap):
        return None
    b_v = bear.get("fairEquityValue") or base["fairEquityValue"] * 0.7
    u_v = bull.get("fairEquityValue") or base["fairEquityValue"] * 1.3
    mc = n.market_cap
    if mc <= b_v:
        # Below the bear case: very attractive, more so the deeper below
        return clamp(85 + 15 * (b_v - mc) / max(b_v, 1), 85, 100)
    if mc >= u_v:
        # Above the bull case: score decays with the premium over bull
        premium = (mc - u_v) / max(u_v, 1)
        return clamp(30 - premium * 60, 0, 30)
    # Inside the range: linear from 85 (at bear) down to 30 (at bull)
    frac = (mc - b_v) / max(u_v - b_v, 1)
    return clamp(85 - frac * 55, 30, 85)


def score_reverse_dcf(n: NormalizedInputs, rdcf: Optional[dict]) -> Optional[float]:
    """How reasonable is the price-implied growth vs the company's own history?"""
    if not rdcf:
        return None
    implied = rdcf["implied_fcf_growth"]
    hist = n.revenue_cagr if n.revenue_cagr is not None else n.fcf_cagr
    if hist is None:
        # No history to compare — judge the absolute level
        return clamp(80 - max(0.0, implied) * 250, 5, 80)
    gap = implied - hist
    if gap <= -0.02:
        return clamp(85 + min(0.10, -gap) * 150, 85, 100)   # price implies LESS than history
    return clamp(80 - gap * 400, 0, 80)                     # each pt of excess growth costs 4


def score_relative_valuation(n: NormalizedInputs, discount_rate: float) -> Optional[float]:
    """
    Multiples vs justified multiples derived from the discount rate
    (justified P/FCF ≈ 1/(r - g_terminal)). Peer and company-historical
    multiples are unavailable from the current provider, so this component
    is the justified-multiple comparison only.
    """
    scores = []
    justified = 1.0 / max(discount_rate - 0.025, 0.02)      # e.g. r=10% → ~13.3x
    if n.enterprise_value and n.normalized_fcf and n.normalized_fcf > 0:
        ev_fcf = n.enterprise_value / n.normalized_fcf
        ratio = ev_fcf / justified
        scores.append(clamp(100 - (ratio - 0.8) * 55, 0, 100))
    if n.pe_ratio and n.pe_ratio > 0:
        pe_justified = justified * 1.15                      # earnings run slightly above FCF
        ratio = n.pe_ratio / pe_justified
        scores.append(clamp(100 - (ratio - 0.8) * 55, 0, 100))
    return sum(scores) / len(scores) if scores else None


def score_fcf_quality(n: NormalizedInputs) -> Optional[float]:
    """Earnings-to-cash conversion and FCF consistency."""
    if n.fcf is None and not n.fcf_history:
        return None
    score = 50.0
    total_years = n.fcf_positive_years + n.fcf_negative_years
    if total_years:
        score = 20 + 70 * (n.fcf_positive_years / total_years)
    if n.net_income and n.net_income > 0 and n.fcf is not None:
        conversion = n.fcf / n.net_income
        if conversion >= 0.9:
            score += 10
        elif conversion < 0.5:
            score -= 10
    return clamp(score, 0, 100)


def score_balance_sheet(n: NormalizedInputs) -> Optional[float]:
    """Debt burden, net cash, and cash-burn runway. Dilution history unavailable."""
    if n.total_debt is None and n.cash is None:
        return None
    score = 60.0
    net_debt = (n.total_debt or 0.0) - (n.cash or 0.0)
    if net_debt < 0:
        score += 25                                          # net cash position
    elif n.normalized_fcf and n.normalized_fcf > 0:
        leverage = net_debt / n.normalized_fcf
        score -= clamp(leverage * 6, 0, 45)
    elif net_debt > 0:
        score -= 30                                          # debt with no positive FCF
    # Cash burn runway
    if n.fcf is not None and n.fcf < 0 and n.cash:
        runway_years = n.cash / abs(n.fcf)
        if runway_years < 1.5:
            score -= 25
        elif runway_years < 3:
            score -= 10
    return clamp(score, 0, 100)


# ── Expectations Gap ──────────────────────────────────────────────────────────

def expectations_gap(n: NormalizedInputs, rdcf: Optional[dict]) -> Optional[dict]:
    """0 = conservative expectations priced in, 100 = extreme expectations."""
    if not rdcf:
        return None
    implied = rdcf["implied_fcf_growth"]
    parts = {}

    hist = n.revenue_cagr if n.revenue_cagr is not None else n.fcf_cagr
    if hist is not None:
        parts["implied_vs_history"] = clamp(50 + (implied - hist) * 350, 0, 100)
    else:
        parts["implied_absolute"] = clamp(implied * 300, 0, 100)

    if rdcf.get("implied_fcf_margin") is not None and n.fcf_margin_median is not None:
        margin_gap = rdcf["implied_fcf_margin"] - n.fcf_margin_median
        parts["required_margin"] = clamp(50 + margin_gap * 400, 0, 100)

    if rdcf.get("terminal_value_pct") is not None:
        parts["terminal_dependency"] = clamp((rdcf["terminal_value_pct"] - 40) * 2.2, 0, 100)

    if rdcf.get("solver_capped") and implied > 0.3:
        parts["solver_ceiling"] = 100.0                      # even max growth can't justify the price

    score = round(sum(parts.values()) / len(parts))
    return {"score": int(clamp(score, 0, 100)), "components": {k: round(v, 1) for k, v in parts.items()}}


# ── Bubble Risk ───────────────────────────────────────────────────────────────

def bubble_risk(n: NormalizedInputs, scenarios: dict, rdcf: Optional[dict]) -> Optional[dict]:
    comps = {}

    base = scenarios.get("base", {})
    if base.get("available") and n.market_cap:
        gap = n.market_cap / base["fairEquityValue"] - 1.0
        comps["price_vs_value_gap"] = clamp(35 + gap * 90, 0, 100)

    if rdcf:
        hist = n.revenue_cagr if n.revenue_cagr is not None else n.fcf_cagr
        implied = rdcf["implied_fcf_growth"]
        if hist is not None:
            comps["implied_vs_history"] = clamp(40 + (implied - hist) * 350, 0, 100)
        if rdcf.get("implied_fcf_margin") is not None and n.net_margin_peak is not None:
            over_peak = rdcf["implied_fcf_margin"] - max(n.net_margin_peak, n.fcf_margin_median or 0)
            comps["required_profitability"] = clamp(40 + over_peak * 400, 0, 100)
        if rdcf.get("terminal_value_pct") is not None:
            comps["terminal_dependency"] = clamp((rdcf["terminal_value_pct"] - 40) * 2.2, 0, 100)

    # Cash burn / financing need (dilution history unavailable — runway only)
    if n.fcf is not None:
        if n.fcf < 0:
            runway = (n.cash / abs(n.fcf)) if n.cash else 0
            comps["cash_burn_dilution"] = clamp(90 - runway * 15, 20, 90)
        elif n.fcf_positive_years >= 3:
            comps["cash_burn_dilution"] = 15.0               # stable positive FCF reduces speculative risk

    # price_vs_results_growth requires a price history the provider lacks — omitted

    result = weighted_score(comps, BUBBLE_WEIGHTS)
    return result


# ── Confidence & Data Quality ─────────────────────────────────────────────────

def valuation_confidence(n: NormalizedInputs, company_type: str, scenarios: dict,
                         methods_used: list, rdcf: Optional[dict]) -> int:
    score = 50.0
    score += clamp((n.years_of_history - 3) * 6, -18, 12)
    if n.fcf_positive_years >= 3:
        score += 10
    if n.revenue_volatility is not None:
        score -= clamp(n.revenue_volatility * 80, 0, 20)
    score += clamp((len(methods_used) - 1) * 4, 0, 12)
    if rdcf and rdcf.get("terminal_value_pct") and rdcf["terminal_value_pct"] > 75:
        score -= 12                                          # value mostly beyond the forecast window
    if rdcf and rdcf.get("fcf_proxy_used"):
        score -= 10
    if company_type in ("financial", "reit"):
        score -= 20                                          # model not fully suited to the sector
    if company_type == "pre_revenue":
        score = min(score, 15)
    # Dispersion between scenario methods: wide bear-bull spread lowers confidence
    bear_v, bull_v = (scenarios.get("bear", {}).get("fairEquityValue"),
                      scenarios.get("bull", {}).get("fairEquityValue"))
    if bear_v and bull_v and bear_v > 0 and bull_v / bear_v > 4:
        score -= 10
    return int(clamp(score, 0, 100))


def data_quality(n: NormalizedInputs) -> dict:
    """complete | partial | limited | insufficient, with the reasons."""
    critical_missing = [m for m in n.missing_inputs
                        if m in ("current_price", "market_cap", "revenue", "sufficient_financial_history")]
    soft_missing = [m for m in n.missing_inputs if m not in critical_missing]

    if ("current_price" in critical_missing or "market_cap" in critical_missing
            or n.years_of_history == 0):
        level = "insufficient"
    elif critical_missing:
        level = "limited"
    elif soft_missing or n.years_of_history < 4:
        level = "partial"
    else:
        level = "complete"
    return {"level": level, "missingInputs": list(n.missing_inputs),
            "estimatedInputs": list(n.estimated_inputs),
            "yearsOfHistory": n.years_of_history}
