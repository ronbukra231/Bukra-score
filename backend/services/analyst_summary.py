"""
"מה המדד זיהה?" — Index-voice analysis grounded entirely in computed score data.

Architecture:
  1. Deterministic path runs first, always: produces full output instantly from
     the score breakdown. No network. No AI. Cannot fail.
  2. If ANTHROPIC_API_KEY is present, the AI path enriches the narrative (Section 1)
     with a tighter, more natural Hebrew/English summary — still grounded in the
     same numbers. Section 2 (contributors) and Section 3 (confidence) are always
     deterministic.
  3. Never raises. Never exposes API keys, model names, or error traces to the
     frontend.
  4. 24-hour in-process cache per symbol.

Voice contract:
  - Speaker is always "המדד" (the index), never "AI", "Bukra", "I", or any person.
  - No investment advice, no buy/sell/hold, no hallucinated data.
"""

import os
import time
import json

# ── Cache ─────────────────────────────────────────────────────────────────────
_cache: dict = {}
_CACHE_TTL = 86_400


def _cached(symbol: str):
    entry = _cache.get(symbol)
    if entry and (time.time() - entry["ts"]) < _CACHE_TTL:
        return entry["data"]
    return None


def _store(symbol: str, data: dict) -> dict:
    _cache[symbol] = {"ts": time.time(), "data": data}
    return data


# ── Category metadata ─────────────────────────────────────────────────────────
_CAT_HE = {
    "growth":        "צמיחה עקבית",
    "profitability": "רווחיות",
    "cash_flow":     "תזרים מזומנים",
    "stability":     "יציבות פיננסית",
    "debt":          "בריאות חוב",
}

_CAT_EN = {
    "growth":        "Consistent Growth",
    "profitability": "Profitability",
    "cash_flow":     "Cash Flow",
    "stability":     "Financial Stability",
    "debt":          "Debt Health",
}

_MAX = {"growth": 25, "profitability": 20, "cash_flow": 20, "stability": 20, "debt": 15}

# Reason phrases for each category in deterministic mode (Hebrew)
_REASON_HE = {
    "growth": {
        "positive": "הכנסות ורווח נקי מציגים מגמת עלייה עקבית לאורך השנים",
        "neutral":  "הצמיחה קיימת אך לא קבועה בכל שנה",
        "negative": "לא זוהתה מגמת צמיחה ברורה בהכנסות או ברווח",
    },
    "profitability": {
        "positive": "שולי הרווח גבוהים והתשואה על ההון חזקה",
        "neutral":  "הרווחיות קיימת אך נמצאת ברמה בינונית",
        "negative": "שולי הרווח נמוכים או שהחברה לא רווחית בעקביות",
    },
    "cash_flow": {
        "positive": "תזרים המזומנים החופשי חיובי ועקבי לאורך רוב השנים",
        "neutral":  "תזרים המזומנים חיובי בחלק מהשנים אך לא בכולן",
        "negative": "תזרים המזומנים החופשי שלילי ברוב השנים שנבדקו",
    },
    "stability": {
        "positive": "יחסי הנזילות ויחס הנכסים-לחוב מעידים על יציבות גבוהה",
        "neutral":  "היציבות הפיננסית נמצאת ברמה בינונית",
        "negative": "כיסוי המזומנים ויחסי הנזילות מצביעים על רמת סיכון גבוהה יחסית",
    },
    "debt": {
        "positive": "רמת החוב נמוכה ביחס להון העצמי",
        "neutral":  "רמת החוב סבירה אך דורשת מעקב",
        "negative": "יחס החוב להון גבוה ומהווה גורם ממתן לציון",
    },
}

# Reason phrases for each category (English)
_REASON_EN = {
    "growth": {
        "positive": "revenue and net income show consistent upward trends",
        "neutral":  "growth is present but inconsistent across years",
        "negative": "no clear growth trend detected in revenue or earnings",
    },
    "profitability": {
        "positive": "profit margins are strong and return on equity is healthy",
        "neutral":  "profitability exists but sits at a moderate level",
        "negative": "thin or inconsistent profit margins weigh on the score",
    },
    "cash_flow": {
        "positive": "free cash flow is positive and consistent across most years",
        "neutral":  "free cash flow is positive in some years but not all",
        "negative": "negative free cash flow in most measured years",
    },
    "stability": {
        "positive": "liquidity ratios and asset coverage indicate high stability",
        "neutral":  "financial stability is at a moderate level",
        "negative": "cash coverage and liquidity ratios point to elevated risk",
    },
    "debt": {
        "positive": "debt level is low relative to equity",
        "neutral":  "debt level is manageable but warrants monitoring",
        "negative": "high debt-to-equity ratio is a meaningful drag on the score",
    },
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _pct(key: str, val: float) -> int:
    return round(val / _MAX.get(key, 25) * 100)


def _sorted_cats(breakdown: dict) -> list[tuple[str, float]]:
    return sorted(breakdown.items(), key=lambda kv: _pct(kv[0], kv[1]), reverse=True)


def _confidence(financials: dict) -> str:
    history = financials.get("history", [])
    if len(history) < 2:
        return "LOW"
    filled = sum(
        1 for h in history
        if h.get("revenue") and h.get("net_income") is not None
        and h.get("free_cash_flow") is not None
    )
    ratio = filled / len(history)
    if ratio >= 0.75 and len(history) >= 4:
        return "HIGH"
    if ratio >= 0.5:
        return "MEDIUM"
    return "LOW"


# ── Section 2: Deterministic contributor lists ────────────────────────────────

def _build_contributors(breakdown: dict, lang: str) -> dict:
    """
    Split categories into positive (≥65%) and negative (<50%) contributors.
    The 50–65% band is omitted (they balance each other out).
    Returns {"positive": [...], "negative": [...]}.
    """
    reasons = _REASON_HE if lang == "he" else _REASON_EN
    labels  = _CAT_HE    if lang == "he" else _CAT_EN

    positive = []
    negative = []

    for key, val in _sorted_cats(breakdown):
        p = _pct(key, val)
        label  = labels.get(key, key)
        reason = reasons.get(key, {})
        score_str = f"{val}/{_MAX.get(key, 25)}"

        if p >= 65:
            phrase = reason.get("positive", "")
            if lang == "he":
                positive.append(f"{label} ({score_str}) — {phrase}")
            else:
                positive.append(f"{label} ({score_str}) — {phrase}")
        elif p < 50:
            phrase = reason.get("negative", "")
            if lang == "he":
                negative.append(f"{label} ({score_str}) — {phrase}")
            else:
                negative.append(f"{label} ({score_str}) — {phrase}")
        else:
            # Neutral band — add only if list has room and it's worth noting
            phrase = reason.get("neutral", "")
            if len(positive) < 2 and p >= 58:
                if lang == "he":
                    positive.append(f"{label} ({score_str}) — {phrase}")
                else:
                    positive.append(f"{label} ({score_str}) — {phrase}")
            elif len(negative) < 2 and p < 58:
                if lang == "he":
                    negative.append(f"{label} ({score_str}) — {phrase}")
                else:
                    negative.append(f"{label} ({score_str}) — {phrase}")

    return {"positive": positive[:3], "negative": negative[:3]}


# ── Section 1: Deterministic narrative (Hebrew) ───────────────────────────────

def _narrative_he(name: str, score: int, breakdown: dict, confidence: str) -> str:
    cats = _sorted_cats(breakdown)
    best_key, best_val = cats[0]
    weak_key, weak_val = cats[-1]
    best_label = _CAT_HE.get(best_key, best_key)
    weak_label = _CAT_HE.get(weak_key, weak_key)
    best_p     = _pct(best_key, best_val)
    weak_p     = _pct(weak_key, weak_val)

    # Opening sentence — score range
    if score >= 80:
        opener = f"המדד זיהה תמונה פיננסית חזקה מאוד עבור {name}, עם ציון {score}/100 שמשקף איכות עסקית גבוהה לפי כלל חמשת העקרונות."
    elif score >= 65:
        opener = f"לפי שקלול הנתונים, {name} מציגה ביצועים טובים עם ציון {score}/100 — תמונה של עסק יציב שעומד ברוב עקרונות המדד."
    elif score >= 50:
        opener = f"המדד זיהה תמונה מעורבת עבור {name} עם ציון {score}/100 — ישנן נקודות חוזק ברורות לצד תחומים שמושכים את הציון כלפי מטה."
    elif score >= 35:
        opener = f"לפי שקלול הנתונים, {name} מציגה חולשות בחלק ממדדי האיכות, עם ציון {score}/100 שמצביע על פערים פיננסיים שדורשים תשומת לב."
    else:
        opener = f"המדד זיהה חולשות משמעותיות בנתונים הפיננסיים של {name}, עם ציון {score}/100 שמשקף רמת איכות נמוכה ברוב הפרמטרים."

    # Strongest signal sentence
    strength = f"אחד הגורמים המרכזיים לציון הוא {best_label}, שקיבלה {best_val}/{_MAX.get(best_key,25)} נקודות ({best_p}%) — המדד מעניק משקל חיובי לכך."

    # Weakest signal sentence
    if weak_p < 50:
        weakness = f"מנגד, המדד מזהה את {weak_label} כגורם הממתן המרכזי — הציון בתחום זה עומד על {weak_val}/{_MAX.get(weak_key,25)} נקודות ({weak_p}%) ומושך את הסך הכולל כלפי מטה."
    else:
        weakness = f"התחום שדורש המשך מעקב הוא {weak_label} עם {weak_val}/{_MAX.get(weak_key,25)} נקודות ({weak_p}%)."

    # Closing — why the score makes sense
    if score >= 65:
        close = f"בסך הכול, הציון {score}/100 משקף חברה שעומדת ברמה גבוהה בעקרונות הצמיחה והרווחיות, עם פחות חוזק בתחומים שציינו."
    elif score >= 45:
        close = f"בסך הכול, ציון {score}/100 הגיוני לאור השילוב בין תחומי החוזק לתחומים שבהם הנתונים חלשים יותר."
    else:
        close = f"ציון {score}/100 משקף את הפערים שהמדד זיהה — הנתונים הזמינים אינם מצביעים על עמידה בסטנדרטים הנדרשים ברוב עקרונות המדד."

    return " ".join([opener, strength, weakness, close])


# ── Section 1: Deterministic narrative (English) ─────────────────────────────

def _narrative_en(name: str, score: int, breakdown: dict, confidence: str) -> str:
    cats = _sorted_cats(breakdown)
    best_key, best_val = cats[0]
    weak_key, weak_val = cats[-1]
    best_label = _CAT_EN.get(best_key, best_key)
    weak_label = _CAT_EN.get(weak_key, weak_key)
    best_p     = _pct(best_key, best_val)
    weak_p     = _pct(weak_key, weak_val)

    if score >= 80:
        opener = f"The index identifies a very strong financial profile for {name}, with a score of {score}/100 reflecting high quality across most of the five principles."
    elif score >= 65:
        opener = f"Based on the available data, {name} scores {score}/100 — a solid result indicating a stable business that meets most of the index's quality criteria."
    elif score >= 50:
        opener = f"The index identifies a mixed picture for {name} at {score}/100 — clear strengths exist alongside dimensions that pull the score downward."
    elif score >= 35:
        opener = f"The data weighted by the index points to financial gaps for {name} at {score}/100, with weaknesses across several quality dimensions."
    else:
        opener = f"The index identifies significant weaknesses in {name}'s financials, with a score of {score}/100 reflecting below-standard performance across most criteria."

    strength = f"The primary positive contributor is {best_label}, scoring {best_val}/{_MAX.get(best_key,25)} points ({best_p}%) — a dimension the index weights favorably."

    if weak_p < 50:
        weakness = f"The main drag on the score is {weak_label} at {weak_val}/{_MAX.get(weak_key,25)} points ({weak_p}%), which pulls the total meaningfully lower."
    else:
        weakness = f"The dimension requiring the most attention is {weak_label} with {weak_val}/{_MAX.get(weak_key,25)} points ({weak_p}%)."

    if score >= 65:
        close = f"Overall, a score of {score}/100 is consistent with a company that performs well on growth and profitability criteria while showing some weakness in the areas noted above."
    elif score >= 45:
        close = f"A score of {score}/100 is consistent with the balance between strong and weaker dimensions identified in the data."
    else:
        close = f"A score of {score}/100 reflects the gaps the index identified — the available data does not indicate compliance with the quality standards of most principles."

    return " ".join([opener, strength, weakness, close])


# ── AI-enhanced narrative (Section 1 only) ───────────────────────────────────

def _ai_narrative(name: str, ticker: str, score: int, breakdown: dict,
                  confidence: str, financials: dict) -> tuple[str, str]:
    """
    Returns (summary_he, summary_en). Raises on any failure so caller falls back.
    The AI writes ONLY Section 1 prose. Contributors and confidence are always
    computed deterministically.
    """
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key or api_key == "your_anthropic_api_key_here":
        raise ValueError("no key")

    history = financials.get("history", [])
    latest  = sorted(history, key=lambda h: h.get("year", ""))[-1] if history else {}

    payload = {
        "ticker":         ticker,
        "score":          score,
        "confidence":     confidence,
        "categories":     {k: {"score": v, "max": _MAX.get(k, 25), "pct": _pct(k, v)} for k, v in breakdown.items()},
        "latest_year":    latest.get("year"),
        "revenue_m":      round(latest["revenue"] / 1e6) if latest.get("revenue") else None,
        "net_income_m":   round(latest["net_income"] / 1e6) if latest.get("net_income") else None,
        "net_margin_pct": round(latest["net_margin"], 1) if latest.get("net_margin") else None,
        "fcf_m":          round(latest["free_cash_flow"] / 1e6) if latest.get("free_cash_flow") else None,
        "total_debt_m":   round(latest["total_debt"] / 1e6) if latest.get("total_debt") else None,
        "equity_m":       round(latest["stockholders_equity"] / 1e6) if latest.get("stockholders_equity") else None,
    }

    he_prompt = f"""אתה מנוע אינדקס פיננסי שמתאר ממצאים באופן אובייקטיבי.

הנתונים שחושבו (אל תמציא שום מספר שאינו מופיע כאן):
{json.dumps(payload, ensure_ascii=False, indent=2)}

כתוב 4–5 משפטים בעברית. כללים נוקשים:

1. הדובר הוא "המדד" — לא "אני", לא "בוקרה", לא "AI".
2. השתמש בביטויים כגון: "המדד זיהה כי...", "לפי שקלול הנתונים...", "אחד הגורמים המרכזיים לציון...", "המדד מעניק משקל חיובי ל...", "מנגד, המדד מזהה...", "בסך הכול, הציון משקף...".
3. הסתמך אך ורק על הנתונים שסופקו.
4. אזכיר את הציון הכולל, הגורם החיובי המרכזי, הגורם השלילי המרכזי, ולמה הציון הגיוני.
5. אל תמליץ לקנות, למכור, להחזיק, לבצע פעולה כלשהי.
6. אל תציין מידע שאינו בנתונים (שמות מנהלים, פרויקטים, תחזיות עתידיות).
7. עברית מקצועית, פשוטה, ישירה. ללא ז'רגון מיותר.

פלט: הטקסט בלבד, ללא כותרת."""

    en_prompt = f"""You are a financial index engine describing findings objectively.

Computed data (do not invent any number not present here):
{json.dumps(payload, ensure_ascii=False, indent=2)}

Write 4–5 sentences in clear English. Strict rules:

1. The speaker is "the index" — never "I", never "we", never an AI or person.
2. Use phrases like: "The index identifies...", "Based on the weighted data...", "A primary driver of the score is...", "The index assigns positive weight to...", "On the other hand, the index flags...", "Overall, the score reflects...".
3. Rely ONLY on the data provided.
4. Cover: overall score, primary positive driver, primary negative driver, why the score makes sense.
5. Never say buy, sell, hold, or recommend any action.
6. Do not mention anything not in the data (executives, future projects, forecasts).
7. Professional, plain, direct English. No unnecessary jargon.

Output: text only, no heading."""

    client = anthropic.Anthropic(api_key=api_key)

    he_resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        messages=[{"role": "user", "content": he_prompt}]
    )
    en_resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        messages=[{"role": "user", "content": en_prompt}]
    )

    return he_resp.content[0].text.strip(), en_resp.content[0].text.strip()


# ── Public entry point ────────────────────────────────────────────────────────

def generate_smart_analyst_summary(
    company_info: dict,
    score_data: dict,
    financials: dict,
    rules_data: dict,
) -> dict:
    """
    Returns:
      summary_he      — Section 1 narrative (Hebrew)
      summary_en      — Section 1 narrative (English)
      contributors_he — Section 2: {positive: [...], negative: [...]} in Hebrew
      contributors_en — Section 2: {positive: [...], negative: [...]} in English
      confidence      — "HIGH" | "MEDIUM" | "LOW"
      is_fallback     — True when narrative is deterministic (AI unavailable)

    Never raises. Never exposes API/model internals.
    """
    sym = company_info.get("symbol", "UNKNOWN")

    cached = _cached(sym)
    if cached:
        return cached

    name      = company_info.get("name", sym)
    score     = score_data.get("score")
    breakdown = score_data.get("breakdown", {})

    if score is None or not breakdown:
        return {
            "summary_he":       "המדד לא זיהה נתונים פיננסיים מספיקים לניתוח.",
            "summary_en":       "The index did not find sufficient financial data for analysis.",
            "contributors_he":  {"positive": [], "negative": []},
            "contributors_en":  {"positive": [], "negative": []},
            "confidence":       "LOW",
            "is_fallback":      True,
        }

    confidence     = _confidence(financials)
    contributors_he = _build_contributors(breakdown, "he")
    contributors_en = _build_contributors(breakdown, "en")

    # Section 1 — try AI, fall back silently
    is_fallback = True
    summary_he  = _narrative_he(name, score, breakdown, confidence)
    summary_en  = _narrative_en(name, score, breakdown, confidence)

    try:
        summary_he, summary_en = _ai_narrative(name, sym, score, breakdown, confidence, financials)
        is_fallback = False
    except Exception:
        pass

    result = {
        "summary_he":      summary_he,
        "summary_en":      summary_en,
        "contributors_he": contributors_he,
        "contributors_en": contributors_en,
        "confidence":      confidence,
        "is_fallback":     is_fallback,
    }
    return _store(sym, result)
