"""
Dynamic conclusion & factor generation — deterministic, template-based,
built ONLY from calculated outputs. Never claims certainty, never says
"bubble", always attributes findings to the Index. Generated directly in
the active UI language.
"""

from typing import Optional

from services.valuation.inputs import NormalizedInputs


def _t(lang, he, en):
    return he if lang == "he" else en


def build_factors(lang: str, n: NormalizedInputs, scenarios: dict,
                  rdcf: Optional[dict], bubble: Optional[dict]) -> dict:
    """Returns {"positive": [...], "risk": [...]} — each supported by a calculation."""
    positive, risk = [], []
    base = scenarios.get("base", {})

    if base.get("available") and n.market_cap:
        ratio = n.market_cap / base["fairEquityValue"]
        if ratio <= 0.85:
            positive.append(_t(lang,
                "מחיר השוק הנוכחי נמוך מהערכת תרחיש הבסיס — פער חיובי פוטנציאלי.",
                "The current market price is below the Base Case estimate — a potential positive gap."))
        elif ratio <= 1.15:
            positive.append(_t(lang,
                "מחיר השוק קרוב לערך תרחיש הבסיס המחושב.",
                "The market price is close to the calculated Base Case value."))
        else:
            risk.append(_t(lang,
                f"שווי השוק גבוה בכ-{round((ratio-1)*100)}% מהערכת תרחיש הבסיס.",
                f"The market value is roughly {round((ratio-1)*100)}% above the Base Case estimate."))

    if n.fcf_positive_years >= 3 and n.fcf is not None and n.fcf > 0:
        positive.append(_t(lang,
            "תזרים מזומנים חופשי חיובי ויציב מפחית סיכון תמחור ספקולטיבי.",
            "Positive and stable free cash flow reduces speculative valuation risk."))
    if n.fcf is not None and n.fcf < 0:
        runway = (n.cash / abs(n.fcf)) if n.cash else None
        if runway is not None and runway < 3:
            risk.append(_t(lang,
                f"קצב שריפת המזומנים הנוכחי מותיר כ-{runway:.1f} שנות פעילות ללא גיוס הון נוסף.",
                f"The current cash-burn rate leaves roughly {runway:.1f} years of runway without additional financing."))

    net_debt = (n.total_debt or 0) - (n.cash or 0)
    if net_debt < 0:
        positive.append(_t(lang,
            "לחברה עמדת מזומנים נטו — המאזן תומך בהערכת השווי.",
            "The company holds a net cash position — the balance sheet supports the valuation."))
    elif n.normalized_fcf and n.normalized_fcf > 0 and net_debt > 3 * n.normalized_fcf:
        risk.append(_t(lang,
            "רמת החוב נטו גבוהה ביחס לתזרים המזומנים החופשי המנורמל.",
            "Net debt is high relative to normalized free cash flow."))

    if rdcf:
        hist = n.revenue_cagr if n.revenue_cagr is not None else n.fcf_cagr
        implied = rdcf["implied_fcf_growth"]
        if hist is not None and implied - hist > 0.05:
            risk.append(_t(lang,
                "המחיר הנוכחי דורש מהחברה לשמור על צמיחה גבוהה מהותית מקצב הצמיחה ההיסטורי שלה.",
                "The current market price requires the company to maintain growth materially above its historical rate."))
        elif hist is not None and implied <= hist:
            positive.append(_t(lang,
                "ההנחות המשתמעות מהמחיר הנוכחי עקביות באופן רחב עם הביצועים התפעוליים האחרונים של החברה.",
                "The assumptions implied by the current price are broadly consistent with the company's recent operating performance."))
        if rdcf.get("terminal_value_pct") and rdcf["terminal_value_pct"] > 75:
            risk.append(_t(lang,
                f"כ-{rdcf['terminal_value_pct']:.0f}% מהשווי המחושב תלוי בתזרימים שמעבר לתקופת התחזית המפורשת.",
                f"About {rdcf['terminal_value_pct']:.0f}% of the calculated value depends on cash flows beyond the explicit forecast period."))
        if rdcf.get("solver_capped") and implied > 0.3:
            risk.append(_t(lang,
                "גם בהנחות הצמיחה המקסימליות של המודל קשה להצדיק את המחיר הנוכחי — התמחור רגיש מאוד להנחות.",
                "Even the model's maximum growth assumptions struggle to justify the current price — the valuation is highly sensitive to assumptions."))

    return {"positive": positive, "risk": risk}


def build_conclusion(lang: str, n: NormalizedInputs, valuation_score: Optional[int],
                     bukra_score: Optional[int], confidence_label: str,
                     scenarios: dict, insufficient: bool) -> str:
    if insufficient:
        return _t(lang,
            "המדד אינו יכול לחשב טווח שווי הוגן אמין עבור חברה זו — הנתונים הזמינים אינם מספיקים.",
            "The Index cannot compute a reliable fair value range for this company — the available data is insufficient.")

    base = scenarios.get("base", {})
    upside = base.get("upsideDownsidePct")
    parts = []

    if bukra_score is not None and valuation_score is not None:
        if bukra_score >= 70 and valuation_score < 40:
            parts.append(_t(lang,
                "החברה מציגה איכות עסקית גבוהה, אך המחיר הנוכחי מגלם הנחות צמיחה אגרסיביות ומותיר מרווח ביטחון מוגבל.",
                "The company demonstrates strong business quality, but the current price implies aggressive long-term growth and leaves a limited margin of safety."))
        elif bukra_score >= 70 and valuation_score >= 65:
            parts.append(_t(lang,
                "המדד זיהה שילוב של איכות עסקית גבוהה ותמחור אטרקטיבי, בכפוף לסיכונים ולרמת הביטחון המוצגים.",
                "The Index identified a combination of strong business quality and attractive valuation, subject to the displayed risks and confidence level."))
        elif valuation_score is not None and valuation_score < 35:
            parts.append(_t(lang,
                "חברה יכולה להיות עסק מצוין ועדיין לא אטרקטיבית במחיר הנוכחי.",
                "The company may be an excellent business while still being unattractive at the current price."))

    if upside is not None:
        if upside > 10:
            parts.append(_t(lang,
                f"המדד זיהה פער חיובי פוטנציאלי של כ-{upside:.0f}% בין המחיר הנוכחי להערכת תרחיש הבסיס.",
                f"The Index identified a potential positive gap of roughly {upside:.0f}% between the current price and the Base Case estimate."))
        elif upside < -10:
            parts.append(_t(lang,
                f"המחיר הנוכחי גבוה בכ-{abs(upside):.0f}% מהערכת תרחיש הבסיס — ירידה משוערת ביחס לתרחיש הבסיס.",
                f"The current price is roughly {abs(upside):.0f}% above the Base Case estimate — an estimated downside relative to the Base Case."))
        else:
            parts.append(_t(lang,
                "מחיר השוק הנוכחי נמצא בתוך טווח השווי ההוגן המחושב.",
                "The current market price is within the calculated fair value range."))

    if confidence_label == "Low":
        parts.append(_t(lang,
            "רמת הביטחון של המדד בהערכה זו נמוכה — יש להתייחס לטווח כאינדיקציה בלבד.",
            "The Index's confidence in this estimate is low — treat the range as indicative only."))

    return " ".join(parts) if parts else _t(lang,
        "ההערכה חושבה; ראו את הטווח, ההנחות והגורמים המפורטים למטה.",
        "The estimate was computed; see the range, assumptions and factors detailed below.")
