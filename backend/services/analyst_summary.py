"""
Smart Analyst Summary — grounded, deterministic-first, AI-enhanced when available.

Architecture:
  1. Always attempt deterministic fallback first (instant, no network).
  2. If ANTHROPIC_API_KEY is present, call Claude with a tightly-constrained prompt
     that grounds every sentence in the numbers already computed.
  3. Never block the /page endpoint — called in the same thread but protected by try/except.
  4. 24-hour cache per symbol (same TTL as the rest of /page).
"""

import os
import time
import json

# ── Cache ─────────────────────────────────────────────────────────────────────
_cache: dict = {}
_CACHE_TTL = 86_400  # 24 h


def _cached(symbol: str):
    entry = _cache.get(symbol)
    if entry and (time.time() - entry["ts"]) < _CACHE_TTL:
        return entry["data"]
    return None


def _store(symbol: str, data: dict) -> dict:
    _cache[symbol] = {"ts": time.time(), "data": data}
    return data


# ── Category label maps ───────────────────────────────────────────────────────
_CAT_LABEL_HE = {
    "growth":        "צמיחה עקבית",
    "profitability": "רווחיות",
    "cash_flow":     "תזרים מזומנים",
    "stability":     "יציבות פיננסית",
    "debt":          "בריאות חוב",
}

_CAT_LABEL_EN = {
    "growth":        "Consistent Growth",
    "profitability": "Profitability",
    "cash_flow":     "Cash Flow",
    "stability":     "Financial Stability",
    "debt":          "Debt Health",
}

_MAX_SCORES = {"growth": 25, "profitability": 20, "cash_flow": 20, "stability": 20, "debt": 15}


# ── Confidence calculation ────────────────────────────────────────────────────

def _confidence(score_data: dict, financials: dict) -> str:
    history = financials.get("history", [])
    if len(history) >= 4:
        filled = sum(
            1 for h in history
            if h.get("revenue") and h.get("net_income") is not None and h.get("free_cash_flow") is not None
        )
        ratio = filled / len(history)
        if ratio >= 0.75:
            return "HIGH"
        if ratio >= 0.5:
            return "MEDIUM"
    return "LOW"


# ── Deterministic fallback summary ───────────────────────────────────────────

def _sorted_categories(breakdown: dict) -> list[tuple[str, float]]:
    """Return categories sorted by score percentage (best → worst)."""
    def pct(key, val):
        return val / _MAX_SCORES.get(key, 25)
    return sorted(breakdown.items(), key=lambda kv: pct(*kv), reverse=True)


def _deterministic_summary_he(name: str, score: int, breakdown: dict,
                               confidence: str, financials: dict) -> dict:
    sorted_cats = _sorted_categories(breakdown)
    best_key, best_val = sorted_cats[0]
    weak_key, weak_val = sorted_cats[-1]

    best_label  = _CAT_LABEL_HE.get(best_key, best_key)
    weak_label  = _CAT_LABEL_HE.get(weak_key, weak_key)
    best_max    = _MAX_SCORES.get(best_key, 25)
    weak_max    = _MAX_SCORES.get(weak_key, 25)
    best_pct    = round(best_val / best_max * 100)
    weak_pct    = round(weak_val / weak_max * 100)

    # Score-range opener
    if score >= 80:
        opener = f"{name} מציגה תמונה פיננסית חזקה מאוד, עם ציון {score}/100 שמשקף בריאות עסקית ברמה גבוהה."
    elif score >= 65:
        opener = f"{name} מציגה ביצועים טובים לפי עקרונות המדד, עם ציון {score}/100 שמצביע על עסק יציב ואיכותי."
    elif score >= 50:
        opener = f"{name} מציגה תמונה מעורבת עם ציון {score}/100 — יש נקודות חוזק ברורות לצד תחומים הדורשים מעקב."
    elif score >= 35:
        opener = f"{name} מציגה חולשות משמעותיות לפי עקרונות המדד, עם ציון {score}/100 שמצביע על סיכונים פיננסיים."
    else:
        opener = f"{name} מציגה תמונה פיננסית מאתגרת עם ציון {score}/100 — רוב הפרמטרים הפיננסיים מצויים ברמה נמוכה."

    # Strongest signal
    strength = f"החוזקה המרכזית היא {best_label} שקיבלה {best_val}/{best_max} נקודות ({best_pct}%), מה שמעיד על ביצועים בולטים בתחום זה."

    # Weakest signal
    if weak_pct < 50:
        weakness = f"נקודת החולשה המרכזית היא {weak_label} שקיבלה {weak_val}/{weak_max} נקודות ({weak_pct}%), תחום שמושך את הציון הכולל כלפי מטה."
    else:
        weakness = f"התחום שדורש הכי הרבה תשומת לב הוא {weak_label} עם {weak_val}/{weak_max} נקודות."

    # Confidence note
    conf_map = {"HIGH": "הנתונים מלאים ואמינים.", "MEDIUM": "חלק מהנתונים חסרים, ולכן הציון הוא הערכה טובה אך לא מלאה.", "LOW": "נתונים רבים חסרים — יש לבחון את הציון בזהירות."}
    conf_note = conf_map.get(confidence, "")

    summary = " ".join([opener, strength, weakness, conf_note]).strip()

    return {
        "summary_he":        summary,
        "summary_en":        None,
        "strongest_signal":  best_label,
        "weakest_signal":    weak_label,
        "confidence":        confidence,
        "is_ai":             False,
        "is_fallback":       True,
    }


def _deterministic_summary_en(name: str, score: int, breakdown: dict,
                               confidence: str) -> str:
    sorted_cats = _sorted_categories(breakdown)
    best_key, best_val = sorted_cats[0]
    weak_key, weak_val = sorted_cats[-1]
    best_label = _CAT_LABEL_EN.get(best_key, best_key)
    weak_label = _CAT_LABEL_EN.get(weak_key, weak_key)
    best_pct   = round(best_val / _MAX_SCORES.get(best_key, 25) * 100)
    weak_pct   = round(weak_val / _MAX_SCORES.get(weak_key, 25) * 100)

    if score >= 80:
        opener = f"{name} shows a very strong financial profile with a Bukra Score of {score}/100."
    elif score >= 65:
        opener = f"{name} shows solid financial quality with a Bukra Score of {score}/100."
    elif score >= 50:
        opener = f"{name} presents a mixed picture with a Bukra Score of {score}/100 — strengths and weaknesses coexist."
    else:
        opener = f"{name} shows notable financial weaknesses with a Bukra Score of {score}/100."

    return (
        f"{opener} "
        f"Its strongest dimension is {best_label} ({best_pct}% of max points). "
        f"Its weakest dimension is {weak_label} ({weak_pct}% of max points), which weighs on the overall score."
    )


# ── AI-enhanced summary ───────────────────────────────────────────────────────

def _ai_summary(name: str, ticker: str, score: int, breakdown: dict,
                confidence: str, financials: dict, rules_data: dict) -> dict:
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key or api_key == "your_anthropic_api_key_here":
        raise ValueError("no key")

    history = financials.get("history", [])
    latest  = sorted(history, key=lambda h: h.get("year", ""))[-1] if history else {}

    # Build a compact data payload — no invented data
    data_payload = {
        "ticker":        ticker,
        "bukra_score":   score,
        "confidence":    confidence,
        "categories": {
            k: {"score": v, "max": _MAX_SCORES.get(k, 25), "pct": round(v / _MAX_SCORES.get(k, 25) * 100)}
            for k, v in breakdown.items()
        },
        "latest_year":   latest.get("year"),
        "revenue_m":     round(latest["revenue"] / 1e6) if latest.get("revenue") else None,
        "net_income_m":  round(latest["net_income"] / 1e6) if latest.get("net_income") else None,
        "net_margin_pct":round(latest["net_margin"], 1) if latest.get("net_margin") else None,
        "fcf_m":         round(latest["free_cash_flow"] / 1e6) if latest.get("free_cash_flow") else None,
        "total_debt_m":  round(latest["total_debt"] / 1e6) if latest.get("total_debt") else None,
        "equity_m":      round(latest["stockholders_equity"] / 1e6) if latest.get("stockholders_equity") else None,
    }

    prompt_he = f"""אתה אנליסט פיננסי שכותב סיכום קצר ומדויק לפלטפורמת מחקר השקעות.

הנתונים לפניך (אל תמציא שום מספר שאינו נמצא כאן):
{json.dumps(data_payload, ensure_ascii=False, indent=2)}

כתוב סיכום אנליסט של 4–6 משפטים בעברית פשוטה וחדה.
הנחיות נוקשות:
- הסתמך רק על הנתונים שסופקו.
- אזכיר את הציון הכולל, החוזקה הגדולה ביותר, החולשה הגדולה ביותר.
- הסבר למה הציון הסופי הגיוני.
- אל תמליץ לקנות, למכור, להחזיק.
- כתוב כמו אנליסט מקצועי לא כמו AI.
- אל תשתמש במלה "מומלץ" או "להשקיע".
- אל תציין מידע שאינו בנתונים (כגון שם מנכ"ל, פרויקטים עתידיים, רכישות).

כתוב רק את הסיכום, ללא כותרת."""

    prompt_en = f"""You are a financial analyst writing a concise summary for an investment research platform.

Data provided (do not invent any number not present here):
{json.dumps(data_payload, ensure_ascii=False, indent=2)}

Write a 4–6 sentence analyst summary in clear English.
Strict rules:
- Rely ONLY on the data provided.
- Mention the overall score, strongest dimension, weakest dimension.
- Explain why the final score makes sense given the numbers.
- Do not say buy, sell, hold, or recommend.
- No generic AI phrases — write like a real analyst.
- Do not mention any data not in the payload (CEO names, future projects, etc.).

Output the summary only, no heading."""

    client = anthropic.Anthropic(api_key=api_key)

    he_msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt_he}]
    )
    summary_he = he_msg.content[0].text.strip()

    en_msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt_en}]
    )
    summary_en = en_msg.content[0].text.strip()

    sorted_cats = _sorted_categories(breakdown)
    return {
        "summary_he":       summary_he,
        "summary_en":       summary_en,
        "strongest_signal": _CAT_LABEL_HE.get(sorted_cats[0][0], sorted_cats[0][0]),
        "weakest_signal":   _CAT_LABEL_HE.get(sorted_cats[-1][0], sorted_cats[-1][0]),
        "confidence":       confidence,
        "is_ai":            True,
        "is_fallback":      False,
    }


# ── Public entry point ────────────────────────────────────────────────────────

def generate_smart_analyst_summary(
    company_info: dict,
    score_data: dict,
    financials: dict,
    rules_data: dict,
) -> dict:
    """
    Generate the Smart Analyst Summary.
    Returns a dict with summary_he, summary_en, strongest_signal, weakest_signal,
    confidence, is_ai, is_fallback.
    Never raises — falls back to deterministic on any error.
    """
    sym = company_info.get("symbol", "UNKNOWN")

    cached = _cached(sym)
    if cached:
        return cached

    name      = company_info.get("name", sym)
    score     = score_data.get("score")
    breakdown = score_data.get("breakdown", {})

    # Nothing to summarise if no score
    if score is None or not breakdown:
        return {
            "summary_he":       "אין מספיק נתונים לסיכום.",
            "summary_en":       "Insufficient data for a summary.",
            "strongest_signal": None,
            "weakest_signal":   None,
            "confidence":       "LOW",
            "is_ai":            False,
            "is_fallback":      True,
        }

    confidence = _confidence(score_data, financials)

    # Try AI first; fall back to deterministic silently
    try:
        result = _ai_summary(name, sym, score, breakdown, confidence, financials, rules_data)
        # Fill English fallback if AI returned only Hebrew
        if not result.get("summary_en"):
            result["summary_en"] = _deterministic_summary_en(name, score, breakdown, confidence)
        return _store(sym, result)
    except Exception:
        pass

    result = _deterministic_summary_he(name, score, breakdown, confidence, financials)
    result["summary_en"] = _deterministic_summary_en(name, score, breakdown, confidence)
    return _store(sym, result)
