"""
Financial data service.
Primary: yahooquery (handles Yahoo auth/crumbs reliably)
Fallback for company info only: yfinance with session headers
Mock fallback for info: hardcoded data for common symbols when Yahoo is rate-limiting
"""

import time
import numpy as np
import requests
import yfinance as yf
from yahooquery import Ticker as YQTicker

# ── HTTP session with browser headers for yfinance info calls ─────────────────
_yf_session = requests.Session()
_yf_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
})

# Simple TTL cache
_cache: dict = {}
CACHE_TTL = 3600


def _cached(key: str):
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL:
        return entry["data"]
    return None


def _store(key: str, data):
    _cache[key] = {"ts": time.time(), "data": data}
    return data


# ── Mock info for when Yahoo rate-limits /v10/quoteSummary ───────────────────
_MOCK_INFO = {
    "AAPL": {"symbol": "AAPL", "name": "Apple Inc.", "sector": "Technology", "industry": "Consumer Electronics", "description": "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.", "website": "https://www.apple.com", "employees": 150000, "market_cap": 3_000_000_000_000, "pe_ratio": 29.5, "price": 189.30, "52w_high": 199.62, "52w_low": 164.08, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 1.47},
    "MSFT": {"symbol": "MSFT", "name": "Microsoft Corporation", "sector": "Technology", "industry": "Software—Infrastructure", "description": "Microsoft Corporation develops, licenses, and supports software, services, devices, and solutions worldwide.", "website": "https://www.microsoft.com", "employees": 220000, "market_cap": 3_100_000_000_000, "pe_ratio": 35.2, "price": 415.0, "52w_high": 468.35, "52w_low": 309.45, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 0.38},
    "NVDA": {"symbol": "NVDA", "name": "NVIDIA Corporation", "sector": "Technology", "industry": "Semiconductors", "description": "NVIDIA Corporation provides graphics and compute and networking solutions in the United States, Taiwan, China, and internationally.", "website": "https://www.nvidia.com", "employees": 29600, "market_cap": 3_200_000_000_000, "pe_ratio": 40.0, "price": 130.0, "52w_high": 153.13, "52w_low": 47.32, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 1.24},
    "TSLA": {"symbol": "TSLA", "name": "Tesla, Inc.", "sector": "Consumer Cyclical", "industry": "Auto Manufacturers", "description": "Tesla, Inc. designs, develops, manufactures, leases, and sells electric vehicles, and energy generation and storage systems.", "website": "https://www.tesla.com", "employees": 127855, "market_cap": 700_000_000_000, "pe_ratio": 60.0, "price": 220.0, "52w_high": 488.54, "52w_low": 138.80, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 0.10},
    "V":    {"symbol": "V",    "name": "Visa Inc.", "sector": "Financial Services", "industry": "Credit Services", "description": "Visa Inc. operates as a payments technology company worldwide. It operates VisaNet, a transaction processing network.", "website": "https://www.visa.com", "employees": 26500, "market_cap": 550_000_000_000, "pe_ratio": 30.0, "price": 275.0, "52w_high": 354.89, "52w_low": 252.70, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 0.52},
    "GOOGL":{"symbol": "GOOGL","name": "Alphabet Inc.", "sector": "Technology", "industry": "Internet Content & Information", "description": "Alphabet Inc. provides various products and platforms in the United States, Europe, the Middle East, Africa, the Asia-Pacific, Canada, and Latin America.", "website": "https://www.abc.xyz", "employees": 182000, "market_cap": 2_100_000_000_000, "pe_ratio": 23.0, "price": 170.0, "52w_high": 208.70, "52w_low": 140.53, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 0.32},
    "AMZN": {"symbol": "AMZN", "name": "Amazon.com, Inc.", "sector": "Consumer Cyclical", "industry": "Internet Retail", "description": "Amazon.com, Inc. engages in the retail sale of consumer products and subscriptions in North America and internationally.", "website": "https://www.amazon.com", "employees": 1525000, "market_cap": 2_000_000_000_000, "pe_ratio": 45.0, "price": 195.0, "52w_high": 242.52, "52w_low": 151.61, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 0.23},
    "META": {"symbol": "META", "name": "Meta Platforms, Inc.", "sector": "Technology", "industry": "Internet Content & Information", "description": "Meta Platforms, Inc. engages in the development of products that enable people to connect and share with friends and family.", "website": "https://www.meta.com", "employees": 67317, "market_cap": 1_400_000_000_000, "pe_ratio": 26.0, "price": 554.0, "52w_high": 740.91, "52w_low": 414.50, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 0.38},
}


# ── Helper: safe float from pandas value ─────────────────────────────────────
def _f(val):
    try:
        v = float(val)
        return None if (v != v) else v  # NaN check
    except (TypeError, ValueError):
        return None


def _first(*vals):
    """Return first non-None value from a sequence."""
    for v in vals:
        if v is not None:
            return v
    return None


# ── yahooquery financial fetcher ──────────────────────────────────────────────

def _yq_financials(symbol: str) -> dict:
    """
    Fetch 5-year annual financials using yahooquery.
    Returns parsed history list or raises on failure.
    """
    t = YQTicker(symbol)

    inc = t.income_statement(frequency="annual")
    bal = t.balance_sheet(frequency="annual")
    cf  = t.cash_flow(frequency="annual")

    # Filter to annual rows for this symbol only, drop rows with no revenue
    def prep(df):
        if df is None or df.empty:
            return None
        df = df[df.index.get_level_values("symbol") == symbol] if "symbol" in df.index.names else df
        df = df[df["periodType"] == "12M"] if "periodType" in df.columns else df
        df = df.sort_values("asOfDate", ascending=False)
        return df

    inc = prep(inc)
    bal = prep(bal)
    cf  = prep(cf)

    if inc is None or inc.empty:
        raise ValueError(f"No income statement data for {symbol}")

    # Drop rows where both TotalRevenue and NetIncome are NaN — useless partial rows
    if "TotalRevenue" in inc.columns:
        inc = inc[inc["TotalRevenue"].notna() | inc.get("NetIncome", inc["TotalRevenue"]).notna()]
    if inc.empty:
        raise ValueError(f"All income statement rows are empty for {symbol}")

    rows = inc.head(5)
    history = []
    for _, row in rows.iterrows():
        year = str(row["asOfDate"].year)

        revenue    = _f(row.get("TotalRevenue"))
        net_income = _f(row.get("NetIncome"))
        gross      = _f(row.get("GrossProfit"))
        net_margin = round(net_income / revenue * 100, 2) if revenue and net_income else None

        # Balance sheet — match by fiscal year, then fall back to nearest
        debt = cash = assets = equity = None
        if bal is not None and not bal.empty:
            bal_row = bal[bal["asOfDate"].dt.year == int(year)]
            if bal_row.empty:
                # pick the row with closest date to this income row
                inc_date = row["asOfDate"]
                bal_row = bal.iloc[[(bal["asOfDate"] - inc_date).abs().argmin()]]
            br = bal_row.iloc[0]
            debt   = _f(br.get("TotalDebt"))
            cash   = _f(_first(br.get("CashAndCashEquivalents"), br.get("CashCashEquivalentsAndShortTermInvestments")))
            assets = _f(br.get("TotalAssets"))
            equity = _f(_first(br.get("CommonStockEquity"), br.get("StockholdersEquity")))

        # Cashflow — match by fiscal year, then fall back to nearest
        fcf = operating_cf = capex = None
        if cf is not None and not cf.empty:
            cf_row = cf[cf["asOfDate"].dt.year == int(year)]
            if cf_row.empty:
                inc_date = row["asOfDate"]
                cf_row = cf.iloc[[(cf["asOfDate"] - inc_date).abs().argmin()]]
            cr = cf_row.iloc[0]
            fcf          = _f(cr.get("FreeCashFlow"))
            operating_cf = _f(_first(cr.get("OperatingCashFlow"), cr.get("CashFlowFromContinuingOperatingActivities")))
            capex        = _f(cr.get("CapitalExpenditure"))
            if fcf is None and operating_cf is not None and capex is not None:
                fcf = operating_cf + capex

        # Skip rows where core income data is completely missing
        if revenue is None and net_income is None:
            continue

        history.append({
            "year": year,
            "revenue": revenue,
            "net_income": net_income,
            "net_margin": net_margin,
            "gross_profit": gross,
            "free_cash_flow": fcf,
            "total_debt": debt,
            "cash": cash,
            "total_assets": assets,
            "stockholders_equity": equity,
        })

    years = [h["year"] for h in history]
    return {"years": years, "history": history, "raw": {}, "source": "live"}


# ── yahooquery info fetcher ───────────────────────────────────────────────────

def _yq_info(symbol: str) -> dict:
    t = YQTicker(symbol)
    price_data     = t.price or {}
    fin_data       = t.financial_data or {}
    key_stats      = t.key_stats or {}
    asset          = t.asset_profile or {}
    summary_detail = t.summary_detail or {}

    pd_ = price_data.get(symbol, {})
    fd  = fin_data.get(symbol, {})
    ks  = key_stats.get(symbol, {})
    ap  = asset.get(symbol, {})
    sd  = summary_detail.get(symbol, {})

    name = pd_.get("longName") or pd_.get("shortName", symbol)
    if not name or name == symbol:
        raise ValueError(f"No info for {symbol}")

    website = ap.get("website", "")
    logo = None
    if website:
        domain = website.replace("https://", "").replace("http://", "").split("/")[0]
        logo = f"https://logo.clearbit.com/{domain}"

    # Dividend: prefer summary_detail (most reliable source)
    div_yield = _f(sd.get("dividendYield")) or _f(sd.get("trailingAnnualDividendYield"))

    return {
        "symbol": symbol.upper(),
        "name": name,
        "sector": ap.get("sector", ""),
        "industry": ap.get("industry", ""),
        "description": ap.get("longBusinessSummary", ""),
        "website": website,
        "employees": ap.get("fullTimeEmployees"),
        "market_cap": _f(sd.get("marketCap")) or _f(pd_.get("marketCap")),
        "pe_ratio": _f(sd.get("trailingPE")) or _f(ks.get("trailingPE")),
        "price": _f(pd_.get("regularMarketPrice")),
        "52w_high": _f(sd.get("fiftyTwoWeekHigh")) or _f(ks.get("fiftyTwoWeekHigh")),
        "52w_low":  _f(sd.get("fiftyTwoWeekLow"))  or _f(ks.get("fiftyTwoWeekLow")),
        "dividend_yield": div_yield,
        "country": ap.get("country", ""),
        "currency": sd.get("currency") or pd_.get("currency", "USD"),
        "logo_url": logo,
        "returnOnEquity": fd.get("returnOnEquity"),
    }


# ── Public API ────────────────────────────────────────────────────────────────

def search_companies(query: str) -> list[dict]:
    sym = query.strip().upper()
    if sym in _MOCK_INFO:
        m = _MOCK_INFO[sym]
        return [{"symbol": sym, "name": m["name"], "exchange": "NYSE/NASDAQ", "type": "EQUITY", "sector": m["sector"]}]
    # Try live
    try:
        t = YQTicker(sym)
        pd_ = (t.price or {}).get(sym, {})
        name = pd_.get("longName") or pd_.get("shortName")
        if name:
            ap = (t.asset_profile or {}).get(sym, {})
            return [{"symbol": sym, "name": name, "exchange": pd_.get("exchangeName", ""), "type": "EQUITY", "sector": ap.get("sector", "")}]
    except Exception:
        pass
    # Return symbol as-is so user can still navigate
    return [{"symbol": sym, "name": sym, "exchange": "", "type": "EQUITY", "sector": ""}]


def get_company_info(symbol: str) -> dict:
    sym = symbol.upper()
    cached = _cached(f"info:{sym}")
    if cached:
        return cached

    # Try yahooquery first
    try:
        result = _yq_info(sym)
        return _store(f"info:{sym}", result)
    except Exception as e:
        print(f"[info] yahooquery failed for {sym}: {e}")

    # Try yfinance with session headers
    try:
        t = yf.Ticker(sym, session=_yf_session)
        info = t.info or {}
        name = info.get("longName") or info.get("shortName")
        if name:
            website = info.get("website", "")
            logo = None
            if website:
                domain = website.replace("https://", "").replace("http://", "").split("/")[0]
                logo = f"https://logo.clearbit.com/{domain}"
            result = {
                "symbol": sym, "name": name,
                "sector": info.get("sector", ""), "industry": info.get("industry", ""),
                "description": info.get("longBusinessSummary", ""),
                "website": website, "employees": info.get("fullTimeEmployees"),
                "market_cap": info.get("marketCap"), "pe_ratio": info.get("trailingPE"),
                "price": info.get("currentPrice") or info.get("regularMarketPrice"),
                "52w_high": info.get("fiftyTwoWeekHigh"), "52w_low": info.get("fiftyTwoWeekLow"),
                "dividend_yield": info.get("dividendYield") or info.get("trailingAnnualDividendYield"),
                "country": info.get("country", ""), "currency": info.get("currency", "USD"),
                "logo_url": logo, "returnOnEquity": info.get("returnOnEquity"),
            }
            return _store(f"info:{sym}", result)
    except Exception as e:
        print(f"[info] yfinance fallback failed for {sym}: {e}")

    # Mock fallback
    if sym in _MOCK_INFO:
        return _store(f"info:{sym}", dict(_MOCK_INFO[sym]))

    return {"symbol": sym, "name": sym, "sector": "", "industry": "", "description": "",
            "website": "", "employees": None, "market_cap": None, "pe_ratio": None,
            "price": None, "52w_high": None, "52w_low": None, "dividend_yield": None,
            "country": "", "currency": "USD", "logo_url": None, "returnOnEquity": None}


def get_five_year_financials(symbol: str) -> dict:
    sym = symbol.upper()
    cached = _cached(f"fin:{sym}")
    if cached:
        return cached

    try:
        result = _yq_financials(sym)
        return _store(f"fin:{sym}", result)
    except Exception as e:
        print(f"[financials] yahooquery failed for {sym}: {e}")

    return {"years": [], "history": [], "raw": {}, "source": "unavailable"}


# Keep get_ticker for routers that still use it
def get_ticker(symbol: str):
    return yf.Ticker(symbol.upper(), session=_yf_session)
