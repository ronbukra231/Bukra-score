"""
Bukra Knowledge Graph — nodes and edges built purely from observed market data.

Every edge in this graph originated from a real company scan.
No rules were written. No relationships were invented.
The graph grows richer every time Bukra sees a new company.

Node types:
  pattern      — a recurring financial signal combination (from world_model)
  sector       — industry sector (Technology, Healthcare, ...)
  signal       — watch signal category (QualityUpgrade, MarginPressure, ...)
  trend        — overall direction observed (Improving, Stable, Weakening)
  score_tier   — Bukra score bucket (90+, 80-89, ...)
  outcome      — market outcome (OutperformedSPY, UnderperformedSPY)

Edge types:
  associated_with   — two nodes frequently appear together in the same scan
  sector_correlation — pattern appears disproportionately in this sector
  preceded          — pattern was followed by this outcome
  confirmed         — outcome confirmed the pattern's predictive value
  contradicted      — outcome contradicted the pattern's predictive value
"""

import json
import os
import threading
import time
from typing import Optional

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
_KG_PATH  = os.path.join(_DATA_DIR, "knowledge_graph.json")
_lock     = threading.Lock()

_MAX_EVIDENCE_PER_EDGE = 50
_MAX_EDGES_IN_RESPONSE = 300


# ── Storage ───────────────────────────────────────────────────────────────────

def _read() -> dict:
    try:
        with open(_KG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"nodes": {}, "edges": {}}


def _write(data: dict):
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(_KG_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── Node / edge helpers ───────────────────────────────────────────────────────

def _node_id(ntype: str, label: str) -> str:
    return f"{ntype}::{label.strip().lower().replace(' ', '_')}"


def _upsert_node(nodes: dict, ntype: str, label: str, extra: Optional[dict] = None) -> str:
    nid   = _node_id(ntype, label)
    today = time.strftime("%Y-%m-%d")
    if nid not in nodes:
        nodes[nid] = {
            "id":                nid,
            "type":              ntype,
            "label":             label,
            "observation_count": 0,
            "first_seen":        today,
            "last_seen":         today,
        }
    nodes[nid]["observation_count"] += 1
    nodes[nid]["last_seen"]          = today
    if extra:
        nodes[nid].update(extra)
    return nid


def _edge_key(src: str, tgt: str, etype: str) -> str:
    return f"{src}▶{etype}▶{tgt}"


def _upsert_edge(
    edges: dict,
    src: str,
    tgt: str,
    etype: str,
    evidence: Optional[dict] = None,
):
    key   = _edge_key(src, tgt, etype)
    today = time.strftime("%Y-%m-%d")
    if key not in edges:
        edges[key] = {
            "source":     src,
            "target":     tgt,
            "type":       etype,
            "weight":     0,
            "first_seen": today,
            "last_seen":  today,
            "evidence":   [],
        }
    edges[key]["weight"]   += 1
    edges[key]["last_seen"] = today
    if evidence and len(edges[key]["evidence"]) < _MAX_EVIDENCE_PER_EDGE:
        edges[key]["evidence"].append(evidence)


# ── Public API ────────────────────────────────────────────────────────────────

def update_from_scan(snapshot: dict, pattern_sig: Optional[str] = None):
    """
    Update the knowledge graph from one completed intelligence scan.
    Called after world_model.observe() so the pattern node label is available.

    Relationships built here:
      sector   → associated_with → score_tier
      sector   → associated_with → trend
      signal   → associated_with → sector
      signal   → associated_with → score_tier
      pattern  → sector_correlation → sector
      pattern  → associated_with   → score_tier
      pattern  → associated_with   → signal
    """
    from services.world_model import score_tier, get_pattern

    symbol  = snapshot.get("symbol", "")
    sector  = snapshot.get("sector", "Unknown")
    score   = snapshot.get("score")
    signals = snapshot.get("signals", [])
    trend   = snapshot.get("trend", {})
    today   = time.strftime("%Y-%m-%d")
    ev      = {"company": symbol, "date": today, "score": score}

    with _lock:
        data  = _read()
        nodes = data.setdefault("nodes", {})
        edges = data.setdefault("edges", {})

        # Core structural nodes
        sector_nid = _upsert_node(nodes, "sector",     sector)
        tier_nid   = _upsert_node(nodes, "score_tier", score_tier(score))
        dir_nid    = _upsert_node(nodes, "trend",      trend.get("direction", "Stable"))

        # Sector → score tier & trend direction
        _upsert_edge(edges, sector_nid, tier_nid, "associated_with",   ev)
        _upsert_edge(edges, sector_nid, dir_nid,  "associated_with",   ev)

        # Signal nodes
        for sig in signals:
            cat = sig.get("category", "")
            if not cat:
                continue
            sig_nid = _upsert_node(nodes, "signal", cat)
            _upsert_edge(edges, sig_nid, sector_nid, "associated_with", ev)
            _upsert_edge(edges, sig_nid, tier_nid,   "associated_with", ev)
            _upsert_edge(edges, sig_nid, dir_nid,    "associated_with", ev)

        # Pattern node (richest relationships)
        if pattern_sig:
            pat      = get_pattern(pattern_sig)
            pat_label = pat["label"] if pat else pattern_sig[:80]
            pat_nid   = _upsert_node(
                nodes, "pattern", pat_label,
                {"signature": pattern_sig, "frequency": pat["frequency"] if pat else 1},
            )
            _upsert_edge(edges, pat_nid, sector_nid, "sector_correlation", ev)
            _upsert_edge(edges, pat_nid, tier_nid,   "associated_with",    ev)
            _upsert_edge(edges, pat_nid, dir_nid,    "associated_with",    ev)
            for sig in signals:
                cat = sig.get("category", "")
                if not cat:
                    continue
                sig_nid = _node_id("signal", cat)
                if sig_nid in nodes:
                    _upsert_edge(edges, pat_nid, sig_nid, "associated_with", ev)

        _write({"nodes": nodes, "edges": edges})


def record_outcome(
    pattern_sig: Optional[str],
    symbol: str,
    beat_spy: bool,
    alpha: float,
):
    """
    When a 90-day accuracy outcome resolves, wire pattern → outcome in the graph.
    This is how the graph learns which patterns preceded outperformance vs underperformance.
    """
    if not pattern_sig:
        return

    from services.world_model import get_pattern

    pat = get_pattern(pattern_sig)
    if not pat:
        return

    outcome = "OutperformedSPY" if beat_spy else "UnderperformedSPY"
    etype   = "confirmed" if beat_spy else "contradicted"
    today   = time.strftime("%Y-%m-%d")
    ev      = {"company": symbol, "alpha": alpha, "date": today}

    with _lock:
        data    = _read()
        nodes   = data.setdefault("nodes", {})
        edges   = data.setdefault("edges", {})

        pat_nid = _upsert_node(
            nodes, "pattern", pat["label"],
            {"signature": pattern_sig},
        )
        out_nid = _upsert_node(nodes, "outcome", outcome)

        # preceded edge: pattern → outcome (always, regardless of direction)
        _upsert_edge(edges, pat_nid, out_nid, "preceded",  ev)
        # typed edge: confirmed or contradicted
        _upsert_edge(edges, pat_nid, out_nid, etype, ev)

        _write({"nodes": nodes, "edges": edges})


def get_graph(max_edges: int = _MAX_EDGES_IN_RESPONSE) -> dict:
    data  = _read()
    nodes = list(data.get("nodes", {}).values())
    edges = list(data.get("edges", {}).values())

    # Return strongest edges first — these are the most confirmed relationships
    edges_sorted = sorted(edges, key=lambda e: -e["weight"])

    # Build a lightweight version (drop large evidence lists from graph payload)
    slim_edges = [
        {
            "source": e["source"],
            "target": e["target"],
            "type":   e["type"],
            "weight": e["weight"],
            "first_seen": e["first_seen"],
            "last_seen":  e["last_seen"],
        }
        for e in edges_sorted[:max_edges]
    ]

    # Aggregate node stats
    node_ids_in_edges = set()
    for e in edges_sorted[:max_edges]:
        node_ids_in_edges.add(e["source"])
        node_ids_in_edges.add(e["target"])

    by_type: dict = {}
    for n in nodes:
        t = n["type"]
        by_type[t] = by_type.get(t, 0) + 1

    return {
        "nodes": nodes,
        "edges": slim_edges,
        "stats": {
            "total_nodes":   len(nodes),
            "total_edges":   len(edges),
            "nodes_by_type": by_type,
            "edges_shown":   len(slim_edges),
        },
    }


def get_stats() -> dict:
    data  = _read()
    nodes = data.get("nodes", {})
    edges = data.get("edges", {})

    by_type: dict = {}
    for n in nodes.values():
        t = n["type"]
        by_type[t] = by_type.get(t, 0) + 1

    strongest = sorted(edges.values(), key=lambda e: -e["weight"])[:10]

    return {
        "total_nodes":    len(nodes),
        "total_edges":    len(edges),
        "nodes_by_type":  by_type,
        "strongest_edges": [
            {
                "source": e["source"],
                "target": e["target"],
                "type":   e["type"],
                "weight": e["weight"],
            }
            for e in strongest
        ],
    }
