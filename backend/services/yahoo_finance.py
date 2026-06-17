"""
Financial data service.
Primary: yahooquery (handles Yahoo auth/crumbs reliably)
Fallback for financials + company info: yfinance with session headers
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

# Simple TTL cache with max-size eviction
_cache: dict = {}
CACHE_TTL  = 3600
_CACHE_MAX = 500   # ~2 keys per symbol (info + fin) × 250 symbols


def _cached(key: str):
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL:
        return entry["data"]
    return None


def _store(key: str, data):
    if len(_cache) >= _CACHE_MAX and key not in _cache:
        oldest = min(_cache, key=lambda k: _cache[k]["ts"])
        del _cache[oldest]
    _cache[key] = {"ts": time.time(), "data": data}
    return data


# ── Mock info for when Yahoo rate-limits /v10/quoteSummary ───────────────────
_MOCK_INFO = {
    "AAPL": {"symbol": "AAPL", "name": "Apple Inc.", "sector": "Technology", "industry": "Consumer Electronics", "description": "Apple designs and sells consumer electronics, software, and services including iPhone, Mac, iPad, and the App Store ecosystem.", "website": "https://www.apple.com", "employees": 150000, "market_cap": 3_000_000_000_000, "pe_ratio": 29.5, "price": 189.30, "52w_high": 199.62, "52w_low": 164.08, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 1.47},
    "MSFT": {"symbol": "MSFT", "name": "Microsoft Corporation", "sector": "Technology", "industry": "Software—Infrastructure", "description": "Microsoft develops and licenses software, cloud services, and productivity tools for consumers and enterprises worldwide.", "website": "https://www.microsoft.com", "employees": 220000, "market_cap": 3_100_000_000_000, "pe_ratio": 35.2, "price": 415.0, "52w_high": 468.35, "52w_low": 309.45, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 0.38},
    "NVDA": {"symbol": "NVDA", "name": "NVIDIA Corporation", "sector": "Technology", "industry": "Semiconductors", "description": "NVIDIA designs graphics processing units and system-on-chip units used in gaming, data centers, AI workloads, and automotive applications.", "website": "https://www.nvidia.com", "employees": 29600, "market_cap": 3_200_000_000_000, "pe_ratio": 40.0, "price": 130.0, "52w_high": 153.13, "52w_low": 47.32, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 1.24},
    "TSLA": {"symbol": "TSLA", "name": "Tesla, Inc.", "sector": "Consumer Cyclical", "industry": "Auto Manufacturers", "description": "Tesla designs, manufactures, and sells electric vehicles, energy storage systems, and solar products.", "website": "https://www.tesla.com", "employees": 127855, "market_cap": 700_000_000_000, "pe_ratio": 60.0, "price": 220.0, "52w_high": 488.54, "52w_low": 138.80, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 0.10},
    "V":    {"symbol": "V",    "name": "Visa Inc.", "sector": "Financial Services", "industry": "Credit Services", "description": "Visa operates a global electronic payments network connecting financial institutions, merchants, and cardholders.", "website": "https://www.visa.com", "employees": 26500, "market_cap": 550_000_000_000, "pe_ratio": 30.0, "price": 275.0, "52w_high": 354.89, "52w_low": 252.70, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 0.52},
    "GOOGL":{"symbol": "GOOGL","name": "Alphabet Inc.", "sector": "Technology", "industry": "Internet Content & Information", "description": "Alphabet is the parent company of Google, operating in search, advertising, cloud computing, hardware, and other technology ventures.", "website": "https://www.abc.xyz", "employees": 182000, "market_cap": 2_100_000_000_000, "pe_ratio": 23.0, "price": 170.0, "52w_high": 208.70, "52w_low": 140.53, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 0.32},
    "AMZN": {"symbol": "AMZN", "name": "Amazon.com, Inc.", "sector": "Consumer Cyclical", "industry": "Internet Retail", "description": "Amazon operates e-commerce, cloud computing (AWS), digital advertising, and logistics businesses globally.", "website": "https://www.amazon.com", "employees": 1525000, "market_cap": 2_000_000_000_000, "pe_ratio": 45.0, "price": 195.0, "52w_high": 242.52, "52w_low": 151.61, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 0.23},
    "META": {"symbol": "META", "name": "Meta Platforms, Inc.", "sector": "Technology", "industry": "Internet Content & Information", "description": "Meta builds social networking platforms including Facebook, Instagram, and WhatsApp, generating revenue primarily through digital advertising.", "website": "https://www.meta.com", "employees": 67317, "market_cap": 1_400_000_000_000, "pe_ratio": 26.0, "price": 554.0, "52w_high": 740.91, "52w_low": 414.50, "country": "United States", "currency": "USD", "logo_url": None, "returnOnEquity": 0.38},
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
    t = YQTicker(symbol, timeout=15, validate=False)

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


def _yf_financials(symbol: str) -> dict:
    """
    Fetch annual financials using yfinance as fallback when yahooquery fails.
    Returns the same structure as _yq_financials().
    """
    t = yf.Ticker(symbol, session=_yf_session)

    # yfinance 0.2.x: income_stmt / balance_sheet / cash_flow (annual by default)
    inc = t.get_income_stmt(freq="yearly") if hasattr(t, "get_income_stmt") else t.income_stmt
    bal = t.get_balance_sheet(freq="yearly") if hasattr(t, "get_balance_sheet") else t.balance_sheet
    cf  = t.get_cash_flow(freq="yearly") if hasattr(t, "get_cash_flow") else t.cash_flow

    if inc is None or inc.empty:
        raise ValueError(f"yfinance: no income statement for {symbol}")

    history = []
    for col in inc.columns[:5]:  # up to 5 most recent annual periods
        year = str(col.year)

        def _get(df, *keys):
            if df is None or df.empty:
                return None
            for k in keys:
                if k in df.index:
                    return _f(df.loc[k, col] if col in df.columns else None)
            return None

        revenue    = _get(inc, "Total Revenue")
        net_income = _get(inc, "Net Income")
        gross      = _get(inc, "Gross Profit")
        net_margin = round(net_income / revenue * 100, 2) if revenue and net_income else None

        # Balance sheet — match closest date column
        bal_col = col
        if bal is not None and not bal.empty and col not in bal.columns:
            bal_col = min(bal.columns, key=lambda c: abs((c - col).days))

        def _get_b(df, *keys):
            if df is None or df.empty:
                return None
            for k in keys:
                if k in df.index:
                    try:
                        return _f(df.loc[k, bal_col])
                    except KeyError:
                        pass
            return None

        debt   = _get_b(bal, "Total Debt", "Long Term Debt")
        cash   = _get_b(bal, "Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments")
        assets = _get_b(bal, "Total Assets")
        equity = _get_b(bal, "Stockholders Equity", "Common Stock Equity")

        # Cashflow — match closest date column
        cf_col = col
        if cf is not None and not cf.empty and col not in cf.columns:
            cf_col = min(cf.columns, key=lambda c: abs((c - col).days))

        def _get_cf(df, *keys):
            if df is None or df.empty:
                return None
            for k in keys:
                if k in df.index:
                    try:
                        return _f(df.loc[k, cf_col])
                    except KeyError:
                        pass
            return None

        fcf          = _get_cf(cf, "Free Cash Flow")
        operating_cf = _get_cf(cf, "Operating Cash Flow", "Cash Flow From Continuing Operating Activities")
        capex        = _get_cf(cf, "Capital Expenditure")
        if fcf is None and operating_cf is not None and capex is not None:
            fcf = operating_cf + capex

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

    if not history:
        raise ValueError(f"yfinance: no usable rows for {symbol}")

    years = [h["year"] for h in history]
    return {"years": years, "history": history, "raw": {}, "source": "yfinance"}


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

# ── Hebrew aliases ────────────────────────────────────────────────────────────
_HEBREW_ALIASES: dict[str, str] = {
    "טסלה": "TSLA",
    "אפל": "AAPL",
    "אנבידיה": "NVDA",
    "נבידיה": "NVDA",
    "גוגל": "GOOGL",
    "אלפבית": "GOOGL",
    "אמזון": "AMZN",
    "מטא": "META",
    "פייסבוק": "META",
    "מיקרוסופט": "MSFT",
    "נטפליקס": "NFLX",
    "איירבנב": "ABNB",
    "ויזה": "V",
    "נייקי": "NKE",
    "דיסני": "DIS",
    "קוקה קולה": "KO",
    "פפסי": "PEP",
    "ג'יי פי מורגן": "JPM",
}

# ── English name/alias universe — searched before hitting Yahoo API ───────────
# Format: (SYMBOL, full_name, [aliases...], sector)
_UNIVERSE: list[tuple] = [
    ("AAPL",  "Apple Inc.",              ["apple", "appl", "aple"],                         "Technology"),
    ("MSFT",  "Microsoft Corporation",   ["microsoft", "micro soft", "microsft"],            "Technology"),
    ("NVDA",  "NVIDIA Corporation",      ["nvidia", "nvida", "nvidea", "nvdia"],             "Technology"),
    ("GOOGL", "Alphabet Inc.",           ["google", "alphabet", "googl", "gooogle"],         "Technology"),
    ("GOOG",  "Alphabet Inc. (C)",       ["google class c"],                                 "Technology"),
    ("META",  "Meta Platforms",          ["meta", "facebook", "fb", "instragram"],           "Technology"),
    ("AMZN",  "Amazon.com Inc.",         ["amazon", "amazn", "amazom"],                      "Consumer Cyclical"),
    ("TSLA",  "Tesla Inc.",              ["tesla", "tezla", "teslas"],                       "Consumer Cyclical"),
    ("NFLX",  "Netflix Inc.",            ["netflix", "netfix", "netflx"],                    "Communication Services"),
    ("ABNB",  "Airbnb Inc.",             ["airbnb", "air bnb", "airnb", "airb", "airbb"],    "Consumer Cyclical"),
    ("V",     "Visa Inc.",               ["visa"],                                           "Financial Services"),
    ("MA",    "Mastercard Inc.",         ["mastercard", "master card"],                      "Financial Services"),
    ("JPM",   "JPMorgan Chase",          ["jpmorgan", "jp morgan", "chase"],                 "Financial Services"),
    ("BAC",   "Bank of America",         ["bank of america", "bofa", "bofA"],                "Financial Services"),
    ("WMT",   "Walmart Inc.",            ["walmart", "wal mart", "walmat"],                  "Consumer Defensive"),
    ("COST",  "Costco Wholesale",        ["costco", "cosco"],                                "Consumer Defensive"),
    ("PG",    "Procter & Gamble",        ["procter", "procter gamble", "pg"],                "Consumer Defensive"),
    ("KO",    "Coca-Cola Co.",           ["coca cola", "cocacola", "coke"],                  "Consumer Defensive"),
    ("PEP",   "PepsiCo Inc.",            ["pepsi", "pepsico"],                               "Consumer Defensive"),
    ("JNJ",   "Johnson & Johnson",       ["johnson", "j&j", "jnj"],                         "Healthcare"),
    ("LLY",   "Eli Lilly",              ["eli lilly", "lilly"],                             "Healthcare"),
    ("UNH",   "UnitedHealth Group",      ["unitedhealth", "united health"],                  "Healthcare"),
    ("ABBV",  "AbbVie Inc.",             ["abbvie"],                                         "Healthcare"),
    ("MRK",   "Merck & Co.",             ["merck"],                                          "Healthcare"),
    ("PFE",   "Pfizer Inc.",             ["pfizer"],                                         "Healthcare"),
    ("AVGO",  "Broadcom Inc.",           ["broadcom"],                                       "Technology"),
    ("ORCL",  "Oracle Corporation",      ["oracle"],                                         "Technology"),
    ("CRM",   "Salesforce Inc.",         ["salesforce", "sales force"],                      "Technology"),
    ("ADBE",  "Adobe Inc.",              ["adobe"],                                          "Technology"),
    ("INTC",  "Intel Corporation",       ["intel"],                                          "Technology"),
    ("AMD",   "Advanced Micro Devices",  ["amd", "advanced micro"],                          "Technology"),
    ("QCOM",  "Qualcomm Inc.",           ["qualcomm"],                                       "Technology"),
    ("TXN",   "Texas Instruments",       ["texas instruments", "ti"],                        "Technology"),
    ("AMAT",  "Applied Materials",       ["applied materials"],                              "Technology"),
    ("MU",    "Micron Technology",       ["micron"],                                         "Technology"),
    ("PYPL",  "PayPal Holdings",         ["paypal", "pay pal"],                              "Financial Services"),
    ("GS",    "Goldman Sachs",           ["goldman", "goldman sachs"],                       "Financial Services"),
    ("MS",    "Morgan Stanley",          ["morgan stanley", "morgan"],                       "Financial Services"),
    ("BLK",   "BlackRock Inc.",          ["blackrock", "black rock"],                        "Financial Services"),
    ("SPGI",  "S&P Global Inc.",         ["sp global", "standard poors"],                   "Financial Services"),
    ("XOM",   "Exxon Mobil",            ["exxon", "exxonmobil", "exxon mobil"],             "Energy"),
    ("CVX",   "Chevron Corporation",     ["chevron"],                                        "Energy"),
    ("COP",   "ConocoPhillips",          ["conocophillips", "conoco"],                       "Energy"),
    ("RTX",   "RTX Corporation",         ["raytheon", "rtx"],                                "Industrials"),
    ("HON",   "Honeywell International", ["honeywell"],                                      "Industrials"),
    ("CAT",   "Caterpillar Inc.",        ["caterpillar", "cat"],                             "Industrials"),
    ("DE",    "Deere & Company",         ["john deere", "deere"],                            "Industrials"),
    ("UPS",   "United Parcel Service",   ["ups", "united parcel"],                           "Industrials"),
    ("FDX",   "FedEx Corporation",       ["fedex", "fed ex"],                                "Industrials"),
    ("BA",    "Boeing Company",          ["boeing"],                                         "Industrials"),
    ("GE",    "GE Aerospace",            ["ge", "general electric"],                         "Industrials"),
    ("NEE",   "NextEra Energy",          ["nextera", "nextera energy"],                      "Utilities"),
    ("DUK",   "Duke Energy",             ["duke energy", "duke"],                            "Utilities"),
    ("NKE",   "Nike Inc.",               ["nike", "nikes"],                                  "Consumer Cyclical"),
    ("SBUX",  "Starbucks Corporation",   ["starbucks", "starbuck"],                          "Consumer Cyclical"),
    ("MCD",   "McDonald's Corporation",  ["mcdonalds", "mcdonald"],                          "Consumer Cyclical"),
    ("TGT",   "Target Corporation",      ["target"],                                         "Consumer Cyclical"),
    ("HD",    "The Home Depot",          ["home depot", "homedepot"],                        "Consumer Cyclical"),
    ("LOW",   "Lowe's Companies",        ["lowes", "lowe's"],                                "Consumer Cyclical"),
    ("BKNG",  "Booking Holdings",        ["booking", "booking.com", "priceline"],            "Consumer Cyclical"),
    ("MAR",   "Marriott International",  ["marriott"],                                       "Consumer Cyclical"),
    ("HLT",   "Hilton Worldwide",        ["hilton"],                                         "Consumer Cyclical"),
    ("DIS",   "The Walt Disney Company", ["disney", "walt disney"],                          "Communication Services"),
    ("CMCSA", "Comcast Corporation",     ["comcast"],                                        "Communication Services"),
    ("T",     "AT&T Inc.",               ["att", "at&t"],                                    "Communication Services"),
    ("VZ",    "Verizon Communications",  ["verizon"],                                        "Communication Services"),
    ("SPOT",  "Spotify Technology",      ["spotify"],                                        "Communication Services"),
    ("UBER",  "Uber Technologies",       ["uber"],                                           "Technology"),
    ("LYFT",  "Lyft Inc.",               ["lyft"],                                           "Technology"),
    ("SNAP",  "Snap Inc.",               ["snap", "snapchat"],                               "Communication Services"),
    ("PINS",  "Pinterest Inc.",          ["pinterest"],                                      "Communication Services"),
    ("X",     "X Corp.",                 ["twitter", "x corp"],                              "Communication Services"),
    ("SQ",    "Block Inc.",              ["square", "block", "cash app"],                    "Technology"),
    ("COIN",  "Coinbase Global",         ["coinbase"],                                       "Financial Services"),
    ("SHOP",  "Shopify Inc.",            ["shopify"],                                        "Technology"),
    ("SNOW",  "Snowflake Inc.",          ["snowflake"],                                      "Technology"),
    ("PLTR",  "Palantir Technologies",   ["palantir"],                                       "Technology"),
    ("RBLX",  "Roblox Corporation",      ["roblox"],                                         "Communication Services"),
    ("CTAS",  "Cintas Corporation",      ["cintas"],                                         "Industrials"),
    ("SPXC",  "SPX Technologies",        ["spx"],                                            "Industrials"),
    ("BRK-B", "Berkshire Hathaway B",    ["berkshire", "buffett"],                           "Financial Services"),
    ("TSM",   "TSMC",                    ["tsmc", "taiwan semiconductor"],                   "Technology"),
    ("ASML",  "ASML Holding",            ["asml"],                                           "Technology"),
    ("SAP",   "SAP SE",                  ["sap"],                                            "Technology"),
    ("TM",    "Toyota Motor",            ["toyota"],                                         "Consumer Cyclical"),
    ("RACE",  "Ferrari N.V.",            ["ferrari"],                                        "Consumer Cyclical"),
    ("LUV",   "Southwest Airlines",      ["southwest", "southwest airlines"],                "Industrials"),
    ("DAL",   "Delta Air Lines",         ["delta", "delta airlines"],                        "Industrials"),
    ("AAL",   "American Airlines",       ["american airlines"],                              "Industrials"),
    ("UAL",   "United Airlines",         ["united airlines"],                                "Industrials"),
    ("RIVN",  "Rivian Automotive",       ["rivian"],                                         "Consumer Cyclical"),
    ("LCID",  "Lucid Group",             ["lucid", "lucid motors"],                          "Consumer Cyclical"),
    ("NIO",   "NIO Inc.",                ["nio"],                                            "Consumer Cyclical"),
    ("BIDU",  "Baidu Inc.",              ["baidu"],                                          "Communication Services"),
    ("BABA",  "Alibaba Group",           ["alibaba"],                                        "Consumer Cyclical"),
    ("JD",    "JD.com Inc.",             ["jd.com", "jd"],                                   "Consumer Cyclical"),
    ("SPY",   "SPDR S&P 500 ETF",        ["spy", "sp500", "s&p 500"],                        "ETF"),
    ("QQQ",   "Invesco QQQ Trust",       ["qqq", "nasdaq etf"],                              "ETF"),
    ("VTI",   "Vanguard Total Market",   ["vti", "vanguard"],                                "ETF"),
    ("VOO",   "Vanguard S&P 500 ETF",    ["voo"],                                            "ETF"),
]

# Pre-build normalized lookup index at import time (fast O(1) lookup per query)
def _build_search_index() -> list[dict]:
    rows = []
    for entry in _UNIVERSE:
        sym, name, aliases, sector = entry
        norm_name = name.lower().replace("&", "").replace(".", "").replace(",", "")
        norm_aliases = [a.lower().replace(" ", "").replace("-", "") for a in aliases]
        rows.append({
            "symbol":       sym,
            "name":         name,
            "sector":       sector,
            "exchange":     "NYSE/NASDAQ",
            "type":         "EQUITY",
            "_norm_sym":    sym.lower().replace("-", ""),
            "_norm_name":   norm_name,
            "_norm_aliases": norm_aliases,
            "_raw_aliases": aliases,
        })
    return rows

_SEARCH_INDEX = _build_search_index()


def _normalize(text: str) -> str:
    """Lowercase, strip punctuation/spaces for fuzzy matching."""
    import re
    return re.sub(r"[\s\-&.,']", "", text.lower())


def _search_universe(query: str, max_results: int = 5) -> list[dict]:
    """
    Multi-pass search against the local universe:
      1. Exact ticker match
      2. Exact alias match (after normalize)
      3. Ticker prefix
      4. Name/alias prefix
      5. Name/alias substring
    Returns up to max_results results ranked by match quality.
    """
    q = _normalize(query)
    if not q:
        return []

    scored: list[tuple[int, dict]] = []

    for row in _SEARCH_INDEX:
        score = 0
        sym_n = row["_norm_sym"]
        name_n = row["_norm_name"]
        aliases_n = row["_norm_aliases"]

        if sym_n == q:
            score = 100
        elif any(a == q for a in aliases_n):
            score = 95
        elif sym_n.startswith(q):
            score = 80
        elif any(a.startswith(q) for a in aliases_n):
            score = 75
        elif name_n.startswith(q):
            score = 70
        elif any(q in a for a in aliases_n):
            score = 60
        elif q in name_n:
            score = 55
        elif q in sym_n:
            score = 40

        if score > 0:
            scored.append((score, row))

    scored.sort(key=lambda x: -x[0])
    return [
        {k: v for k, v in row.items() if not k.startswith("_")}
        for _, row in scored[:max_results]
    ]


def search_companies(query: str) -> list[dict]:
    raw = query.strip()
    if not raw:
        return []

    # 1. Hebrew alias — exact match → resolve to ticker, then universe entry
    hebrew_sym = _HEBREW_ALIASES.get(raw)
    if hebrew_sym:
        # Find in universe first for full metadata
        hit = next((r for r in _SEARCH_INDEX if r["symbol"] == hebrew_sym), None)
        if hit:
            return [{"symbol": hit["symbol"], "name": hit["name"],
                     "exchange": hit["exchange"], "type": "EQUITY", "sector": hit["sector"]}]
        # Fall back to mock info
        if hebrew_sym in _MOCK_INFO:
            m = _MOCK_INFO[hebrew_sym]
            return [{"symbol": hebrew_sym, "name": m["name"],
                     "exchange": "NYSE/NASDAQ", "type": "EQUITY", "sector": m["sector"]}]

    # 2. Local universe fuzzy search (no network, instant)
    universe_results = _search_universe(raw)
    if universe_results:
        return universe_results

    # 3. Exact ticker — live Yahoo lookup for tickers not in universe
    sym = raw.upper()
    if sym in _MOCK_INFO:
        m = _MOCK_INFO[sym]
        return [{"symbol": sym, "name": m["name"],
                 "exchange": "NYSE/NASDAQ", "type": "EQUITY", "sector": m["sector"]}]
    try:
        t = YQTicker(sym)
        pd_ = (t.price or {}).get(sym, {})
        name = pd_.get("longName") or pd_.get("shortName")
        if name:
            ap = (t.asset_profile or {}).get(sym, {})
            return [{"symbol": sym, "name": name, "exchange": pd_.get("exchangeName", ""),
                     "type": "EQUITY", "sector": ap.get("sector", "")}]
    except Exception:
        pass

    # 4. Return symbol as-is so user can still navigate to any valid ticker
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

    # Primary: yahooquery
    try:
        result = _yq_financials(sym)
        if result.get("history"):
            print(f"[financials] {sym} | source=yahooquery | rows={len(result['history'])}")
            return _store(f"fin:{sym}", result)
        print(f"[financials] {sym} | yahooquery returned empty history, trying yfinance fallback")
    except Exception as e:
        print(f"[financials] {sym} | yahooquery failed: {e}")

    # Fallback: yfinance
    try:
        result = _yf_financials(sym)
        if result.get("history"):
            print(f"[financials] {sym} | source=yfinance | rows={len(result['history'])}")
            return _store(f"fin:{sym}", result)
    except Exception as e:
        print(f"[financials] {sym} | yfinance fallback failed: {e}")

    # Both providers failed — return empty but do NOT cache so next request retries
    print(f"[financials] {sym} | all providers failed, returning empty (not cached)")
    return {"years": [], "history": [], "raw": {}, "source": "unavailable"}


# Keep get_ticker for routers that still use it
def get_ticker(symbol: str):
    return yf.Ticker(symbol.upper(), session=_yf_session)
