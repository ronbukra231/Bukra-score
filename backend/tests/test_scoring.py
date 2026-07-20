"""
Bukra Score — determinism and consistency tests.

Run with: cd backend && pytest tests/test_scoring.py -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.bukra_score import compute_bukra_score, _tier, _score_pct


# ── Shared fixtures ────────────────────────────────────────────────────────────

def _make_history(
    years=5,
    revenue_start=1_000,
    revenue_growth=0.15,
    net_income_start=250,
    net_income_growth=0.15,
    net_margin=25.0,
    fcf=300,
    total_assets=5_000,
    total_debt=500,
    cash=600,
    equity=3_000,
):
    """Build synthetic history list. All amounts in millions."""
    h = []
    rev = revenue_start
    ni  = net_income_start
    for i in range(years):
        year = str(2019 + i)
        h.append({
            "year":               year,
            "revenue":            round(rev, 2),
            "net_income":         round(ni, 2),
            "net_margin":         net_margin,
            "free_cash_flow":     fcf,
            "total_assets":       total_assets,
            "total_debt":         total_debt,
            "cash":               cash,
            "stockholders_equity": equity,
        })
        rev *= (1 + revenue_growth)
        ni  *= (1 + net_income_growth)
    return h


INFO_GOOD = {"returnOnEquity": 0.30}   # 30% ROE — strong
INFO_EMPTY = {}


# ── 1. Tier helper ─────────────────────────────────────────────────────────────

def test_tier_boundaries():
    assert _tier(85, 100) == "excellent"
    assert _tier(84, 100) == "strong"
    assert _tier(70, 100) == "strong"
    assert _tier(69, 100) == "moderate"
    assert _tier(50, 100) == "moderate"
    assert _tier(49, 100) == "weak"
    assert _tier(30, 100) == "weak"
    assert _tier(29, 100) == "poor"
    assert _tier(0,  100) == "poor"


def test_tier_max_score_zero():
    assert _tier(0, 0) == "poor"   # graceful — no division by zero


# ── 2. Safeguards ─────────────────────────────────────────────────────────────

def test_total_equals_sum_of_categories():
    """Invariant (weighted methodology): legacyScore equals the category sum;
    the displayed score is the weighted normalised total, 0-100."""
    h = _make_history()
    result = compute_bukra_score({"history": h}, INFO_GOOD)
    assert result["legacyScore"] == sum(result["breakdown"].values()), \
        f"legacy {result['legacyScore']} ≠ sum {sum(result['breakdown'].values())}"
    assert 0 <= result["score"] <= 100


def test_no_category_exceeds_max():
    """No category score may exceed its declared maximum."""
    h = _make_history()
    result = compute_bukra_score({"history": h}, INFO_GOOD)
    for key, val in result["breakdown"].items():
        max_val = result["max_scores"][key]
        assert val <= max_val, f"{key}: {val} > max {max_val}"
        assert val >= 0,       f"{key}: {val} < 0"


def test_audit_category_scores_match_breakdown():
    """audit.categories scores must match the top-level breakdown exactly."""
    h = _make_history()
    result = compute_bukra_score({"history": h}, INFO_GOOD)
    audit = result.get("audit")
    assert audit is not None, "audit key missing"
    for cat in audit["categories"]:
        key    = cat["key"]
        bd_key = key  # keys are the same
        assert cat["score"] == result["breakdown"].get(bd_key), \
            f"audit {key} score mismatch"


def test_audit_total_matches_score():
    h = _make_history()
    result = compute_bukra_score({"history": h}, INFO_GOOD)
    assert result["audit"]["total_score"] == result["score"]


# ── 3. Explanation tier consistency ───────────────────────────────────────────

def test_explanation_does_not_use_excellent_wording_for_low_score():
    """
    A category at moderate level must not produce an explanation containing
    premium tier words like 'מצוין' (excellent) or 'חזק מאוד' (very strong).
    """
    # Force poor stability: high debt ratio, low cash coverage
    h = _make_history(total_debt=4_500, total_assets=5_000, cash=100, equity=500)
    result = compute_bukra_score({"history": h}, INFO_EMPTY)
    stab_score = result["breakdown"]["stability"]
    stab_pct   = stab_score / 20 * 100
    stab_expl  = result["explanations"]["stability"]

    assert stab_pct < 70, f"expected low stability score, got {stab_score}/20"
    assert "מצוין" not in stab_expl, f"'מצוין' should not appear for moderate/weak: {stab_expl}"


def test_tier_in_audit_matches_score_percent():
    """Every audit category's tier must match what _tier() would return for that score."""
    h = _make_history()
    result = compute_bukra_score({"history": h}, INFO_GOOD)
    for cat in result["audit"]["categories"]:
        expected = _tier(cat["score"], cat["max_score"])
        assert cat["tier"] == expected, \
            f"{cat['key']}: tier={cat['tier']} but score {cat['score']}/{cat['max_score']} → expected {expected}"


def test_score_percent_in_audit_is_correct():
    h = _make_history()
    result = compute_bukra_score({"history": h}, INFO_GOOD)
    for cat in result["audit"]["categories"]:
        expected = round(cat["score"] / cat["max_score"] * 100, 1)
        assert cat["score_percent"] == expected, \
            f"{cat['key']}: score_percent={cat['score_percent']} expected {expected}"


# ── 4. Low debt → high debt-health score ─────────────────────────────────────

def test_zero_debt_receives_high_debt_and_stability_scores():
    """
    A company with zero debt throughout history scores 10/15 on debt health.

    Known formula behaviour: when debts[0] == 0, Python treats it as falsy so
    the trend component (`if debts[0] and debts[-1]`) gives 0 trend pts.
    D/E = 0/equity → < 0.3 → 10 pts; trend = 0 pts → total = 10.
    This is documented as a known limitation (no formula change without review).
    Stability cash-to-debt: no debt → 10 pts automatically.
    """
    h = _make_history(total_debt=0, cash=1_000, equity=4_000)
    result = compute_bukra_score({"history": h}, INFO_EMPTY)
    # D/E = 0 → 10 pts; trend skipped (debts[0] == 0 is falsy) → 0 pts → 10/15
    assert result["breakdown"]["debt"] == 10, \
        f"zero-debt company scored {result['breakdown']['debt']}/15 (expected 10)"
    # Stability: no debt → cash-to-debt component awards 10 pts automatically
    assert result["breakdown"]["stability"] >= 10, \
        f"zero-debt stability {result['breakdown']['stability']}/20"


def test_very_high_debt_reduces_debt_score():
    """A company with D/E >> 1.5 should score near the minimum on debt health."""
    h = _make_history(total_debt=9_000, equity=1_000, cash=100)
    result = compute_bukra_score({"history": h}, INFO_EMPTY)
    # D/E = 9.0 → 1 pt; trend: debt unchanged → 0 pts → total = 1
    assert result["breakdown"]["debt"] <= 4, \
        f"high-debt company scored too high: {result['breakdown']['debt']}/15"


# ── 5. Volatile FCF → no perfect stability score ─────────────────────────────

def test_all_negative_fcf_receives_low_cash_flow_score():
    """All negative FCF years must result in a low cash-flow score."""
    h = _make_history(fcf=-200)
    result = compute_bukra_score({"history": h}, INFO_EMPTY)
    cf_score = result["breakdown"]["cash_flow"]
    assert cf_score <= 4, \
        f"all-negative FCF company scored {cf_score}/20 — too high"


def test_mixed_fcf_does_not_score_perfect():
    """A company with only 3/5 positive FCF years must not score 20/20."""
    history = _make_history()
    # Make 2 years negative
    history[0]["free_cash_flow"] = -50
    history[2]["free_cash_flow"] = -50
    result = compute_bukra_score({"history": history}, INFO_EMPTY)
    assert result["breakdown"]["cash_flow"] < 20, \
        f"mixed FCF should not be perfect: {result['breakdown']['cash_flow']}/20"


# ── 6. Missing data → limited-data explanation ───────────────────────────────

def test_no_history_returns_none_score():
    result = compute_bukra_score({"history": []}, INFO_EMPTY)
    assert result["score"] is None
    assert "data" in result.get("errors", {})


def test_missing_debt_data_produces_partial_explanation():
    """When debt data is absent, explanation must acknowledge missing data."""
    h = _make_history()
    for row in h:
        row.pop("total_debt", None)
        row.pop("stockholders_equity", None)
    result = compute_bukra_score({"history": h}, INFO_EMPTY)
    debt_expl = result["explanations"]["debt"]
    assert any(word in debt_expl for word in ["חלקי", "אין נתונים", "חסרים", "נתונים"]), \
        f"debt explanation should mention missing data: {debt_expl}"


def test_missing_assets_partial_stability_explanation():
    """When assets are missing, stability explanation must acknowledge it."""
    h = _make_history()
    for row in h:
        row.pop("total_assets", None)
        row.pop("total_debt", None)
    result = compute_bukra_score({"history": h}, INFO_EMPTY)
    stab_expl = result["explanations"]["stability"]
    assert any(word in stab_expl for word in ["חלקי", "אין", "נתונים"]), \
        f"stability explanation should acknowledge missing data: {stab_expl}"


# ── 7. Audit structure completeness ───────────────────────────────────────────

def test_audit_has_required_fields():
    h = _make_history()
    result = compute_bukra_score({"history": h}, INFO_GOOD)
    audit = result["audit"]
    assert "total_score"  in audit
    assert "categories"   in audit
    assert len(audit["categories"]) == 5

    required_cat_fields = {"key", "label", "score", "max_score", "score_percent", "tier", "metrics", "rules", "explanation"}
    for cat in audit["categories"]:
        missing = required_cat_fields - set(cat.keys())
        assert not missing, f"category {cat.get('key')} missing fields: {missing}"

    for cat in audit["categories"]:
        for rule in cat["rules"]:
            assert "name"       in rule
            assert "value"      in rule
            assert "points"     in rule
            assert "max_points" in rule
            assert "reason"     in rule


def test_backward_compat_fields_present():
    """Legacy fields used by the frontend must always be present."""
    h = _make_history()
    result = compute_bukra_score({"history": h}, INFO_GOOD)
    assert "score"        in result
    assert "breakdown"    in result
    assert "explanations" in result
    assert "max_scores"   in result
    for key in ("growth", "profitability", "cash_flow", "stability", "debt"):
        assert key in result["breakdown"],    f"breakdown missing {key}"
        assert key in result["explanations"], f"explanations missing {key}"
        assert key in result["max_scores"],   f"max_scores missing {key}"
