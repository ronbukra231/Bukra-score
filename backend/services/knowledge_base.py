"""
Bukra Discovery Knowledge Base — persistent storage for market discoveries.

Each discovery tracks its own validation history across multiple scans.
Status lifecycle: emerging → confirmed → historical (or rejected).
"""
import json
import logging
import os
import threading
import time
import uuid
from typing import Optional

logger = logging.getLogger("bukra.knowledge_base")

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
_DB_PATH  = os.path.join(_DATA_DIR, "discoveries.json")
_lock     = threading.Lock()


# ── I/O ────────────────────────────────────────────────────────────────────────

def _read() -> dict:
    try:
        with open(_DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"discoveries": [], "research_notes": []}


def _write(data: dict):
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(_DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── Read ───────────────────────────────────────────────────────────────────────

def get_all_discoveries() -> list:
    return _read().get("discoveries", [])


def get_active_discoveries() -> list:
    return [d for d in get_all_discoveries() if d.get("status") in ("emerging", "confirmed")]


def get_research_notes(limit: int = 30) -> list:
    return _read().get("research_notes", [])[-limit:]


# ── Write ──────────────────────────────────────────────────────────────────────

def upsert_discovery(candidate: dict) -> dict:
    """
    Insert a new discovery or update an existing one matched by signature.

    Promotion rules:
      emerging → confirmed  after ≥2 consecutive confirmations
      confirmed → historical if consecutive_confirmations drops to 0
    """
    signature = candidate["signature"]
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    with _lock:
        data     = _read()
        existing = next(
            (d for d in data["discoveries"] if d.get("signature") == signature),
            None,
        )

        if existing:
            existing["occurrences"]               = existing.get("occurrences", 1) + 1
            existing["consecutive_confirmations"] = existing.get("consecutive_confirmations", 0) + 1
            existing["last_confirmed"]            = now
            existing["confidence"]                = candidate["confidence"]
            existing["affected_companies"]        = candidate["affected_companies"]
            existing["affected_sectors"]          = candidate["affected_sectors"]
            existing["evidence"]                  = candidate["evidence"]
            existing["summary"]                   = candidate["summary"]
            existing["statistical_significance"]  = candidate.get("statistical_significance", candidate["confidence"])
            existing["false_positive_probability"] = round(1.0 - candidate["confidence"], 2)
            existing["importance"]                = candidate.get("importance", existing.get("importance", "Medium"))

            if existing.get("consecutive_confirmations", 0) >= 2 and existing.get("status") == "emerging":
                existing["status"]               = "confirmed"
                existing["requires_validation"]  = False

            _write(data)
            return existing
        else:
            new_disc = {
                **candidate,
                "id":                         str(uuid.uuid4())[:8],
                "occurrences":                1,
                "consecutive_confirmations":  1,
                "first_detected":             now,
                "last_confirmed":             now,
                "status":                     "emerging",
                "requires_validation":        True,
                "statistical_significance":   candidate.get("statistical_significance", candidate["confidence"]),
                "false_positive_probability": round(1.0 - candidate["confidence"], 2),
            }
            data["discoveries"].append(new_disc)
            _write(data)
            return new_disc


def mark_unseen_stale(seen_signatures: set):
    """
    For active discoveries not observed in the latest scan, decrement consecutive
    confirmations. Drops to 0 → status becomes 'historical'.
    """
    with _lock:
        data    = _read()
        changed = False
        for d in data["discoveries"]:
            if d.get("status") not in ("emerging", "confirmed"):
                continue
            if d.get("signature") not in seen_signatures:
                d["consecutive_confirmations"] = max(0, d.get("consecutive_confirmations", 1) - 1)
                if d["consecutive_confirmations"] == 0:
                    d["status"] = "historical"
                    changed     = True
        if changed:
            _write(data)


def append_research_note(note: dict):
    with _lock:
        data = _read()
        data["research_notes"].append(note)
        data["research_notes"] = data["research_notes"][-90:]
        _write(data)
