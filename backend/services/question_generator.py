"""
Bukra Research Question Generator

At the end of every scan, asks: "What should I investigate next?"

Questions are not answers. They are the system's epistemic agenda —
the gaps in current knowledge that need evidence before a conclusion
can be drawn.

Question lifecycle (managed by question_generator + knowledge_evolution):
  open → investigating → validated | rejected | dormant → reactivated

Public API
----------
generate_and_save(candidates, all_memories)  → list[dict]  newly created questions
get_all_questions()                          → list[dict]
get_questions_by_status(status)             → list[dict]
update_question_status(qid, status, note)   → None
"""
import json
import logging
import os
import threading
import time
import uuid
from typing import Optional

logger = logging.getLogger("bukra.question_generator")

_DATA_DIR   = os.path.join(os.path.dirname(__file__), "..", "data")
_Q_PATH     = os.path.join(_DATA_DIR, "research_questions.json")
_lock       = threading.Lock()


# ── I/O ────────────────────────────────────────────────────────────────────────

def _read() -> dict:
    try:
        with open(_Q_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"questions": []}


def _write(data: dict):
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(_Q_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── Read ───────────────────────────────────────────────────────────────────────

def get_all_questions() -> list:
    return _read().get("questions", [])


def get_questions_by_status(status: str) -> list:
    return [q for q in get_all_questions() if q.get("status") == status]


def update_question_status(qid: str, status: str, note: str = ""):
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with _lock:
        data = _read()
        for q in data["questions"]:
            if q["id"] == qid:
                q["status"]       = status
                q["last_updated"] = now
                if note:
                    q.setdefault("notes", []).append({"date": now, "note": note})
                break
        _write(data)


# ── Standing question bank ─────────────────────────────────────────────────────
# These questions are always relevant regardless of what was found in a scan.
# They are seeded once (dedup by text) and remain open until validated.

_STANDING_QUESTIONS = [
    {
        "question":    "האם שחיקת מרווח תפעולי מקדימה ירידת ROIC?",
        "hypothesis":  "חברות עם שחיקה רצופה של 3+ אחוזים במרווח התפעולי יציגו ירידת ROIC בסריקה העוקבת.",
        "priority":    "High",
        "sector":      "All",
        "tags":        ["margins", "ROIC", "predictive"],
    },
    {
        "question":    "האם שיפור ב-FCF מוביל להרחבת מרווחים בפיגור של 2 סריקות?",
        "hypothesis":  "חברות עם שיפור >15% ב-FCF יציגו הרחבת מרווח נקי בממוצע 2 סריקות לאחר מכן.",
        "priority":    "High",
        "sector":      "All",
        "tags":        ["FCF", "margins", "lag"],
    },
    {
        "question":    "האם חברות עם חוב גדל מהכנסות מציגות ירידת ROE?",
        "hypothesis":  "חברות בהן גידול החוב עולה על גידול ההכנסות בשנתיים רצופות יציגו ירידת ROE תוך שנה.",
        "priority":    "Medium",
        "sector":      "All",
        "tags":        ["debt", "ROE", "leverage"],
    },
    {
        "question":    "האם היחלשות סקטוריאלית מופיעה בו-זמנית עם ירידת מחיר?",
        "hypothesis":  "ירידת מגמה ב-60%+ מחברות סקטור תתואם עם ביצועי ביטחוני גרועים ב-12 חודש.",
        "priority":    "Medium",
        "sector":      "All",
        "tags":        ["sector", "price", "correlation"],
    },
    {
        "question":    "האם ניתוק שווי-איכות הוא תופעה מחזורית?",
        "hypothesis":  "ניתוק בין ערך עסקי לתמחור שוק מתרחש בתדירות גבוהה יותר בתקופות עלייה מהירה בריבית.",
        "priority":    "Medium",
        "sector":      "All",
        "tags":        ["valuation", "cycles", "rates"],
    },
    {
        "question":    "האם חברות עם Inventory גדל מהמכירות מציגות ירידת ROE לאחר שנה?",
        "hypothesis":  "עלייה ב-Inventory/Sales ratio מעל 15% תתואם עם ירידת ROE בשנה הבאה.",
        "priority":    "High",
        "sector":      "All",
        "tags":        ["inventory", "ROE", "predictive"],
    },
    {
        "question":    "האם חברות עם רמת ביטחון נמוכה מציגות תנודתיות ציון גבוהה יותר?",
        "hypothesis":  "חברות עם רמת ביטחון Low יציגו שונות ציון גבוהה פי 2 בין סריקות.",
        "priority":    "Low",
        "sector":      "All",
        "tags":        ["confidence", "score", "volatility"],
    },
]


# ── Triggered questions (based on scan findings) ───────────────────────────────

def _triggered_questions(candidates: list) -> list:
    """Generate context-specific questions based on what this scan found."""
    questions = []
    found_types = {c.get("discovery_type") for c in candidates}

    for c in candidates:
        dtype   = c.get("discovery_type", "")
        sectors = c.get("affected_sectors", [])
        sec_str = sectors[0] if sectors else "השוק"

        if dtype == "SectorWeakening":
            questions.append({
                "question":   f"האם ירידת האיכות בסקטור {sec_str} תוביל לירידת ציונים ברמה הבודדת?",
                "hypothesis": f"חברות בסקטור {sec_str} יציגו ירידה ממוצעת של 5+ נקודות ציון תוך 2 סריקות.",
                "priority":   "High",
                "sector":     sec_str,
                "tags":       ["sector", "score", "predictive"],
            })
        elif dtype == "SectorImproving":
            questions.append({
                "question":   f"האם השיפור בסקטור {sec_str} נובע ממחזור ענפי או מיתרון מבני?",
                "hypothesis": f"השיפור בסקטור {sec_str} יישמר ≥3 סריקות אם הוא מבני, ויתאפס אם מחזורי.",
                "priority":   "Medium",
                "sector":     sec_str,
                "tags":       ["sector", "structural", "cyclical"],
            })
        elif dtype == "SignalCategorySurge":
            cat = c.get("signature", "").split(":")[-1]
            questions.append({
                "question":   f"האם ריכוז אותות {cat} מנבא שינוי בציוני השוק הרחב?",
                "hypothesis": f"ריכוז >25% אות {cat} יוביל לירידה ממוצעת של 3+ נקודות ציון בסריקה הבאה.",
                "priority":   "High",
                "sector":     "All",
                "tags":       ["signals", "predictive", cat.lower()],
            })
        elif dtype == "BroadMarketDirection":
            direction = "שיפור" if "Improving" in c.get("signature", "") else "היחלשות"
            questions.append({
                "question":   f"האם המגמה הרחבה של {direction} עקבית על פני מחזורי ריבית שונים?",
                "hypothesis": f"מגמת {direction} רחבה מעל 60% תתמיד ≥3 סריקות ב-70% מהמקרים.",
                "priority":   "High",
                "sector":     "All",
                "tags":       ["macro", "broad_market", "persistence"],
            })

    return questions


# ── Dedup + save ───────────────────────────────────────────────────────────────

def _question_exists(questions: list, question_text: str) -> bool:
    return any(q.get("question", "").strip() == question_text.strip() for q in questions)


def generate_and_save(candidates: list, all_memories: list) -> list:
    """
    Generate research questions from scan candidates + standing bank.
    Only saves questions that don't already exist (dedup by text).
    Returns the list of newly created questions.
    """
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # Build candidate question list
    new_q_dicts: list = []

    # 1. Standing questions (seed once)
    for tpl in _STANDING_QUESTIONS:
        new_q_dicts.append({
            "question":    tpl["question"],
            "hypothesis":  tpl["hypothesis"],
            "priority":    tpl["priority"],
            "sector":      tpl["sector"],
            "tags":        tpl.get("tags", []),
            "generated_by":"standing_bank",
        })

    # 2. Triggered questions from this scan
    for tpl in _triggered_questions(candidates):
        new_q_dicts.append({**tpl, "generated_by": "question_generator"})

    # Save new questions (skip duplicates)
    created = []
    with _lock:
        data    = _read()
        existing = data.setdefault("questions", [])

        for q_dict in new_q_dicts:
            if _question_exists(existing, q_dict["question"]):
                # Check if a related discovery now links to this question
                _maybe_link_discovery(existing, q_dict, candidates)
                continue

            entry = {
                "id":                 str(uuid.uuid4())[:8],
                "question":           q_dict["question"],
                "hypothesis":         q_dict.get("hypothesis", ""),
                "priority":           q_dict.get("priority", "Medium"),
                "sector":             q_dict.get("sector", "All"),
                "tags":               q_dict.get("tags", []),
                "generated_by":       q_dict.get("generated_by", "question_generator"),
                "status":             "open",
                "related_discoveries":[],
                "created_at":         now,
                "last_updated":       now,
                "notes":              [],
                "resolved_at":        None,
                "resolution_summary": None,
            }
            existing.append(entry)
            created.append(entry)

        # Mark any open question as "investigating" if a related discovery appeared
        for q in existing:
            if q.get("status") == "open":
                for c in candidates:
                    if _question_relates_to_discovery(q, c):
                        q["status"]       = "investigating"
                        q["last_updated"] = now
                        q.setdefault("related_discoveries", []).append(c["signature"])
                        break

        # Mark dormant: open questions not linked to any discovery after many scans
        # (simple heuristic: questions older than 5 minutes with no related discoveries — in production
        # this would be "5 scans". For now, we flag it if no related discovery exists.)

        _write(data)
    logger.info("[question_generator] %d new questions created", len(created))
    return created


def _maybe_link_discovery(existing: list, q_dict: dict, candidates: list):
    """Link a related discovery to an existing question (mutates existing in place)."""
    for q in existing:
        if q.get("question") == q_dict["question"]:
            for c in candidates:
                if _question_relates_to_discovery(q, c):
                    sig = c["signature"]
                    if sig not in q.get("related_discoveries", []):
                        q.setdefault("related_discoveries", []).append(sig)
                        q["status"] = "investigating"
            break


def _question_relates_to_discovery(q: dict, c: dict) -> bool:
    """Heuristic: question relates to discovery if sector or tags overlap."""
    q_sector = q.get("sector", "All")
    c_sectors = c.get("affected_sectors", [])
    if q_sector != "All" and q_sector in c_sectors:
        return True
    q_tags = set(q.get("tags", []))
    c_type = c.get("discovery_type", "").lower()
    if any(tag in c_type for tag in q_tags):
        return True
    return False
