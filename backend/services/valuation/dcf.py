"""
DCF and Reverse-DCF calculations.

Forward DCF: value an FCF stream under explicit, bounded assumptions.
Reverse DCF: solve for the growth rate the current enterprise value implies,
answering "what must the business deliver to justify today's price?"

All rates are validated against DCF_BOUNDS. Economically impossible
combinations (discount rate <= terminal growth, absurd growth) are clamped
or rejected before they can propagate.
"""

import math
from typing import Optional

from services.valuation.methodology import (
    DCF_BOUNDS, DISCOUNT_RATE_BUILDUP, TERMINAL_GROWTH_DEFAULT,
)
from services.valuation.inputs import NormalizedInputs


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def build_discount_rate(n: NormalizedInputs) -> float:
    """Risk build-up on real company characteristics, clamped to bounds."""
    b = DISCOUNT_RATE_BUILDUP
    rate = b["base"]
    if n.market_cap is not None:
        if n.market_cap < 2e9:
            rate += b["small_cap_adder"]
        elif n.market_cap < 10e9:
            rate += b["mid_cap_adder"]
    if n.normalized_fcf and n.normalized_fcf > 0 and n.total_debt is not None:
        net_debt = (n.total_debt or 0) - (n.cash or 0)
        if net_debt > 3 * n.normalized_fcf:
            rate += b["high_leverage_adder"]
    if n.normalized_fcf is not None and n.normalized_fcf <= 0:
        rate += b["negative_fcf_adder"]
    if n.revenue_volatility is not None and n.revenue_volatility > 0.15:
        rate += b["volatile_revenue_adder"]
    return clamp(rate, DCF_BOUNDS["discount_rate_min"], DCF_BOUNDS["discount_rate_max"])


def dcf_enterprise_value(start_fcf: float, growth: float, discount_rate: float,
                         terminal_growth: float = TERMINAL_GROWTH_DEFAULT,
                         years: int = None, fade_to: float = None) -> Optional[dict]:
    """
    Present value of an FCF stream. Growth fades linearly from `growth` to
    `fade_to` (default: terminal growth) over the forecast, which avoids
    valuing any company off a single unsustainable rate.

    Returns {"ev", "terminal_value_pct", "final_fcf"} or None when inputs
    are economically invalid.
    """
    years = years or DCF_BOUNDS["forecast_years"]
    if start_fcf is None or start_fcf <= 0:
        return None
    growth = clamp(growth, DCF_BOUNDS["growth_min"], DCF_BOUNDS["growth_max"])
    terminal_growth = clamp(terminal_growth, DCF_BOUNDS["terminal_growth_min"], DCF_BOUNDS["terminal_growth_max"])
    discount_rate = clamp(discount_rate, DCF_BOUNDS["discount_rate_min"], DCF_BOUNDS["discount_rate_max"])
    if discount_rate <= terminal_growth + 0.01:      # keep a sane spread
        discount_rate = terminal_growth + 0.01
    fade_to = terminal_growth if fade_to is None else fade_to

    pv = 0.0
    fcf = start_fcf
    for t in range(1, years + 1):
        g_t = growth + (fade_to - growth) * (t - 1) / max(1, years - 1)
        fcf *= (1.0 + g_t)
        pv += fcf / ((1.0 + discount_rate) ** t)
    terminal = fcf * (1.0 + terminal_growth) / (discount_rate - terminal_growth)
    pv_terminal = terminal / ((1.0 + discount_rate) ** years)
    total = pv + pv_terminal
    if total <= 0 or math.isinf(total) or math.isnan(total):
        return None
    return {
        "ev": total,
        "terminal_value_pct": round(pv_terminal / total * 100, 1),
        "final_fcf": fcf,
    }


def reverse_dcf(n: NormalizedInputs, discount_rate: float) -> Optional[dict]:
    """
    Solve (bisection) for the FCF growth rate at which the DCF equals the
    current enterprise value. Uses normalized FCF as the starting stream;
    for companies without positive FCF the question is answered on revenue
    with the median-margin FCF proxy, explicitly labeled.
    """
    ev_target = n.enterprise_value
    if ev_target is None or ev_target <= 0:
        return None

    start_fcf = n.normalized_fcf if (n.normalized_fcf and n.normalized_fcf > 0) else None
    proxy = False
    if start_fcf is None and n.revenue and n.revenue > 0:
        # FCF proxy: revenue x bounded target margin — labeled as an estimate
        margin = n.fcf_margin_median if (n.fcf_margin_median and n.fcf_margin_median > 0) else 0.10
        margin = clamp(margin, 0.02, DCF_BOUNDS["fcf_margin_max"])
        start_fcf = n.revenue * margin
        proxy = True
    if start_fcf is None or start_fcf <= 0:
        return None

    lo, hi = DCF_BOUNDS["implied_growth_min"], DCF_BOUNDS["implied_growth_max"]

    def ev_at(g):
        r = dcf_enterprise_value(start_fcf, g, discount_rate)
        return r["ev"] if r else 0.0

    if ev_at(hi) < ev_target:
        implied = hi          # even the ceiling doesn't justify the price
        capped = True
    elif ev_at(lo) > ev_target:
        implied = lo
        capped = True
    else:
        capped = False
        for _ in range(60):
            mid = (lo + hi) / 2.0
            if ev_at(mid) < ev_target:
                lo = mid
            else:
                hi = mid
        implied = (lo + hi) / 2.0

    result = dcf_enterprise_value(start_fcf, implied, discount_rate)
    final_fcf = result["final_fcf"] if result else None
    years = DCF_BOUNDS["forecast_years"]

    implied_fcf_margin = None
    required_revenue = None
    if n.revenue and n.revenue > 0 and final_fcf:
        # Revenue path implied if margins hold at the historical median
        margin = n.fcf_margin_median if (n.fcf_margin_median and n.fcf_margin_median > 0.01) else None
        if margin:
            margin = clamp(margin, 0.01, DCF_BOUNDS["fcf_margin_max"])
            required_revenue = final_fcf / margin
            implied_fcf_margin = margin
        else:
            implied_fcf_margin = clamp(final_fcf / (n.revenue * ((1 + clamp(implied, -0.2, 0.4)) ** years)), 0, 1)

    return {
        "implied_fcf_growth": round(implied, 4),
        "solver_capped": capped,
        "fcf_proxy_used": proxy,
        "start_fcf": start_fcf,
        "final_fcf_required": final_fcf,
        "required_revenue_at_horizon": required_revenue,
        "implied_fcf_margin": round(implied_fcf_margin, 4) if implied_fcf_margin is not None else None,
        "discount_rate": round(discount_rate, 4),
        "terminal_growth": TERMINAL_GROWTH_DEFAULT,
        "terminal_value_pct": result["terminal_value_pct"] if result else None,
        "forecast_years": years,
    }
