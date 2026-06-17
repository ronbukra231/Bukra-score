# Provider abstraction layer — import from composite, not directly from fmp/yahoo
from providers.composite import get_company_info, get_five_year_financials, search_companies

__all__ = ["get_company_info", "get_five_year_financials", "search_companies"]
