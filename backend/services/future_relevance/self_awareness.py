"""
Self-Awareness — Bukra understands its own strengths and weaknesses.

Answers, from the prediction ledger and research memory:
  Which sectors do I understand best?    Which analyst performs best?
  Where am I consistently wrong?         Where am I improving?
  When should I trust myself?            When should I remain cautious?

Honest by construction: with too little resolved history, the answer is
"insufficient evidence" — never an invented strength.
"""

from services.future_relevance import ledger
from services.future_relevance.self_eval import calibration_report

MIN_RESOLVED_FOR_JUDGMENT = 5


def self_awareness_report() -> dict:
    resolved = [e for e in ledger.get_ledger()
                if e["status"] != "still_unknown" and e.get("accuracy") is not None]

    if len(resolved) < MIN_RESOLVED_FOR_JUDGMENT:
        return {
            "sufficientEvidence": False,
            "resolvedPredictions": len(resolved),
            "note": ("Too few resolved predictions to judge strengths and weaknesses. "
                     "Bukra remains cautious until reality has graded enough of its work."),
            "structuralStats": calibration_report(),   # what CAN be said today
            "calibration": ledger.calibration(),
        }

    # Per-symbol accuracy → where Bukra is consistently right/wrong
    by_symbol: dict = {}
    for e in resolved:
        by_symbol.setdefault(e["symbol"], []).append(e["accuracy"])
    symbol_acc = {s: round(sum(a) / len(a), 2) for s, a in by_symbol.items() if len(a) >= 2}
    ranked = sorted(symbol_acc.items(), key=lambda kv: -kv[1])

    # Improvement: first half of history vs second half
    half = len(resolved) // 2
    early = [e["accuracy"] for e in resolved[:half]]
    late  = [e["accuracy"] for e in resolved[half:]]
    improving = (sum(late) / len(late)) > (sum(early) / len(early)) if early and late else None

    return {
        "sufficientEvidence": True,
        "resolvedPredictions": len(resolved),
        "strongestUnderstanding": ranked[:5],
        "weakestUnderstanding":   ranked[-5:][::-1],
        "improving": improving,
        "calibration": ledger.calibration(),
        # Per-analyst realized accuracy joins here once module-level outcomes
        # are graded (analyst predictions are already stored per run).
        "structuralStats": calibration_report(),
    }
