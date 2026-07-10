"""
Self-Evaluation — the engine measures its own track record.

Every research run is already a stored prediction (Research Memory keeps
score, confidence and per-analyst module scores with timestamps). This
module reads that ledger and produces calibration statistics.

Today: structural statistics (prediction counts, score drift, confidence
distribution, per-analyst dispersion). A future sprint joins these against
realized outcomes via services/accuracy_db.py — same pattern already proven
for the Bukra Score — to measure true prediction accuracy, per-analyst
accuracy and confidence calibration. The report shape is stable now.
"""

from statistics import mean, pstdev

from services.future_relevance import memory


def calibration_report() -> dict:
    """Platform-wide self-evaluation across every company in Research Memory."""
    data = memory._load()

    total_reports   = 0
    conf_counts     = {"High": 0, "Medium": 0, "Low": 0}
    analyst_scores: dict = {}          # analyst_key -> [scores across all reports]
    revisions       = 0                # times a company's score moved between reports

    for symbol, history in data.items():
        total_reports += len(history)
        prev_score = None
        for report in history:
            conf = report.get("confidence")
            if conf in conf_counts:
                conf_counts[conf] += 1
            for key, s in report.get("moduleScores", {}).items():
                analyst_scores.setdefault(key, []).append(s)
            score = report.get("score")
            if prev_score is not None and score != prev_score:
                revisions += 1
            prev_score = score

    return {
        "companiesTracked":  len(data),
        "totalPredictions":  total_reports,
        "scoreRevisions":    revisions,
        "confidenceDistribution": conf_counts,
        "analystStats": {
            key: {
                "predictions": len(scores),
                "meanScore":   round(mean(scores), 1),
                "dispersion":  round(pstdev(scores), 1) if len(scores) > 1 else 0.0,
                # accuracy vs. realized outcomes lands here once wired to accuracy_db
                "realizedAccuracy": None,
            }
            for key, scores in sorted(analyst_scores.items())
        },
    }
