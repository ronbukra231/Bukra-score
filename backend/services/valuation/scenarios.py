"""
Scenario engine — Bear / Base / Bull fair values.

Assumptions are generated from each company's own history (growth, margins,
volatility) and its classification — never one template for every company.
The bear case is a realistic adverse path, not a collapse; the bull case is
strong execution, capped by economic bounds.
"""

from typing import Optional

from services.valuation.methodology import SCENARIO_SPREADS, DCF_BOUNDS, TERMINAL_GROWTH_DEFAULT
from services.valuation.inputs import NormalizedInputs
from services.valuation.dcf import dcf_enterprise_value, clamp


def _base_growth(n: NormalizedInputs) -> float:
    """Base-case FCF growth anchored on history, moderated toward sustainability."""
    candidates = [g for g in (n.revenue_cagr, n.fcf_cagr) if g is not None]
    if candidates:
        hist = sum(candidates) / len(candidates)
    else:
        hist = 0.04                          # no history — conservative default, flagged upstream
    # Historical hypergrowth fades: assume 70% persistence, bounded
    return clamp(hist * 0.70, DCF_BOUNDS["growth_min"], DCF_BOUNDS["growth_max"])


def _start_fcf(n: NormalizedInputs, company_type: str, margin_mult: float) -> Optional[float]:
    """Scenario starting FCF. Cyclicals always use the normalized (median) figure."""
    if company_type == "high_growth":
        # Model the transition to profitability: revenue x scenario target margin.
        if not n.revenue or n.revenue <= 0:
            return None
        target = n.fcf_margin_median if (n.fcf_margin_median and n.fcf_margin_median > 0) else 0.12
        target = clamp(target * margin_mult, 0.02, DCF_BOUNDS["fcf_margin_max"])
        return n.revenue * target
    fcf = n.normalized_fcf
    if fcf is None or fcf <= 0:
        return None
    return fcf * margin_mult


def build_scenarios(n: NormalizedInputs, company_type: str, discount_rate: float) -> dict:
    """
    Returns {"bear": {...}, "base": {...}, "bull": {...}} — every scenario
    carries its full assumptions and its fair value, or is marked unavailable.
    Fair equity value = DCF enterprise value - net debt.
    """
    base_g = _base_growth(n)
    net_debt = (n.total_debt or 0.0) - (n.cash or 0.0)
    out = {}
    for name, spread in SCENARIO_SPREADS.items():
        growth = clamp(base_g * spread["growth_mult"], DCF_BOUNDS["growth_min"], DCF_BOUNDS["growth_max"])
        # Volatile-revenue companies get a wider bear haircut
        if name == "bear" and n.revenue_volatility is not None and n.revenue_volatility > 0.15:
            growth = clamp(growth - 0.02, DCF_BOUNDS["growth_min"], DCF_BOUNDS["growth_max"])
        start = _start_fcf(n, company_type, spread["margin_mult"])
        scenario = {
            "assumptions": {
                "fcfGrowth": round(growth, 4),
                "startFcf": round(start, 0) if start else None,
                "marginMultiplier": spread["margin_mult"],
                "discountRate": round(discount_rate, 4),
                "terminalGrowth": TERMINAL_GROWTH_DEFAULT,
                "forecastYears": DCF_BOUNDS["forecast_years"],
                "anchoredOn": "historical revenue/FCF growth and margins" if (n.revenue_cagr is not None or n.fcf_cagr is not None) else "conservative default (insufficient history)",
            },
            "fairEquityValue": None,
            "fairValuePerShare": None,
            "upsideDownsidePct": None,
            "terminalValuePct": None,
            "available": False,
        }
        if start and start > 0:
            r = dcf_enterprise_value(start, growth, discount_rate)
            if r:
                equity = r["ev"] - net_debt
                if equity > 0:
                    scenario["fairEquityValue"] = round(equity, 0)
                    scenario["terminalValuePct"] = r["terminal_value_pct"]
                    scenario["available"] = True
                    if n.shares_outstanding and n.shares_outstanding > 0:
                        scenario["fairValuePerShare"] = round(equity / n.shares_outstanding, 2)
                    if n.market_cap and n.market_cap > 0:
                        scenario["upsideDownsidePct"] = round((equity / n.market_cap - 1.0) * 100, 1)
        out[name] = scenario
    return out
