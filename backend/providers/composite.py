"""
Composite provider — FMP primary, Yahoo fallback.
Behavior controlled by DATA_PROVIDER env var:

  "auto"   — FMP primary, Yahoo fallback on any error (default when FMP_API_KEY is set)
  "yahoo"  — Yahoo only; FMP never called (instant rollback mode)
  "fmp"    — FMP only; no Yahoo fallback (not recommended in production)
  "shadow" — Yahoo serves users; FMP called silently in background for score comparison

If FMP_API_KEY is absent or empty, mode is always "yahoo" regardless of DATA_PROVIDER.
"""
import logging
import os
import threading

import providers.fmp as fmp_provider
import services.yahoo_finance as yahoo_provider
from services.provider_monitor import (
    record_success,
    record_failure,
    record_fallback,
    record_shadow_divergence,
)

logger = logging.getLogger("bukra.composite")


def _mode() -> str:
    if not os.environ.get("FMP_API_KEY", "").strip():
        return "yahoo"
    return os.environ.get("DATA_PROVIDER", "auto").strip().lower()


# ── Public interface ───────────────────────────────────────────────────────────

def get_company_info(symbol: str) -> dict:
    mode = _mode()

    if mode == "yahoo":
        return yahoo_provider.get_company_info(symbol)

    if mode == "fmp":
        result = fmp_provider.get_company_info(symbol)
        record_success("fmp", "info")
        return result

    if mode == "shadow":
        yahoo_result = yahoo_provider.get_company_info(symbol)
        _shadow_info_bg(symbol, yahoo_result)
        return yahoo_result

    # "auto" — FMP primary, Yahoo fallback
    try:
        result = fmp_provider.get_company_info(symbol)
        record_success("fmp", "info")
        return result
    except Exception as e:
        logger.warning("[composite] FMP info failed for %s — falling back to Yahoo: %s", symbol, e)
        record_failure("fmp", "info")
        record_fallback(symbol, "info")
        return yahoo_provider.get_company_info(symbol)


def get_five_year_financials(symbol: str) -> dict:
    mode = _mode()

    if mode == "yahoo":
        return yahoo_provider.get_five_year_financials(symbol)

    if mode == "fmp":
        result = fmp_provider.get_five_year_financials(symbol)
        record_success("fmp", "financials")
        return result

    if mode == "shadow":
        yahoo_result = yahoo_provider.get_five_year_financials(symbol)
        _shadow_fin_bg(symbol, yahoo_result)
        return yahoo_result

    # "auto" — FMP primary, Yahoo fallback
    try:
        result = fmp_provider.get_five_year_financials(symbol)
        if not result.get("history"):
            raise ValueError("FMP returned empty financials")
        record_success("fmp", "financials")
        return result
    except Exception as e:
        logger.warning("[composite] FMP financials failed for %s — falling back to Yahoo: %s", symbol, e)
        record_failure("fmp", "financials")
        record_fallback(symbol, "financials")
        yahoo_result = yahoo_provider.get_five_year_financials(symbol)
        return yahoo_result


def search_companies(query: str) -> list[dict]:
    # Search always uses the local fuzzy index in yahoo_finance.py — no FMP call needed
    return yahoo_provider.search_companies(query)


# ── Shadow mode ───────────────────────────────────────────────────────────────
# Shadow mode is activated by DATA_PROVIDER=shadow during Week 4 of migration.
# It serves Yahoo data to users while calling FMP silently in background threads
# to accumulate score comparison data. Divergences are logged at WARNING level.

def _shadow_info_bg(symbol: str, yahoo_result: dict):
    """Compare FMP vs Yahoo ROE in the background. Log if delta > 5 percentage points."""
    def _run():
        try:
            fmp_result = fmp_provider.get_company_info(symbol)
            yahoo_roe  = yahoo_result.get("returnOnEquity")
            fmp_roe    = fmp_result.get("returnOnEquity")
            if yahoo_roe is not None and fmp_roe is not None:
                delta = abs(yahoo_roe - fmp_roe)
                logger.info(
                    "[shadow] %s ROE: yahoo=%.3f fmp=%.3f delta=%.3f",
                    symbol, yahoo_roe, fmp_roe, delta,
                )
                if delta > 0.05:
                    record_shadow_divergence(symbol, "roe", yahoo_roe, fmp_roe)
                    logger.warning(
                        "[shadow] ROE divergence >5pp for %s — review before traffic switch",
                        symbol,
                    )
        except Exception as e:
            logger.debug("[shadow] FMP info shadow call failed for %s: %s", symbol, e)

    threading.Thread(target=_run, daemon=True).start()


def _shadow_fin_bg(symbol: str, yahoo_financials: dict):
    """
    Compute Bukra Score from FMP financials in the background and compare with
    the Yahoo-based score. Log any divergence > 3 points.
    Score divergence > 5 points is recorded as a blocking concern.
    """
    def _run():
        try:
            fmp_fin = fmp_provider.get_five_year_financials(symbol)
            if not fmp_fin.get("history"):
                logger.debug("[shadow] FMP returned empty financials for %s — skipping comparison", symbol)
                return

            from services.bukra_score import compute_bukra_score

            # Use the same info dict for both — we're isolating the financials variable
            info = yahoo_provider.get_company_info(symbol)
            yahoo_score_data = compute_bukra_score(yahoo_financials, info)
            fmp_score_data   = compute_bukra_score(fmp_fin, info)

            yahoo_score = yahoo_score_data.get("score")
            fmp_score   = fmp_score_data.get("score")

            if yahoo_score is None or fmp_score is None:
                return

            delta = abs(yahoo_score - fmp_score)
            logger.info(
                "[shadow] %s Bukra Score: yahoo=%s fmp=%s delta=%s",
                symbol, yahoo_score, fmp_score, delta,
            )

            if delta > 3:
                record_shadow_divergence(symbol, "bukra_score", yahoo_score, fmp_score)

            if delta > 5:
                logger.warning(
                    "[shadow] SCORE DIVERGENCE >5 for %s (yahoo=%s fmp=%s) — "
                    "DO NOT switch to auto mode until this is resolved",
                    symbol, yahoo_score, fmp_score,
                )

        except Exception as e:
            logger.debug("[shadow] FMP financials shadow call failed for %s: %s", symbol, e)

    threading.Thread(target=_run, daemon=True).start()
