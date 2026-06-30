"""
Bukra World Model — persistent pattern learning from real market observations.

Job: learning, not predicting.

Every completed company scan is an observation. Patterns emerge when multiple
companies share the same combination of financial signals. Over time Bukra
builds a library of patterns it has actually seen — with frequency, confidence,
and outcome history so it can answer "what usually follows this?" instead of
"what is happening right now?"

Nothing is invented here. Every pattern starts from a real scan.
Every confidence value is traceable to observed company data.
"""

import json
import math
import os
import threading
import time
from typing import Optional

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
_WM_PATH  = os.path.join(_DATA_DIR, "world_model.json")
_lock     = threading.Lock()

_CONF_FLOOR   = 0.10
_CONF_CEILING = 0.95

# After this many companies confirm a pattern it is no longer "emerging"
_EMERGING_THRESHOLD = 3


# ── Storage ───────────────────────────────────────────────────────────────────

def _read() -> dict:
    try:
        with open(_WM_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {
            "patterns": {},
            "meta": {
                "total_observations": 0,
                "total_companies":    0,
                "last_updated":       None,
            },
        }


def _write(data: dict):
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(_WM_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── Pattern signature extraction ──────────────────────────────────────────────

def score_tier(score: Optional[int]) -> str:
    if score is None:   return "unknown"
    if score >= 90:     return "90+"
    if score >= 80:     return "80-89"
    if score >= 70:     return "70-79"
    if score >= 60:     return "60-69"
    return "below-60"


def extract_signature(snapshot: dict) -> Optional[str]:
    """
    Build a deterministic pattern signature from an intelligence snapshot.
    Returns None if there is not enough financial data to form a pattern.

    Dimensions:
      fcf    — free_cash_flow trend:  up / flat / down
      margin — net_margin trend:      up / flat / down
      debt   — total_debt trend:      improving / stable / worsening
      rev    — revenue trend:         up / flat / down
      trend  — overall direction:     Improving / Stable / Weakening
      tier   — Bukra score bucket:    90+ / 80-89 / 70-79 / 60-69 / below-60
    """
    trend   = snapshot.get("trend", {})
    metrics = trend.get("metrics", {})
    score   = snapshot.get("score")

    fcf    = metrics.get("fcf_trend")      # up / flat / down
    margin = metrics.get("margin_trend")   # up / flat / down
    debt   = metrics.get("debt_trend")     # improving / stable / worsening
    rev    = metrics.get("revenue_trend")  # up / flat / down

    # Need at least 2 trend signals to form a meaningful pattern
    filled = [v for v in [fcf, margin, debt, rev] if v is not None]
    if len(filled) < 2:
        return None

    tier      = score_tier(score)
    direction = trend.get("direction", "Stable")

    return "|".join([
        f"fcf:{fcf or 'unknown'}",
        f"margin:{margin or 'unknown'}",
        f"debt:{debt or 'unknown'}",
        f"rev:{rev or 'unknown'}",
        f"trend:{direction}",
        f"tier:{tier}",
    ])


def _human_label(sig: str) -> str:
    """Readable Hebrew/English label for a pattern signature."""
    parts = {}
    for token in sig.split("|"):
        if ":" in token:
            k, v = token.split(":", 1)
            parts[k] = v

    pieces = []
    fcf    = parts.get("fcf")
    margin = parts.get("margin")
    debt   = parts.get("debt")
    rev    = parts.get("rev")
    tier   = parts.get("tier", "")

    if fcf    == "up":         pieces.append("FCF גדל")
    elif fcf  == "down":       pieces.append("FCF יורד")
    if margin == "up":         pieces.append("מרווחים מתרחבים")
    elif margin == "down":     pieces.append("מרווחים נשחקים")
    if debt   == "improving":  pieces.append("חוב יורד")
    elif debt == "worsening":  pieces.append("חוב עולה")
    if rev    == "up":         pieces.append("הכנסות גדלות")
    elif rev  == "down":       pieces.append("הכנסות יורדות")
    if tier:                   pieces.append(f"ציון {tier}")

    return " · ".join(pieces) if pieces else sig[:60]


def _compute_confidence(frequency: int, outcome_count: int, success_rate: Optional[float]) -> float:
    """
    Confidence grows in two stages:
    1. Frequency-based (before any outcomes):  logarithmic growth as more companies confirm
    2. Outcome-blended (once outcomes arrive): weighted blend of frequency confidence and
       empirical success rate. Outcomes gain influence as their sample size grows.
    """
    freq_conf = _CONF_FLOOR + (1 - _CONF_FLOOR) * (1 - math.exp(-frequency / 20))
    freq_conf = min(_CONF_CEILING, freq_conf)

    if outcome_count < 3 or success_rate is None:
        return round(freq_conf, 4)

    # Outcome weight increases up to 60% as we see more resolved cases
    outcome_weight = min(outcome_count / 20, 0.6)
    blended = freq_conf * (1 - outcome_weight) + success_rate * outcome_weight
    return round(min(_CONF_CEILING, max(_CONF_FLOOR, blended)), 4)


# ── Public API ────────────────────────────────────────────────────────────────

def observe(snapshot: dict) -> Optional[str]:
    """
    Record one observation from a completed intelligence scan.
    Returns the pattern_signature if the world model was updated, else None.
    Called immediately after save_intelligence_snapshot().
    """
    sig = extract_signature(snapshot)
    if not sig:
        return None

    symbol = snapshot.get("symbol", "")
    sector = snapshot.get("sector", "Unknown")
    score  = snapshot.get("score")
    today  = time.strftime("%Y-%m-%d")
    now    = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    with _lock:
        data     = _read()
        patterns = data.setdefault("patterns", {})
        meta     = data.setdefault("meta", {
            "total_observations": 0,
            "total_companies":    0,
            "last_updated":       None,
        })

        p = patterns.get(sig)
        if p is None:
            p = {
                "pattern_id":              f"P{len(patterns) + 1:04d}",
                "pattern_signature":       sig,
                "label":                   _human_label(sig),
                "companies":               [],
                "sectors":                 [],
                "frequency":               0,
                "success_rate":            None,
                "confidence":              _CONF_FLOOR,
                "first_seen":              today,
                "last_seen":               today,
                "supporting_evidence":     [],
                "contradicting_evidence":  [],
                "outcome_count":           0,
                "positive_outcome_count":  0,
            }

        is_new_company = symbol and symbol not in p["companies"]
        if is_new_company:
            p["companies"].append(symbol)
        if sector and sector not in p["sectors"]:
            p["sectors"].append(sector)

        p["frequency"] = len(p["companies"])
        p["last_seen"] = today
        p["confidence"] = _compute_confidence(
            p["frequency"], p["outcome_count"], p["success_rate"]
        )

        evidence_entry = {
            "company": symbol,
            "sector":  sector,
            "score":   score,
            "date":    today,
        }
        # Cap evidence list at 100 to control file size
        if is_new_company and len(p["supporting_evidence"]) < 100:
            p["supporting_evidence"].append(evidence_entry)

        patterns[sig] = p

        # Update meta
        meta["total_observations"] = meta.get("total_observations", 0) + 1
        if is_new_company:
            meta["total_companies"] = meta.get("total_companies", 0) + 1
        meta["last_updated"] = now

        _write(data)

    return sig


def record_outcome(sig: str, symbol: str, beat_spy: bool, alpha: float):
    """
    Called when a 90-day accuracy outcome resolves for a company.
    Updates success_rate and adjusts confidence accordingly.
    This is the mechanism by which the world model learns from reality.
    """
    with _lock:
        data     = _read()
        patterns = data.get("patterns", {})
        p        = patterns.get(sig)
        if not p:
            return

        p["outcome_count"]          = p.get("outcome_count", 0) + 1
        if beat_spy:
            p["positive_outcome_count"] = p.get("positive_outcome_count", 0) + 1

        total    = p["outcome_count"]
        positive = p["positive_outcome_count"]
        p["success_rate"] = round(positive / total, 4) if total > 0 else None

        # Recompute confidence with outcome data
        p["confidence"] = _compute_confidence(p["frequency"], total, p["success_rate"])

        entry = {"company": symbol, "alpha": alpha, "date": time.strftime("%Y-%m-%d")}
        if beat_spy:
            if len(p["supporting_evidence"]) < 100:
                p["supporting_evidence"].append(entry)
        else:
            if len(p["contradicting_evidence"]) < 100:
                p["contradicting_evidence"].append(entry)

        patterns[sig] = p
        data["patterns"] = patterns
        _write(data)


def get_all_patterns() -> list:
    data = _read()
    pats = list(data.get("patterns", {}).values())
    return sorted(pats, key=lambda p: (-p["confidence"], -p["frequency"]))


def get_pattern(sig: str) -> Optional[dict]:
    return _read().get("patterns", {}).get(sig)


def get_company_patterns(symbol: str) -> list:
    """All patterns this company's scans have contributed observations to."""
    return [
        p for p in _read().get("patterns", {}).values()
        if symbol in p.get("companies", [])
    ]


def get_stats() -> dict:
    data     = _read()
    patterns = list(data.get("patterns", {}).values())
    meta     = data.get("meta", {})

    with_outcomes  = [p for p in patterns if p.get("outcome_count", 0) > 0]
    emerging       = [p for p in patterns if p["frequency"] < _EMERGING_THRESHOLD]
    confirmed      = [p for p in patterns if p["frequency"] >= _EMERGING_THRESHOLD]
    high_conf      = [p for p in patterns if p["confidence"] >= 0.60]
    strengthened   = sorted(
        [p for p in with_outcomes if (p.get("success_rate") or 0) >= 0.65],
        key=lambda p: -(p.get("success_rate") or 0)
    )[:5]
    weakened       = sorted(
        [p for p in with_outcomes if (p.get("success_rate") or 1) <= 0.35],
        key=lambda p: (p.get("success_rate") or 1)
    )[:5]

    return {
        "total_patterns":           len(patterns),
        "total_observations":       meta.get("total_observations", 0),
        "total_companies_observed": meta.get("total_companies", 0),
        "patterns_with_outcomes":   len(with_outcomes),
        "emerging_patterns":        len(emerging),
        "confirmed_patterns":       len(confirmed),
        "high_confidence_patterns": len(high_conf),
        "last_updated":             meta.get("last_updated"),
        "recently_strengthened":    strengthened,
        "recently_weakened":        weakened,
        "most_observed":            sorted(patterns, key=lambda p: -p["frequency"])[:5],
    }
