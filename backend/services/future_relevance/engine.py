"""
Research Engine — orchestrates one full research run.

Flow:  ResearchContext → all Analysts → Judge → Confidence → Scenarios
       → Knowledge Evolution (vs previous conclusion) → Investment Thesis
       → Research Memory → API payload

The engine never produces a one-time opinion: every run compares itself
against the previous conclusion, evolves (or reconfirms) the investment
thesis, and records the result permanently.
"""

import logging
from datetime import datetime, timezone

from services.future_relevance.context import ResearchContext
from services.future_relevance.analysts import get_analysts
from services.future_relevance.judge import judge, build_summary
from services.future_relevance.confidence import compute_confidence
from services.future_relevance.scenarios import generate_scenarios
from services.future_relevance.evolution import detect_changes
from services.future_relevance.thesis import build_thesis
from services.future_relevance.conviction import compute_conviction
from services.future_relevance import memory, ledger

logger = logging.getLogger("bukra.future_relevance")

ENGINE_VERSION = "2.2.0"


def run_research(ctx: ResearchContext, trigger_reasons: list = None) -> dict:
    """
    Run a full multi-analyst research pass for one company.
    `trigger_reasons` — set by Background Intelligence when a change event
    initiated this run; recorded in memory so the timeline can explain WHY.
    """
    ctx.previous_reports = memory.get_history(ctx.symbol)
    previous = ctx.previous_reports[-1] if ctx.previous_reports else None

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

    # 4. Knowledge evolution — has anything materially changed since last time?
    changes = detect_changes(ctx, previous, verdict["score"], confidence, verdict["status"])

    # 5. Investment thesis — evolves or is reconfirmed, never rewritten
    prev_thesis = previous.get("thesis") if previous else None
    thesis = build_thesis(ctx, verdict, confidence, reports, generated_at, previous=prev_thesis)

    # 5b. Conviction — how strongly Bukra should believe its own prediction.
    #     Independent from both score and confidence; informed by the
    #     prediction ledger's realized track record.
    conviction = compute_conviction(
        reports,
        is_placeholder=is_placeholder,
        historical_accuracy=ledger.historical_hit_rate(ctx.symbol),
    )

    # 6. Persist to permanent research memory (deduped against latest report)
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
    record["thesis"]     = thesis
    record["changes"]    = changes
    record["conviction"] = conviction["score"]
    if trigger_reasons:
        record["triggeredBy"] = trigger_reasons
    stored = memory.save_report(ctx.symbol, record)

    # 6b. Prediction ledger — every stored research run is a prediction that
    #     reality will later grade. Deduped alongside memory (same gate).
    if stored:
        ledger.record_prediction(
            symbol=ctx.symbol,
            prediction=thesis["currentThesis"],
            score=verdict["score"],
            confidence=confidence,
            conviction=conviction["score"],
            horizon="10-15y",
            engine_version=ENGINE_VERSION,
            module_scores={r.analyst_key: r.score for r in reports},
        )

    # 7. API payload — same shape the UI already renders, plus engine metadata
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
        "thesis":         thesis,
        "changesSinceLast": changes,
        "conviction":     conviction,
        "analystBreakdown": [
            {"key": r.analyst_key, "label": r.label, "score": r.score, "confidence": r.confidence}
            for r in reports
        ],
    }
