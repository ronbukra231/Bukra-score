"""
Analyst interface — every AI analyst (placeholder or real) implements this.

The multi-analyst architecture: each analyst studies ONE dimension of a
company's long-term relevance and returns a structured AnalystReport.
The Judge combines all reports into a single Future Relevance conclusion.

To add a real LLM analyst later:
  1. Subclass Analyst, implement analyze() with an LLM call.
  2. Register it in analysts/__init__.py.
Nothing else changes.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from services.future_relevance.context import ResearchContext


@dataclass
class AnalystReport:
    """Structured research output of a single analyst."""
    analyst_key: str                 # e.g. "ai_adoption"
    label: str                       # display label in the active language
    score: int                       # 0–100, this analyst's relevance verdict
    confidence: str                  # "High" | "Medium" | "Low"
    reasoning: str                   # why the analyst reached this score
    opportunities: list = field(default_factory=list)   # [{key,label,score,summary}]
    risks: list = field(default_factory=list)           # [{key,label,severity,summary}]
    trends: list = field(default_factory=list)          # [{key,label,relevance}]
    assumptions: list = field(default_factory=list)     # explicit assumptions made
    sources: list = field(default_factory=list)         # data sources used

    def to_dict(self) -> dict:
        return {
            "analystKey":    self.analyst_key,
            "label":         self.label,
            "score":         self.score,
            "confidence":    self.confidence,
            "reasoning":     self.reasoning,
            "opportunities": self.opportunities,
            "risks":         self.risks,
            "trends":        self.trends,
            "assumptions":   self.assumptions,
            "sources":       self.sources,
        }


class Analyst(ABC):
    """One independent research perspective on a company."""

    key: str = ""          # stable identifier, e.g. "regulation"
    is_placeholder = True  # real LLM analysts set this to False

    @abstractmethod
    def analyze(self, ctx: ResearchContext) -> AnalystReport:
        ...
