"""
Knowledge Evolution — answers "has anything materially changed?"

Compares the current research run against the previous memory record and
produces short, human-readable change notes in the active UI language.
These notes ARE the product's heartbeat: a returning user sees that Bukra
kept working while they were away. Empty list = nothing meaningful changed —
and silence is a valid, calm answer.
"""

from typing import Optional

from services.future_relevance.context import ResearchContext

# Below this score move, we stay silent — no noise, no false urgency
MATERIAL_SCORE_DELTA = 3


def detect_changes(ctx: ResearchContext, previous: Optional[dict],
                   score: int, confidence: str, status: str) -> list:
    """Meaningful changes since the last analysis. [] when nothing material."""
    if not previous:
        return []

    changes = []
    prev_score = previous.get("score")
    prev_conf  = previous.get("confidence")
    prev_stat  = previous.get("status")

    if prev_score is not None and abs(score - prev_score) >= MATERIAL_SCORE_DELTA:
        if score > prev_score:
            changes.append(ctx.txt(
                f"חיזקנו את הערכת הרלוונטיות העתידית ({prev_score}→{score}).",
                f"We strengthened our future-relevance assessment ({prev_score}→{score}).",
            ))
        else:
            changes.append(ctx.txt(
                f"הפחתנו את הערכת הרלוונטיות העתידית ({prev_score}→{score}).",
                f"We lowered our future-relevance assessment ({prev_score}→{score}).",
            ))

    if prev_conf and prev_conf != confidence:
        order = {"Low": 0, "Medium": 1, "High": 2}
        if order.get(confidence, 1) > order.get(prev_conf, 1):
            changes.append(ctx.txt("רמת הביטחון שלנו עלתה.", "Our confidence increased."))
        else:
            changes.append(ctx.txt("רמת הביטחון שלנו ירדה.", "Our confidence decreased."))

    if prev_stat and prev_stat != status:
        changes.append(ctx.txt(
            f"הסטטוס השתנה: {prev_stat} → {status}.",
            f"Status changed: {prev_stat} → {status}.",
        ))

    return changes
