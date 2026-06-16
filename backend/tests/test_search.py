"""
Search + safe-helpers tests.

Run with: cd backend && pytest tests/test_search.py -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.yahoo_finance import search_companies, _HEBREW_ALIASES
from services.bukra_score import _safe_number, _safe_divide, _average_available


# ── Hebrew alias resolution ────────────────────────────────────────────────────

def test_hebrew_alias_tsla():
    results = search_companies("טסלה")
    assert results
    assert results[0]["symbol"] == "TSLA"

def test_hebrew_alias_aapl():
    results = search_companies("אפל")
    assert results
    assert results[0]["symbol"] == "AAPL"

def test_hebrew_alias_nvda():
    results = search_companies("אנבידיה")
    assert results
    assert results[0]["symbol"] == "NVDA"

def test_hebrew_alias_meta_facebook():
    assert search_companies("פייסבוק")[0]["symbol"] == "META"
    assert search_companies("מטא")[0]["symbol"] == "META"

def test_hebrew_alias_googl():
    assert search_companies("גוגל")[0]["symbol"] == "GOOGL"
    assert search_companies("אלפבית")[0]["symbol"] == "GOOGL"

def test_all_aliases_resolve_to_known_symbols():
    for he, sym in _HEBREW_ALIASES.items():
        results = search_companies(he)
        assert results, f"No results for Hebrew alias '{he}'"
        assert results[0]["symbol"] == sym, f"'{he}' resolved to {results[0]['symbol']}, expected {sym}"

def test_english_ticker_still_works():
    results = search_companies("AAPL")
    assert results
    assert results[0]["symbol"] == "AAPL"

def test_unknown_query_returns_something():
    results = search_companies("XYZ999")
    assert isinstance(results, list)
    assert len(results) > 0

# ── Fuzzy / partial name search ───────────────────────────────────────────────

def test_partial_tes_suggests_tesla():
    results = search_companies("tes")
    assert results
    assert results[0]["symbol"] == "TSLA", f"Expected TSLA, got {results[0]['symbol']}"

def test_name_tesla_resolves():
    results = search_companies("tesla")
    assert results[0]["symbol"] == "TSLA"

def test_typo_tezla_resolves():
    results = search_companies("tezla")
    assert results[0]["symbol"] == "TSLA"

def test_name_apple_resolves():
    results = search_companies("apple")
    assert results[0]["symbol"] == "AAPL"

def test_typo_appl_resolves():
    results = search_companies("appl")
    syms = [r["symbol"] for r in results]
    assert "AAPL" in syms

def test_name_airbnb_resolves():
    results = search_companies("airbnb")
    assert results[0]["symbol"] == "ABNB"

def test_space_air_bnb_resolves():
    results = search_companies("air bnb")
    assert results[0]["symbol"] == "ABNB"

def test_typo_airnb_resolves():
    results = search_companies("airnb")
    assert results[0]["symbol"] == "ABNB"

def test_name_nvidia_resolves():
    results = search_companies("nvidia")
    assert results[0]["symbol"] == "NVDA"

def test_typo_nvida_resolves():
    results = search_companies("nvida")
    assert results[0]["symbol"] == "NVDA"

def test_name_netflix_resolves():
    results = search_companies("netflix")
    assert results[0]["symbol"] == "NFLX"

def test_typo_netfix_resolves():
    results = search_companies("netfix")
    assert results[0]["symbol"] == "NFLX"

def test_name_google_resolves():
    results = search_companies("google")
    assert results[0]["symbol"] in ("GOOGL", "GOOG")

def test_multiple_results_for_ambiguous_query():
    """'apple' should return at least 1 result; ambiguous short queries may return more."""
    results = search_companies("apple")
    assert len(results) >= 1

def test_cintas_ctas_resolves():
    results = search_companies("cintas")
    assert results[0]["symbol"] == "CTAS"

def test_berkshire_resolves():
    results = search_companies("berkshire")
    assert results[0]["symbol"] == "BRK-B"

def test_hebrew_nvida_alias():
    results = search_companies("נבידיה")
    assert results[0]["symbol"] == "NVDA"


# ── Safe math helpers ─────────────────────────────────────────────────────────

def test_safe_number_none():
    assert _safe_number(None) is None

def test_safe_number_nan():
    assert _safe_number(float('nan')) is None

def test_safe_number_inf():
    assert _safe_number(float('inf')) is None

def test_safe_number_valid():
    assert _safe_number("3.14") == 3.14
    assert _safe_number(42) == 42.0

def test_safe_divide_by_zero():
    assert _safe_divide(10, 0) is None

def test_safe_divide_none_inputs():
    assert _safe_divide(None, 5) is None
    assert _safe_divide(5, None) is None

def test_safe_divide_valid():
    assert _safe_divide(10, 4) == 2.5

def test_safe_divide_default():
    assert _safe_divide(10, 0, default=0.0) == 0.0

def test_average_available_empty():
    assert _average_available([]) is None

def test_average_available_with_nones():
    assert _average_available([None, 10, None, 20]) == 15.0

def test_average_available_all_none():
    assert _average_available([None, None]) is None
