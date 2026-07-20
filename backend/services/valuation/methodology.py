"""
Bukra Valuation Engine — central methodology configuration.

Every weight, band and bound the engine uses lives here, versioned.
No magic numbers scattered through the calculation code. A methodology
update bumps METHODOLOGY_VERSION; stored analyses keep the version they
were computed with and are never rewritten.
"""

METHODOLOGY_VERSION = "1.0.0"

# ── Valuation Score component weights (sum = 1.0) ─────────────────────────────
# Components that cannot be computed for a company are dropped and the
# remaining weights are re-normalized — a missing input never scores zero.
VALUATION_WEIGHTS = {
    "price_vs_fair_value":  0.35,   # current price vs calculated fair value range
    "reverse_dcf":          0.25,   # reasonableness of price-implied assumptions
    "relative_valuation":   0.20,   # multiples vs justified/peer/historical multiples
    "fcf_quality":          0.10,   # earnings-to-cash conversion and FCF stability
    "balance_sheet_risk":   0.10,   # debt, dilution, cash burn, financial risk
}

# ── Bubble Risk component weights (sum = 1.0) ─────────────────────────────────
BUBBLE_WEIGHTS = {
    "price_vs_value_gap":      0.30,
    "implied_vs_history":      0.25,
    "required_profitability":  0.15,
    "terminal_dependency":     0.10,
    "cash_burn_dilution":      0.10,
    "price_vs_results_growth": 0.10,   # needs price history — usually unavailable
}

for _name, _w in (("VALUATION_WEIGHTS", VALUATION_WEIGHTS), ("BUBBLE_WEIGHTS", BUBBLE_WEIGHTS)):
    _t = sum(_w.values())
    assert abs(_t - 1.0) < 1e-9, f"{_name} must sum to 1.0 — got {_t}"

# ── DCF / Reverse-DCF bounds (economic sanity limits) ─────────────────────────
DCF_BOUNDS = {
    "discount_rate_min":   0.06,
    "discount_rate_max":   0.16,
    "terminal_growth_min": 0.00,
    "terminal_growth_max": 0.03,
    "growth_min":         -0.20,     # forecast revenue/FCF growth floor
    "growth_max":          0.40,     # forecast growth ceiling (per year)
    "implied_growth_min": -0.25,     # reverse-DCF solver search range
    "implied_growth_max":  0.60,
    "forecast_years":      10,
    "fcf_margin_max":      0.50,     # no company is assumed to exceed this durably
}

# Discount-rate build-up: base rate + risk adders, clamped to bounds above.
DISCOUNT_RATE_BUILDUP = {
    "base":                0.085,    # market-level required return
    "small_cap_adder":     0.015,    # market cap < $2B
    "mid_cap_adder":       0.005,    # market cap < $10B
    "high_leverage_adder": 0.010,    # net debt > 3x FCF
    "negative_fcf_adder":  0.020,    # currently burning cash
    "volatile_revenue_adder": 0.010, # revenue CV above threshold
}
TERMINAL_GROWTH_DEFAULT = 0.025

# ── Scenario growth spreads relative to the base assumption ───────────────────
SCENARIO_SPREADS = {
    "bear": {"growth_mult": 0.45, "margin_mult": 0.80},
    "base": {"growth_mult": 1.00, "margin_mult": 1.00},
    "bull": {"growth_mult": 1.45, "margin_mult": 1.12},
}

# ── Interpretation bands ──────────────────────────────────────────────────────
VALUATION_BANDS = [
    (80, "very_attractive"), (65, "attractive"), (50, "reasonable"),
    (35, "expensive"), (20, "very_expensive"), (0, "extreme"),
]
EXPECTATIONS_BANDS = [
    (81, "extreme"), (61, "aggressive"), (41, "high"), (21, "reasonable"), (0, "conservative"),
]
BUBBLE_BANDS = [
    (81, "extreme_risk"), (61, "speculative"), (41, "elevated"), (21, "reasonable"), (0, "conservative"),
]
CONFIDENCE_LEVELS = [(70, "High"), (40, "Medium"), (0, "Low")]
DATA_QUALITY_LEVELS = ["complete", "partial", "limited", "insufficient"]


def band_label(score, bands):
    for threshold, label in bands:
        if score >= threshold:
            return label
    return bands[-1][1]
