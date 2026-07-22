"""
Market price + FX lookups for the simulator, wrapping the existing provider
(services/yahoo_finance, services/data_service) — no new data source, no
fabricated numbers. Every price is real-provider or explicitly unavailable.
"""

import time
import logging
from typing import Optional

from services.data_service import get_company_info
from services.yahoo_finance import get_latest_price
from services.simulator.config import EXECUTION

logger = logging.getLogger("bukra.simulator.pricing")

# A handful of FX pairs needed for USD<->ILS simulation. Cached briefly —
# this is a simulator convenience rate, not a trading-grade feed.
_FX_CACHE: dict = {}
_FX_TTL = 3600


def get_quote(ticker: str) -> dict:
    """
    {"price": float|None, "currency": str, "asOf": iso-str|None, "stale": bool}
    Uses the same info pipeline as the company page — no duplicate provider
    logic. Falls back to price-history close when info.price is unavailable.
    """
    info = get_company_info(ticker)
    price = info.get("price")
    if price is None:
        price = get_latest_price(ticker)
    currency = info.get("currency") or "USD"
    return {
        "price": price,
        "currency": currency,
        "asOf": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()) if price is not None else None,
        "stale": False,   # the provider's own cache TTL already bounds staleness
    }


# get_price_history (which get_latest_price sits on) only has a yfinance
# path, no yahooquery fallback — and yfinance's rate is the single most
# commonly rate-limited (HTTP 429) call in this codebase. A brief retry
# turns a transient 429 into a working FX rate instead of blocking every
# non-native-currency simulated trade on the first hiccup.
_FX_MAX_RETRIES = 2
_FX_RETRY_BACKOFF_S = 1.5


def get_fx_rate(from_ccy: str, to_ccy: str) -> Optional[float]:
    """
    Approximate FX conversion rate for simulation purposes. USD<->ILS via a
    live quote when reachable; identity when currencies match. Returns None
    (never a fabricated rate) when neither is available after retrying
    transient failures.
    """
    if from_ccy == to_ccy:
        return 1.0
    key = f"{from_ccy}{to_ccy}"
    cached = _FX_CACHE.get(key)
    if cached and (time.time() - cached["ts"]) < _FX_TTL:
        return cached["rate"]

    rate = None
    for attempt in range(_FX_MAX_RETRIES + 1):
        pair_symbol = f"{from_ccy}{to_ccy}=X"
        rate = get_latest_price(pair_symbol)
        if rate is None:
            inverse = get_latest_price(f"{to_ccy}{from_ccy}=X")
            if inverse and inverse > 0:
                rate = 1.0 / inverse
        if rate is not None and rate > 0:
            break
        if attempt < _FX_MAX_RETRIES:
            logger.info("[pricing] FX rate %s->%s unavailable, retrying (attempt %d)", from_ccy, to_ccy, attempt + 1)
            time.sleep(_FX_RETRY_BACKOFF_S)

    if rate is not None and rate > 0:
        _FX_CACHE[key] = {"rate": rate, "ts": time.time()}
        return rate
    return None
