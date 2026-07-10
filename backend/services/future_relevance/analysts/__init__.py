"""
Analyst registry.

To swap a placeholder for a real LLM analyst: implement it (same key),
and register it here. Order does not matter — the Judge weighs reports,
not positions.
"""

from services.future_relevance.analysts.base import Analyst, AnalystReport
from services.future_relevance.analysts.placeholder import ALL_PLACEHOLDER_ANALYSTS

_REGISTRY: list[type[Analyst]] = list(ALL_PLACEHOLDER_ANALYSTS)


def get_analysts() -> list[Analyst]:
    """Instantiate every registered analyst."""
    return [cls() for cls in _REGISTRY]


__all__ = ["Analyst", "AnalystReport", "get_analysts"]
