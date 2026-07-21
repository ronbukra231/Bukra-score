"""
Bukra Portfolio Simulator — central methodology configuration.

Every simulated cost, threshold and risk-profile rule lives here, versioned.
No magic numbers scattered through the execution or recommendation code.
This is a simulation-only system: nothing here connects to a real broker,
moves real money, or places a real order.
"""

METHODOLOGY_VERSION = "1.0.0"

# ── Simulated execution costs ──────────────────────────────────────────────────
EXECUTION = {
    "fee_pct":              0.001,   # 0.10% of trade notional
    "min_fee":               1.00,   # portfolio-currency floor per trade
    "spread_pct":            0.0005, # 0.05% simulated bid/ask spread
    "slippage_pct":          0.0010, # 0.10% simulated market-impact slippage
    "fx_conversion_pct":     0.0025, # 0.25% simulated FX conversion cost
    "min_trade_amount":     50.0,    # smallest simulated order notional
    "fractional_shares":    True,
    "max_stale_price_hours": 48,     # price older than this is rejected as stale
}

# ── Simulated dividend / recommendation expiry ─────────────────────────────────
RECOMMENDATION_EXPIRY_DAYS = 14

# ── Risk-profile rules — govern eligibility + concentration limits ─────────────
# max_position_pct / max_sector_pct: hard concentration caps used both for
# ADD_POSITION eligibility and for flagging REDUCE_POSITION candidates.
RISK_PROFILES = {
    "conservative": {
        "max_position_pct":     0.08,
        "max_sector_pct":       0.25,
        "min_cash_pct":         0.15,
        "max_holdings":         15,
        "max_bubble_risk":      40,
        "min_valuation_conf":   60,
        "min_bukra_score":      65,
        "min_valuation_score":  50,
    },
    "balanced": {
        "max_position_pct":     0.12,
        "max_sector_pct":       0.30,
        "min_cash_pct":         0.08,
        "max_holdings":         20,
        "max_bubble_risk":      55,
        "min_valuation_conf":   45,
        "min_bukra_score":      55,
        "min_valuation_score":  40,
    },
    "growth": {
        "max_position_pct":     0.16,
        "max_sector_pct":       0.35,
        "min_cash_pct":         0.05,
        "max_holdings":         25,
        "max_bubble_risk":      70,
        "min_valuation_conf":   35,
        "min_bukra_score":      50,
        "min_valuation_score":  30,
    },
    "aggressive": {
        "max_position_pct":     0.22,
        "max_sector_pct":       0.45,
        "min_cash_pct":         0.02,
        "max_holdings":         30,
        "max_bubble_risk":      85,
        "min_valuation_conf":   25,
        "min_bukra_score":      45,
        "min_valuation_score":  20,
    },
}
DEFAULT_RISK_PROFILE = "balanced"

# ── Recommendation eligibility thresholds (deterministic, not per-profile) ─────
RECOMMENDATION_RULES = {
    # ADD_POSITION additionally requires the risk-profile minimums above.
    "reduce_weight_overshoot_pct":     0.03,   # weight above max_position_pct by this triggers REDUCE
    "reduce_valuation_drop_pts":       15,     # valuation score drop vs snapshot triggers REDUCE
    "reduce_bubble_rise_pts":          15,     # bubble risk rise vs snapshot triggers REDUCE
    "reduce_price_over_bull_pct":      0.10,   # price this far above Bull fair value triggers REDUCE
    "exit_bukra_score_critical":       35,     # Bukra Score below this triggers EXIT
    "exit_data_quality":               "insufficient",
    "min_cash_for_add_position":       500.0,  # minimum virtual cash to consider adding a new position
    "add_candidate_pool_size":         40,     # top-N by cached Bukra Score considered per generation run
    "max_new_recommendations_per_run": 6,
}

# ── Benchmark defaults ──────────────────────────────────────────────────────────
DEFAULT_BENCHMARK = {"USD": "SPY", "ILS": "TA35.TA"}

SUPPORTED_CURRENCIES = ("USD", "ILS")

PORTFOLIO_STATUSES = ("active", "archived")
