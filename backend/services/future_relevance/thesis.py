"""
Investment Thesis Engine — an evolving thesis per company.

The thesis is never rewritten from scratch. Each research run either
confirms the existing thesis (same version, evolution log grows) or evolves
it (version bumps, with a recorded note explaining what changed and why).

Thesis shape (stable):
    currentThesis, supportingEvidence, counterArguments, knownRisks,
    unknownRisks, majorAssumptions, confidence, reevaluationTriggers,
    catalysts, threats, version, evolvedAt, evolutionLog
"""

from typing import Optional

from services.future_relevance.context import ResearchContext


def _thesis_text(ctx: ResearchContext, score: int, status: str) -> str:
    if ctx.lang == "he":
        if score >= 80:
            return (f"{ctx.name} ממוצבת להישאר רלוונטית מאוד בעשור הקרוב ({status}). "
                    "שילוב של חפיר תחרותי בר-הגנה, פוטנציאל אימוץ AI וביקוש מובנה ארוך טווח "
                    "תומך בתזה של רלוונטיות מתמשכת — כל עוד ההנחות המרכזיות מחזיקות.")
        if score >= 65:
            return (f"{ctx.name} צפויה לשמור על מעמדה אך תידרש להתמודד עם אתגרים מבניים ({status}). "
                    "התזה תלויה ביכולת ההנהלה להתאים את המודל העסקי בקצב השינוי הענפי.")
        if score >= 50:
            return (f"הרלוונטיות ארוכת הטווח של {ctx.name} אינה ודאית ({status}). "
                    "נדרשות ראיות נוספות ליכולת החברה להגן על מעמדה מול שיבוש טכנולוגי ותחרותי.")
        return (f"{ctx.name} חשופה לסיכון שיבוש גבוה ({status}). "
                "התזה הנוכחית מזהה שחיקה מבנית ברלוונטיות ללא עדות מספקת ליכולת היפוך מגמה.")
    if score >= 80:
        return (f"{ctx.name} is positioned to remain highly relevant over the coming decade ({status}). "
                "A defensible competitive moat, AI adoption potential and structural long-term demand "
                "support a durable-relevance thesis — provided the core assumptions hold.")
    if score >= 65:
        return (f"{ctx.name} should hold its position but faces structural challenges ({status}). "
                "The thesis depends on management adapting the business model at the pace of industry change.")
    if score >= 50:
        return (f"The long-term relevance of {ctx.name} is uncertain ({status}). "
                "More evidence is needed of the company's ability to defend its position against "
                "technological and competitive disruption.")
    return (f"{ctx.name} is exposed to high disruption risk ({status}). "
            "The current thesis identifies structural relevance erosion without sufficient evidence "
            "of a credible turnaround.")


def _material_change(previous: dict, score: int, confidence: str) -> bool:
    """A thesis evolves only on material change — score band shift or confidence move."""
    def band(s):
        return 0 if s < 50 else 1 if s < 65 else 2 if s < 80 else 3
    prev_score = previous.get("score")
    if prev_score is None:
        return True
    return band(prev_score) != band(score) or previous.get("confidence") != confidence


def build_thesis(ctx: ResearchContext, verdict: dict, confidence: str,
                 reports: list, generated_at: str,
                 previous: Optional[dict] = None) -> dict:
    """
    Build or evolve the company's investment thesis.
    `previous` is the thesis stored in the last memory record (or None).
    """
    score  = verdict["score"]
    status = verdict["status"]

    supporting = [d["summary"] for d in verdict["drivers"][:4]]
    counter    = [r["summary"] for r in verdict["risks"][:3]]
    known      = [r["label"] for r in verdict["risks"]]
    assumptions = sorted({a for r in reports for a in r.assumptions})

    unknown = [ctx.txt(
        "סיכונים שטרם ניתנים לזיהוי: שיבושים טכנולוגיים שטרם נולדו, שינויים רגולטוריים לא צפויים, "
        "ואירועים גיאופוליטיים מחוץ למודל.",
        "Risks not yet identifiable: technologies not yet born, unanticipated regulatory shifts, "
        "and geopolitical events outside the model.",
    )]
    triggers = [
        ctx.txt("דוח רווחים החורג מהותית מהמגמה", "An earnings report materially off-trend"),
        ctx.txt("רכישה משמעותית או שינוי הנהלה", "A major acquisition or management change"),
        ctx.txt("שינוי רגולטורי בשוקי הליבה", "A regulatory shift in core markets"),
        ctx.txt("פריצת דרך טכנולוגית אצל מתחרה", "A competitor technology breakthrough"),
    ]
    catalysts = [d["label"] for d in verdict["drivers"][:3]]
    threats   = [r["label"] for r in verdict["risks"][:3]]

    new_thesis = {
        "currentThesis":        _thesis_text(ctx, score, status),
        "supportingEvidence":   supporting,
        "counterArguments":     counter,
        "knownRisks":           known,
        "unknownRisks":         unknown,
        "majorAssumptions":     assumptions,
        "confidence":           confidence,
        "reevaluationTriggers": triggers,
        "catalysts":            catalysts,
        "threats":              threats,
        "score":                score,
        "version":              1,
        "evolvedAt":            generated_at,
        "evolutionLog":         [],
    }

    if not previous:
        new_thesis["evolutionLog"] = [{
            "date": generated_at,
            "note": ctx.txt("תזה ראשונית נוסחה.", "Initial thesis formed."),
        }]
        return new_thesis

    log = list(previous.get("evolutionLog", []))
    if _material_change(previous, score, confidence):
        note = ctx.txt(
            f"התזה התפתחה: ציון {previous.get('score')}→{score}, ביטחון {previous.get('confidence')}→{confidence}.",
            f"Thesis evolved: score {previous.get('score')}→{score}, confidence {previous.get('confidence')}→{confidence}.",
        )
        log.append({"date": generated_at, "note": note})
        new_thesis["version"]      = previous.get("version", 1) + 1
        new_thesis["evolutionLog"] = log[-20:]
        return new_thesis

    # No material change — the existing thesis is CONFIRMED, not rewritten
    confirmed = dict(previous)
    log.append({"date": generated_at, "note": ctx.txt("התזה אושררה ללא שינוי מהותי.",
                                                      "Thesis reconfirmed without material change.")})
    confirmed["evolutionLog"] = log[-20:]
    confirmed["evolvedAt"]    = previous.get("evolvedAt", generated_at)
    return confirmed
