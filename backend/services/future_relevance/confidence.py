"""
Confidence Engine — estimates how much to trust the current conclusion.

Confidence is ALWAYS independent from the score itself. A company can score
90 with Low confidence, or 40 with High confidence.

High confidence requires: multiple supporting signals, consistent evidence,
and strong agreement between analysts. Disagreement or thin data lowers it.
"""

from statistics import pstdev

from services.future_relevance.analysts.base import AnalystReport

# Analyst-score standard deviation thresholds (0–100 scale)
_AGREEMENT_TIGHT = 6.0    # analysts strongly agree
_AGREEMENT_LOOSE = 14.0   # analysts meaningfully disagree

MIN_ANALYSTS_FOR_HIGH = 8


def compute_confidence(reports: list[AnalystReport]) -> str:
    """Returns "High" | "Medium" | "Low"."""
    if len(reports) < 3:
        return "Low"

    scores = [r.score for r in reports]
    spread = pstdev(scores)

    # Placeholder analysts can never justify High confidence — real evidence
    # (multiple signals, real sources) is required. This rule stays after the
    # real engine lands: High demands enough analysts AND tight agreement.
    all_placeholder = all(getattr(r, "sources", None) == ["bukra_score", "company_info"] for r in reports)

    if spread > _AGREEMENT_LOOSE:
        return "Low"
    if (not all_placeholder
            and len(reports) >= MIN_ANALYSTS_FOR_HIGH
            and spread <= _AGREEMENT_TIGHT):
        return "High"
    return "Medium"
