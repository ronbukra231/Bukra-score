"""
Event Memory — persistent lifecycle storage for BusinessEvents.

Events evolve through a defined lifecycle:
  Detected → Analyzing → Monitoring → Confirmed | Rejected

The Bukra Score is NEVER modified here.
This module tracks the maturation of business hypotheses only.
"""
from __future__ import annotations

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any

logger = logging.getLogger("bukra.event_memory")

_DATA_FILE = Path(__file__).parent.parent / "data" / "event_memory.json"
_lock = threading.Lock()

_EMPTY: Dict[str, Any] = {"events": {}, "company_index": {}, "theme_index": {}}


def _load() -> Dict[str, Any]:
    if _DATA_FILE.exists():
        try:
            return json.loads(_DATA_FILE.read_text(encoding="utf-8"))
        except Exception:
            logger.warning("[event_memory] corrupt data file, resetting")
    return {k: (v.copy() if isinstance(v, dict) else v) for k, v in _EMPTY.items()}


def _save(data: Dict[str, Any]) -> None:
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    _DATA_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


# ── Public write API ──────────────────────────────────────────────────────────

def store_event(event: Dict[str, Any]) -> str:
    """
    Store or update an event.
    - If event id already exists: merges evidence, upgrades confidence, preserves Confirmed/Rejected status.
    - If new: indexes by symbol and category.
    Returns the event id.
    """
    eid = event["id"]
    with _lock:
        data = _load()
        existing = data["events"].get(eid)

        if existing:
            # Merge supporting evidence
            existing["supporting_evidence"] = list(set(
                existing.get("supporting_evidence", []) +
                event.get("supporting_evidence", [])
            ))
            # Never downgrade a terminal status
            if existing.get("status") not in ("Confirmed", "Rejected"):
                existing["status"] = event.get("status", existing["status"])
            # Confidence can only increase
            existing["confidence"] = max(existing.get("confidence", 0), event.get("confidence", 0))
            existing["last_updated"] = datetime.now(timezone.utc).isoformat()
        else:
            data["events"][eid] = dict(event)
            # Company index
            sym = event.get("symbol", "").upper()
            if sym:
                data.setdefault("company_index", {}).setdefault(sym, [])
                if eid not in data["company_index"][sym]:
                    data["company_index"][sym].append(eid)
            # Category theme index
            cat = event.get("category", "")
            if cat:
                data.setdefault("theme_index", {}).setdefault(cat, [])
                if eid not in data["theme_index"][cat]:
                    data["theme_index"][cat].append(eid)
            # Secondary companies — index them too
            for secondary in event.get("affected_companies", []):
                sec_sym = secondary.upper()
                if sec_sym and sec_sym != sym:
                    data.setdefault("company_index", {}).setdefault(sec_sym, [])
                    if eid not in data["company_index"][sec_sym]:
                        data["company_index"][sec_sym].append(eid)

        _save(data)

    # Feed knowledge graph — import lazily to avoid circular dependency
    try:
        import services.knowledge_graph as kg
        kg.update_from_event(event)
    except Exception:
        pass

    return eid


def advance_status(event_id: str, new_status: str, evidence: Optional[str] = None) -> bool:
    """Move an event to a new lifecycle status. Returns False if event not found."""
    with _lock:
        data = _load()
        ev = data["events"].get(event_id)
        if not ev:
            return False
        ev["status"] = new_status
        ev["last_updated"] = datetime.now(timezone.utc).isoformat()
        if evidence:
            key = "supporting_evidence" if new_status == "Confirmed" else "contradicting_evidence"
            evlist = ev.setdefault(key, [])
            if evidence not in evlist:
                evlist.append(evidence)
        snapshot = dict(ev)
        _save(data)

    # When confirmed, re-feed graph so confirmation edges are written
    if new_status in ("Confirmed", "Rejected"):
        try:
            import services.knowledge_graph as kg
            kg.update_from_event(snapshot)
        except Exception:
            pass

    return True


def add_evidence(event_id: str, evidence: str, supports: bool = True) -> bool:
    """Add a piece of supporting or contradicting evidence to an event."""
    with _lock:
        data = _load()
        ev = data["events"].get(event_id)
        if not ev:
            return False
        key = "supporting_evidence" if supports else "contradicting_evidence"
        evlist = ev.setdefault(key, [])
        if evidence not in evlist:
            evlist.append(evidence)
        ev["last_updated"] = datetime.now(timezone.utc).isoformat()
        _save(data)
    return True


# ── Public read API ───────────────────────────────────────────────────────────

def get_company_events(symbol: str, status_filter: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    data = _load()
    ids = data.get("company_index", {}).get(symbol.upper(), [])
    events = [data["events"][i] for i in ids if i in data["events"]]
    if status_filter:
        events = [e for e in events if e.get("status") in status_filter]
    events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
    return events


def get_all_events(limit: int = 100) -> List[Dict[str, Any]]:
    data = _load()
    events = sorted(data["events"].values(), key=lambda e: e.get("timestamp", ""), reverse=True)
    return events[:limit]


def get_market_themes() -> Dict[str, Any]:
    """Aggregate event themes across all companies for the Market Intelligence page."""
    data = _load()
    all_events = list(data["events"].values())

    by_category: Dict[str, List[Dict]] = {}
    for ev in all_events:
        cat = ev.get("category", "Unknown")
        by_category.setdefault(cat, []).append(ev)

    themes = []
    for cat, evs in by_category.items():
        confirmed = [e for e in evs if e.get("status") == "Confirmed"]
        rejected  = [e for e in evs if e.get("status") == "Rejected"]
        active    = [e for e in evs if e.get("status") not in ("Confirmed", "Rejected")]
        pos = sum(1 for e in evs if e.get("sentiment") == "Positive")
        neg = sum(1 for e in evs if e.get("sentiment") == "Negative")
        avg_conf = sum(e.get("confidence", 0.0) for e in evs) / len(evs)
        conf_rate = round(len(confirmed) / max(1, len(confirmed) + len(rejected)), 3)

        themes.append({
            "category":          cat,
            "total":             len(evs),
            "confirmed":         len(confirmed),
            "rejected":          len(rejected),
            "active":            len(active),
            "positive":          pos,
            "negative":          neg,
            "avg_confidence":    round(avg_conf, 3),
            "confirmation_rate": conf_rate,
            "companies":         list({e.get("symbol") for e in evs if e.get("symbol")}),
            "recent_headline":   evs[0].get("headline", "") if evs else "",
        })

    themes.sort(key=lambda t: t["total"], reverse=True)

    return {
        "themes":           themes,
        "total_events":     len(all_events),
        "total_categories": len(themes),
        "confirmed_events": sum(1 for e in all_events if e.get("status") == "Confirmed"),
        "rejected_events":  sum(1 for e in all_events if e.get("status") == "Rejected"),
        "monitoring_events": sum(1 for e in all_events if e.get("status") == "Monitoring"),
        "detected_events":  sum(1 for e in all_events if e.get("status") == "Detected"),
    }


def get_cross_sector_relationships() -> List[Dict[str, Any]]:
    """Events that affect multiple companies — used for chain/relationship visualization."""
    data = _load()
    relationships = []
    for ev in data["events"].values():
        affected = ev.get("affected_companies", [])
        if affected and ev.get("symbol"):
            relationships.append({
                "source_symbol":     ev["symbol"],
                "source_company":    ev.get("company", ev["symbol"]),
                "category":          ev.get("category", ""),
                "affected_companies": affected,
                "sentiment":         ev.get("sentiment", "Neutral"),
                "confidence":        ev.get("confidence", 0.0),
                "status":            ev.get("status", "Detected"),
                "headline":          ev.get("headline", ""),
                "importance":        ev.get("importance", "Medium"),
            })
    relationships.sort(key=lambda r: len(r["affected_companies"]), reverse=True)
    return relationships


def get_stats() -> Dict[str, Any]:
    data = _load()
    all_events = list(data["events"].values())
    by_status: Dict[str, int] = {}
    by_category: Dict[str, int] = {}
    by_importance: Dict[str, int] = {}
    for ev in all_events:
        by_status[ev.get("status","?")] = by_status.get(ev.get("status","?"), 0) + 1
        by_category[ev.get("category","?")] = by_category.get(ev.get("category","?"), 0) + 1
        by_importance[ev.get("importance","?")] = by_importance.get(ev.get("importance","?"), 0) + 1
    return {
        "total_events":      len(all_events),
        "companies_tracked": len(data.get("company_index", {})),
        "categories_seen":   len(by_category),
        "by_status":         by_status,
        "by_category":       by_category,
        "by_importance":     by_importance,
    }
