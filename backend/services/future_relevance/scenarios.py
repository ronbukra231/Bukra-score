"""
Scenario Generator — bull / base / bear long-term scenarios.

Placeholder content today; the real generator will build scenarios from the
analysts' merged reasoning. Content is generated directly in the UI language.
"""

from services.future_relevance.context import ResearchContext


def generate_scenarios(ctx: ResearchContext, score: int) -> list[dict]:
    name = ctx.name
    if ctx.lang == "he":
        return [
            {
                "type": "bull",
                "title": "תרחיש אופטימי — מנהיגות טכנולוגית",
                "summary": (
                    f"{name} מבצעת בהצלחה את מפת הדרכים לשילוב AI והופכת לפלטפורמה מועדפת "
                    "בסגמנטים ארגוניים. ההכנסות צומחות ב-12–15% בשנה, המרווח התפעולי מתרחב, "
                    "והעסק מבסס חפיר תחרותי עמיד דרך אפקטי רשת ודאטה קנייני. "
                    "החברה מסיימת את העשור כמובילת קטגוריה."
                ),
                "timeframe": "2030–2035",
            },
            {
                "type": "base",
                "title": "תרחיש בסיס — צמיחה יציבה",
                "summary": (
                    f"{name} שומרת על מעמדה תוך התרחבות הדרגתית לשווקים משיקים. "
                    "צמיחת ההכנסות מתמתנת ל-6–9% בשנה עם התבגרות שוקי הליבה. "
                    "העסק ממשיך להשקיע ביכולות הדור הבא ומייצר תזרים חופשי עקבי "
                    "שממומן ממנו גם השקעה חוזרת וגם החזר לבעלי המניות."
                ),
                "timeframe": "2030–2035",
            },
            {
                "type": "bear",
                "title": "תרחיש פסימי — שחיקת נתח שוק",
                "summary": (
                    f"שיבוש מהיר מהצפוי ממתחרים מבוססי AI, בשילוב רוחות נגד רגולטוריות, "
                    f"דוחק את {name} לעמדת מגננה. הצמיחה נעצרת על 1–3% בשנה תוך דחיסת מרווחים. "
                    "העסק נותר רווחי אך מאבד רלוונטיות אסטרטגית ככל שלקוחות עוברים לחלופות "
                    "עם כלכלה או יכולות עדיפות."
                ),
                "timeframe": "2030–2035",
            },
        ]
    return [
        {
            "type": "bull",
            "title": "Bull Case — Technology Leadership",
            "summary": (
                f"{name} successfully executes its AI integration roadmap, becoming a platform "
                "of choice across enterprise segments. Revenue compounds at 12–15% annually, "
                "operating margins expand, and the business builds a durable competitive moat "
                "through network effects and proprietary data. "
                "The company exits the decade as a category-defining leader."
            ),
            "timeframe": "2030–2035",
        },
        {
            "type": "base",
            "title": "Base Case — Steady Compounder",
            "summary": (
                f"{name} maintains its position while gradually expanding into adjacent markets. "
                "Revenue growth moderates to 6–9% annually as core markets mature. "
                "The business keeps investing in next-generation capabilities and generates "
                "consistent free cash flow funding both reinvestment and shareholder returns."
            ),
            "timeframe": "2030–2035",
        },
        {
            "type": "bear",
            "title": "Bear Case — Market Share Erosion",
            "summary": (
                f"Faster-than-expected disruption from AI-native competitors, combined with "
                f"regulatory headwinds, forces {name} into a defensive posture. Growth stalls "
                "at 1–3% annually while margins compress. The business stays profitable but "
                "loses strategic relevance as customers migrate to superior alternatives."
            ),
            "timeframe": "2030–2035",
        },
    ]
