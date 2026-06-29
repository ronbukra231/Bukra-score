"""
Bukra Market Intelligence Engine — deterministic analysis layers.

All logic is derived from financial data only. No AI, no market predictions.
The Bukra Score formulas are not touched — this layer only *interprets* the
data that the scoring engine already computed.

Public API:
  calculate_confidence_level(financials, info)           -> dict
  calculate_trend_direction(history)                     -> dict
  generate_watch_signals(info, financials, score_data, confidence, trend) -> list
  explain_score_change(current_score_data, previous_snapshot) -> dict | None
  build_company_intelligence(info, financials, score_data, previous_snapshot) -> dict
"""

import datetime
from typing import Optional


def _s(val) -> Optional[float]:
    """Safe float — returns None for None, NaN, or non-numeric."""
    try:
        v = float(val)
        return None if (v != v) else v
    except (TypeError, ValueError):
        return None


# ── Confidence Level ───────────────────────────────────────────────────────────

_CRITICAL_FIELDS = [
    "revenue", "net_income", "free_cash_flow",
    "total_debt", "cash", "stockholders_equity",
]


def calculate_confidence_level(financials: dict, info: dict) -> dict:
    """
    Evaluate data quality and return a confidence level (High / Medium / Low).
    Based on: years available, field completeness, and data consistency.
    """
    history = financials.get("history", [])
    reasons = []
    data_years = len(history)

    if data_years == 0:
        return {
            "level": "Low",
            "score": 0,
            "reasons": ["אין נתונים פיננסיים זמינים"],
            "data_years": 0,
            "completeness_pct": 0.0,
        }

    # Field completeness
    total_expected = data_years * len(_CRITICAL_FIELDS)
    total_present = sum(
        1 for row in history for field in _CRITICAL_FIELDS
        if _s(row.get(field)) is not None
    )
    completeness_pct = round(total_present / total_expected * 100, 1) if total_expected > 0 else 0.0

    # Revenue consistency — flag extreme YoY jumps (acquisition, restatement, split)
    revenues = [_s(r.get("revenue")) for r in history]
    revenues = [v for v in revenues if v is not None]
    has_outlier = False
    for i in range(len(revenues) - 1):
        if revenues[i] and revenues[i + 1] and revenues[i + 1] > 0:
            ratio = revenues[i] / revenues[i + 1]
            if ratio > 4.0 or ratio < 0.25:
                has_outlier = True
                break

    # Numeric confidence score (0–100)
    conf_score = min(data_years, 5) * 12 + round(completeness_pct * 0.3) + (10 if not has_outlier else 0)
    conf_score = min(conf_score, 100)

    # Level
    if data_years >= 4 and completeness_pct >= 75 and not has_outlier:
        level = "High"
        if data_years < 5:
            reasons.append(f"נתונים זמינים ל-{data_years} שנים (לא מלא)")
    elif data_years >= 2 and completeness_pct >= 45:
        level = "Medium"
        if data_years < 4:
            reasons.append(f"נתונים זמינים ל-{data_years} שנים בלבד")
        if completeness_pct < 70:
            reasons.append(f"שלמות שדות: {completeness_pct}%")
    else:
        level = "Low"
        if data_years < 2:
            reasons.append("בסיס נתונים מוגבל מאוד — פחות משתי שנות דיווח")
        if completeness_pct < 45:
            reasons.append(f"שלמות שדות נמוכה: {completeness_pct}%")

    if has_outlier:
        reasons.append("תנודתיות חריגה בנתונים — ייתכן רכישה, פיצול, או שינוי דיווח")
        if level == "High":
            level = "Medium"

    if not reasons:
        reasons.append(f"נתונים מלאים ל-{data_years} שנים, שלמות {completeness_pct}%")

    return {
        "level": level,
        "score": conf_score,
        "reasons": reasons,
        "data_years": data_years,
        "completeness_pct": completeness_pct,
    }


# ── Trend Direction ────────────────────────────────────────────────────────────

def calculate_trend_direction(history: list) -> dict:
    """
    Compare recent performance (last 1–2 years) vs older years.
    Returns direction (Improving / Stable / Weakening) and metric breakdown.
    """
    if len(history) < 2:
        return {
            "direction": "Stable",
            "metrics": {},
            "summary": "אין מספיק נתונים להערכת מגמה",
            "trend_score": 0,
        }

    recent = history[:2]
    older  = history[2:] if len(history) > 2 else []

    def avg(rows, field):
        vals = [_s(r.get(field)) for r in rows]
        vals = [v for v in vals if v is not None]
        return sum(vals) / len(vals) if vals else None

    metrics = {}
    trend_score = 0
    signals_counted = 0

    # Revenue trend
    r_recent = avg(recent, "revenue")
    r_older  = avg(older, "revenue") if older else None
    if r_recent is not None and r_older is not None and r_older > 0:
        chg = (r_recent - r_older) / r_older
        metrics["revenue_trend"] = "up" if chg > 0.05 else ("down" if chg < -0.05 else "flat")
        trend_score += 1 if chg > 0.05 else (-1 if chg < -0.05 else 0)
        signals_counted += 1

    # Net margin trend
    m_recent = avg(recent, "net_margin")
    m_older  = avg(older, "net_margin") if older else None
    if m_recent is not None and m_older is not None:
        delta = m_recent - m_older
        metrics["margin_trend"] = "up" if delta > 1.0 else ("down" if delta < -1.0 else "flat")
        trend_score += 1 if delta > 1.0 else (-1 if delta < -1.0 else 0)
        signals_counted += 1

    # Free cash flow trend
    f_recent = avg(recent, "free_cash_flow")
    f_older  = avg(older, "free_cash_flow") if older else None
    if f_recent is not None and f_older is not None and f_older != 0:
        chg = (f_recent - f_older) / abs(f_older)
        metrics["fcf_trend"] = "up" if chg > 0.05 else ("down" if chg < -0.10 else "flat")
        trend_score += 1 if chg > 0.05 else (-1 if chg < -0.10 else 0)
        signals_counted += 1

    # Debt trend (lower = better)
    d_recent = avg(recent, "total_debt")
    d_older  = avg(older, "total_debt") if older else None
    if d_recent is not None and d_older is not None and d_older > 0:
        chg = (d_recent - d_older) / d_older
        metrics["debt_trend"] = "improving" if chg < -0.05 else ("worsening" if chg > 0.10 else "stable")
        trend_score += 1 if chg < -0.05 else (-1 if chg > 0.10 else 0)
        signals_counted += 1

    if signals_counted == 0:
        direction = "Stable"
        summary   = "אין מספיק נתונים להערכת מגמה"
    elif trend_score >= 2:
        direction = "Improving"
        summary   = "מרבית המדדים העסקיים מצביעים על שיפור"
    elif trend_score <= -2:
        direction = "Weakening"
        summary   = "מרבית המדדים העסקיים מצביעים על היחלשות"
    elif trend_score > 0:
        direction = "Improving"
        summary   = "סימנים ראשוניים של שיפור בנתונים"
    elif trend_score < 0:
        direction = "Weakening"
        summary   = "סימנים ראשוניים של היחלשות בנתונים"
    else:
        direction = "Stable"
        summary   = "יציבות יחסית בביצועי העסק"

    return {
        "direction":    direction,
        "metrics":      metrics,
        "summary":      summary,
        "trend_score":  trend_score,
    }


# ── Watch Signals ──────────────────────────────────────────────────────────────

def generate_watch_signals(
    info: dict,
    financials: dict,
    score_data: dict,
    confidence: dict,
    trend: dict,
) -> list:
    """
    Deterministic watch signals derived from financial data.
    No predictions. Each signal explains what the data shows — nothing more.
    """
    history = financials.get("history", [])
    signals = []
    score   = score_data.get("score")

    def add(text, category, severity):
        signals.append({"signal": text, "category": category, "severity": severity})

    if len(history) >= 2:
        h0 = history[0]
        h1 = history[1]

        rev0    = _s(h0.get("revenue"))
        rev1    = _s(h1.get("revenue"))
        margin0 = _s(h0.get("net_margin"))
        margin1 = _s(h1.get("net_margin"))
        debt0   = _s(h0.get("total_debt"))
        debt1   = _s(h1.get("total_debt"))
        fcf0    = _s(h0.get("free_cash_flow"))
        fcf1    = _s(h1.get("free_cash_flow"))
        ni0     = _s(h0.get("net_income"))

        # Revenue growing but margins shrinking
        if rev0 and rev1 and rev1 != 0 and margin0 is not None and margin1 is not None:
            rev_growth = (rev0 - rev1) / abs(rev1)
            if rev_growth > 0.05 and margin0 < margin1 - 1.5:
                add(
                    "ההכנסות צומחות, אבל הרווחיות לא מצטרפת — הצמיחה מגיעה על חשבון המרווחים",
                    "MarginPressure", "Medium",
                )

        # Consecutive margin erosion
        if len(history) >= 3:
            m2 = _s(history[2].get("net_margin"))
            if margin0 is not None and margin1 is not None and m2 is not None:
                if margin0 < margin1 < m2:
                    add(
                        "המרווח הנקי נשחק כבר כמה תקופות ברצף — מגמה שדורשת מעקב",
                        "MarginPressure", "High",
                    )

        # Debt growing faster than FCF
        if debt0 and debt1 and debt1 > 0 and fcf1 and fcf1 > 0:
            debt_chg = (debt0 - debt1) / debt1
            fcf_chg  = (fcf0 - fcf1) / abs(fcf1) if fcf0 is not None else 0
            if debt_chg > 0.15 and debt_chg > fcf_chg + 0.10:
                add(
                    "החוב עולה מהר יותר מהתזרים — המינוף הפיננסי גדל",
                    "DebtAlert", "High",
                )

        # Positive income but negative FCF
        if ni0 and ni0 > 0 and fcf0 is not None and fcf0 < 0:
            add(
                "הרווח הנקי חיובי, אך תזרים המזומנים החופשי שלילי — כדאי לבחון את איכות הרווחים",
                "DebtAlert", "Medium",
            )

        # Revenue deceleration
        if len(history) >= 3 and rev0 and rev1 and rev1 != 0:
            rev2 = _s(history[2].get("revenue"))
            if rev2 and rev2 != 0:
                old_growth = (rev1 - rev2) / abs(rev2)
                new_growth = (rev0 - rev1) / abs(rev1)
                if old_growth > 0.15 and new_growth < old_growth * 0.4:
                    add(
                        "קצב הצמיחה בהכנסות האט משמעותית — שינוי במומנטום הצמיחה",
                        "RevenueMomentum", "Medium",
                    )
                elif old_growth > 0.05 and new_growth > old_growth * 1.3:
                    add(
                        "קצב הצמיחה בהכנסות האיץ — מומנטום חיובי בנתונים",
                        "RevenueMomentum", "Low",
                    )

    # High score but low confidence
    if score is not None and score >= 70:
        conf_level = confidence.get("level")
        if conf_level == "Low":
            add(
                "הציון גבוה, אבל רמת הביטחון נמוכה — הנתונים הזמינים מוגבלים, יש לקרוא בזהירות",
                "DataWarning", "High",
            )
        elif conf_level == "Medium":
            add(
                "הציון גבוה, אך חלק מהמסקנות מבוססות על נתונים חלקיים",
                "DataWarning", "Low",
            )

    # Price near 52w low with solid score
    price    = _s(info.get("price"))
    low_52w  = _s(info.get("52w_low"))
    high_52w = _s(info.get("52w_high"))
    if price and low_52w and high_52w and high_52w > low_52w and score is not None:
        range_pct = (price - low_52w) / (high_52w - low_52w)
        if range_pct < 0.25 and score >= 70:
            add(
                "המניה קרובה לשפל השנתי, אך איכות העסק לא נפגעה משמעותית — יחס הסיכון-סיכוי השתנה",
                "PriceOpportunity", "Medium",
            )
        elif range_pct > 0.85 and score < 60:
            add(
                "המניה קרובה לשיא השנתי, אך איכות העסק מוגבלת — התמחור מגלם ציפיות גבוהות",
                "ValuationWarning", "Medium",
            )

    # High P/E with mediocre score
    pe = _s(info.get("pe_ratio"))
    if pe and pe > 40 and score is not None and score < 65:
        add(
            "החברה נסחרת במכפיל גבוה יחסית לרמת איכות העסק — התמחור מגלם ציפיות גבוהות",
            "ValuationWarning", "Medium",
        )

    # Trend signals
    direction = trend.get("direction")
    if direction == "Improving" and score is not None and score >= 60:
        if not (price and high_52w and price > high_52w * 0.93):
            add(
                "איכות העסק משתפרת — המגמה בנתונים הפיננסיים חיובית",
                "QualityUpgrade", "Low",
            )
    elif direction == "Weakening":
        add(
            "נזהתה היחלשות במגמת הנתונים הפיננסיים — דורש מעקב נוסף",
            "QualityDowngrade", "Medium",
        )

    return signals


# ── Score Change Explanation ───────────────────────────────────────────────────

_FACTOR_LABELS_HE = {
    "growth":        "צמיחה",
    "profitability": "רווחיות",
    "cash_flow":     "תזרים מזומנים",
    "stability":     "יציבות פיננסית",
    "debt":          "בריאות חוב",
}


def explain_score_change(
    current_score_data: dict,
    previous_snapshot: Optional[dict],
) -> Optional[dict]:
    """
    Compare current score to the previous saved snapshot.
    Returns None if no previous data is available.
    """
    if not previous_snapshot:
        return None

    curr_score = current_score_data.get("score")
    prev_score = previous_snapshot.get("score")

    if curr_score is None or prev_score is None:
        return None

    delta     = curr_score - prev_score
    direction = "up" if delta > 0 else ("down" if delta < 0 else "unchanged")

    if delta == 0:
        return {
            "prev_score":        prev_score,
            "curr_score":        curr_score,
            "delta":             0,
            "direction":         "unchanged",
            "main_factor":       None,
            "main_factor_label": None,
            "explanation":       "הציון לא השתנה מהסריקה הקודמת.",
            "is_significant":    False,
            "component_changes": {},
        }

    # Find the breakdown component with the largest change
    curr_bd = current_score_data.get("breakdown", {})
    prev_bd = previous_snapshot.get("breakdown", {})
    component_changes = {}
    max_key   = None
    max_delta = 0

    for key in curr_bd:
        if key in prev_bd:
            chg = curr_bd[key] - prev_bd[key]
            component_changes[key] = chg
            if abs(chg) > abs(max_delta):
                max_delta = chg
                max_key   = key

    factor_label = _FACTOR_LABELS_HE.get(max_key, max_key) if max_key else None

    # Build Hebrew explanation
    abs_delta = abs(delta)
    verb = "עלה" if direction == "up" else "ירד"

    if abs_delta < 3:
        magnitude = "שינוי קטן"
    elif abs_delta < 8:
        magnitude = "שינוי מתון"
    else:
        magnitude = "שינוי משמעותי"

    if max_key and factor_label:
        factor_direction = "שיפור ב" if max_delta > 0 else "שחיקה ב"
        factor_text = f"בעיקר בשל {factor_direction}{factor_label}"
    else:
        factor_text = "בשל שינוי בנתונים הפיננסיים"

    explanation = f"הציון {verb} מ-{prev_score} ל-{curr_score} ({magnitude}), {factor_text}."
    if abs_delta < 5:
        explanation += " שינוי זה עשוי לשקף עדכון בנתונים יותר מאשר שינוי מהותי באיכות העסק."

    return {
        "prev_score":        prev_score,
        "curr_score":        curr_score,
        "delta":             delta,
        "direction":         direction,
        "main_factor":       max_key,
        "main_factor_label": factor_label,
        "explanation":       explanation,
        "is_significant":    abs_delta >= 5,
        "component_changes": component_changes,
    }


# ── Top-level builder ──────────────────────────────────────────────────────────

def build_company_intelligence(
    info: dict,
    financials: dict,
    score_data: dict,
    previous_snapshot: Optional[dict] = None,
) -> dict:
    """
    Build the full intelligence layer for a company.
    Called from: company page endpoint (per request) and scanner (post-scan batch).
    """
    history    = financials.get("history", [])
    confidence = calculate_confidence_level(financials, info)
    trend      = calculate_trend_direction(history)
    signals    = generate_watch_signals(info, financials, score_data, confidence, trend)
    score_chg  = explain_score_change(score_data, previous_snapshot)

    return {
        "confidence":   confidence,
        "trend":        trend,
        "signals":      signals,
        "score_change": score_chg,
        "computed_at":  datetime.datetime.utcnow().isoformat() + "Z",
    }
