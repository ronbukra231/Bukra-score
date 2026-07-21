"""
Portfolio Health — a diagnostic, never a safety guarantee. Every driver of
the overall status is returned alongside it so the UI can explain, not just
assert, the rating.
"""

from services.simulator.config import RISK_PROFILES


def compute_health(state: dict, holding_scores: dict) -> dict:
    """
    holding_scores: {ticker: {"bukraScore": int|None, "valuationScore": int|None,
    "bubbleRisk": int|None, "confidence": int|None, "dataQuality": str|None,
    "aboveFairValue": bool|None}} — freshly computed by the caller (service.py),
    never trusted from the client.
    """
    p = state["portfolio"]
    open_holdings = [h for h in state["holdings"].values() if h["status"] == "open"]
    rules = RISK_PROFILES.get(p["riskProfile"], RISK_PROFILES["balanced"])
    total = max(p["currentValue"], 1e-9)

    if not open_holdings:
        return {
            "status": "Balanced" if p["currentCash"] > 0 else "Needs Attention",
            "cashAllocation": 1.0 if p["currentValue"] > 0 else 0.0,
            "numberOfHoldings": 0, "largestPositionWeight": 0.0, "largestSectorWeight": 0.0,
            "currencyConcentration": {}, "averageBukraScore": None, "averageValuationScore": None,
            "weightedBubbleRisk": None, "weightedValuationConfidence": None,
            "pctAboveFairValue": None, "pctLowConfidence": None, "pctLimitedDataQuality": None,
            "drivers": [],
        }

    weights = {h["ticker"]: (h["currentMarketValue"] / total if total else 0) for h in open_holdings}
    largest_position = max(weights.values()) if weights else 0.0

    sector_totals: dict = {}
    currency_totals: dict = {}
    for h in open_holdings:
        sector_totals[h.get("sector", "")] = sector_totals.get(h.get("sector", ""), 0) + h["currentMarketValue"]
        currency_totals[h.get("tradingCurrency", "USD")] = currency_totals.get(h.get("tradingCurrency", "USD"), 0) + h["currentMarketValue"]
    largest_sector = max(sector_totals.values()) / total if sector_totals and total else 0.0
    currency_concentration = {k: round(v / total, 4) for k, v in currency_totals.items()} if total else {}

    def w_avg(key):
        vals = [(weights[h["ticker"]], holding_scores.get(h["ticker"], {}).get(key))
               for h in open_holdings]
        vals = [(w, v) for w, v in vals if v is not None]
        if not vals:
            return None
        wsum = sum(w for w, _ in vals)
        return round(sum(w * v for w, v in vals) / wsum, 1) if wsum else None

    avg_bukra = w_avg("bukraScore")
    avg_val = w_avg("valuationScore")
    weighted_bubble = w_avg("bubbleRisk")
    weighted_conf = w_avg("confidence")

    n = len(open_holdings)
    pct_above_fv = round(sum(1 for h in open_holdings
                             if holding_scores.get(h["ticker"], {}).get("aboveFairValue")) / n, 3)
    pct_low_conf = round(sum(1 for h in open_holdings
                             if (holding_scores.get(h["ticker"], {}).get("confidence") or 100) < 40) / n, 3)
    pct_limited_dq = round(sum(1 for h in open_holdings
                               if holding_scores.get(h["ticker"], {}).get("dataQuality") in ("limited", "insufficient")) / n, 3)

    drivers = []
    status_flags = []

    if largest_position > rules["max_position_pct"] + 0.03:
        drivers.append(("position_concentration", largest_position))
        status_flags.append("High Concentration")
    if largest_sector > rules["max_sector_pct"] + 0.05:
        drivers.append(("sector_concentration", largest_sector))
        status_flags.append("High Concentration")
    cash_pct = p["currentCash"] / total if total else 0.0
    if cash_pct < rules["min_cash_pct"] * 0.5:
        drivers.append(("low_cash", cash_pct))
        status_flags.append("Needs Attention")
    if weighted_bubble is not None and weighted_bubble > rules["max_bubble_risk"]:
        drivers.append(("high_bubble_risk", weighted_bubble))
        status_flags.append("High Valuation Risk")
    if pct_above_fv is not None and pct_above_fv > 0.5:
        drivers.append(("majority_above_fair_value", pct_above_fv))
        status_flags.append("High Valuation Risk")
    if pct_limited_dq is not None and pct_limited_dq > 0.4:
        drivers.append(("limited_data_quality", pct_limited_dq))
        status_flags.append("Limited Data Confidence")

    if not status_flags:
        status = "Strong" if (avg_bukra or 0) >= 70 and (avg_val or 0) >= 55 else "Balanced"
    else:
        # Priority order when multiple issues exist
        for candidate in ("High Concentration", "High Valuation Risk", "Limited Data Confidence", "Needs Attention"):
            if candidate in status_flags:
                status = candidate
                break

    return {
        "status": status,
        "cashAllocation": round(cash_pct, 4),
        "numberOfHoldings": n,
        "largestPositionWeight": round(largest_position, 4),
        "largestSectorWeight": round(largest_sector, 4),
        "currencyConcentration": currency_concentration,
        "averageBukraScore": avg_bukra, "averageValuationScore": avg_val,
        "weightedBubbleRisk": weighted_bubble, "weightedValuationConfidence": weighted_conf,
        "pctAboveFairValue": pct_above_fv, "pctLowConfidence": pct_low_conf,
        "pctLimitedDataQuality": pct_limited_dq,
        "drivers": [{"key": k, "value": round(v, 4)} for k, v in drivers],
    }
