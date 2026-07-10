"""
Background Intelligence — the user never asks for analysis; Bukra already knows.

Entry point for autonomous re-evaluation: when the event layer observes
meaningful new information about a company, it calls maybe_reanalyze().
If change detection recommends it, a fresh research run executes, Research
Memory records exactly why, and the user later sees only the meaningful
changes (via changesSinceLast in the next page payload).

Wiring plan (future sprint): services/event_engine.py + news_ingestion.py
feed observed events here on their existing schedules. No API change needed.
"""

import logging

from services.future_relevance.context import ResearchContext
from services.future_relevance.change_detection import recommend_reanalysis
from services.future_relevance.engine import run_research

logger = logging.getLogger("bukra.future_relevance")


def maybe_reanalyze(symbol: str, events: list, info: dict, score_data: dict,
                    lang: str = "he") -> dict:
    """
    Re-run research for a company if observed events justify it.

    Returns {"reanalyzed": bool, "recommendation": {...}, "result": payload|None}
    """
    recommendation = recommend_reanalysis(symbol, events)
    if not recommendation["reanalyze"]:
        return {"reanalyzed": False, "recommendation": recommendation, "result": None}

    logger.info("[fr-background] re-analyzing %s — triggered by %s",
                symbol, recommendation["triggeredBy"])
    ctx    = ResearchContext(symbol=symbol, info=info, score_data=score_data, lang=lang)
    result = run_research(ctx, trigger_reasons=recommendation["reasons"])
    return {"reanalyzed": True, "recommendation": recommendation, "result": result}
