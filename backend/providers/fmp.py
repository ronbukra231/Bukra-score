"""
FMP (Financial Modeling Prep) licensed data provider.
Implements the same public interface as yahoo_finance.py:
  get_company_info(symbol)       -> dict
  get_five_year_financials(symbol) -> dict
"""
import os
import time
import logging
import httpx

logger = logging.getLogger("bukra.fmp")

_API_KEY  = ""          # read fresh on each call so env changes take effect without restart
_BASE_URL = "https://financialmodelingprep.com/api"
_TIMEOUT  = 15.0

# TTL cache — same pattern as yahoo_finance.py
_cache: dict = {}
_CACHE_TTL = 3600
_CACHE_MAX = 500


def _api_key() -> str:
    return os.environ.get("FMP_API_KEY", "").strip()


def _base_url() -> str:
    return os.environ.get("FMP_BASE_URL", _BASE_URL).rstrip("/")


def _cached(key: str):
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < _CACHE_TTL:
        return entry["data"]
    return None


def _store(key: str, data):
    if len(_cache) >= _CACHE_MAX and key not in _cache:
        oldest = min(_cache, key=lambda k: _cache[k]["ts"])
        del _cache[oldest]
    _cache[key] = {"ts": time.time(), "data": data}
    return data


def _f(val):
    """Safe float conversion — returns None for NaN, None, or non-numeric."""
    try:
        v = float(val)
        return None if (v != v) else v  # NaN check
    except (TypeError, ValueError):
        return None


def _get(path: str, params=None):
    """GET request to FMP. Raises on non-2xx or missing API key."""
    key = _api_key()
    if not key:
        raise ValueError("FMP_API_KEY not configured")
    p = {"apikey": key, **(params or {})}
    url = f"{_base_url()}/{path}"
    with httpx.Client(timeout=_TIMEOUT) as client:
        r = client.get(url, params=p)
        r.raise_for_status()
        return r.json()


def _normalize_roe(roe):
    """
    Normalize ROE to decimal (0.25 = 25%).
    FMP /v3/key-metrics returns decimal. Guard: if abs(v) > 5, it's a percentage.
    This is the only info field the scoring engine reads — correctness is critical.
    """
    v = _f(roe)
    if v is None:
        return None
    return v / 100 if abs(v) > 5 else v


# ── Public: company info ───────────────────────────────────────────────────────

def get_company_info(symbol: str) -> dict:
    sym = symbol.upper()
    cached = _cached(f"info:{sym}")
    if cached:
        return cached

    # Profile — primary source for most fields
    profile_data = _get(f"v3/profile/{sym}")
    if not profile_data or not isinstance(profile_data, list) or not profile_data[0]:
        raise ValueError(f"FMP: empty profile for {sym}")

    p = profile_data[0]
    if not p.get("companyName"):
        raise ValueError(f"FMP: no company name in profile for {sym}")

    # ROE from key-metrics — CRITICAL for scoring engine
    roe = None
    try:
        km = _get(f"v3/key-metrics/{sym}", {"period": "annual", "limit": 1})
        if km and isinstance(km, list) and km[0]:
            roe = _normalize_roe(km[0].get("roe"))
    except Exception as e:
        logger.warning("[fmp] key-metrics failed for %s: %s", sym, e)

    # PE ratio from quote — profile doesn't have it reliably
    pe = None
    try:
        q = _get(f"v3/quote/{sym}")
        if q and isinstance(q, list) and q[0]:
            pe = _f(q[0].get("pe"))
    except Exception as e:
        logger.warning("[fmp] quote failed for %s: %s", sym, e)

    # 52-week range: FMP profile "range" field = "182.00-260.10"
    w52_low = w52_high = None
    range_str = p.get("range") or ""
    if "-" in range_str:
        try:
            lo, hi = range_str.rsplit("-", 1)
            w52_low  = _f(lo.strip())
            w52_high = _f(hi.strip())
        except Exception:
            pass

    # Dividend yield: lastDiv (annual) / price
    div_yield = None
    price     = _f(p.get("price"))
    last_div  = _f(p.get("lastDiv"))
    if price and last_div and price > 0:
        div_yield = last_div / price

    result = {
        "symbol":         sym,
        "name":           p.get("companyName") or sym,
        "sector":         p.get("sector") or "",
        "industry":       p.get("industry") or "",
        "description":    p.get("description") or "",
        "website":        p.get("website") or "",
        "employees":      int(p["fullTimeEmployees"]) if p.get("fullTimeEmployees") else None,
        "market_cap":     _f(p.get("mktCap")),
        "pe_ratio":       pe,
        "price":          price,
        "52w_high":       w52_high,
        "52w_low":        w52_low,
        "dividend_yield": div_yield,
        "country":        p.get("country") or "",
        "currency":       p.get("currency") or "USD",
        "logo_url":       p.get("image") or None,
        "returnOnEquity": roe,
    }

    logger.info("[fmp] info OK: %s | roe=%s price=%s", sym, roe, price)
    return _store(f"info:{sym}", result)


# ── Public: 5-year financials ──────────────────────────────────────────────────

def get_five_year_financials(symbol: str) -> dict:
    sym = symbol.upper()
    cached = _cached(f"fin:{sym}")
    if cached:
        return cached

    # Fetch all 3 annual statements
    try:
        inc_data = _get(f"v3/income-statement/{sym}", {"period": "annual", "limit": 5})
        bal_data = _get(f"v3/balance-sheet-statement/{sym}", {"period": "annual", "limit": 5})
        cf_data  = _get(f"v3/cash-flow-statement/{sym}", {"period": "annual", "limit": 5})
    except Exception as e:
        raise ValueError(f"FMP: statement fetch failed for {sym}: {e}")

    if not inc_data or not isinstance(inc_data, list):
        raise ValueError(f"FMP: no income statement for {sym}")

    # Index balance sheet and cash flow by calendarYear for O(1) lookup
    bal_by_year = {
        str(r.get("calendarYear", "")): r
        for r in (bal_data or []) if r.get("calendarYear")
    }
    cf_by_year = {
        str(r.get("calendarYear", "")): r
        for r in (cf_data or []) if r.get("calendarYear")
    }

    history = []
    for row in inc_data[:5]:
        year = str(row.get("calendarYear", ""))
        if not year:
            continue

        revenue    = _f(row.get("revenue"))
        net_income = _f(row.get("netIncome"))
        gross      = _f(row.get("grossProfit"))

        # Always recompute margin — never trust provider's precomputed value
        net_margin = None
        if revenue and net_income and revenue != 0:
            net_margin = round(net_income / revenue * 100, 2)

        br     = bal_by_year.get(year, {})
        debt   = _f(br.get("totalDebt"))
        cash   = _f(br.get("cashAndCashEquivalents")) or _f(br.get("cashAndShortTermInvestments"))
        assets = _f(br.get("totalAssets"))
        equity = _f(br.get("totalStockholdersEquity"))

        cr  = cf_by_year.get(year, {})
        fcf = _f(cr.get("freeCashFlow"))

        # Skip rows where both revenue and net income are absent — unusable for scoring
        if revenue is None and net_income is None:
            continue

        history.append({
            "year":                year,
            "revenue":             revenue,
            "net_income":          net_income,
            "net_margin":          net_margin,
            "gross_profit":        gross,
            "free_cash_flow":      fcf,
            "total_debt":          debt,
            "cash":                cash,
            "total_assets":        assets,
            "stockholders_equity": equity,
        })

    if not history:
        raise ValueError(f"FMP: no usable financial rows for {sym}")

    years  = [h["year"] for h in history]
    result = {"years": years, "history": history, "raw": {}, "source": "fmp"}
    logger.info("[fmp] financials OK: %s | rows=%d years=%s", sym, len(history), years)
    return _store(f"fin:{sym}", result)
