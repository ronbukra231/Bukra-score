"""
Future Relevance Engine — an independent, continuously evolving research engine.

    Bukra Engine
    ├── Bukra Score Engine        (proven business quality — services/bukra_score.py)
    └── Future Relevance Engine   (long-term relevance — this package)

Components:
    engine.py            Research Engine — orchestrates a full research run
    analysts/            AI Analyst Layer — independent perspectives + registry
    judge.py             Judge — combines analyst opinions into one verdict
    confidence.py        Confidence Engine — independent of the score
    scenarios.py         Scenario Generator — bull / base / bear
    memory.py            Research Memory — permanent per-company history
    timeline.py          Research Timeline — opinion evolution over time
    change_detection.py  Change Detection — when to recommend re-analysis
    context.py           ResearchContext — the single input object

The engine never produces a one-time opinion: every run is stored in Research
Memory, and every new piece of information can strengthen or weaken previous
conclusions. Content is generated directly in the active UI language.
"""

from services.future_relevance.context import ResearchContext
from services.future_relevance.engine import run_research, ENGINE_VERSION
from services.future_relevance.timeline import build_timeline
from services.future_relevance.change_detection import recommend_reanalysis, ChangeEventType


def compute_future_relevance(symbol: str, info: dict, score_data: dict, lang: str = "he") -> dict:
    """Public entry point — backward-compatible with the original module API."""
    ctx = ResearchContext(symbol=symbol, info=info, score_data=score_data, lang=lang)
    return run_research(ctx)


__all__ = [
    "compute_future_relevance",
    "build_timeline",
    "recommend_reanalysis",
    "ChangeEventType",
    "ResearchContext",
    "ENGINE_VERSION",
]
