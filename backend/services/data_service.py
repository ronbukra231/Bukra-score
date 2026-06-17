"""
Public data facade — the single import point for all routers.
Replaces direct imports from services/yahoo_finance.py.

To roll back to Yahoo-only: set DATA_PROVIDER=yahoo (or remove FMP_API_KEY).
No code change required.
"""
from providers.composite import get_company_info, get_five_year_financials, search_companies

__all__ = ["get_company_info", "get_five_year_financials", "search_companies"]
