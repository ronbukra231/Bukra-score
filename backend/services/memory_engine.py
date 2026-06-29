"""
Bukra Memory Engine — long-term belief management.

Sits above knowledge_base.py (basic CRUD) and enriches every discovery with:
  • confidence_history  — a dated timeline of how confidence evolved
  • evidence_history    — each evidence batch recorded with date + type
  • validation_history  — lifecycle events (detected, promoted, archived …)
  • four_questions      — mandatory scientific framing of every discovery
  • research_score      — composite quality score (0–100)

Data lives in backend/data/memory.json (keyed by signature).

Public API
----------
update_memory(candidate, prev_confidence, prev_status)  → dict
get_all_memories()                                      → list[dict]
get_memory(signature)                                   → dict | None
compute_research_score(memory)                          → dict
"""
import json
import logging
import os
import threading
import time
from typing import Optional

logger = logging.getLogger("bukra.memory_engine")

_DATA_DIR   = os.path.join(os.path.dirname(__file__), "..", "data")
_MEM_PATH   = os.path.join(_DATA_DIR, "memory.json")
_lock       = threading.Lock()


# ── I/O ────────────────────────────────────────────────────────────────────────

def _read() -> dict:
    try:
        with open(_MEM_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"memories": {}}


def _write(data: dict):
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(_MEM_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── Read ───────────────────────────────────────────────────────────────────────

def get_all_memories() -> list:
    return list(_read().get("memories", {}).values())


def get_memory(signature: str) -> Optional[dict]:
    return _read().get("memories", {}).get(signature)


# ── Four mandatory questions ───────────────────────────────────────────────────

_INVALIDATION_BY_TYPE = {
    "SectorWeakening":     "הדפוס ייסתר אם ≥2 סריקות עוקבות יראו פחות מ-40% חברות בסקטור במגמת היחלשות.",
    "SectorImproving":     "הדפוס ייסתר אם ≥2 סריקות עוקבות יראו פחות מ-40% חברות בסקטור במגמת שיפור.",
    "SignalCategorySurge": "הדפוס ייסתר אם האות יופיע בפחות מ-15% מהחברות בשתי סריקות עוקבות.",
    "ValuationQualityDisconnect": "הדפוס ייסתר אם כמות חברות האיכות קרוב לשפל תרד מ-3 בסריקה הבאה.",
    "HighConfidenceWeakening": "הדפוס ייסתר אם החברות הבעייתיות יציגו שיפור מגמה בסריקה עוקבת.",
    "ScorePolarization":   "הדפוס ייסתר אם %-חברות אזור הביניים (ציון 45–70) יעלה מ-30%.",
    "BroadMarketDirection":"הדפוס ייסתר אם הכיוון הרחב יתהפך, או אחוז הכיוון יירד מ-50%.",
    "DebtStressCrossSector":"הדפוס ייסתר אם אותות חוב יצטמצמו לסקטור יחיד בסריקה הבאה.",
    "SectorDataGap":       "הדפוס ייסתר אם רמת הביטחון הממוצעת בסקטור תעלה מ-Medium.",
}

_SIGNIFICANCE_BY_TYPE = {
    "SectorWeakening":     "היחלשות רוחבית מצביעה על גורם חיצוני משותף לסקטור — לחץ תחרותי, שינוי רגולטורי, או מחזור ענפי — שאינו מוסבר בגורמים פנים-חברתיים.",
    "SectorImproving":     "שיפור רוחבי בסקטור מצביע על מחזור עסקי חיובי, יתרון מבני, או שינוי בדינמיקת הענף — לא על הצלחה מקרית של חברה בודדת.",
    "SignalCategorySurge": "ריכוז אות אחד ב-25%+ מהחברות עלול לשקף לחץ שיטתי שטרם מצא ביטוי מלא במחיר — חלון אפשרי לפני שהמידע מתמחר.",
    "ValuationQualityDisconnect": "כאשר מספר חברות איכות נסחרות מתחת לשוויין הפיננסי בו-זמנית, הסנטימנט השוקי ניתק מהנתונים — מצב שהיסטורית מתקן.",
    "HighConfidenceWeakening": "כאשר הנתונים מלאים ואמינים והמגמה עדיין שלילית — זהו האות הכי אמין שהמערכת מסוגלת לייצר. אי-ודאות הנתונים אינה גורם מבלבל כאן.",
    "ScorePolarization":   "מיעוט חברות באזור הביניים מצביע על שוק ללא 'ממוצע' — חברות חזקות נשארות חזקות, וחלשות נשארות חלשות. ביניים נדיר.",
    "BroadMarketDirection":"מגמה שחוצה סקטורים מרמזת על גורם מאקרו-כלכלי — שינוי ריבית, מחזור כלכלי, אינפלציה — ולא על בעיה ספציפית בענף.",
    "DebtStressCrossSector":"לחץ חוב שמפוזר על סקטורים שונים אינו בעיית ענף — הוא מצביע על גורם מימוני שוקי רחב כגון עלות אשראי גבוהה.",
    "SectorDataGap":       "ידיעה שהנתונים לסקטור מסוים חלשים היא בעצמה מידע חשוב — מסקנות על חברות אלו צריכות להישקל בזהירות.",
}


def _four_questions(candidate: dict) -> dict:
    dtype   = candidate.get("discovery_type", "")
    n       = len(candidate.get("affected_companies", []))
    sectors = ", ".join(candidate.get("affected_sectors", [])[:3]) or "לא מפורט"
    evid    = "; ".join(candidate.get("evidence", [])[:3])

    return {
        "observation":          candidate.get("summary", ""),
        "significance":         _SIGNIFICANCE_BY_TYPE.get(dtype, "דפוס זה מופיע בחברות מרובות בו-זמנית — דבר שמצביע על גורם שוקי רחב."),
        "supporting_evidence":  f"{n} חברות בסקטורים: {sectors}. ראיות: {evid}",
        "invalidation_criteria":_INVALIDATION_BY_TYPE.get(dtype, "הדפוס ייסתר אם לא יזוהה בשלוש סריקות עוקבות."),
    }


# ── Research score ─────────────────────────────────────────────────────────────

def compute_research_score(memory: dict) -> dict:
    """
    Composite scientific quality score (0–100).

    Sub-scores
    ----------
    evidence_quantity    0–25   companies count × scan count
    evidence_quality     0–25   high-confidence companies worth more
    historical_cons      0–20   consecutive confirmations × 5
    cross_sector_cons    0–15   distinct sectors affected
    false_positive_ctrl  0–15   1 − false_positive_probability
    """
    eh  = memory.get("evidence_history", [])
    n   = sum(e.get("count", 0) for e in eh)
    sec = len(set(memory.get("affected_sectors", [])))
    consecutive = memory.get("consecutive_confirmations", 1)
    fp  = memory.get("false_positive_probability", 0.5)

    eq  = min(int(n * 1.2), 25)
    qual= min(int(len(eh) * 4), 25)
    hc  = min(consecutive * 5, 20)
    cs  = min(sec * 5, 15)
    fpc = min(int((1 - fp) * 15), 15)

    total = eq + qual + hc + cs + fpc
    return {
        "total":                  total,
        "evidence_quantity":      eq,
        "evidence_quality":       qual,
        "historical_consistency": hc,
        "cross_sector_consistency": cs,
        "false_positive_control": fpc,
    }


# ── Validation event labels ────────────────────────────────────────────────────

def _validation_event(event: str, candidate: dict) -> dict:
    n    = len(candidate.get("affected_companies", []))
    conf = int(candidate.get("confidence", 0) * 100)
    msgs = {
        "first_detection": f"תגלית זוהתה לראשונה — {n} חברות, ביטחון ראשוני {conf}%.",
        "reconfirmed":     f"דפוס אושר מחדש — {n} חברות בסריקה זו, ביטחון {conf}%.",
        "promoted":        f"הדפוס קיבל מעמד מאושר לאחר אישורים עקביים. ביטחון נוכחי {conf}%.",
        "confidence_jump": f"ביטחון עלה ל-{conf}% — ראיות חדשות חיזקו את הדפוס.",
        "confidence_drop": f"ביטחון ירד ל-{conf}% — ראיות נגדיות או פחות חברות זוהו.",
        "archived":        f"הדפוס לא אותר בסריקות האחרונות ועבר לארכיון. ביטחון אחרון {conf}%.",
    }
    return {
        "date":        time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "event":       event,
        "description": msgs.get(event, event),
    }


# ── Main update ────────────────────────────────────────────────────────────────

def update_memory(
    candidate: dict,
    prev_confidence: float = 0.0,
    prev_status: str = "",
) -> dict:
    """
    Upsert memory entry for a discovery candidate.
    Appends to confidence_history, evidence_history, validation_history.
    Returns the updated memory dict.
    """
    signature = candidate["signature"]
    now       = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    conf      = candidate.get("confidence", 0.0)

    with _lock:
        data   = _read()
        mems   = data.setdefault("memories", {})
        mem    = mems.get(signature)
        is_new = mem is None

        if is_new:
            mem = {
                "signature":         signature,
                "discovery_type":    candidate.get("discovery_type", ""),
                "title":             candidate.get("title", ""),
                "category":          candidate.get("category", ""),
                "importance":        candidate.get("importance", "Medium"),
                "affected_sectors":  candidate.get("affected_sectors", []),
                "affected_companies":candidate.get("affected_companies", []),
                "created_at":        now,
                "last_updated":      now,
                "status":            "emerging",
                "consecutive_confirmations": 1,
                "false_positive_probability": candidate.get("false_positive_probability",
                                              round(1 - conf, 2)),
                "confidence_history":  [],
                "evidence_history":    [],
                "validation_history":  [],
                "four_questions":      _four_questions(candidate),
                "research_score":      {},
            }
            # First detection event
            mem["confidence_history"].append({
                "date":       now,
                "confidence": conf,
                "reason":     "זוהה לראשונה",
            })
            mem["evidence_history"].append({
                "date":  now,
                "type":  "supporting",
                "count": len(candidate.get("affected_companies", [])),
                "items": candidate.get("evidence", [])[:5],
            })
            mem["validation_history"].append(_validation_event("first_detection", candidate))

        else:
            # Update mutable fields
            mem["last_updated"]            = now
            mem["affected_companies"]      = candidate.get("affected_companies", [])
            mem["affected_sectors"]        = candidate.get("affected_sectors", [])
            mem["false_positive_probability"] = candidate.get("false_positive_probability",
                                                              round(1 - conf, 2))
            mem["importance"]              = candidate.get("importance", mem.get("importance", "Medium"))
            prev_conf_stored = mem["confidence_history"][-1]["confidence"] if mem["confidence_history"] else 0.0

            # Confidence event
            conf_delta = conf - prev_conf_stored
            if abs(conf_delta) >= 0.05:
                reason  = "ראיות חדשות חיזקו את הדפוס" if conf_delta > 0 else "ראיות מוגבלות בסריקה זו"
                event   = "confidence_jump" if conf_delta > 0 else "confidence_drop"
                mem["confidence_history"].append({
                    "date":       now,
                    "confidence": conf,
                    "reason":     reason,
                })
                if abs(conf_delta) >= 0.08:
                    mem["validation_history"].append(_validation_event(event, candidate))
            else:
                # Small change — still log it
                mem["confidence_history"].append({
                    "date":       now,
                    "confidence": conf,
                    "reason":     "אושר מחדש — ביטחון יציב",
                })

            # Evidence batch
            mem["evidence_history"].append({
                "date":  now,
                "type":  "supporting",
                "count": len(candidate.get("affected_companies", [])),
                "items": candidate.get("evidence", [])[:5],
            })
            mem["validation_history"].append(_validation_event("reconfirmed", candidate))

            # Status promotion
            occ = mem.get("consecutive_confirmations", 0) + 1
            mem["consecutive_confirmations"] = occ
            if occ >= 2 and mem.get("status") == "emerging":
                mem["status"] = "confirmed"
                mem["validation_history"].append(_validation_event("promoted", candidate))

        # Recompute research score
        mem["research_score"] = compute_research_score(mem)
        mems[signature] = mem
        _write(data)
        return mem


def mark_memory_historical(signature: str, candidate: dict):
    """Mark a memory entry as historical when its discovery goes stale."""
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with _lock:
        data = _read()
        mem  = data.get("memories", {}).get(signature)
        if mem and mem.get("status") in ("emerging", "confirmed"):
            mem["status"]       = "historical"
            mem["last_updated"] = now
            mem["validation_history"].append(_validation_event("archived", candidate or {}))
            _write(data)
