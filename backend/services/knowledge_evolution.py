"""
Bukra Knowledge Evolution — tracks how the system's beliefs change over time.

Every significant change in confidence or status is recorded as a BeliefChange.
These are never deleted. They form the record of how the system learned.

"We believed X. Now we believe Y. Here is why."

Public API
----------
record_evolution(old_memory, new_memory, candidate)  → None
get_all_belief_changes()                             → list[dict]
"""
import json
import logging
import os
import threading
import time
import uuid

logger = logging.getLogger("bukra.knowledge_evolution")

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
_BC_PATH  = os.path.join(_DATA_DIR, "belief_changes.json")
_lock     = threading.Lock()


# ── I/O ────────────────────────────────────────────────────────────────────────

def _read() -> dict:
    try:
        with open(_BC_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"changes": []}


def _write(data: dict):
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(_BC_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_all_belief_changes() -> list:
    return list(reversed(_read().get("changes", [])))


# ── Change type logic ──────────────────────────────────────────────────────────

def _change_type(conf_before: float, conf_after: float, status_before: str, status_after: str) -> str:
    if status_before in ("emerging", "confirmed") and status_after == "historical":
        return "archived"
    if status_before == "emerging" and status_after == "confirmed":
        return "promoted"
    delta = conf_after - conf_before
    if delta > 0.08:
        return "strengthened"
    if delta < -0.08:
        return "weakened"
    return "minor"


def _old_belief(title: str, conf: float, status: str) -> str:
    conf_pct = int(conf * 100)
    status_he = {"emerging": "בחינה", "confirmed": "מאושרת", "historical": "היסטורית"}.get(status, status)
    return f"'{title}' — ביטחון {conf_pct}%, מעמד: {status_he}."


def _new_belief(title: str, conf: float, status: str, change_type: str) -> str:
    conf_pct = int(conf * 100)
    status_he = {"emerging": "בחינה", "confirmed": "מאושרת", "historical": "היסטורית"}.get(status, status)
    verbs = {
        "strengthened": f"הביטחון עלה ל-{conf_pct}%",
        "weakened":     f"הביטחון ירד ל-{conf_pct}%",
        "promoted":     f"הדפוס קיבל מעמד מאושר, ביטחון {conf_pct}%",
        "archived":     f"הדפוס עבר לארכיון — לא זוהה בסריקות האחרונות",
        "minor":        f"הביטחון נשאר יציב ב-{conf_pct}%",
    }
    return verbs.get(change_type, f"ביטחון {conf_pct}%, מעמד: {status_he}.")


def _reason(change_type: str, candidate: dict) -> str:
    n    = len(candidate.get("affected_companies", []))
    dtype = candidate.get("discovery_type", "")
    reasons = {
        "strengthened": f"ראיות חדשות בסריקה זו חיזקו את הדפוס — {n} חברות נצפו.",
        "weakened":     f"פחות ראיות בסריקה זו ({n} חברות) — הדפוס דועך.",
        "promoted":     f"הדפוס אושר בשתי סריקות עוקבות ועלה למעמד מאושר.",
        "archived":     f"הדפוס לא נצפה בשלוש סריקות עוקבות — עבר לארכיון.",
        "minor":        f"שינוי קטן בביטחון — {n} חברות בסריקה זו.",
    }
    return reasons.get(change_type, "ביטחון השתנה בין סריקות.")


# ── Main ───────────────────────────────────────────────────────────────────────

def record_evolution(old_memory: dict, new_memory: dict, candidate: dict):
    """
    Compare old vs new memory state. Record a BeliefChange if the change
    is significant enough to remember (confidence delta ≥ 0.05 OR status changed).
    """
    conf_before   = old_memory.get("last_confidence", 0.0) if old_memory else 0.0
    conf_after    = candidate.get("confidence", 0.0)
    status_before = old_memory.get("status", "emerging") if old_memory else "emerging"
    status_after  = new_memory.get("status", "emerging")

    # Get previous confidence from the history
    ch = old_memory.get("confidence_history", []) if old_memory else []
    if ch:
        conf_before = ch[-1].get("confidence", conf_before)

    ctype = _change_type(conf_before, conf_after, status_before, status_after)
    delta = abs(conf_after - conf_before)

    # Only record if meaningful
    if ctype == "minor" and delta < 0.05:
        return
    if status_before == status_after and delta < 0.05:
        return

    now    = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    change = {
        "id":                 str(uuid.uuid4())[:8],
        "date":               now,
        "signature":          candidate["signature"],
        "title":              candidate.get("title", ""),
        "discovery_type":     candidate.get("discovery_type", ""),
        "category":           candidate.get("category", ""),
        "change_type":        ctype,
        "confidence_before":  round(conf_before, 3),
        "confidence_after":   round(conf_after, 3),
        "confidence_delta":   round(conf_after - conf_before, 3),
        "status_before":      status_before,
        "status_after":       status_after,
        "old_belief":         _old_belief(candidate.get("title", ""), conf_before, status_before),
        "new_belief":         _new_belief(candidate.get("title", ""), conf_after, status_after, ctype),
        "reason":             _reason(ctype, candidate),
        "affected_companies": candidate.get("affected_companies", [])[:6],
        "affected_sectors":   candidate.get("affected_sectors", []),
    }

    with _lock:
        data = _read()
        data["changes"].append(change)
        data["changes"] = data["changes"][-500:]  # Keep last 500 changes
        _write(data)

    logger.info("[knowledge_evolution] %s — %s (delta %.2f)", ctype, candidate.get("title","")[:40], conf_after - conf_before)


def record_archival(signature: str, title: str, conf_before: float):
    """Record when a discovery moves to historical (not found in recent scans)."""
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    change = {
        "id":                 str(uuid.uuid4())[:8],
        "date":               now,
        "signature":          signature,
        "title":              title,
        "discovery_type":     "",
        "category":           "",
        "change_type":        "archived",
        "confidence_before":  round(conf_before, 3),
        "confidence_after":   0.0,
        "confidence_delta":   round(-conf_before, 3),
        "status_before":      "confirmed",
        "status_after":       "historical",
        "old_belief":         f"'{title}' — ביטחון {int(conf_before*100)}%, מעמד: מאושרת.",
        "new_belief":         "הדפוס לא זוהה בסריקות האחרונות ועבר לארכיון היסטורי.",
        "reason":             "הדפוס לא אותר ב-3 סריקות עוקבות — ייתכן שנסיבות השוק השתנו.",
        "affected_companies": [],
        "affected_sectors":   [],
    }
    with _lock:
        data = _read()
        data["changes"].append(change)
        _write(data)
