"""
Bukra Score category weights.

These weights control how each category contributes to the final Bukra Score.
Category DISPLAY scores (e.g. 21/25) are never affected — only the final 0-100.

Edit only here. Never hardcode weights in bukra_score.py or anywhere else.

Rationale:
  Profitability (0.30)  — Most predictive of long-term business durability.
  Cash Flow    (0.25)   — Real cash is harder to manipulate than reported earnings.
  Stability    (0.20)   — Balance-sheet strength protects against adversity.
  Growth       (0.15)   — Important but already partially captured by profitability trends.
  Debt         (0.10)   — Least independent; captured better by stability metrics.

Sum must equal 1.0.
"""

BUKRA_WEIGHTS: dict[str, float] = {
    "profitability": 0.30,
    "cash_flow":     0.25,
    "stability":     0.20,
    "growth":        0.15,
    "debt":          0.10,
}

# Verify weights sum to 1.0 at import time (fast, no deps)
_total = sum(BUKRA_WEIGHTS.values())
assert abs(_total - 1.0) < 1e-9, (
    f"BUKRA_WEIGHTS must sum to 1.0 — got {_total}. Fix bukra_weights.py."
)
