"""
Portfolio view — the single aggregated, intelligence-enriched view the
Portfolio Office renders.

Aggregates every connected broker snapshot, then annotates each holding with
Bukra's intelligence (Bukra Score, Future Relevance, conviction) so the
cockpit shows judgement, not just numbers. All computation stays here —
the UI receives finished clarity.
"""

from services.portfolio.registry import SUPPORTED_BROKERS, connected_snapshots


def build_portfolio_view() -> dict:
    """
    The complete Portfolio Office payload.
    connected=False until the first broker adapter ships — the UI renders
    the cockpit shell with the connection invitation.
    """
    snapshots = connected_snapshots()
    if not snapshots:
        return {
            "connected":  False,
            "brokers":    SUPPORTED_BROKERS,
            "totalValue": None,
            "cash":       None,
            "holdings":   [],
            "allocation": {"bySector": [], "byCountry": []},
            "alerts":     [],
        }

    holdings = [h for s in snapshots for h in s.to_dict()["holdings"]]
    total    = sum(h["market_value"] or 0 for h in holdings)
    cash     = sum(s.cash for s in snapshots)

    def _group(key):
        groups: dict = {}
        for h in holdings:
            groups[h[key] or "Other"] = groups.get(h[key] or "Other", 0) + (h["market_value"] or 0)
        return [{"label": k, "value": round(v, 2), "weight": round(v / total, 4) if total else 0}
                for k, v in sorted(groups.items(), key=lambda kv: -kv[1])]

    # Intelligence enrichment (Bukra Score / Future Relevance / conviction per
    # holding) joins here once a live adapter exists — the cached company-page
    # pipeline already computes everything needed.
    return {
        "connected":  True,
        "brokers":    SUPPORTED_BROKERS,
        "totalValue": round(total + cash, 2),
        "cash":       round(cash, 2),
        "holdings":   holdings,
        "allocation": {"bySector": _group("sector"), "byCountry": _group("country")},
        "alerts":     [],
    }
