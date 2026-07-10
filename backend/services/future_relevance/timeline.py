"""
Research Timeline — how our opinion of a company evolved over time.

Built from Research Memory. Each entry: when, what we concluded, how sure we
were, and why. Future UI versions will visualize this evolution; the data
shape is stable now.
"""

from services.future_relevance import memory


def build_timeline(symbol: str) -> list[dict]:
    """Chronological timeline entries (oldest first) for a company."""
    entries = []
    prev_score = None
    for report in memory.get_history(symbol):
        score = report.get("score")
        entries.append({
            "date":          report.get("timestamp"),
            "score":         score,
            "delta":         (score - prev_score) if (score is not None and prev_score is not None) else None,
            "confidence":    report.get("confidence"),
            "status":        report.get("status"),
            "engineVersion": report.get("engineVersion"),
            # Knowledge evolution: what changed, or what triggered this run.
            # Falls back to the research summary for the initial analysis.
            "reason":        "; ".join(report.get("triggeredBy") or report.get("changes") or [])
                             or report.get("reasoning", ""),
            "thesisVersion": (report.get("thesis") or {}).get("version"),
        })
        prev_score = score if score is not None else prev_score
    return entries
