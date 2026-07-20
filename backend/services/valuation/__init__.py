"""
Bukra Valuation Engine — distinguishes business quality from price attractiveness.

    Bukra Score        → "How strong is the underlying business?"      (unchanged)
    Valuation Score    → "How attractive is the stock at this price?"  (this engine)
    Expectations Gap   → "How much future success is already priced in?"
    Bubble Risk        → "How dependent is the price on aggressive assumptions?"

Modules:
    methodology.py  versioned weights, bands, bounds — the single config source
    inputs.py       provider-payload normalization + missing-input bookkeeping
    classify.py     company-type → methodology mix
    dcf.py          DCF, discount-rate build-up, reverse DCF solver
    scenarios.py    bear/base/bull generation from company-specific history
    scoring.py      component scores + weight normalization + confidence/quality
    conclusions.py  deterministic bilingual factors & conclusion
    engine.py       orchestrator (fail-safe; returns structured insufficiency)
    store.py        versioned append-only persistence
"""

from services.valuation.engine import compute_valuation
from services.valuation.store import get_history as get_valuation_history
from services.valuation.methodology import METHODOLOGY_VERSION

__all__ = ["compute_valuation", "get_valuation_history", "METHODOLOGY_VERSION"]
