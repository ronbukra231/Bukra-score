"""
Persistence — one JSON file per user under backend/data/simulator/{userId}.json.

This project has no SQL database or ORM anywhere (every existing service —
world_intelligence, future_relevance, valuation, scan history — persists to
versioned JSON files under backend/data/). The simulator follows the same
convention. Keying storage by the authenticated user's id is also the
ownership boundary: an API handler can only ever open the calling user's
file, so cross-user access is structurally impossible, not just checked.

A per-user threading.Lock serializes read-modify-write cycles for that user
(covers double-click approval, concurrent execution, race conditions) while
different users never contend with each other.
"""

import json
import os
import threading
from typing import Optional

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "simulator")

_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def _lock_for(user_id: str) -> threading.Lock:
    with _locks_guard:
        if user_id not in _locks:
            _locks[user_id] = threading.Lock()
        return _locks[user_id]


def _path(user_id: str) -> str:
    safe = "".join(c for c in user_id if c.isalnum() or c in "-_")
    return os.path.join(_DATA_DIR, f"{safe}.json")


_EMPTY_STATE = {
    "portfolio": None,
    "holdings": {},          # id -> dict
    "transactions": [],       # list of dicts, append-only
    "recommendations": {},   # id -> dict
    "auditEvents": [],       # list of dicts, append-only
    "snapshots": [],         # list of dicts, one per day
}


def load_state(user_id: str) -> dict:
    path = _path(user_id)
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
            for k, v in _EMPTY_STATE.items():
                data.setdefault(k, v if not isinstance(v, (dict, list)) else type(v)())
            return data
    except (FileNotFoundError, json.JSONDecodeError):
        return {k: (v if not isinstance(v, (dict, list)) else type(v)()) for k, v in _EMPTY_STATE.items()}


def save_state(user_id: str, state: dict) -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    path = _path(user_id)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False)
    os.replace(tmp, path)


class UserPortfolioLock:
    """Context manager: load state under the user's lock, save on clean exit."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self._lock = _lock_for(user_id)
        self.state: Optional[dict] = None

    def __enter__(self) -> dict:
        self._lock.acquire()
        self.state = load_state(self.user_id)
        return self.state

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type is None:
                save_state(self.user_id, self.state)
        finally:
            self._lock.release()
        return False
