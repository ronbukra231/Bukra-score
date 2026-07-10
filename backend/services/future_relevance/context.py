"""
ResearchContext — the single input object passed to every engine component.

All analysts, the judge, the confidence engine and the scenario generator
receive the same context. New data sources (news, filings, events) are added
here, never as extra function parameters.
"""

from dataclasses import dataclass, field


@dataclass
class ResearchContext:
    symbol: str
    info: dict                       # company info (name, sector, country, ...)
    score_data: dict                 # full Bukra Score payload (score, breakdown, audit)
    lang: str = "he"                 # active UI language — content is GENERATED in this language
    previous_reports: list = field(default_factory=list)  # research memory for this symbol

    @property
    def name(self) -> str:
        return self.info.get("name") or self.symbol

    @property
    def sector(self) -> str:
        return self.info.get("sector") or ""

    @property
    def country(self) -> str:
        return self.info.get("country") or ""

    @property
    def bukra_score(self) -> int:
        return self.score_data.get("score") or 50

    def txt(self, he: str, en: str) -> str:
        """Pick text by active language. Content is generated directly, never translated."""
        return he if self.lang == "he" else en
