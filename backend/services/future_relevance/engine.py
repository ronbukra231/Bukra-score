"""
Research Engine — orchestrates one full research run.

Flow:  ResearchContext → all Analysts → Judge → Confidence → Scenarios
       → Research Memory → API payload

The payload shape is stable and backward compatible with the original
Future Relevance response consumed by FutureRelevanceCard / Drawer.
"""

import logging
from datetime import datetime, timezone

from services.future_relevance.context import ResearchContext
from services.future_relevance.analysts import get_analysts
from services.future_relevance.judge import judge, build_summary
from services.future_relevance.confidence import compute_confidence
from services.future_relevance.scenarios import generate_scenarios
from services.future_relevance import memory

logger = logging.getLogger("bukra.future_relevance")

ENGINE_VERSION = "2.0.0"


def run_research(ctx: ResearchContext) -> dict:
    """Run a full multi-analyst research pass for one company."""
    ctx.previous_reports = memory.get_history(ctx.symbol)

    # 1. Every analyst studies the company independently
    reports = []
    for analyst in get_analysts():
        try:
            reports.append(analyst.analyze(ctx))
        except Exception as e:
            logger.warning("[fr-engine] analyst %s failed for %s: %s", analyst.key, ctx.symbol, e)

    # 2. Judge combines the opinions; 3. Confidence is estimated independently
    verdict    = judge(ctx, reports)
    confidence = compute_confidence(reports)
    scenarios  = generate_scenarios(ctx, verdict["score"])
    summary    = build_summary(ctx, verdict, confidence, len(reports))

    generated_at   = datetime.now(timezone.utc).isoformat()
    is_placeholder = all(a.is_placeholder for a in get_analysts())

    # 4. Persist to permanent research memory (deduped against latest report)
    record = memory.build_memory_record(
        ctx.symbol,
        engine_version=ENGINE_VERSION,
        verdict=verdict,
        confidence=confidence,
        reports=reports,
        scenarios=scenarios,
        summary=summary,
        generated_at=generated_at,
    )
    memory.save_report(ctx.symbol, record)

    # 5. API payload — same shape the UI already renders, plus engine metadata
    return {
        "score":          verdict["score"],
        "confidence":     confidence,
        "status":         verdict["status"],
        "isPlaceholder":  is_placeholder,
        "generatedAt":    generated_at,
        "engineVersion":  ENGINE_VERSION,
        "aiSummary":      summary,
        "drivers":        verdict["drivers"],
        "risks":          verdict["risks"],
        "trends":         verdict["trends"],
        "scenarios":      scenarios,
        "analystBreakdown": [
            {"key": r.analyst_key, "label": r.label, "score": r.score, "confidence": r.confidence}
            for r in reports
        ],
    }
