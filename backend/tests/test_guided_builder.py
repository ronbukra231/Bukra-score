"""
Guided Portfolio Builder — one-recommendation-at-a-time engine and API.

Run: venv/bin/python -m pytest tests/test_guided_builder.py -q   (from backend/)
"""

import os
import sys
import time
import uuid
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-for-pytest")
os.environ.pop("SUPABASE_URL", None)

import jwt
import pytest
from fastapi.testclient import TestClient

import main
from services.simulator import service, recommendations as reco_engine
from services.simulator.store import _path

client = TestClient(main.app)


def make_token(user_id: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {"sub": user_id, "aud": "authenticated", "exp": now + 3600, "iat": now},
        os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256",
    )


def auth(user_id: str) -> dict:
    return {"Authorization": f"Bearer {make_token(user_id)}"}


@pytest.fixture
def user_id():
    uid = f"pytest-guided-{uuid.uuid4().hex[:10]}"
    yield uid
    try:
        os.remove(_path(uid))
    except FileNotFoundError:
        pass


@pytest.fixture(autouse=True)
def _clear_analysis_cache():
    # The short-lived in-process analysis cache must not leak state between
    # tests (it's keyed only by ticker+lang, and several tests reuse tickers).
    reco_engine._analysis_cache.clear()
    yield
    reco_engine._analysis_cache.clear()


def make_portfolio(user_id, capital=100000.0, risk="balanced"):
    return service.create_portfolio(user_id, name="Test", base_currency="USD",
                                    initial_capital=capital, risk_profile=risk,
                                    benchmark_symbol=None, lang="en")


def scanner(tickers_sectors_scores):
    return [{"ticker": t, "sector": s, "bukra_score": b} for t, s, b in tickers_sectors_scores]


SCANNER = scanner([("AAA", "Technology", 80), ("BBB", "Healthcare", 78), ("CCC", "Technology", 60)])


def _analysis(ticker, score, valuation_score, bubble_risk, confidence=70, base_per_share=120.0,
             price=100.0, future_relevance=None):
    return {
        "info": {"name": ticker, "sector": "Technology"},
        "score": {"score": score},
        "valuation": {
            "available": True, "valuationScore": valuation_score, "bubbleRisk": bubble_risk,
            "valuationConfidence": {"score": confidence, "label": "medium"},
            "currentPrice": price,
            "fairValueRange": {"bearPerShare": 80.0, "basePerShare": base_per_share, "bullPerShare": 160.0},
            "dataQuality": {"level": "sufficient"},
        },
        "futureRelevance": future_relevance,
    }


def _fake_analyze(overrides, failures=None):
    """Mirrors _analyze_ticker's real signature (ticker, lang, fail_log=...):
    `overrides` maps ticker -> analysis dict for successes; `failures` maps
    ticker -> a fail_log reason string to simulate a provider failure
    (as opposed to a plain missing-data None, which isn't logged)."""
    failures = failures or {}
    def _inner(ticker, lang, fail_log=None):
        if ticker in failures:
            if fail_log is not None:
                fail_log.append((ticker, failures[ticker]))
            return None
        return overrides.get(ticker)
    return _inner


# ── 1. Ranking picks Opportunity Score, not raw Bukra Score ─────────────────
def test_picks_highest_opportunity_score(user_id):
    make_portfolio(user_id)
    analyses = {
        "AAA": _analysis("AAA", score=80, valuation_score=30, bubble_risk=80, base_per_share=95.0),
        "BBB": _analysis("BBB", score=78, valuation_score=85, bubble_risk=10, base_per_share=180.0),
    }
    with patch("services.simulator.recommendations._scanner_universe", return_value=SCANNER[:2]), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)):
        rec, reason = service.generate_guided_recommendation(user_id, lang="en")
    assert rec is not None and reason is None
    assert rec["ticker"] == "BBB"
    assert rec["metadata"]["guided"] is True
    assert 0 <= rec["metadata"]["opportunityScore"] <= 100


# ── 2. Never recommends the same ticker twice in one guided session ─────────
def test_excludes_tickers_already_shown(user_id):
    make_portfolio(user_id)
    analyses = {
        "AAA": _analysis("AAA", score=80, valuation_score=70, bubble_risk=20),
        "BBB": _analysis("BBB", score=78, valuation_score=68, bubble_risk=25),
    }
    with patch("services.simulator.recommendations._scanner_universe", return_value=SCANNER[:2]), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)):
        first, _ = service.generate_guided_recommendation(user_id, lang="en")
        second, _ = service.generate_guided_recommendation(user_id, exclude_tickers=[first["ticker"]], lang="en")
    assert second is not None
    assert second["ticker"] != first["ticker"]


# ── No duplicate recommendation across a longer session (3 picks in a row) ──
def test_no_duplicate_recommendation_within_build_session(user_id):
    make_portfolio(user_id, capital=1_000_000)
    universe = scanner([("AAA", "Technology", 90), ("BBB", "Healthcare", 88), ("CCC", "Energy", 86)])
    analyses = {
        "AAA": _analysis("AAA", score=90, valuation_score=70, bubble_risk=20),
        "BBB": _analysis("BBB", score=88, valuation_score=68, bubble_risk=22),
        "CCC": _analysis("CCC", score=86, valuation_score=66, bubble_risk=24),
    }
    seen = []
    excluded = []
    with patch("services.simulator.recommendations._scanner_universe", return_value=universe), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)):
        for _ in range(3):
            rec, _reason = service.generate_guided_recommendation(user_id, exclude_tickers=excluded, lang="en")
            assert rec is not None
            assert rec["ticker"] not in seen
            seen.append(rec["ticker"])
            excluded.append(rec["ticker"])
    assert len(set(seen)) == 3


# ── 3. Nothing clears the quality bar → intentionally leaves cash uninvested ─
def test_no_qualifying_candidate_returns_none(user_id):
    make_portfolio(user_id)
    analyses = {"AAA": _analysis("AAA", score=80, valuation_score=5, bubble_risk=95)}
    with patch("services.simulator.recommendations._scanner_universe", return_value=SCANNER[:1]), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)):
        rec, reason = service.generate_guided_recommendation(user_id, lang="en")
    assert rec is None
    assert reason == "no_candidate_passed_quality_gates"


# ── 4. Empty scanner universe never crashes, just returns None ──────────────
def test_empty_universe_returns_none(user_id):
    make_portfolio(user_id)
    with patch("services.simulator.recommendations._scanner_universe", return_value=[]):
        rec, reason = service.generate_guided_recommendation(user_id, lang="en")
    assert rec is None
    assert reason == "no_candidate_passed_cached_threshold"


# ── 5. Allocation sizing respects the 3-10% guardrails from the opportunity score ─
def test_position_sizing_tiers():
    assert reco_engine._guided_position_pct(40) == pytest.approx(0.03 + (40 / 85) * 0.03, abs=1e-4)
    assert 0.03 <= reco_engine._guided_position_pct(0) <= 0.06
    assert reco_engine._guided_position_pct(85) == 0.08
    assert reco_engine._guided_position_pct(92) == 0.10
    assert reco_engine._guided_position_pct(100) == 0.10


# ── 6. API: /builder/next returns a recommendation, then a reasoned {"done": true} ─
def test_builder_next_endpoint(user_id):
    make_portfolio(user_id)
    analyses = {"AAA": _analysis("AAA", score=80, valuation_score=70, bubble_risk=20)}
    with patch("services.simulator.recommendations._scanner_universe", return_value=SCANNER[:1]), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)):
        res = client.post("/api/simulator/builder/next?lang=en", headers=auth(user_id), json={"excludeTickers": []})
        assert res.status_code == 200
        body = res.json()
        assert body["ticker"] == "AAA"

        res2 = client.post("/api/simulator/builder/next?lang=en", headers=auth(user_id),
                           json={"excludeTickers": ["AAA"]})
        assert res2.status_code == 200
        assert res2.json() == {"done": True, "reason": "no_opportunities"}


# ── 7. Investing then asking for "next" excludes the now-held ticker ────────
def test_invest_then_next_excludes_held_ticker(user_id):
    make_portfolio(user_id, capital=100000)
    analyses = {
        "AAA": _analysis("AAA", score=80, valuation_score=70, bubble_risk=20, price=50.0),
        "BBB": _analysis("BBB", score=75, valuation_score=65, bubble_risk=25, price=60.0),
    }
    with patch("services.simulator.recommendations._scanner_universe", return_value=SCANNER[:2]), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)), \
         patch("services.simulator.pricing.get_company_info", return_value={"symbol": "AAA", "name": "AAA",
               "sector": "Technology", "price": 50.0, "currency": "USD", "market_cap": 1e9}):
        rec, _ = service.generate_guided_recommendation(user_id, lang="en")
        assert rec["ticker"] in ("AAA", "BBB")
        result = service.approve_recommendation(user_id, rec["id"], True, lang="en")
        assert result["recommendation"]["recommendationStatus"] == "SIMULATED_EXECUTED"

        nxt, _ = service.generate_guided_recommendation(user_id, lang="en")
        assert nxt is None or nxt["ticker"] != rec["ticker"]


# ── FIX 1: top-ranked candidate sizes too small → falls through to the next ─
def test_top_ranked_below_min_trade_size_falls_through_to_second(user_id):
    # AAA (Technology) already near the sector cap for 'balanced' (30%) —
    # its remaining room is tiny, so even though it has the highest
    # Opportunity Score its position collapses below the $500 floor. BBB
    # (Healthcare) is unconstrained and should be returned instead.
    portfolio = make_portfolio(user_id, capital=100000, risk="balanced")
    from services.simulator.store import UserPortfolioLock
    with UserPortfolioLock(user_id) as state:
        state["holdings"]["h1"] = {
            "id": "h1", "portfolioId": portfolio["id"], "companyId": "ZZZ", "ticker": "ZZZ",
            "quantity": 100, "averageCost": 298.0, "totalCostBasis": 29800.0, "currentPrice": 298.0,
            "currentMarketValue": 29800.0, "unrealizedGainLoss": 0.0, "unrealizedGainLossPercent": 0.0,
            "realizedGainLoss": 0.0, "portfolioWeight": 0.298, "tradingCurrency": "USD", "sector": "Technology",
            "openedAt": "2024-01-01T00:00:00+00:00", "updatedAt": "2024-01-01T00:00:00+00:00",
            "reasonForHolding": "test fixture", "closedAt": None, "status": "open",
        }
        # Keep the books consistent: buying ZZZ must have come out of cash,
        # so currentValue stays 100000 (cash 70200 + ZZZ 29800) and ZZZ's
        # sector weight stays ~0.298, as the test's sizing math assumes.
        state["portfolio"]["currentCash"] = 70200.0
        state["portfolio"]["currentValue"] = 100000.0

    universe = scanner([("AAA", "Technology", 95), ("BBB", "Healthcare", 80)])
    analyses = {
        "AAA": _analysis("AAA", score=95, valuation_score=90, bubble_risk=10, base_per_share=200.0),
        "BBB": _analysis("BBB", score=80, valuation_score=70, bubble_risk=20, base_per_share=140.0),
    }
    with patch("services.simulator.recommendations._scanner_universe", return_value=universe), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)), \
         patch("services.simulator.pricing.get_quote", return_value={"price": 298.0, "currency": "USD",
               "asOf": "2024-01-01T00:00:00Z", "stale": False}):
        rec, reason = service.generate_guided_recommendation(user_id, lang="en")
    assert rec is not None and reason is None
    assert rec["ticker"] == "BBB"


# ── FIX 1: several consecutive sizing failures before a valid candidate ─────
def test_multiple_consecutive_sizing_failures_then_valid_candidate(user_id):
    portfolio = make_portfolio(user_id, capital=100000, risk="balanced")
    from services.simulator.store import UserPortfolioLock
    with UserPortfolioLock(user_id) as state:
        state["holdings"]["h1"] = {
            "id": "h1", "portfolioId": portfolio["id"], "companyId": "ZZZ", "ticker": "ZZZ",
            "quantity": 100, "averageCost": 298.0, "totalCostBasis": 29800.0, "currentPrice": 298.0,
            "currentMarketValue": 29800.0, "unrealizedGainLoss": 0.0, "unrealizedGainLossPercent": 0.0,
            "realizedGainLoss": 0.0, "portfolioWeight": 0.298, "tradingCurrency": "USD", "sector": "Technology",
            "openedAt": "2024-01-01T00:00:00+00:00", "updatedAt": "2024-01-01T00:00:00+00:00",
            "reasonForHolding": "test fixture", "closedAt": None, "status": "open",
        }
        state["portfolio"]["currentCash"] = 70200.0
        state["portfolio"]["currentValue"] = 100000.0

    # AAA/CCC/DDD all Technology (sector-capped, will size below $500);
    # BBB is Healthcare (unconstrained) and should win despite ranking 4th.
    universe = scanner([("AAA", "Technology", 96), ("CCC", "Technology", 94),
                        ("DDD", "Technology", 92), ("BBB", "Healthcare", 80)])
    analyses = {
        "AAA": _analysis("AAA", score=96, valuation_score=90, bubble_risk=10, base_per_share=200.0),
        "CCC": _analysis("CCC", score=94, valuation_score=88, bubble_risk=12, base_per_share=190.0),
        "DDD": _analysis("DDD", score=92, valuation_score=86, bubble_risk=14, base_per_share=180.0),
        "BBB": _analysis("BBB", score=80, valuation_score=70, bubble_risk=20, base_per_share=140.0),
    }
    with patch("services.simulator.recommendations._scanner_universe", return_value=universe), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)), \
         patch("services.simulator.pricing.get_quote", return_value={"price": 298.0, "currency": "USD",
               "asOf": "2024-01-01T00:00:00Z", "stale": False}):
        rec, reason = service.generate_guided_recommendation(user_id, lang="en")
    assert rec is not None and reason is None
    assert rec["ticker"] == "BBB"


# ── FIX 2: many provider failures at the front of the pool, valid candidate later ─
def test_provider_failures_early_in_pool_valid_candidate_later(user_id):
    make_portfolio(user_id, capital=100000)
    failing = [f"FAIL{i}" for i in range(15)]
    universe = scanner([(t, "Technology", 90 - i) for i, t in enumerate(failing)] + [("WIN", "Healthcare", 60)])
    failures = {t: "provider_unavailable" for t in failing}
    analyses = {"WIN": _analysis("WIN", score=60, valuation_score=65, bubble_risk=20)}
    with patch("services.simulator.recommendations._scanner_universe", return_value=universe), \
         patch("services.simulator.recommendations._analyze_ticker",
              side_effect=_fake_analyze(analyses, failures=failures)):
        rec, reason = service.generate_guided_recommendation(user_id, lang="en")
    assert rec is not None and reason is None
    assert rec["ticker"] == "WIN"


# ── FIX 2/3: partial failure — mix of provider failures, permanent data gaps, and successes ─
def test_partial_provider_failure_diagnostics(user_id):
    make_portfolio(user_id, capital=100000)
    universe = scanner([("PFAIL", "Technology", 90), ("NODATA", "Technology", 88), ("OK", "Healthcare", 80)])
    analyses = {"OK": _analysis("OK", score=80, valuation_score=70, bubble_risk=20)}
    # PFAIL -> provider failure (logged); NODATA -> permanent gap (returns
    # None with no failures entry, e.g. no financial history at all).
    failures = {"PFAIL": "timeout"}

    def _inner(ticker, lang, fail_log=None):
        if ticker in failures:
            if fail_log is not None:
                fail_log.append((ticker, failures[ticker]))
            return None
        if ticker == "NODATA":
            return None
        return analyses.get(ticker)

    from services.simulator.store import UserPortfolioLock
    with patch("services.simulator.recommendations._scanner_universe", return_value=universe), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_inner):
        with UserPortfolioLock(user_id) as state:
            rec, diag = reco_engine.generate_guided_candidate(state, lang="en")
    assert rec is not None
    assert rec["ticker"] == "OK"
    assert diag["liveAttempted"] == 3
    assert len(diag["providerFailures"]) == 1
    assert diag["providerFailures"][0]["ticker"] == "PFAIL"


# ── FIX 3: full provider outage → distinct "temporary" reason, not "no opportunities" ─
def test_full_provider_outage_returns_temporary_reason(user_id):
    make_portfolio(user_id, capital=100000)
    universe = scanner([("AAA", "Technology", 90), ("BBB", "Healthcare", 88), ("CCC", "Energy", 86)])
    failures = {t["ticker"]: "timeout" for t in universe}
    with patch("services.simulator.recommendations._scanner_universe", return_value=universe), \
         patch("services.simulator.recommendations._analyze_ticker",
              side_effect=_fake_analyze({}, failures=failures)):
        rec, reason = service.generate_guided_recommendation(user_id, lang="en")
    assert rec is None
    assert reason == "provider_degraded"

    with patch("services.simulator.recommendations._scanner_universe", return_value=universe), \
         patch("services.simulator.recommendations._analyze_ticker",
              side_effect=_fake_analyze({}, failures=failures)):
        res = client.post("/api/simulator/builder/next?lang=en", headers=auth(user_id), json={"excludeTickers": []})
    assert res.status_code == 200
    assert res.json() == {"done": True, "reason": "temporary_data_unavailable"}


# ── FIX 4: Future Relevance present is used as a real weighted component ────
def test_opportunity_score_uses_future_relevance_when_available():
    state = {"portfolio": {"currentValue": 100000.0}, "holdings": {}}
    analysis = _analysis("AAA", score=80, valuation_score=70, bubble_risk=20,
                         future_relevance={"score": 90, "confidence": {"score": 80}})
    opp, meta = reco_engine._opportunity_score(analysis, "Technology", state)
    assert meta["futureRelevanceAvailable"] is True
    assert meta["weights"]["future_relevance"] == pytest.approx(0.15)
    assert sum(meta["weights"].values()) == pytest.approx(1.0, abs=1e-6)

    # A materially higher Future Relevance score should raise the Opportunity
    # Score, all else equal.
    analysis_low_fr = _analysis("AAA", score=80, valuation_score=70, bubble_risk=20,
                                future_relevance={"score": 10, "confidence": {"score": 80}})
    opp_low, _ = reco_engine._opportunity_score(analysis_low_fr, "Technology", state)
    assert opp > opp_low


# ── FIX 4: Future Relevance missing → weight normalized, never invented ─────
def test_opportunity_score_normalizes_weights_when_future_relevance_missing():
    state = {"portfolio": {"currentValue": 100000.0}, "holdings": {}}
    analysis = _analysis("AAA", score=80, valuation_score=70, bubble_risk=20, future_relevance=None)
    opp, meta = reco_engine._opportunity_score(analysis, "Technology", state)
    assert meta["futureRelevanceAvailable"] is False
    assert "future_relevance" not in meta["weights"]
    # The 0.15 that future_relevance would have carried is redistributed —
    # the remaining weights must still sum to 1.0, not silently lost.
    assert sum(meta["weights"].values()) == pytest.approx(1.0, abs=1e-6)
    for k, base_w in reco_engine._OPPORTUNITY_WEIGHTS.items():
        if k == "future_relevance":
            continue
        assert meta["weights"][k] > base_w   # every remaining weight grew


# ── FIX 5: done=true only after the full eligible pool has been tried ───────
def test_done_only_after_full_pool_exhaustion(user_id):
    make_portfolio(user_id)
    universe = scanner([("AAA", "Technology", 90), ("BBB", "Healthcare", 85), ("CCC", "Energy", 80)])
    # All three fail the same quality gate (poor valuation) — a real,
    # deterministic rejection, not a provider problem.
    analyses = {
        "AAA": _analysis("AAA", score=90, valuation_score=5, bubble_risk=20),
        "BBB": _analysis("BBB", score=85, valuation_score=5, bubble_risk=20),
        "CCC": _analysis("CCC", score=80, valuation_score=5, bubble_risk=20),
    }
    with patch("services.simulator.recommendations._scanner_universe", return_value=universe), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)):
        from services.simulator.store import UserPortfolioLock
        with UserPortfolioLock(user_id) as state:
            rec, diag = reco_engine.generate_guided_candidate(state, lang="en")
    assert rec is None
    assert diag["liveAttempted"] == 3   # every eligible candidate was actually tried
    assert diag["rejectedByGate"].get("valuation_score") == 3
    assert diag["doneReason"] == "no_candidate_passed_quality_gates"


# ── FIX 2: configured pool size is honored, not hard-capped at 15 ───────────
def test_pool_size_uses_full_configured_limit(user_id):
    make_portfolio(user_id, capital=100000)
    from services.simulator.config import RECOMMENDATION_RULES
    pool_cap = RECOMMENDATION_RULES["add_candidate_pool_size"]
    assert pool_cap > 15   # sanity: the configured pool really is bigger than the old hard cap

    # 20 candidates, all failing the same gate — forces a full scan past 15.
    universe = scanner([(f"T{i}", "Technology", 90 - i) for i in range(20)])
    analyses = {f"T{i}": _analysis(f"T{i}", score=90 - i, valuation_score=5, bubble_risk=20) for i in range(20)}
    with patch("services.simulator.recommendations._scanner_universe", return_value=universe), \
         patch("services.simulator.recommendations._analyze_ticker", side_effect=_fake_analyze(analyses)):
        from services.simulator.store import UserPortfolioLock
        with UserPortfolioLock(user_id) as state:
            rec, diag = reco_engine.generate_guided_candidate(state, lang="en")
    assert rec is None
    assert diag["liveAttempted"] == 20   # all 20 were attempted, not capped at 15


# ── Provider layer: retry-then-succeed on a transient failure ───────────────
def test_analyze_ticker_retries_transient_failure_then_succeeds():
    calls = {"n": 0}

    def _flaky(ticker, lang):
        calls["n"] += 1
        if calls["n"] == 1:
            raise reco_engine._ProviderUnavailable("transient")
        return {"info": {"name": ticker}, "score": {"score": 70},
               "valuation": {"available": True}, "futureRelevance": None}

    with patch("services.simulator.recommendations._fetch_analysis", side_effect=_flaky), \
         patch.object(reco_engine, "_PROVIDER_RETRY_BACKOFF_S", 0.01):
        result = reco_engine._analyze_ticker("XYZ", "en")
    assert result is not None
    assert calls["n"] == 2   # failed once, retried once, succeeded


# ── Provider layer: exhausts retries and records the failure ────────────────
def test_analyze_ticker_gives_up_after_retries_and_logs():
    def _always_fails(ticker, lang):
        raise reco_engine._ProviderUnavailable("still down")

    fail_log = []
    with patch("services.simulator.recommendations._fetch_analysis", side_effect=_always_fails), \
         patch.object(reco_engine, "_PROVIDER_RETRY_BACKOFF_S", 0.01):
        result = reco_engine._analyze_ticker("XYZ", "en", fail_log=fail_log)
    assert result is None
    assert fail_log == [("XYZ", "provider_unavailable")]


# ── Provider layer: a hung call is bounded by the timeout ───────────────────
def test_analyze_ticker_timeout_is_bounded():
    def _hangs(ticker, lang):
        time.sleep(0.5)
        return {"info": {"name": ticker}, "score": {"score": 70},
               "valuation": {"available": True}, "futureRelevance": None}

    fail_log = []
    with patch("services.simulator.recommendations._fetch_analysis", side_effect=_hangs), \
         patch.object(reco_engine, "_PROVIDER_TIMEOUT_S", 0.05), \
         patch.object(reco_engine, "_PROVIDER_MAX_RETRIES", 0):
        started = time.monotonic()
        result = reco_engine._analyze_ticker("XYZ", "en", fail_log=fail_log)
        elapsed = time.monotonic() - started
    assert result is None
    assert fail_log == [("XYZ", "timeout")]
    assert elapsed < 0.5   # bounded by the timeout, not the hang duration


# ── Provider layer: successful results are cached for a short TTL ───────────
def test_analyze_ticker_caches_successful_result():
    calls = {"n": 0}

    def _count(ticker, lang):
        calls["n"] += 1
        return {"info": {"name": ticker}, "score": {"score": 70},
               "valuation": {"available": True}, "futureRelevance": None}

    with patch("services.simulator.recommendations._fetch_analysis", side_effect=_count):
        first = reco_engine._analyze_ticker("XYZ", "en")
        second = reco_engine._analyze_ticker("XYZ", "en")
    assert first == second
    assert calls["n"] == 1   # second call served from cache, not re-fetched
