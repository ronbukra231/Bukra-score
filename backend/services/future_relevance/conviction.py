"""
Bukra Conviction Engine — separate from prediction, separate from confidence.

Prediction answers:  "What do we believe will happen?"
Conviction answers:  "How strongly should Bukra believe this prediction?"

Conviction is computed from ten factors, each 0.0–1.0. Placeholder-derived
factors are capped conservatively — Bukra never fakes certainty. Each factor
becomes measurable as its real data source comes online (ledger, sources,
world model), without changing this contract.
"""

from statistics import pstdev

from services.future_relevance.analysts.base import AnalystReport

# Factor weights (must sum to 1.0)
FACTOR_WEIGHTS = {
    "historical_accuracy": 0.15,   # from prediction ledger resolutions
    "analyst_agreement":   0.15,   # score dispersion across analysts
    "evidence_quality":    0.12,   # verified sources vs heuristics
    "evidence_quantity":   0.08,   # number of independent signals
    "source_reliability":  0.10,   # track record of the sources used
    "causal_certainty":    0.10,   # strength of supporting causal chains
    "macro_stability":     0.10,   # world-model turbulence
    "unknown_variables":   0.08,   # inverse of open unknowns
    "model_agreement":     0.06,   # multiple models reaching same verdict
    "historical_analogues": 0.06,  # base-rate support from pattern library
}
_total = sum(FACTOR_WEIGHTS.values())
assert abs(_total - 1.0) < 1e-9, f"FACTOR_WEIGHTS must sum to 1.0 — got {_total}"

# Ceiling while the engine runs on placeholder analysts: real conviction
# requires real evidence. Removed when isPlaceholder goes False.
PLACEHOLDER_CONVICTION_CAP = 60


def compute_conviction(reports: list, *, is_placeholder: bool,
                       historical_accuracy: float = None,
                       macro_stability: float = None) -> dict:
    """
    Returns {"score": 0-100, "factors": {name: 0.0-1.0}, "capped": bool}.

    historical_accuracy — hit-rate from the prediction ledger (None until
    enough predictions resolve). macro_stability — from the world model
    (None until themes carry evidence).
    """
    scores = [r.score for r in reports]
    spread = pstdev(scores) if len(scores) > 1 else 0.0

    # Agreement: spread 0 → 1.0, spread ≥20 → 0.0
    agreement = max(0.0, 1.0 - spread / 20.0)

    factors = {
        "historical_accuracy": historical_accuracy if historical_accuracy is not None else 0.5,
        "analyst_agreement":   round(agreement, 2),
        "evidence_quality":    0.3 if is_placeholder else 0.6,
        "evidence_quantity":   min(1.0, len(reports) / 13),
        "source_reliability":  0.3 if is_placeholder else 0.6,
        "causal_certainty":    0.5,   # wired to causal_graph chain strength later
        "macro_stability":     macro_stability if macro_stability is not None else 0.5,
        "unknown_variables":   0.4,   # inverse of open unknowns — improves with evidence
        "model_agreement":     0.5,   # single model today; multi-model later
        "historical_analogues": 0.5,  # wired to patterns.find_analogues base rates later
    }

    raw = sum(factors[k] * FACTOR_WEIGHTS[k] for k in FACTOR_WEIGHTS)
    score = round(raw * 100)

    capped = False
    if is_placeholder and score > PLACEHOLDER_CONVICTION_CAP:
        score, capped = PLACEHOLDER_CONVICTION_CAP, True

    return {"score": score, "factors": factors, "capped": capped}
