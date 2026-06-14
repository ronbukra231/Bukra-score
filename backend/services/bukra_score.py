"""
Bukra Score — 0 to 100.

Categories (each computed independently — a missing metric never crashes the rest):
  Consistent Growth     25 pts
  Profitability         20 pts
  Cash Flow             20 pts
  Financial Stability   20 pts
  Debt Health           15 pts
"""

from typing import Optional


def _cagr(start: float, end: float, years: int) -> Optional[float]:
    if not start or not end or years <= 0 or start <= 0 or end <= 0:
        return None
    try:
        return (end / start) ** (1 / years) - 1
    except Exception:
        return None


def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


def _safe(fn):
    """Run fn(), return (result, None) or (0, error_str) on any exception."""
    try:
        return fn(), None
    except Exception as e:
        return 0, str(e)


def _vals(history: list, key: str) -> list:
    """Non-None values for a key from history, oldest→newest."""
    rows = sorted(history, key=lambda x: x.get("year", ""))
    return [h[key] for h in rows if h.get(key) is not None]


def compute_bukra_score(financials: dict, info: dict) -> dict:
    history = financials.get("history", [])
    breakdown: dict[str, int] = {}
    explanations: dict[str, str] = {}
    errors: dict[str, str] = {}
    max_scores = {"growth": 25, "profitability": 20, "cash_flow": 20, "stability": 20, "debt": 15}

    if not history:
        return {"score": None, "breakdown": {}, "explanations": {}, "max_scores": max_scores, "errors": {"data": "אין נתונים פיננסיים"}}

    # ── 1. Consistent Growth (25 pts) ─────────────────────────────────────────
    def _growth():
        revenues   = _vals(history, "revenue")
        net_incomes = _vals(history, "net_income")
        score = 0
        rev_cagr = None

        if len(revenues) >= 2:
            rev_cagr = _cagr(revenues[0], revenues[-1], len(revenues) - 1)
            if rev_cagr is not None:
                if rev_cagr >= 0.15:  score += 15
                elif rev_cagr >= 0.10: score += 12
                elif rev_cagr >= 0.05: score += 8
                elif rev_cagr >= 0:    score += 4

        if len(net_incomes) >= 2:
            growing = sum(1 for i in range(1, len(net_incomes)) if net_incomes[i] > net_incomes[i-1])
            ni_ratio = growing / (len(net_incomes) - 1)
            score += round(10 * ni_ratio)

        explanations["growth"] = _growth_explanation(rev_cagr, net_incomes)
        return _clamp(score, 0, 25)

    val, err = _safe(_growth)
    breakdown["growth"] = int(val)
    if err: errors["growth"] = err

    # ── 2. Profitability (20 pts) ──────────────────────────────────────────────
    def _profitability():
        margins = _vals(history, "net_margin")
        roe = info.get("returnOnEquity")
        score = 0
        avg_margin = None

        if margins:
            avg_margin = sum(margins) / len(margins)
            if avg_margin >= 25:   score += 12
            elif avg_margin >= 15: score += 9
            elif avg_margin >= 8:  score += 6
            elif avg_margin >= 0:  score += 3

        if roe is not None:
            try:
                roe_pct = float(roe) * 100
                if roe_pct >= 20:   score += 8
                elif roe_pct >= 15: score += 6
                elif roe_pct >= 10: score += 4
                elif roe_pct >= 0:  score += 2
            except (TypeError, ValueError):
                pass

        explanations["profitability"] = _profitability_explanation(avg_margin, roe)
        return _clamp(score, 0, 20)

    val, err = _safe(_profitability)
    breakdown["profitability"] = int(val)
    if err: errors["profitability"] = err

    # ── 3. Cash Flow (20 pts) ─────────────────────────────────────────────────
    def _cash_flow():
        fcfs     = _vals(history, "free_cash_flow")
        revenues = _vals(history, "revenue")
        score = 0

        if fcfs:
            positive = sum(1 for f in fcfs if f > 0)
            score += round(12 * positive / len(fcfs))

            latest_rev = revenues[-1] if revenues else None
            latest_fcf = fcfs[-1]
            if latest_rev and latest_rev > 0:
                fcf_margin = latest_fcf / latest_rev * 100
                if fcf_margin >= 15:   score += 8
                elif fcf_margin >= 8:  score += 5
                elif fcf_margin >= 0:  score += 2

        explanations["cash_flow"] = _cashflow_explanation(fcfs, revenues)
        return _clamp(score, 0, 20)

    val, err = _safe(_cash_flow)
    breakdown["cash_flow"] = int(val)
    if err: errors["cash_flow"] = err

    # ── 4. Financial Stability (20 pts) ──────────────────────────────────────
    def _stability():
        assets  = _vals(history, "total_assets")
        debts   = _vals(history, "total_debt")
        cashes  = _vals(history, "cash")
        score = 0

        if assets and debts:
            ratio = debts[-1] / assets[-1]
            if ratio < 0.2:   score += 10
            elif ratio < 0.4: score += 7
            elif ratio < 0.6: score += 4
            else:              score += 1

        if cashes and debts and debts[-1] > 0:
            c2d = cashes[-1] / debts[-1]
            if c2d >= 1.0:    score += 10
            elif c2d >= 0.5:  score += 6
            elif c2d >= 0.25: score += 3
        elif cashes and debts and debts[-1] == 0:
            score += 10  # no debt at all

        explanations["stability"] = _stability_explanation(assets, debts, cashes)
        return _clamp(score, 0, 20)

    val, err = _safe(_stability)
    breakdown["stability"] = int(val)
    if err: errors["stability"] = err

    # ── 5. Debt Health (15 pts) ───────────────────────────────────────────────
    def _debt():
        debts   = _vals(history, "total_debt")
        equities = _vals(history, "stockholders_equity")
        score = 0

        if debts and equities and equities[-1] and equities[-1] > 0:
            de = debts[-1] / equities[-1]
            if de < 0.3:   score += 10
            elif de < 0.7: score += 7
            elif de < 1.5: score += 4
            else:           score += 1

        if len(debts) >= 2 and debts[0] and debts[-1]:
            if debts[-1] < debts[0]:
                score += 5
            elif debts[-1] < debts[0] * 1.2:
                score += 2

        explanations["debt"] = _debt_explanation(debts, equities)
        return _clamp(score, 0, 15)

    val, err = _safe(_debt)
    breakdown["debt"] = int(val)
    if err: errors["debt"] = err

    total = sum(breakdown.values())
    return {
        "score": round(total),
        "breakdown": breakdown,
        "explanations": explanations,
        "max_scores": max_scores,
        **({"errors": errors} if errors else {}),
    }


# ── Explanation helpers ────────────────────────────────────────────────────────

def _growth_explanation(rev_cagr, net_incomes):
    if rev_cagr is None:
        return "אין מספיק נתוני הכנסות לחישוב צמיחה."
    pct = round(rev_cagr * 100, 1)
    if pct >= 15:  return f"ההכנסות צמחו בממוצע {pct}% בשנה — צמיחה חזקה מאוד."
    elif pct >= 5: return f"ההכנסות צמחו בממוצע {pct}% בשנה — צמיחה יציבה."
    elif pct >= 0: return f"ההכנסות צמחו לאט ({pct}% בשנה) — צמיחה מתונה."
    else:          return f"ההכנסות ירדו בממוצע {abs(pct)}% בשנה — מגמה שלילית."


def _profitability_explanation(avg_margin, roe):
    parts = []
    if avg_margin is not None:
        m = round(avg_margin, 1)
        if m >= 20:   parts.append(f"שולי רווח ממוצעים גבוהים מאוד: {m}%")
        elif m >= 10: parts.append(f"שולי רווח ממוצעים סבירים: {m}%")
        elif m >= 0:  parts.append(f"שולי רווח נמוכים: {m}%")
        else:         parts.append(f"החברה הפסידה בממוצע ({m}% שולי רווח)")
    if roe is not None:
        try:
            r = round(float(roe) * 100, 1)
            parts.append(f"תשואה על ההון (ROE): {r}%")
        except (TypeError, ValueError):
            pass
    return " | ".join(parts) if parts else "אין נתוני רווחיות."


def _cashflow_explanation(fcfs, revenues):
    if not fcfs:
        return "אין נתוני תזרים מזומנים."
    positive = sum(1 for f in fcfs if f > 0)
    total = len(fcfs)
    if positive == total:   return f"תזרים מזומנים חיובי בכל {total} השנים — סימן בריאות מצוין."
    elif positive >= total * 0.7: return f"תזרים חיובי ב-{positive} מתוך {total} שנים — טוב."
    else:                   return f"תזרים חיובי רק ב-{positive} מתוך {total} שנים — דורש בדיקה."


def _stability_explanation(assets, debts, cashes):
    if not assets or not debts:
        return "אין נתוני יציבות פיננסית."
    try:
        ratio = round(debts[-1] / assets[-1] * 100, 1)
        if ratio < 20:   return f"החוב מהווה רק {ratio}% מהנכסים — חברה יציבה מאוד."
        elif ratio < 40: return f"החוב מהווה {ratio}% מהנכסים — יציבות סבירה."
        else:            return f"החוב מהווה {ratio}% מהנכסים — מינוף גבוה."
    except (TypeError, ZeroDivisionError):
        return "נתונים חלקיים."


def _debt_explanation(debts, equities):
    if not debts or not equities:
        return "אין נתוני חוב."
    try:
        if equities[-1] and equities[-1] > 0:
            de = round(debts[-1] / equities[-1], 2)
            if de < 0.3:   return f"יחס חוב להון נמוך מאוד ({de}) — חברה עם מינוף נמוך."
            elif de < 1.0: return f"יחס חוב להון מתון ({de}) — בטוח."
            else:          return f"יחס חוב להון גבוה ({de}) — שימו לב."
    except (TypeError, ZeroDivisionError):
        pass
    return "נתוני הון חסרים."
