"""
Judge — combines all analyst reports into one Future Relevance conclusion.

Current implementation: simple weighted mean plus deterministic assembly of
drivers / risks / trends. Will later become a Judge AI that reads full
analyst reasoning and adjudicates disagreements.
"""

from services.future_relevance.context import ResearchContext
from services.future_relevance.analysts.base import AnalystReport

# Per-analyst weights in the final verdict (must sum to 1.0)
JUDGE_WEIGHTS: dict[str, float] = {
    "ai_adoption":        0.12,
    "industry":           0.12,
    "technology":         0.10,
    "competition":        0.10,
    "consumer_behaviour": 0.06,
    "regulation":         0.08,
    "innovation":         0.10,
    "management":         0.08,
    "macro":              0.08,
    "geopolitical":       0.06,
    "competitive_moat":   0.10,
}
_total = sum(JUDGE_WEIGHTS.values())
assert abs(_total - 1.0) < 1e-9, f"JUDGE_WEIGHTS must sum to 1.0 — got {_total}"


def status_label(score: int) -> str:
    if score >= 90: return "Future Leader"
    if score >= 80: return "Highly Relevant"
    if score >= 65: return "Stable but Challenged"
    if score >= 50: return "Future Uncertain"
    return "High Disruption Risk"


def judge(ctx: ResearchContext, reports: list[AnalystReport]) -> dict:
    """Combine analyst reports into a final verdict + merged research content."""
    if not reports:
        return {"score": 50, "status": status_label(50), "drivers": [], "risks": [], "trends": []}

    weighted = 0.0
    covered  = 0.0
    for r in reports:
        w = JUDGE_WEIGHTS.get(r.analyst_key, 0)
        weighted += r.score * w
        covered  += w
    score = max(0, min(100, round(weighted / covered if covered else 50)))

    # Merge structured content, deduplicated by key, ordered by score/severity
    drivers, risks, trends = {}, {}, {}
    for r in reports:
        for d in r.opportunities:
            drivers.setdefault(d["key"], d)
        for k in r.risks:
            risks.setdefault(k["key"], k)
        for t in r.trends:
            trends.setdefault(t["key"], t)

    sev_rank = {"High": 0, "Medium": 1, "Low": 2}
    return {
        "score":   score,
        "status":  status_label(score),
        "drivers": sorted(drivers.values(), key=lambda d: -d["score"]),
        "risks":   sorted(risks.values(), key=lambda r: sev_rank.get(r["severity"], 3)),
        "trends":  sorted(trends.values(), key=lambda t: sev_rank.get(t["relevance"], 3)),
    }


def build_summary(ctx: ResearchContext, verdict: dict, confidence: str, n_analysts: int) -> str:
    """Final research summary in the active UI language (generated, not translated)."""
    score  = verdict["score"]
    status = verdict["status"]
    if ctx.lang == "he":
        return (
            f"{ctx.name} מקבלת ציון רלוונטיות עתידית של {score}/100 ({status}). "
            f"המסקנה משקללת {n_analysts} פרספקטיבות מחקר עצמאיות באופק של 10–15 שנים, "
            f"ברמת ביטחון {confidence}. "
            f"הגורמים החיוביים המרכזיים כוללים פוטנציאל אימוץ AI וחפיר תחרותי בר-הגנה, "
            f"בעוד שהסיכונים העיקריים הם התגברות התחרות ואי-ודאות רגולטורית. "
            f"ההערכה מתעדכנת ככל שמידע חדש מצטבר — מסקנת היום אינה מסקנת המחר."
        )
    return (
        f"{ctx.name} receives a Future Relevance score of {score}/100 ({status}). "
        f"The conclusion weighs {n_analysts} independent research perspectives over a "
        f"10–15 year horizon, at {confidence} confidence. "
        f"Key positive drivers include AI adoption potential and a defensible competitive moat, "
        f"while the primary risks are intensifying competition and regulatory uncertainty. "
        f"The assessment evolves as new information accumulates — today's conclusion is not tomorrow's."
    )
