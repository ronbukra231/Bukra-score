"""
Benchmark comparison — normalized percentage returns since portfolio
creation, never raw monetary values (a $500 SPY share and a $50,000
portfolio are not comparable in dollars).
"""

from datetime import datetime, timezone
from typing import Optional

from services.yahoo_finance import get_price_history


def compare_to_benchmark(portfolio_created_at: str, benchmark_symbol: str,
                         period: str = "1Y") -> dict:
    """
    Returns {"available": bool, "series": [{"date","portfolioIndex" placeholder,
    "benchmarkIndex"}], "benchmarkReturn": float|None, ...}. The caller merges
    this with the portfolio's own snapshot series (performance.py) for the
    combined chart — this module only supplies the benchmark leg.
    """
    hist = get_price_history(benchmark_symbol, period)
    created_date = portfolio_created_at[:10]
    hist = [h for h in hist if h["date"] >= created_date]
    if not hist:
        return {
            "available": False, "benchmarkSymbol": benchmark_symbol,
            "series": [], "benchmarkReturn": None,
            "calculatedAt": datetime.now(timezone.utc).isoformat(),
        }

    base = hist[0]["close"]
    series = [{"date": h["date"], "benchmarkIndex": round((h["close"] / base - 1) * 100, 3)}
             for h in hist if base]
    return {
        "available": True, "benchmarkSymbol": benchmark_symbol, "series": series,
        "benchmarkReturn": series[-1]["benchmarkIndex"] if series else None,
        "calculatedAt": datetime.now(timezone.utc).isoformat(),
    }
