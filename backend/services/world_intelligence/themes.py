"""
Living World Model — Bukra's continuously evolving understanding of the world.

Every global theme carries: current state, confidence, direction, momentum,
and a permanent historical evolution (append-only — the world model remembers
how its understanding changed, not just what it currently believes).

Storage: backend/data/world_themes.json (runtime, gitignored).
"""

import json
import os
import threading
from datetime import datetime, timezone

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
_PATH     = os.path.join(_DATA_DIR, "world_themes.json")
_lock     = threading.Lock()

MAX_HISTORY_PER_THEME = 200

# The global themes Bukra maintains an opinion about. Adding a theme is a
# one-line change; each starts Neutral until evidence moves it.
THEMES = [
    "artificial_intelligence", "energy", "inflation", "interest_rates",
    "semiconductors", "cybersecurity", "defense", "healthcare",
    "consumer_behaviour", "demographics", "climate", "regulation",
    "trade", "supply_chains", "shipping", "technology", "geopolitics",
]

DIRECTIONS = ("Improving", "Stable", "Deteriorating")
MOMENTUM   = ("Accelerating", "Steady", "Slowing")


def _default_theme(key: str) -> dict:
    return {
        "key":        key,
        "state":      "No verified assessment yet — awaiting first evidence.",
        "confidence": "Low",
        "direction":  "Stable",
        "momentum":   "Steady",
        "updatedAt":  None,
        "history":    [],       # append-only evolution of understanding
    }


def _load() -> dict:
    try:
        with open(_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _dump(data: dict) -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    tmp = _PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, _PATH)


def get_theme(key: str) -> dict:
    return _load().get(key, _default_theme(key))


def get_world_model() -> dict:
    """The full current world model — every theme's present understanding."""
    data = _load()
    return {key: data.get(key, _default_theme(key)) for key in THEMES}


def update_theme(key: str, *, state: str, confidence: str, direction: str,
                 momentum: str, evidence: str = "", source: str = "") -> dict:
    """
    Evolve a theme. The previous understanding is preserved in history —
    never overwritten. Returns the updated theme.
    """
    assert direction in DIRECTIONS and momentum in MOMENTUM
    now = datetime.now(timezone.utc).isoformat()
    with _lock:
        data  = _load()
        theme = data.get(key, _default_theme(key))
        theme["history"] = (theme["history"] + [{
            "date":       now,
            "state":      theme["state"],
            "confidence": theme["confidence"],
            "direction":  theme["direction"],
            "momentum":   theme["momentum"],
            "evidence":   evidence,
            "source":     source,
        }])[-MAX_HISTORY_PER_THEME:]
        theme.update({"state": state, "confidence": confidence,
                      "direction": direction, "momentum": momentum, "updatedAt": now})
        data[key] = theme
        _dump(data)
    return theme
