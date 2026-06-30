"""
News Ingestion — provider abstraction layer.

Architecture only. No API calls are hardcoded here.
Add real providers by subclassing NewsProvider and calling register_provider().

Supported provider types (future implementations):
  rss            — Public RSS feeds (Yahoo Finance, Reuters, etc.)
  google_news    — Google News API or SerpAPI
  sec            — SEC EDGAR filings (8-K, 10-Q, earnings releases)
  press_release  — Company IR pages, Business Wire, PR Newswire
  earnings       — Earnings call transcripts (Motley Fool, Seeking Alpha)
  wire           — Business Wire / PR Newswire direct feeds
  api            — Premium data APIs (Polygon.io, Alpaca, Benzinga, etc.)

Interface contract:
  Every provider must implement:
    search_company_news(symbol, company, limit) → List[RawNewsItem]
    search_sector_news(sector, limit)           → List[RawNewsItem]
    search_macro_news(topics, limit)            → List[RawNewsItem]
    search_competitor_news(symbol, competitors, limit) → List[RawNewsItem]
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

logger = logging.getLogger("bukra.news_ingestion")


# ── Raw data model ────────────────────────────────────────────────────────────

@dataclass
class RawNewsItem:
    """
    Normalized representation of a news item from any provider,
    before classification by event_engine.py.
    """
    source:    str
    url:       str
    headline:  str
    body:      str
    published: str                         # ISO 8601 timestamp
    symbol:    Optional[str] = None        # primary ticker if known
    company:   Optional[str] = None        # company display name
    sector:    Optional[str] = None
    tags:      List[str] = field(default_factory=list)
    metadata:  Dict[str, Any] = field(default_factory=dict)


# ── Provider interface ─────────────────────────────────────────────────────────

class NewsProvider(ABC):
    """
    Abstract base class for all news data sources.
    Implementations live in separate modules (e.g. providers/rss_provider.py).
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique slug identifier, e.g. 'yahoo_rss', 'sec_edgar', 'polygon'."""
        ...

    @property
    @abstractmethod
    def provider_type(self) -> str:
        """One of: rss | google_news | sec | press_release | earnings | wire | api"""
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """
        Return True only if the provider is properly configured.
        Check for required env vars / API keys here.
        """
        ...

    @abstractmethod
    def search_company_news(
        self, symbol: str, company: str, limit: int = 20
    ) -> List[RawNewsItem]:
        """
        Fetch recent news about a specific public company.
        symbol:  ticker (e.g. "NVDA")
        company: display name (e.g. "NVIDIA Corporation")
        """
        ...

    @abstractmethod
    def search_sector_news(self, sector: str, limit: int = 20) -> List[RawNewsItem]:
        """
        Fetch news covering an industry sector.
        sector: e.g. "Technology", "Healthcare", "Energy"
        """
        ...

    @abstractmethod
    def search_macro_news(
        self,
        topics: Optional[List[str]] = None,
        limit: int = 20,
    ) -> List[RawNewsItem]:
        """
        Fetch macroeconomic news.
        topics: optional filter list, e.g. ["interest rates", "inflation", "GDP"]
        """
        ...

    @abstractmethod
    def search_competitor_news(
        self, symbol: str, competitors: List[str], limit: int = 10
    ) -> List[RawNewsItem]:
        """
        Fetch news about known competitors of a company.
        symbol:      the primary company's ticker
        competitors: list of competitor tickers, e.g. ["AMD", "INTC"]
        """
        ...


# ── Provider registry ──────────────────────────────────────────────────────────

_REGISTRY: Dict[str, NewsProvider] = {}


def register_provider(provider: NewsProvider) -> None:
    """Register a NewsProvider instance. Safe to call at import time."""
    _REGISTRY[provider.name] = provider
    logger.info("[news_ingestion] registered: %s (%s)", provider.name, provider.provider_type)


def get_available_providers() -> List[NewsProvider]:
    """Return all registered providers that pass is_available()."""
    return [p for p in _REGISTRY.values() if p.is_available()]


def get_provider(name: str) -> Optional[NewsProvider]:
    return _REGISTRY.get(name)


def list_providers() -> List[Dict[str, Any]]:
    """For the /api/events/providers status endpoint."""
    return [
        {
            "name":      p.name,
            "type":      p.provider_type,
            "available": p.is_available(),
        }
        for p in _REGISTRY.values()
    ]


# ── Aggregator ────────────────────────────────────────────────────────────────

class NewsAggregator:
    """
    Queries all available providers in sequence and deduplicates results.
    Does NOT classify events — that is event_engine.py's responsibility.
    """

    def __init__(self, providers: Optional[List[NewsProvider]] = None) -> None:
        self._providers = providers if providers is not None else get_available_providers()

    def fetch_company_news(self, symbol: str, company: str, limit: int = 20) -> List[RawNewsItem]:
        results: List[RawNewsItem] = []
        for p in self._providers:
            try:
                results.extend(p.search_company_news(symbol, company, limit))
            except Exception as exc:
                logger.warning("[news_ingestion] %s company search failed: %s", p.name, exc)
        return _deduplicate(results)

    def fetch_sector_news(self, sector: str, limit: int = 20) -> List[RawNewsItem]:
        results: List[RawNewsItem] = []
        for p in self._providers:
            try:
                results.extend(p.search_sector_news(sector, limit))
            except Exception as exc:
                logger.warning("[news_ingestion] %s sector search failed: %s", p.name, exc)
        return _deduplicate(results)

    def fetch_macro_news(
        self, topics: Optional[List[str]] = None, limit: int = 20
    ) -> List[RawNewsItem]:
        results: List[RawNewsItem] = []
        for p in self._providers:
            try:
                results.extend(p.search_macro_news(topics, limit))
            except Exception as exc:
                logger.warning("[news_ingestion] %s macro search failed: %s", p.name, exc)
        return _deduplicate(results)

    def fetch_competitor_news(
        self, symbol: str, competitors: List[str], limit: int = 10
    ) -> List[RawNewsItem]:
        results: List[RawNewsItem] = []
        for p in self._providers:
            try:
                results.extend(p.search_competitor_news(symbol, competitors, limit))
            except Exception as exc:
                logger.warning("[news_ingestion] %s competitor search failed: %s", p.name, exc)
        return _deduplicate(results)


def _deduplicate(items: List[RawNewsItem]) -> List[RawNewsItem]:
    """Remove near-duplicate headlines (first-60-chars case-insensitive match)."""
    seen: set = set()
    out: List[RawNewsItem] = []
    for item in items:
        key = item.headline[:60].lower().strip()
        if key not in seen:
            seen.add(key)
            out.append(item)
    return out


# ── Null provider (placeholder for cold start) ────────────────────────────────

class NullProvider(NewsProvider):
    """
    Satisfies the interface but returns no results.
    Swap out for a real implementation once providers are configured.
    """

    @property
    def name(self) -> str:
        return "null"

    @property
    def provider_type(self) -> str:
        return "null"

    def is_available(self) -> bool:
        return False

    def search_company_news(self, symbol: str, company: str, limit: int = 20) -> List[RawNewsItem]:
        return []

    def search_sector_news(self, sector: str, limit: int = 20) -> List[RawNewsItem]:
        return []

    def search_macro_news(self, topics: Optional[List[str]] = None, limit: int = 20) -> List[RawNewsItem]:
        return []

    def search_competitor_news(self, symbol: str, competitors: List[str], limit: int = 10) -> List[RawNewsItem]:
        return []


# Register the null provider so the aggregator always has at least one entry
register_provider(NullProvider())
