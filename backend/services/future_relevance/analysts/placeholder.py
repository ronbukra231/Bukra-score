"""
Placeholder analysts — deterministic heuristics with the exact structure the
real LLM analysts will produce. Each covers one research dimension.

Replace individual analysts with real LLM implementations one at a time;
the Judge and everything downstream will not notice the difference.
"""

from services.future_relevance.context import ResearchContext
from services.future_relevance.analysts.base import Analyst, AnalystReport


# Sector modifier used by several placeholder heuristics
_SECTOR_MOD = {
    "technology":             15,
    "healthcare":             10,
    "communication services":  8,
    "consumer cyclical":       3,
    "industrials":             2,
    "financial services":      0,
    "consumer defensive":     -2,
    "real estate":            -3,
    "energy":                 -5,
    "basic materials":        -6,
    "utilities":              -8,
}


def _clamp(v: float) -> int:
    return max(0, min(100, round(v)))


def _sector_mod(ctx: ResearchContext) -> int:
    return _SECTOR_MOD.get(ctx.sector.lower(), 0)


def _growth_mod(ctx: ResearchContext) -> int:
    growth_raw = ctx.score_data.get("breakdown", {}).get("growth", 0)
    return round((growth_raw / 25) * 10 - 5)   # -5 .. +5


class PlaceholderAnalyst(Analyst):
    """
    Generic placeholder: base score = Bukra Score adjusted by sector/growth,
    plus a per-analyst offset so analysts genuinely disagree with each other
    (required for the confidence engine to behave realistically).
    """

    label_he = ""
    label_en = ""
    offset = 0

    def base_score(self, ctx: ResearchContext) -> int:
        return _clamp(ctx.bukra_score + _sector_mod(ctx) + _growth_mod(ctx) + self.offset)

    def analyze(self, ctx: ResearchContext) -> AnalystReport:
        score = self.base_score(ctx)
        return AnalystReport(
            analyst_key=self.key,
            label=ctx.txt(self.label_he, self.label_en),
            score=score,
            confidence="Medium",
            reasoning=self.reasoning(ctx, score),
            opportunities=self.opportunities(ctx, score),
            risks=self.risks(ctx, score),
            trends=self.trends(ctx),
            assumptions=[ctx.txt(
                "הערכה היוריסטית המבוססת על ציון בוקרא, סקטור ומומנטום צמיחה בלבד.",
                "Heuristic estimate based only on Bukra Score, sector and growth momentum.",
            )],
            sources=["bukra_score", "company_info"],
        )

    # Subclasses override the content hooks below
    def reasoning(self, ctx: ResearchContext, score: int) -> str:
        return ""

    def opportunities(self, ctx: ResearchContext, score: int) -> list:
        return []

    def risks(self, ctx: ResearchContext, score: int) -> list:
        return []

    def trends(self, ctx: ResearchContext) -> list:
        return []


# ── The eleven placeholder analysts ───────────────────────────────────────────

class AIAdoptionAnalyst(PlaceholderAnalyst):
    key = "ai_adoption"
    label_he, label_en = "אנליסט אימוץ AI", "AI Adoption Analyst"
    offset = 8

    def reasoning(self, ctx, score):
        return ctx.txt(
            f"{ctx.name} פועלת בסביבה שבה אימוץ AI ארגוני מאיץ. יכולת שילוב AI במוצרי הליבה היא גורם מרכזי ברלוונטיות העתידית.",
            f"{ctx.name} operates in an environment of accelerating enterprise AI adoption. The ability to embed AI into core products is a primary future-relevance factor.",
        )

    def opportunities(self, ctx, score):
        return [{
            "key": "ai_adoption", "label": ctx.txt("אימוץ AI", "AI Adoption"),
            "score": _clamp(score + 4),
            "summary": ctx.txt(
                f"{ctx.name} ממוצבת ליהנות מהאצת אימוץ AI ארגוני בשוקי הליבה שלה.",
                f"{ctx.name} is positioned to benefit from accelerating enterprise AI adoption in its core markets.",
            ),
        }]

    def trends(self, ctx):
        return [
            {"key": "ai",   "label": ctx.txt("בינה מלאכותית", "Artificial Intelligence"), "relevance": "High"},
            {"key": "data", "label": ctx.txt("כלכלת הדאטה", "Data Economy"),              "relevance": "High"},
        ]


class IndustryAnalyst(PlaceholderAnalyst):
    key = "industry"
    label_he, label_en = "אנליסט תעשייה", "Industry Analyst"
    offset = 0

    def reasoning(self, ctx, score):
        return ctx.txt(
            f"סקטור ה{ctx.sector or 'ליבה'} צפוי לצמוח בקצב מעל הממוצע בעשור הקרוב, בהובלת טרנספורמציה דיגיטלית.",
            f"The {ctx.sector or 'core'} sector is expected to grow above average over the next decade, driven by digital transformation.",
        )

    def opportunities(self, ctx, score):
        return [{
            "key": "industry_outlook", "label": ctx.txt("תחזית ענפית", "Industry Outlook"),
            "score": score,
            "summary": ctx.txt(
                "מגמות ענפיות ארוכות טווח תומכות בביקוש מובנה למוצרי הליבה.",
                "Long-term industry trends structurally support demand for core products.",
            ),
        }]

    def risks(self, ctx, score):
        return [{
            "key": "industry_risks", "label": ctx.txt("סיכונים ענפיים", "Industry Risks"),
            "severity": "Low",
            "summary": ctx.txt(
                "מחזוריות, קומודיטיזציה ולחץ על מרווחים נותרים סיכונים ענפיים באופק של 10–15 שנים.",
                "Cyclicality, commoditisation and margin pressure remain sector risks over a 10–15 year horizon.",
            ),
        }]


class TechnologyAnalyst(PlaceholderAnalyst):
    key = "technology"
    label_he, label_en = "אנליסט טכנולוגיה", "Technology Analyst"
    offset = 3

    def reasoning(self, ctx, score):
        return ctx.txt(
            "מחזורי טכנולוגיה מתקצרים; יתרון טכנולוגי חייב להתחדש כדי להישאר רלוונטי.",
            "Technology cycles are shortening; a technical edge must be continuously renewed to stay relevant.",
        )

    def risks(self, ctx, score):
        return [{
            "key": "technology_disruption", "label": ctx.txt("שיבוש טכנולוגי", "Technology Disruption"),
            "severity": "Medium",
            "summary": ctx.txt(
                "מחזורי חדשנות מהירים במודלים ובתשתיות מחשוב עלולים לשחוק יתרונות מוצר קיימים מהר מבעבר.",
                "Rapid cycles in AI models and compute architectures could erode existing product advantages faster than historical norms.",
            ),
        }]

    def trends(self, ctx):
        return [
            {"key": "cloud",          "label": ctx.txt("מחשוב ענן", "Cloud Computing"),  "relevance": "High"},
            {"key": "semiconductors", "label": ctx.txt("שבבים", "Semiconductors"),       "relevance": "High"},
            {"key": "cybersecurity",  "label": ctx.txt("סייבר", "Cybersecurity"),        "relevance": "Medium"},
        ]


class CompetitionAnalyst(PlaceholderAnalyst):
    key = "competition"
    label_he, label_en = "אנליסט תחרות", "Competition Analyst"
    offset = -5

    def reasoning(self, ctx, score):
        return ctx.txt(
            "שחקנים מבוססים וסטארטאפים ממומנים ממשיכים להיכנס לשוק הליבה ולוחצים על כוח התמחור.",
            "Well-capitalised incumbents and funded challengers keep entering the core market, pressuring pricing power.",
        )

    def risks(self, ctx, score):
        return [{
            "key": "competition", "label": ctx.txt("תחרות", "Competition"),
            "severity": "High" if score < 65 else "Medium",
            "summary": ctx.txt(
                "התגברות התחרות עלולה לדחוס מרווחים ולשחוק נתח שוק לאורך זמן.",
                "Intensifying competition may compress margins and erode market share over time.",
            ),
        }]


class ConsumerBehaviourAnalyst(PlaceholderAnalyst):
    key = "consumer_behaviour"
    label_he, label_en = "אנליסט התנהגות צרכנים", "Consumer Behaviour Analyst"
    offset = 0

    def reasoning(self, ctx, score):
        return ctx.txt(
            "שינויים דוריים בהרגלי צריכה מחייבים התאמת מוצר מתמשכת לקהלים צעירים.",
            "Generational shifts in consumption habits require ongoing product adaptation for younger cohorts.",
        )

    def risks(self, ctx, score):
        return [{
            "key": "consumer_behaviour", "label": ctx.txt("התנהגות צרכנים", "Consumer Behaviour"),
            "severity": "Low",
            "summary": ctx.txt(
                "העדפות פלטפורמה משתנות דורשות אבולוציית מוצר כדי לשמור על רלוונטיות.",
                "Shifting platform preferences require product evolution to maintain relevance.",
            ),
        }]

    def trends(self, ctx):
        return [{"key": "payments", "label": ctx.txt("תשלומים דיגיטליים", "Digital Payments"), "relevance": "Medium"}]


class RegulationAnalyst(PlaceholderAnalyst):
    key = "regulation"
    label_he, label_en = "אנליסט רגולציה", "Regulation Analyst"
    offset = -3

    def reasoning(self, ctx, score):
        return ctx.txt(
            "פיקוח רגולטורי גובר — בפרט בפרטיות מידע, אחריות AI והגבלים עסקיים — עלול לייקר ציות ולהגביל התרחבות.",
            "Growing regulatory scrutiny — notably data privacy, AI liability and antitrust — may raise compliance costs and limit expansion.",
        )

    def risks(self, ctx, score):
        heavy = ctx.sector.lower() in ("technology", "financial services", "healthcare")
        return [{
            "key": "regulation", "label": ctx.txt("רגולציה", "Regulation"),
            "severity": "Medium" if heavy else "Low",
            "summary": self.reasoning(ctx, score),
        }]


class InnovationAnalyst(PlaceholderAnalyst):
    key = "innovation"
    label_he, label_en = "אנליסט חדשנות", "Innovation Analyst"
    offset = 5

    def reasoning(self, ctx, score):
        return ctx.txt(
            "השקעה עקבית במו\"פ מעל חציון הענף מעידה על מחויבות לפיתוח דור המוצרים הבא.",
            "R&D investment above the industry median signals sustained commitment to next-generation product development.",
        )

    def opportunities(self, ctx, score):
        return [{
            "key": "innovation", "label": ctx.txt("חדשנות", "Innovation"),
            "score": _clamp(score + 2),
            "summary": self.reasoning(ctx, score),
        }]


class ManagementAnalyst(PlaceholderAnalyst):
    key = "management"
    label_he, label_en = "אנליסט הנהלה", "Management Analyst"
    offset = -2

    def reasoning(self, ctx, score):
        return ctx.txt(
            "ההנהלה הפגינה נכונות להתאים את המודל העסקי ולהיכנס לשווקים משיקים כשצמיחת הליבה מאטה.",
            "Leadership has shown willingness to adapt the business model and enter adjacent markets when core growth slows.",
        )

    def opportunities(self, ctx, score):
        return [{
            "key": "management_adaptability", "label": ctx.txt("גמישות ניהולית", "Management Adaptability"),
            "score": _clamp(score),
            "summary": self.reasoning(ctx, score),
        }]


class MacroAnalyst(PlaceholderAnalyst):
    key = "macro"
    label_he, label_en = "אנליסט מאקרו", "Macro Analyst"
    offset = 0

    def reasoning(self, ctx, score):
        return ctx.txt(
            "מגמות מאקרו — דיגיטציה, אוטומציה והתרחבות מעמד הביניים העולמי — תומכות מבנית בביקוש ארוך הטווח.",
            "Macro trends — digitalisation, automation and global middle-class expansion — structurally support long-term demand.",
        )

    def opportunities(self, ctx, score):
        return [{
            "key": "long_term_demand", "label": ctx.txt("ביקוש ארוך טווח", "Long-Term Demand"),
            "score": score,
            "summary": self.reasoning(ctx, score),
        }]

    def trends(self, ctx):
        return [
            {"key": "automation", "label": ctx.txt("אוטומציה", "Automation"),           "relevance": "High"},
            {"key": "energy",     "label": ctx.txt("מעבר אנרגטי", "Energy Transition"), "relevance": "Medium"},
            {"key": "aging",      "label": ctx.txt("הזדקנות אוכלוסייה", "Population Aging"), "relevance": "Low"},
        ]


class GeopoliticalAnalyst(PlaceholderAnalyst):
    key = "geopolitical"
    label_he, label_en = "אנליסט גיאופוליטי", "Geopolitical Analyst"
    offset = -1

    def reasoning(self, ctx, score):
        return ctx.txt(
            "חשיפת שרשרת אספקה וריכוז הכנסות באזורים רגישים גיאופוליטית מוסיפים תנודתיות לרווחים.",
            "Supply-chain exposure and revenue concentration in geopolitically sensitive regions add earnings volatility.",
        )

    def risks(self, ctx, score):
        return [{
            "key": "geopolitical_risk", "label": ctx.txt("סיכון גיאופוליטי", "Geopolitical Risk"),
            "severity": "Low" if ctx.country == "United States" else "Medium",
            "summary": self.reasoning(ctx, score),
        }]


class CompetitiveMoatAnalyst(PlaceholderAnalyst):
    key = "competitive_moat"
    label_he, label_en = "אנליסט חפיר תחרותי", "Competitive Moat Analyst"
    offset = 2

    def reasoning(self, ctx, score):
        return ctx.txt(
            f"{ctx.name} מחזיקה יתרונות ברי-הגנה: עלויות מעבר, אפקטי רשת ונכסי דאטה קנייניים שנצברו לאורך זמן.",
            f"{ctx.name} holds defensible advantages: switching costs, network effects and proprietary data assets accumulated over time.",
        )

    def opportunities(self, ctx, score):
        return [{
            "key": "competitive_moat", "label": ctx.txt("חפיר תחרותי", "Competitive Moat"),
            "score": _clamp(score - 3),
            "summary": self.reasoning(ctx, score),
        }]

    def trends(self, ctx):
        return [{"key": "healthcare", "label": ctx.txt("חדשנות רפואית", "Healthcare Innovation"), "relevance": "Medium"}]


ALL_PLACEHOLDER_ANALYSTS = [
    AIAdoptionAnalyst,
    IndustryAnalyst,
    TechnologyAnalyst,
    CompetitionAnalyst,
    ConsumerBehaviourAnalyst,
    RegulationAnalyst,
    InnovationAnalyst,
    ManagementAnalyst,
    MacroAnalyst,
    GeopoliticalAnalyst,
    CompetitiveMoatAnalyst,
]
