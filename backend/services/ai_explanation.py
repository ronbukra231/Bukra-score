import os
import json
import time

# ── Cache (24-hour TTL) ───────────────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 86400


def _cached(symbol: str):
    entry = _cache.get(symbol)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL:
        return entry["data"]
    return None


def _store(symbol: str, data: dict) -> dict:
    _cache[symbol] = {"ts": time.time(), "data": data}
    return data


# ── Sector / industry lookup tables ──────────────────────────────────────────

_SECTOR_HE = {
    "Technology": "טכנולוגיה",
    "Financial Services": "שירותים פיננסיים",
    "Healthcare": "בריאות",
    "Consumer Cyclical": "צריכה מחזורית",
    "Consumer Defensive": "צריכה בסיסית",
    "Energy": "אנרגיה",
    "Industrials": "תעשייה",
    "Communication Services": "שירותי תקשורת",
    "Real Estate": "נדל\"ן",
    "Utilities": "שירותים ציבוריים",
    "Basic Materials": "חומרי גלם",
}

_REVENUE_STREAMS = {
    "Technology": ["מכירת תוכנה ורישיונות", "שירותי ענן ומנויים", "מכירת חומרה ומוצרי צריכה", "שירותי פיתוח ותמיכה"],
    "Financial Services": ["עמלות על עסקאות ותשלומים", "הכנסות מריבית ואשראי", "ניהול נכסים ודמי ניהול", "שירותים בנקאיים ופיננסיים"],
    "Healthcare": ["מכירת תרופות ומוצרי בריאות", "שירותי רפואה ואשפוז", "ציוד ומכשור רפואי", "מחקר ופיתוח תרופות חדשות"],
    "Consumer Cyclical": ["מכירת מוצרים לצרכן הפרטי", "שירותי לקוחות ואחריות", "מסחר מקוון ואמזון-סטייל", "שירותי מנויים ופרמיום"],
    "Consumer Defensive": ["מכירת מוצרי מזון ומשקאות", "מוצרי בית וטיפוח", "הפצה קמעונאית בסופרים", "מותגים עצמיים"],
    "Energy": ["כריית ומכירת נפט וגז טבעי", "זיקוק ומוצרי דלק לצרכן", "תשתיות אנרגיה וצינורות", "פתרונות אנרגיה מתחדשת"],
    "Industrials": ["מכירת ציוד ומכונות תעשייתיות", "שירותי תחזוקה ותפעול", "פרויקטי הנדסה ובנייה", "לוגיסטיקה ושינוע"],
    "Communication Services": ["שירותי סלולר ואינטרנט", "פרסום דיגיטלי ומדיה", "תוכן, בידור ומנויים", "ענן ותקשורת לעסקים"],
    "Real Estate": ["דמי שכירות מנכסים מסחריים ומגורים", "מכירת נכסים ופיתוח", "ניהול נכסים ותחזוקה", "קרנות ריט ומינוף נדל\"ן"],
    "Utilities": ["מכירת חשמל לצרכני בית ותעשייה", "שירותי גז ומים", "תשתיות אנרגיה מתחדשת", "שירותי חלוקה ותחזוקה"],
    "Basic Materials": ["מכירת מינרלים ומתכות", "עיבוד חומרי גלם ופולימרים", "כרייה ומחצבים", "כימיקלים ופתרונות חומרים"],
}

_SECTOR_RISK = {
    "Technology": "תחום הטכנולוגיה תחרותי מאוד — חברות חדשות ומהפכות טכנולוגיות עלולות לאיים על המעמד הקיים",
    "Financial Services": "שינויים בריביות, רגולציה מחמירה, ומשברי אשראי עלולים להשפיע משמעותית על הרווחיות",
    "Healthcare": "אישורים רגולטוריים ממושכים, תחרות מגנריקים ולחץ על מחירי תרופות הם סיכונים מרכזיים",
    "Consumer Cyclical": "הביקוש תלוי במצב הכלכלה — בשפל כלכלי, צרכנים מקצצים ברכישות שאינן הכרחיות",
    "Consumer Defensive": "שולי רווח נמוכים ותחרות חריפה על מדף הסופרמרקט עלולים ללחוץ על הרווחיות",
    "Energy": "מחירי הנפט והגז תנודתיים מאוד ותלויים בגורמים גיאופוליטיים, OPEC ובמעבר לאנרגיות ירוקות",
    "Industrials": "מחזורי ביקוש תעשייתי, עליית מחירי חומרי גלם ושיבושים בשרשרת האספקה הם סיכונים שכיחים",
    "Communication Services": "תחרות עזה בין ספקיות ורגולציה ממשלתית עלולים ללחוץ על מחירים ושולי רווח",
    "Real Estate": "עלייה בריביות מייקרת מימון ועלולה להוריד את שוויי הנכסים ולפגוע בהכנסות",
    "Utilities": "רגולציה ממשלתית על תעריפים, סיכוני מזג אוויר ועלויות תשתית גבוהות הם סיכונים מרכזיים",
    "Basic Materials": "מחירי חומרי גלם תנודתיים, ביקוש מחזורי ותחרות עולמית עלולים לפגוע בשולי הרווח",
}

_ELI5_INDUSTRY = {
    "Semiconductors": "דמיין שיש לך מפעל שמייצר את המוח של כל המחשבים בעולם. {name} מייצרת שבבים — בלעדיהם לא יעבדו גיימינג, בינה מלאכותית ורכבים אוטונומיים. כשכולם רוצים AI, כולם צריכים את השבבים של {name}.",
    "Software—Infrastructure": "דמיין שיש לך תוכנה שכל עסק בעולם צריך כדי לעבוד. {name} מספקת את התוכנה הזאת ומרוויחה מדמי מנוי חודשי מאלפי חברות ברחבי העולם.",
    "Consumer Electronics": "דמיין שמיליארד אנשים משתמשים במוצר שאתה מייצר כל יום. {name} מייצרת טלפונים ומחשבים שאנשים מוכנים לשלם עליהם יותר מאשר על כל מוצר אחר — וממשיכים לחזור לקנות.",
    "Credit Services": "דמיין שאתה גובה עמלה קטנה מכל תשלום שנעשה בעולם — בסופר, באינטרנט, בחו\"ל. {name} עושה בדיוק את זה. בכל פעם שאתה משלם בכרטיס, החברה מרוויחה — בלי לקחת שום סיכון אשראי.",
    "Internet Retail": "דמיין שיש לך חנות שמוכרת כל דבר לכולם, 24 שעות ביממה. {name} היא החנות הזאת — ומרוויחה גם מהמכירות, גם מאחסון מוצרים עבור עסקים אחרים, וגם מענן.",
    "Internet Content & Information": "דמיין שיש לך את לוח המודעות הגדול בעולם, שכולם מסתכלים עליו כל יום. {name} מאפשרת לחברות לפרסם שם — וכל קליק שווה כסף.",
    "Oil & Gas E&P": "דמיין שיש לך באר נפט ענקית. {name} מחפשת, מוציאה ומוכרת נפט וגז — וכשמחירי הנפט עולים, החברה מרוויחה הרבה יותר.",
    "Drug Manufacturers—General": "דמיין שהמצאת תרופה שמיליוני חולים צריכים כל יום. {name} עושה בדיוק את זה — משקיעה מיליארדים במחקר, ואז מוכרת את התרופות לבתי חולים ורופאים בכל העולם.",
}

_ELI5_SECTOR = {
    "Technology": "דמיין שיש לך כלי שכולם בעולם צריכים כדי לעבוד. {name} מספקת את הכלים האלה לעסקים ואנשים, ומרוויחה בכל פעם שמישהו משתמש בהם.",
    "Financial Services": "דמיין שאתה הבנק של כולם — גובה עמלה קטנה על כל עסקה. {name} עושה בדיוק את זה, ומרוויחה מכל תשלום ועסקה שעוברת דרכה.",
    "Healthcare": "דמיין שאתה ממציא תרופות ופתרונות שעוזרים לאנשים להיות בריאים. {name} מוציאה הרבה כסף על מחקר ואז מוכרת את הפתרונות לבתי חולים ורופאים.",
    "Consumer Cyclical": "דמיין שיש לך חנות גדולה שכולם אוהבים לבקר בה. {name} מנהלת חנויות וסניפים ברחבי העולם ומרוויחה כשאנשים קונים את המוצרים שלה.",
    "Consumer Defensive": "דמיין שאתה מוכר דברים שאנשים צריכים כל יום — כמו אוכל, שתייה וסבון. {name} עושה בדיוק את זה, ולכן אנשים ממשיכים לקנות גם כשהכלכלה לא טובה.",
    "Energy": "דמיין שיש לך באר נפט ענקית. {name} מוציאה את הנפט, מזקקת אותו לדלק, ומוכרת אותו לכולם — לרכבים, למפעלים ולתחנות כוח.",
    "Industrials": "דמיין שאתה מייצר את הכלים שמפעלים ובניינים לא יכולים לעבוד בלעדיהם. {name} עושה בדיוק את זה — מוכרת ציוד ומספקת שירותים לתעשיות ברחבי העולם.",
    "Communication Services": "דמיין שיש לך ספריית סרטים ענקית שכולם רוצים לצפות בה, ואתה גובה דמי מנוי. {name} עושה משהו דומה — שירותי תקשורת ותוכן שמגיעים לבתים של מיליוני אנשים.",
    "Real Estate": "דמיין שיש לך הרבה בניינים ואנשים משלמים לך שכר דירה כל חודש. {name} עושה בדיוק את זה — מחזיקה ומנהלת נכסים ומרוויחה מהשכרתם.",
    "Energy": "דמיין שיש לך באר נפט ענקית. {name} מוציאה את הנפט, מזקקת אותו לדלק, ומוכרת אותו לכולם.",
}


def _generate_fallback_he(company_info: dict, financials: dict, bukra_score: dict) -> dict:
    """Generate a structured Hebrew explanation from structured data — no AI needed."""
    name     = company_info.get("name", "החברה")
    sector   = company_info.get("sector", "")
    industry = company_info.get("industry", "")
    employees = company_info.get("employees")
    history  = financials.get("history", [])
    score    = bukra_score.get("score")

    sector_he = _SECTOR_HE.get(sector, sector)

    # ── 1. מה החברה עושה ─────────────────────────────────────────────────────
    emp_str = f" ומעסיקה כ-{employees:,} עובדים" if employees else ""
    what_does = f"{name} היא חברה ציבורית בתחום {sector_he}{emp_str}."
    if industry and industry != sector:
        what_does += f" החברה פועלת בתחום {industry}."
    if sector_he:
        what_does += f" כחברה בתחום {sector_he}, {name} מספקת מוצרים ושירותים ללקוחות עסקיים ופרטיים."

    # ── 2. איך מרוויחה כסף ───────────────────────────────────────────────────
    streams = _REVENUE_STREAMS.get(sector, [
        "מכירת מוצרים ושירותים ייחודיים",
        "הכנסות ממנויים ורישיונות",
        "שירותים מקצועיים לעסקים",
    ])
    revenue_streams = "\n".join(f"• {s}" for s in streams[:4])

    # ── 3. למה משקיעים אוהבים ────────────────────────────────────────────────
    positives = []
    sorted_h = sorted(history, key=lambda x: x["year"]) if history else []

    if len(sorted_h) >= 2:
        revs = [h["revenue"] for h in sorted_h if h.get("revenue")]
        if len(revs) >= 2 and revs[-1] > revs[0]:
            years = len(revs) - 1
            cagr = ((revs[-1] / revs[0]) ** (1 / years) - 1) * 100 if years > 0 else 0
            positives.append(
                f"הכנסות החברה צמחו בממוצע של כ-{cagr:.0f}% בשנה בשנים האחרונות, מה שמעיד על ביקוש הולך וגדל למוצריה"
            )

    if sorted_h:
        latest = sorted_h[-1]
        margin = latest.get("net_margin")
        if margin and margin > 15:
            positives.append(
                f"שולי הרווח הנקי עומדים על {margin:.1f}%, מה שמעיד על יכולת תמחור חזקה ויעילות תפעולית גבוהה"
            )

        fcfs = [h.get("free_cash_flow") for h in sorted_h if h.get("free_cash_flow") is not None]
        if fcfs and all(f > 0 for f in fcfs):
            positives.append(
                "החברה מייצרת תזרים מזומנים חיובי עקבי, מה שמאפשר לה לממן צמיחה, לשלם דיבידנדים ולרכוש מניות בחזרה"
            )

    if score and score >= 70:
        positives.append(f"ציון הבוקרה של {score}/100 מצביע על בריאות פיננסית טובה ביחס לשוק הרחב")

    if not positives:
        positives.append(
            f"{name} פועלת בשוק מבוסס עם מוצרים ושירותים שיש להם ביקוש עקבי"
        )

    why_attractive = ". ".join(positives[:3]) + "."

    # ── 4. סיכונים ───────────────────────────────────────────────────────────
    risks_list = []

    if sorted_h:
        latest = sorted_h[-1]
        debt   = latest.get("total_debt")
        cash   = latest.get("cash")
        equity = latest.get("stockholders_equity")
        if debt and equity and equity > 0 and debt / equity > 1.5:
            risks_list.append(
                f"החברה נושאת רמת חוב גבוהה ביחס להונה העצמי (יחס {debt/equity:.1f}), דבר שמוסיף סיכון פיננסי במקרה של עלייה בריביות"
            )
        elif debt and cash and debt > cash * 3:
            risks_list.append(
                "עומס החוב גבוה ביחס לרמת המזומנים של החברה, מה שמגביל את הגמישות הפיננסית שלה"
            )

        margins = [h["net_margin"] for h in sorted_h if h.get("net_margin") is not None]
        if len(margins) >= 3:
            variance = max(margins) - min(margins)
            if variance > 12:
                risks_list.append(
                    f"שולי הרווח הנקי נעו בין {min(margins):.1f}% ל-{max(margins):.1f}% לאורך השנים — תנודתיות שמעידה על רגישות לתנאי השוק"
                )

    sector_risk = _SECTOR_RISK.get(sector, "שינויים כלכליים, רגולטוריים ותחרות עולמית עלולים להשפיע על ביצועי החברה")
    risks_list.append(sector_risk)

    risks = ". ".join(risks_list[:2]) + "."

    # ── 5. ELI5 ──────────────────────────────────────────────────────────────
    eli5_template = _ELI5_INDUSTRY.get(industry) or _ELI5_SECTOR.get(sector,
        "דמיין שיש לך עסק שמספק שירות שהרבה אנשים צריכים. {name} עושה בדיוק את זה בתחום {sector_he}, ומרוויחה כסף מכל לקוח שמשתמש בשירותים שלה."
    )
    eli5 = eli5_template.replace("{name}", name).replace("{sector_he}", sector_he)

    return {
        "what_does": what_does,
        "revenue_streams": revenue_streams,
        "why_attractive": why_attractive,
        "risks": risks,
        "eli5": eli5,
        "no_api_key": True,
        "is_fallback": True,
    }


# ── Main function ─────────────────────────────────────────────────────────────

def get_hebrew_explanation(company_info: dict, financials: dict, bukra_score: dict) -> dict:
    sym = company_info.get("symbol", "UNKNOWN")

    cached = _cached(sym)
    if cached:
        return cached

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key or api_key == "your_anthropic_api_key_here":
        return _store(sym, _generate_fallback_he(company_info, financials, bukra_score))

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        name        = company_info.get("name", "החברה")
        sector      = company_info.get("sector", "")
        industry    = company_info.get("industry", "")
        description = (company_info.get("description") or "")[:600]
        score       = bukra_score.get("score")
        history     = financials.get("history", [])

        fin_summary = ""
        if history:
            latest = history[0]
            rev    = latest.get("revenue")
            ni     = latest.get("net_income")
            fcf    = latest.get("free_cash_flow")
            margin = latest.get("net_margin")
            if rev:    fin_summary += f"הכנסות: ${rev/1e9:.1f}B. "
            if ni:     fin_summary += f"רווח נקי: ${ni/1e9:.1f}B. "
            if margin: fin_summary += f"שולי רווח: {margin:.1f}%. "
            if fcf:    fin_summary += f"תזרים חופשי: ${fcf/1e9:.1f}B."

        prompt = f"""אתה יועץ השקעות שמסביר חברות ציבוריות בעברית פשוטה למשקיעים פרטיים ישראלים שאינם מומחים בפיננסים.

שם החברה: {name}
תחום: {sector} / {industry}
תיאור: {description}
נתונים פיננסיים אחרונים: {fin_summary}
ציון בוקרה: {score}/100

כתוב תשובה בפורמט JSON מדויק עם 5 שדות:

{{
  "what_does": "2-3 משפטים בעברית פשוטה המסבירים מה החברה עושה. הימנע מז'רגון. התמקד במוצר/שירות הליבה.",
  "revenue_streams": "3-4 שורות קצרות (bullets) המסבירות איך החברה מרוויחה כסף. כל שורה מתחילה ב-•",
  "why_attractive": "2-3 משפטים בעברית המסבירים למה משקיעים לטווח ארוך מוצאים את החברה מעניינת.",
  "risks": "2-3 משפטים בעברית המסבירים את הסיכונים העיקריים. היה כנה וספציפי.",
  "eli5": "משפט אחד או שניים המסבירים את החברה כאילו מדברים עם ילד בן 12. השתמש בדוגמאות יומיומיות."
}}

כתוב בעברית בלבד. שפה פשוטה וישירה. אל תכתוב כותרות."""

        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        text = message.content[0].text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        result = json.loads(text)
        result["no_api_key"] = False
        result["is_fallback"] = False
        return _store(sym, result)

    except json.JSONDecodeError:
        result = {
            "what_does": text, "revenue_streams": None, "why_attractive": None,
            "risks": None, "eli5": None, "no_api_key": False, "is_fallback": False,
        }
        return _store(sym, result)
    except Exception as e:
        print(f"[ai_explanation] Error for {sym}: {e}")
        return _generate_fallback_he(company_info, financials, bukra_score)
