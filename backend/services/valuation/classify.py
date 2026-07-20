"""
Company-type classification — selects the valuation methodology mix.

Types:
  financial     — banks / insurers: FCF-DCF is inappropriate; use an
                  ROE-based justified price-to-book model when data allows
  reit          — real-estate trusts: FFO/AFFO unavailable from the current
                  provider, so the model runs in explicitly limited mode
  pre_revenue   — no meaningful revenue: no reliable range can be produced
  high_growth   — fast growth with negative or unstable FCF: margin-ramp
                  scenarios instead of naive FCF extrapolation
  cyclical      — commodity/industrial cyclicals: normalized (median) FCF
                  and margins, never a single peak/trough year
  standard      — profitable with usable cash flow: full DCF + reverse DCF
"""

from services.valuation.inputs import NormalizedInputs

_FINANCIAL_INDUSTRY_HINTS = ("bank", "insurance", "insurer", "capital markets", "credit services", "asset management")
_CYCLICAL_SECTORS = ("energy", "basic materials", "industrials")
_CYCLICAL_INDUSTRY_HINTS = ("auto", "airlines", "semiconductor", "oil", "gas", "mining", "steel", "chemical")
HIGH_GROWTH_THRESHOLD = 0.20


def classify(n: NormalizedInputs) -> str:
    industry = n.industry.lower()
    sector   = n.sector.lower()

    if "reit" in industry or "reit" in sector:
        return "reit"
    if sector == "financial services" and any(h in industry for h in _FINANCIAL_INDUSTRY_HINTS):
        return "financial"
    if not n.revenue or n.revenue <= 0:
        return "pre_revenue"
    if (n.revenue_cagr is not None and n.revenue_cagr > HIGH_GROWTH_THRESHOLD
            and (n.fcf is None or n.fcf <= 0 or n.fcf_negative_years > n.fcf_positive_years)):
        return "high_growth"
    if sector in _CYCLICAL_SECTORS or any(h in industry for h in _CYCLICAL_INDUSTRY_HINTS):
        return "cyclical"
    return "standard"
