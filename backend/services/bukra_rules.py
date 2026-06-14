"""
Python mirror of the TypeScript BukraRules.tsx logic.
Used by the scanner to evaluate rules server-side.
"""
import math


def compute_bukra_rules(financials: dict) -> dict:
    history = financials.get("history", [])

    # Filter and sort (mirror TS: filter revenue or NI not None, sort by year asc)
    valid = [h for h in history if h.get("revenue") is not None or h.get("net_income") is not None]
    sorted_h = sorted(valid, key=lambda x: x.get("year", ""))

    # Find latest with balance-sheet data (mirror TS latestWithDebt)
    latest = None
    for h in reversed(sorted_h):
        if h.get("total_debt") is not None or h.get("cash") is not None or h.get("stockholders_equity") is not None:
            latest = h
            break
    if latest is None and sorted_h:
        latest = sorted_h[-1]

    passed = 0
    unavailable = 0

    # ── 1. Revenue growth (≥60% of year-pairs must increase) ─────────────────
    revs = [h["revenue"] for h in sorted_h if h.get("revenue") is not None]
    if len(revs) < 2:
        unavailable += 1
    else:
        growing = sum(1 for i in range(1, len(revs)) if revs[i] > revs[i - 1])
        total = len(revs) - 1
        passed += 1 if growing >= math.ceil(total * 0.6) else 0
        if growing < math.ceil(total * 0.6):
            pass  # counted as fail (not unavailable)

    # ── 2. Net income growth (≥60% of year-pairs must increase) ──────────────
    nis = [h["net_income"] for h in sorted_h if h.get("net_income") is not None]
    if len(nis) < 2:
        unavailable += 1
    else:
        growing = sum(1 for i in range(1, len(nis)) if nis[i] > nis[i - 1])
        total = len(nis) - 1
        passed += 1 if growing >= math.ceil(total * 0.6) else 0

    # ── 3. Net margin ≥ 30% (avg of last 3 years) ────────────────────────────
    margins = [h["net_margin"] for h in sorted_h[-3:] if h.get("net_margin") is not None]
    if not margins:
        unavailable += 1
    else:
        avg = sum(margins) / len(margins)
        passed += 1 if avg >= 30 else 0

    # ── 4. Free cash flow positive (all years) ────────────────────────────────
    fcfs = [h["free_cash_flow"] for h in sorted_h if h.get("free_cash_flow") is not None]
    if not fcfs:
        unavailable += 1
    else:
        passed += 1 if all(f > 0 for f in fcfs) else 0

    # ── 5. Debt health ────────────────────────────────────────────────────────
    if latest is None:
        unavailable += 1
    else:
        debt  = latest.get("total_debt")
        cash  = latest.get("cash")
        equity = latest.get("stockholders_equity")
        if debt is None and cash is None:
            unavailable += 1
        elif debt is None:
            unavailable += 1
        else:
            rule_passed = False
            if equity is not None and equity > 0:
                de = debt / equity
                cash_ok = cash is not None and cash >= debt * 0.5
                rule_passed = de < 1.0 or cash_ok
            elif cash is not None:
                rule_passed = cash >= debt
            passed += 1 if rule_passed else 0

    available = 5 - unavailable
    ratio = passed / available if available > 0 else 0

    if available == 0:
        status = "no_data"
    elif passed == 5:
        status = "strong_candidate"
    elif ratio >= 0.75:
        status = "watchlist"
    elif ratio >= 0.5:
        status = "mixed"
    else:
        status = "avoid"

    return {
        "rules_passed": passed,
        "rules_available": available,
        "investment_status": status,
    }
