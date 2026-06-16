"""
Bukra Score — 0 to 100.

## Category weights (UNCHANGED — do not modify without explicit review)
  Consistent Growth     25 pts
  Profitability         20 pts
  Cash Flow             20 pts
  Financial Stability   20 pts
  Debt Health           15 pts

## Bugs fixed in this version (audit 2024-06):
  FIXED — Stability explanation described only the debt/assets sub-component
  (up to 10 pts) while ignoring cash/debt coverage (up to 10 pts).
  A company with 0% debt but poor cash-to-debt coverage could score 13/20 (65%,
  "moderate") yet receive the wording "חברה יציבה מאוד" (very stable company).
  Root cause: explanation was derived from the debt/assets threshold alone.

  FIXED — Growth explanation described only revenue CAGR and never mentioned the
  net-income-consistency component (up to 10 pts), so it could misrepresent why a
  score was high or low.

  FIXED — Cash flow explanation called any company with 100% positive FCF years
  "מצוין" even when the FCF margin was near 0%, capping the score at ~14/20 (70%).

  Root cause of all three: explanations were generated inside each category function
  from individual sub-metric thresholds, BEFORE the final category score and tier
  were known. The explanation literally could not reflect what the number meant.

## What was NOT changed:
  - All point thresholds (exactly as originally coded)
  - Category max scores and total (still 25+20+20+20+15 = 100)
  - Tier boundaries: excellent ≥85% | strong ≥70% | moderate ≥50% | weak ≥30% | poor <30%
  - Any API response field that the frontend currently reads
  - Bukra Rules (bukra_rules.py) — untouched
"""

from typing import Optional


# ── Utilities ─────────────────────────────────────────────────────────────────

def _cagr(start: float, end: float, years: int) -> Optional[float]:
    if not start or not end or years <= 0 or start <= 0 or end <= 0:
        return None
    try:
        return (end / start) ** (1 / years) - 1
    except Exception:
        return None


def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


def _safe_number(value) -> Optional[float]:
    """Return float or None — never raises, never returns NaN/Inf."""
    try:
        v = float(value)
        if v != v or v in (float('inf'), float('-inf')):
            return None
        return v
    except (TypeError, ValueError):
        return None


def _safe_divide(a, b, default=None) -> Optional[float]:
    """Divide a/b safely; returns default when b is 0 or either is None."""
    av, bv = _safe_number(a), _safe_number(b)
    if av is None or bv is None or bv == 0:
        return default
    return av / bv


def _average_available(values: list) -> Optional[float]:
    """Mean of non-None numeric values; None when list is empty."""
    nums = [_safe_number(v) for v in values]
    nums = [n for n in nums if n is not None]
    return sum(nums) / len(nums) if nums else None


def _safe(fn):
    """Run fn(), return (result, None) or (0, error_str) on any exception."""
    try:
        return fn(), None
    except Exception as e:
        return ({"score": 0}, str(e))


def _vals(history: list, key: str) -> list:
    """Non-None values for a key from history, oldest→newest."""
    rows = sorted(history, key=lambda x: x.get("year", ""))
    return [h[key] for h in rows if h.get(key) is not None]


# ── Tier system ───────────────────────────────────────────────────────────────
# Tiers are derived AFTER the numeric score is computed, so the wording always
# reflects the actual number — never a sub-component threshold.

def _tier(score: int, max_score: int) -> str:
    """Deterministic tier from score percentage. Never contradicts the number."""
    pct = score / max_score * 100 if max_score > 0 else 0
    if pct >= 85: return "excellent"
    if pct >= 70: return "strong"
    if pct >= 50: return "moderate"
    if pct >= 30: return "weak"
    return "poor"


def _tier_label_he(tier: str) -> str:
    return {"excellent": "מצוין", "strong": "חזק", "moderate": "בינוני",
            "weak": "חלש", "poor": "חלש מאוד"}.get(tier, tier)


def _score_pct(score: int, max_score: int) -> float:
    return round(score / max_score * 100, 1) if max_score > 0 else 0.0


# ── Category: Consistent Growth (25 pts) ─────────────────────────────────────

def _compute_growth(history: list) -> dict:
    """
    Points breakdown (UNCHANGED):
      Revenue CAGR ≥15%  → 15 pts
      Revenue CAGR ≥10%  → 12 pts
      Revenue CAGR ≥5%   → 8 pts
      Revenue CAGR ≥0%   → 4 pts
      Net income growing in ≥X of Y year-pairs → up to 10 pts (proportional)
    """
    revenues    = _vals(history, "revenue")
    net_incomes = _vals(history, "net_income")
    score = 0
    rev_cagr = None
    ni_growing_pairs = 0
    ni_total_pairs = max(len(net_incomes) - 1, 0)

    rev_pts = 0
    ni_pts  = 0

    if len(revenues) >= 2:
        rev_cagr = _cagr(revenues[0], revenues[-1], len(revenues) - 1)
        if rev_cagr is not None:
            if   rev_cagr >= 0.15: rev_pts = 15
            elif rev_cagr >= 0.10: rev_pts = 12
            elif rev_cagr >= 0.05: rev_pts = 8
            elif rev_cagr >= 0:    rev_pts = 4
            score += rev_pts

    if len(net_incomes) >= 2:
        ni_growing_pairs = sum(1 for i in range(1, len(net_incomes)) if net_incomes[i] > net_incomes[i - 1])
        ni_ratio = ni_growing_pairs / ni_total_pairs
        ni_pts   = round(10 * ni_ratio)
        score   += ni_pts

    score = _clamp(score, 0, 25)

    metrics = {
        "revenue_cagr": round(rev_cagr * 100, 2) if rev_cagr is not None else None,
        "ni_growing_pairs": ni_growing_pairs,
        "ni_total_pairs": ni_total_pairs,
        "data_years": len(revenues),
    }

    rules = [
        {
            "name": "צמיחת הכנסות (CAGR)",
            "value": f"{round(rev_cagr * 100, 1)}%" if rev_cagr is not None else "אין נתונים",
            "points": rev_pts,
            "max_points": 15,
            "reason": _rev_cagr_reason(rev_cagr),
        },
        {
            "name": "עקביות רווח נקי",
            "value": f"{ni_growing_pairs}/{ni_total_pairs} שנים" if ni_total_pairs else "אין נתונים",
            "points": ni_pts,
            "max_points": 10,
            "reason": f"הרווח הנקי עלה ב-{ni_growing_pairs} מתוך {ni_total_pairs} שנים" if ni_total_pairs else "אין מספיק נתונים",
        },
    ]

    return {"score": int(score), "max_score": 25, "metrics": metrics, "rules": rules}


def _rev_cagr_reason(rev_cagr) -> str:
    if rev_cagr is None: return "אין מספיק נתוני הכנסות"
    pct = rev_cagr * 100
    if pct >= 15:  return "צמיחת הכנסות שנתית מצוינת (≥15%)"
    if pct >= 10:  return "צמיחת הכנסות שנתית חזקה (10–14%)"
    if pct >= 5:   return "צמיחת הכנסות שנתית מתונה (5–9%)"
    if pct >= 0:   return "צמיחת הכנסות שנתית איטית (0–4%)"
    return "ירידה בהכנסות"


def _growth_explanation(score: int, max_score: int, metrics: dict) -> str:
    """Tier-consistent explanation for growth. Mentions both components."""
    tier  = _tier(score, max_score)
    label = _tier_label_he(tier)
    cagr  = metrics.get("revenue_cagr")
    pairs = metrics.get("ni_growing_pairs", 0)
    total = metrics.get("ni_total_pairs", 0)

    if cagr is None:
        return "אין מספיק נתונים לחישוב ציון הצמיחה."

    cagr_str = f"{cagr}%"
    ni_str   = f"הרווח הנקי עלה ב-{pairs} מתוך {total} שנים" if total else ""

    base = f"ציון צמיחה {label} ({score}/{max_score}). ההכנסות צמחו בממוצע {cagr_str} בשנה"
    if ni_str:
        return f"{base}. {ni_str}."
    return f"{base}."


# ── Category: Profitability (20 pts) ─────────────────────────────────────────

def _compute_profitability(history: list, info: dict) -> dict:
    """
    Points breakdown (UNCHANGED):
      Avg net margin ≥25%  → 12 pts
      Avg net margin ≥15%  → 9 pts
      Avg net margin ≥8%   → 6 pts
      Avg net margin ≥0%   → 3 pts
      ROE ≥20%  → 8 pts
      ROE ≥15%  → 6 pts
      ROE ≥10%  → 4 pts
      ROE ≥0%   → 2 pts
    """
    margins = _vals(history, "net_margin")
    roe_raw = info.get("returnOnEquity")
    score   = 0
    avg_margin = None
    roe_pct    = None
    margin_pts = 0
    roe_pts    = 0

    if margins:
        avg_margin = sum(margins) / len(margins)
        if   avg_margin >= 25: margin_pts = 12
        elif avg_margin >= 15: margin_pts = 9
        elif avg_margin >= 8:  margin_pts = 6
        elif avg_margin >= 0:  margin_pts = 3
        score += margin_pts

    if roe_raw is not None:
        try:
            roe_pct = float(roe_raw) * 100
            if   roe_pct >= 20: roe_pts = 8
            elif roe_pct >= 15: roe_pts = 6
            elif roe_pct >= 10: roe_pts = 4
            elif roe_pct >= 0:  roe_pts = 2
            score += roe_pts
        except (TypeError, ValueError):
            pass

    score = _clamp(score, 0, 20)

    metrics = {
        "avg_net_margin": round(avg_margin, 2) if avg_margin is not None else None,
        "roe_pct":        round(roe_pct, 2)    if roe_pct   is not None else None,
        "margin_years":   len(margins),
    }

    rules = [
        {
            "name": "שולי רווח נקי ממוצעים",
            "value": f"{round(avg_margin, 1)}%" if avg_margin is not None else "אין נתונים",
            "points": margin_pts,
            "max_points": 12,
            "reason": _margin_reason(avg_margin),
        },
        {
            "name": "תשואה על ההון (ROE)",
            "value": f"{round(roe_pct, 1)}%" if roe_pct is not None else "אין נתונים",
            "points": roe_pts,
            "max_points": 8,
            "reason": _roe_reason(roe_pct),
        },
    ]

    return {"score": int(score), "max_score": 20, "metrics": metrics, "rules": rules}


def _margin_reason(m) -> str:
    if m is None: return "אין נתוני שולי רווח"
    if m >= 25:  return "שולי רווח גבוהים מאוד (≥25%)"
    if m >= 15:  return "שולי רווח טובים (15–24%)"
    if m >= 8:   return "שולי רווח בינוניים (8–14%)"
    if m >= 0:   return "שולי רווח נמוכים (0–7%)"
    return "החברה בהפסד"


def _roe_reason(r) -> str:
    if r is None: return "אין נתוני ROE"
    if r >= 20:  return "תשואה על ההון מצוינת (≥20%)"
    if r >= 15:  return "תשואה על ההון חזקה (15–19%)"
    if r >= 10:  return "תשואה על ההון בינונית (10–14%)"
    if r >= 0:   return "תשואה על ההון נמוכה (0–9%)"
    return "תשואה על ההון שלילית"


def _profitability_explanation(score: int, max_score: int, metrics: dict) -> str:
    tier  = _tier(score, max_score)
    label = _tier_label_he(tier)
    m     = metrics.get("avg_net_margin")
    r     = metrics.get("roe_pct")
    parts = [f"ציון רווחיות {label} ({score}/{max_score})."]
    if m is not None: parts.append(f"שולי רווח ממוצעים: {round(m, 1)}%.")
    if r is not None: parts.append(f"תשואה על ההון (ROE): {round(r, 1)}%.")
    if m is None and r is None: parts.append("אין נתוני רווחיות זמינים.")
    return " ".join(parts)


# ── Category: Cash Flow (20 pts) ─────────────────────────────────────────────

def _compute_cash_flow(history: list) -> dict:
    """
    Points breakdown (UNCHANGED):
      Positive FCF years fraction × 12 pts (proportional)
      FCF margin (latest year):
        ≥15%  → 8 pts
        ≥8%   → 5 pts
        ≥0%   → 2 pts
    """
    fcfs     = _vals(history, "free_cash_flow")
    revenues = _vals(history, "revenue")
    score    = 0
    positive = 0
    fcf_margin  = None
    positive_pts = 0
    margin_pts   = 0

    if fcfs:
        positive      = sum(1 for f in fcfs if f > 0)
        positive_pts  = round(12 * positive / len(fcfs))
        score        += positive_pts

        latest_rev = revenues[-1] if revenues else None
        latest_fcf = fcfs[-1]
        if latest_rev and latest_rev > 0:
            fcf_margin = latest_fcf / latest_rev * 100
            if   fcf_margin >= 15: margin_pts = 8
            elif fcf_margin >= 8:  margin_pts = 5
            elif fcf_margin >= 0:  margin_pts = 2
            score += margin_pts

    score = _clamp(score, 0, 20)

    metrics = {
        "positive_fcf_years": positive,
        "total_fcf_years":    len(fcfs),
        "latest_fcf_margin":  round(fcf_margin, 2) if fcf_margin is not None else None,
    }

    rules = [
        {
            "name": "שנות תזרים חיובי",
            "value": f"{positive}/{len(fcfs)}" if fcfs else "אין נתונים",
            "points": positive_pts,
            "max_points": 12,
            "reason": f"תזרים חיובי ב-{positive} מתוך {len(fcfs)} שנים" if fcfs else "אין נתוני תזרים",
        },
        {
            "name": "שולי תזרים (שנה אחרונה)",
            "value": f"{round(fcf_margin, 1)}%" if fcf_margin is not None else "אין נתונים",
            "points": margin_pts,
            "max_points": 8,
            "reason": _fcf_margin_reason(fcf_margin),
        },
    ]

    return {"score": int(score), "max_score": 20, "metrics": metrics, "rules": rules}


def _fcf_margin_reason(m) -> str:
    if m is None: return "אין נתוני תזרים או הכנסות"
    if m >= 15:  return "שולי תזרים גבוהים (≥15%)"
    if m >= 8:   return "שולי תזרים בינוניים (8–14%)"
    if m >= 0:   return "שולי תזרים נמוכים (0–7%)"
    return "תזרים שלילי בשנה האחרונה"


def _cashflow_explanation(score: int, max_score: int, metrics: dict) -> str:
    tier  = _tier(score, max_score)
    label = _tier_label_he(tier)
    pos   = metrics.get("positive_fcf_years", 0)
    total = metrics.get("total_fcf_years", 0)
    fm    = metrics.get("latest_fcf_margin")

    if total == 0:
        return "אין נתוני תזרים מזומנים."

    base = f"ציון תזרים {label} ({score}/{max_score}). תזרים חיובי ב-{pos} מתוך {total} שנים."
    if fm is not None:
        return f"{base} שולי תזרים בשנה האחרונה: {round(fm, 1)}%."
    return base


# ── Category: Financial Stability (20 pts) ────────────────────────────────────

def _compute_stability(history: list) -> dict:
    """
    Points breakdown (UNCHANGED):
      Debt/assets ratio:
        <20%  → 10 pts
        <40%  → 7 pts
        <60%  → 4 pts
        ≥60%  → 1 pt
      Cash-to-debt coverage:
        ≥1.0  → 10 pts   (cash ≥ total debt)
        ≥0.5  → 6 pts
        ≥0.25 → 3 pts
        no debt at all → 10 pts (best case)

    NOTE: Two components, each up to 10 pts. Previously only the first component
    was reflected in the explanation, causing tier mismatches (e.g. 13/20 = 65%
    described as "very stable" because debt ratio alone was low).
    """
    assets = _vals(history, "total_assets")
    debts  = _vals(history, "total_debt")
    cashes = _vals(history, "cash")
    score  = 0

    debt_ratio    = None
    c2d           = None
    debt_ratio_pts = 0
    c2d_pts        = 0

    if assets and debts:
        debt_ratio      = debts[-1] / assets[-1] if assets[-1] else None
        if debt_ratio is not None:
            if   debt_ratio < 0.2: debt_ratio_pts = 10
            elif debt_ratio < 0.4: debt_ratio_pts = 7
            elif debt_ratio < 0.6: debt_ratio_pts = 4
            else:                  debt_ratio_pts = 1
            score += debt_ratio_pts

    if cashes and debts:
        if debts[-1] == 0:
            c2d     = None   # no debt — best case
            c2d_pts = 10
            score  += c2d_pts
        elif debts[-1] > 0:
            c2d = cashes[-1] / debts[-1]
            if   c2d >= 1.0:  c2d_pts = 10
            elif c2d >= 0.5:  c2d_pts = 6
            elif c2d >= 0.25: c2d_pts = 3
            score += c2d_pts

    score = _clamp(score, 0, 20)

    metrics = {
        "debt_ratio":       round(debt_ratio * 100, 2) if debt_ratio is not None else None,
        "cash_to_debt":     round(c2d, 3)              if c2d is not None        else None,
        "latest_debt":      debts[-1]                  if debts                  else None,
        "latest_assets":    assets[-1]                 if assets                 else None,
        "latest_cash":      cashes[-1]                 if cashes                 else None,
        "zero_debt":        bool(debts and debts[-1] == 0),
    }

    rules = [
        {
            "name": "יחס חוב לנכסים",
            "value": f"{round(debt_ratio * 100, 1)}%" if debt_ratio is not None else "אין נתונים",
            "points": debt_ratio_pts,
            "max_points": 10,
            "reason": _debt_ratio_reason(debt_ratio),
        },
        {
            "name": "כיסוי מזומן לחוב",
            "value": ("אין חוב" if metrics["zero_debt"] else
                      f"{round(c2d, 2)}x"  if c2d is not None else "אין נתונים"),
            "points": c2d_pts,
            "max_points": 10,
            "reason": _c2d_reason(c2d, metrics["zero_debt"]),
        },
    ]

    return {"score": int(score), "max_score": 20, "metrics": metrics, "rules": rules}


def _debt_ratio_reason(r) -> str:
    if r is None: return "אין נתוני חוב או נכסים"
    pct = r * 100
    if pct < 20:  return "חוב נמוך מאוד ביחס לנכסים (<20%)"
    if pct < 40:  return "חוב ביחס לנכסים סביר (20–39%)"
    if pct < 60:  return "חוב ביחס לנכסים מוגבר (40–59%)"
    return "מינוף גבוה (חוב ≥60% מהנכסים)"


def _c2d_reason(c2d, zero_debt: bool) -> str:
    if zero_debt: return "אין חוב כלל — מצב אופטימלי"
    if c2d is None: return "אין נתוני מזומן או חוב"
    if c2d >= 1.0:  return "המזומן מכסה את כל החוב (≥1x)"
    if c2d >= 0.5:  return "המזומן מכסה 50–99% מהחוב"
    if c2d >= 0.25: return "המזומן מכסה 25–49% מהחוב"
    return "כיסוי מזומן נמוך (<25% מהחוב)"


def _stability_explanation(score: int, max_score: int, metrics: dict) -> str:
    """
    Tier-consistent stability explanation.
    Previously only described the debt/assets component — now describes both
    components and uses tier-based wording that matches the numeric score.
    """
    tier  = _tier(score, max_score)
    label = _tier_label_he(tier)
    dr    = metrics.get("debt_ratio")
    c2d   = metrics.get("cash_to_debt")
    zero  = metrics.get("zero_debt", False)

    if dr is None:
        return f"ציון יציבות פיננסית {label} ({score}/{max_score}). נתונים חלקיים — לא ניתן לחשב את כל המרכיבים."

    dr_str  = f"החוב מהווה {round(dr, 1)}% מהנכסים"
    if zero:
        c2d_str = "ללא חוב"
    elif c2d is not None:
        c2d_str = f"יחס כיסוי מזומן לחוב: {round(c2d, 2)}x"
    else:
        c2d_str = "אין נתוני מזומן"

    return f"יציבות פיננסית {label} ({score}/{max_score}). {dr_str}. {c2d_str}."


# ── Category: Debt Health (15 pts) ────────────────────────────────────────────

def _compute_debt(history: list) -> dict:
    """
    Points breakdown (UNCHANGED):
      Debt/equity:
        <0.3  → 10 pts
        <0.7  → 7 pts
        <1.5  → 4 pts
        ≥1.5  → 1 pt
      Debt trend (latest vs earliest):
        Decreasing       → 5 pts
        Stable (<+20%)   → 2 pts
    """
    debts    = _vals(history, "total_debt")
    equities = _vals(history, "stockholders_equity")
    score    = 0

    de         = None
    de_pts     = 0
    trend_pts  = 0
    debt_trend = None

    if debts and equities and equities[-1] and equities[-1] > 0:
        de = debts[-1] / equities[-1]
        if   de < 0.3: de_pts = 10
        elif de < 0.7: de_pts = 7
        elif de < 1.5: de_pts = 4
        else:          de_pts = 1
        score += de_pts

    if len(debts) >= 2 and debts[0] and debts[-1]:
        debt_trend = (debts[-1] - debts[0]) / abs(debts[0])
        if debts[-1] < debts[0]:
            trend_pts = 5
        elif debts[-1] < debts[0] * 1.2:
            trend_pts = 2
        score += trend_pts

    score = _clamp(score, 0, 15)

    metrics = {
        "debt_to_equity":  round(de, 3)          if de is not None          else None,
        "debt_trend_pct":  round(debt_trend * 100, 1) if debt_trend is not None else None,
        "latest_debt":     debts[-1]              if debts                   else None,
        "earliest_debt":   debts[0]               if debts                   else None,
        "latest_equity":   equities[-1]           if equities                else None,
    }

    rules = [
        {
            "name": "יחס חוב להון עצמי (D/E)",
            "value": f"{round(de, 2)}" if de is not None else "אין נתונים",
            "points": de_pts,
            "max_points": 10,
            "reason": _de_reason(de),
        },
        {
            "name": "מגמת חוב לאורך זמן",
            "value": (f"{round(debt_trend * 100, 1)}%" if debt_trend is not None else "אין נתונים"),
            "points": trend_pts,
            "max_points": 5,
            "reason": _trend_reason(debt_trend),
        },
    ]

    return {"score": int(score), "max_score": 15, "metrics": metrics, "rules": rules}


def _de_reason(de) -> str:
    if de is None: return "אין נתוני חוב או הון"
    if de < 0.3:   return "מינוף נמוך מאוד (D/E <0.3)"
    if de < 0.7:   return "מינוף מתון (D/E 0.3–0.69)"
    if de < 1.5:   return "מינוף מוגבר (D/E 0.7–1.49)"
    return "מינוף גבוה (D/E ≥1.5)"


def _trend_reason(t) -> str:
    if t is None:  return "אין מספיק נתוני חוב"
    if t < 0:      return "החוב פחת לאורך הזמן — מגמה חיובית"
    if t < 0.2:    return "החוב יציב (עלייה <20%)"
    return "החוב גדל משמעותית"


def _debt_explanation(score: int, max_score: int, metrics: dict) -> str:
    tier  = _tier(score, max_score)
    label = _tier_label_he(tier)
    de    = metrics.get("debt_to_equity")
    trend = metrics.get("debt_trend_pct")

    if de is None:
        return f"ציון בריאות חוב {label} ({score}/{max_score}). נתונים חלקיים."

    parts = [f"בריאות חוב {label} ({score}/{max_score}). יחס חוב להון: {round(de, 2)}."]
    if trend is not None:
        direction = "ירד" if trend < 0 else "עלה"
        parts.append(f"החוב {direction} ב-{abs(round(trend, 1))}% לאורך תקופת המדידה.")
    return " ".join(parts)


# ── Main entry point ──────────────────────────────────────────────────────────

def compute_bukra_score(financials: dict, info: dict) -> dict:
    """
    Compute the Bukra Score.

    Returns the same shape as before (backward compatible) plus a new `audit` key
    with full per-category breakdown including tier, metrics, rules, and explanation.
    """
    import time
    t0      = time.monotonic()
    history = financials.get("history", [])

    max_scores = {"growth": 25, "profitability": 20, "cash_flow": 20, "stability": 20, "debt": 15}

    if not history:
        return {
            "score":      None,
            "breakdown":  {},
            "explanations": {},
            "max_scores": max_scores,
            "errors":     {"data": "אין נתונים פיננסיים"},
            "audit":      None,
        }

    # ── Compute each category ─────────────────────────────────────────────────
    errors: dict = {}

    try:
        growth_data = _compute_growth(history)
    except Exception as e:
        growth_data = {"score": 0, "max_score": 25, "metrics": {}, "rules": []}
        errors["growth"] = str(e)

    try:
        prof_data = _compute_profitability(history, info)
    except Exception as e:
        prof_data = {"score": 0, "max_score": 20, "metrics": {}, "rules": []}
        errors["profitability"] = str(e)

    try:
        cf_data = _compute_cash_flow(history)
    except Exception as e:
        cf_data = {"score": 0, "max_score": 20, "metrics": {}, "rules": []}
        errors["cash_flow"] = str(e)

    try:
        stab_data = _compute_stability(history)
    except Exception as e:
        stab_data = {"score": 0, "max_score": 20, "metrics": {}, "rules": []}
        errors["stability"] = str(e)

    try:
        debt_data = _compute_debt(history)
    except Exception as e:
        debt_data = {"score": 0, "max_score": 15, "metrics": {}, "rules": []}
        errors["debt"] = str(e)

    # ── Build breakdown (legacy shape) ────────────────────────────────────────
    breakdown = {
        "growth":        growth_data["score"],
        "profitability": prof_data["score"],
        "cash_flow":     cf_data["score"],
        "stability":     stab_data["score"],
        "debt":          debt_data["score"],
    }

    # ── Safeguard: category scores must not exceed max ────────────────────────
    for key, max_val in max_scores.items():
        if breakdown[key] > max_val:
            breakdown[key] = max_val  # clamp silently — should never happen

    total = sum(breakdown.values())

    # ── Build tier-consistent explanations (generated AFTER scores known) ─────
    explanations = {
        "growth":        _growth_explanation(growth_data["score"], 25, growth_data["metrics"]),
        "profitability": _profitability_explanation(prof_data["score"], 20, prof_data["metrics"]),
        "cash_flow":     _cashflow_explanation(cf_data["score"], 20, cf_data["metrics"]),
        "stability":     _stability_explanation(stab_data["score"], 20, stab_data["metrics"]),
        "debt":          _debt_explanation(debt_data["score"], 15, debt_data["metrics"]),
    }

    # ── Build audit categories ────────────────────────────────────────────────
    categories = [
        {
            "key":           "growth",
            "label":         "צמיחה עקבית",
            "score":         growth_data["score"],
            "max_score":     25,
            "score_percent": _score_pct(growth_data["score"], 25),
            "tier":          _tier(growth_data["score"], 25),
            "metrics":       growth_data["metrics"],
            "rules":         growth_data["rules"],
            "explanation":   explanations["growth"],
        },
        {
            "key":           "profitability",
            "label":         "רווחיות",
            "score":         prof_data["score"],
            "max_score":     20,
            "score_percent": _score_pct(prof_data["score"], 20),
            "tier":          _tier(prof_data["score"], 20),
            "metrics":       prof_data["metrics"],
            "rules":         prof_data["rules"],
            "explanation":   explanations["profitability"],
        },
        {
            "key":           "cash_flow",
            "label":         "תזרים מזומנים",
            "score":         cf_data["score"],
            "max_score":     20,
            "score_percent": _score_pct(cf_data["score"], 20),
            "tier":          _tier(cf_data["score"], 20),
            "metrics":       cf_data["metrics"],
            "rules":         cf_data["rules"],
            "explanation":   explanations["cash_flow"],
        },
        {
            "key":           "stability",
            "label":         "יציבות פיננסית",
            "score":         stab_data["score"],
            "max_score":     20,
            "score_percent": _score_pct(stab_data["score"], 20),
            "tier":          _tier(stab_data["score"], 20),
            "metrics":       stab_data["metrics"],
            "rules":         stab_data["rules"],
            "explanation":   explanations["stability"],
        },
        {
            "key":           "debt",
            "label":         "בריאות חוב",
            "score":         debt_data["score"],
            "max_score":     15,
            "score_percent": _score_pct(debt_data["score"], 15),
            "tier":          _tier(debt_data["score"], 15),
            "metrics":       debt_data["metrics"],
            "rules":         debt_data["rules"],
            "explanation":   explanations["debt"],
        },
    ]

    calc_ms = round((time.monotonic() - t0) * 1000, 1)

    # ── Confidence, missingData, warnings ────────────────────────────────────
    sorted_h = sorted(history, key=lambda x: x.get("year", ""))
    _key_fields = ["revenue", "net_income", "net_margin", "free_cash_flow",
                   "total_debt", "stockholders_equity", "total_assets", "cash"]

    missing_data: list[str] = []
    for field in _key_fields:
        present = sum(1 for h in sorted_h if h.get(field) is not None)
        if present == 0:
            missing_data.append(field)

    warnings: list[str] = list(errors.values())

    total_fields = len(_key_fields)
    missing_count = len(missing_data)
    error_count = len(errors)

    if missing_count == 0 and error_count == 0 and len(history) >= 4:
        confidence = "HIGH"
    elif missing_count <= 2 and error_count <= 1:
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    result = {
        # ── Legacy fields (frontend uses these — do not rename or remove) ──
        "score":             round(total),
        "breakdown":         breakdown,
        "explanations":      explanations,
        "max_scores":        max_scores,
        # ── Reliability metadata (Part 2 spec) ───────────────────────────
        "confidence":        confidence,
        "missingData":       missing_data,
        "warnings":          warnings,
        "calculationSource": "deterministic",
        # ── Full audit breakdown ──────────────────────────────────────────
        "audit": {
            "total_score":  round(total),
            "categories":   categories,
            "calc_ms":      calc_ms,
        },
    }
    if errors:
        result["errors"] = errors
    return result
