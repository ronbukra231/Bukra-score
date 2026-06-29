"""Bukra Memory API — serves all memory, questions, belief-change, and graph pages."""
from fastapi import APIRouter, Request
from limiter import limiter
from services.memory_engine       import get_all_memories
from services.question_generator  import get_all_questions
from services.knowledge_evolution import get_all_belief_changes

router = APIRouter(prefix="/api/memory", tags=["memory"])

_STATUS_ORDER = {"open": 0, "investigating": 1, "validated": 2, "rejected": 3, "dormant": 4, "reactivated": 5}
_CHANGE_ORDER = {"promoted": 0, "strengthened": 1, "weakened": 2, "archived": 3, "minor": 4}


@router.get("/")
@limiter.limit("30/minute")
def memory_overview(request: Request):
    """All memory objects with full timeline data."""
    mems = get_all_memories()
    active    = [m for m in mems if m.get("status") in ("emerging", "confirmed")]
    confirmed = [m for m in mems if m.get("status") == "confirmed"]
    emerging  = [m for m in mems if m.get("status") == "emerging"]
    historical= [m for m in mems if m.get("status") == "historical"]

    active.sort(key=lambda m: -(m.get("research_score", {}).get("total", 0)))

    return {
        "memories":           mems,
        "active_memories":    active,
        "confirmed_memories": confirmed,
        "emerging_memories":  emerging,
        "historical_memories":historical,
        "stats": {
            "total":     len(mems),
            "active":    len(active),
            "confirmed": len(confirmed),
            "emerging":  len(emerging),
            "historical":len(historical),
        },
    }


@router.get("/questions")
@limiter.limit("30/minute")
def research_questions(request: Request):
    """All research questions grouped by status."""
    qs = get_all_questions()

    groups: dict = {
        "open":          [],
        "investigating": [],
        "validated":     [],
        "rejected":      [],
        "dormant":       [],
        "reactivated":   [],
    }
    for q in qs:
        status = q.get("status", "open")
        groups.setdefault(status, []).append(q)

    # Sort by priority within each group
    _priority = {"High": 0, "Medium": 1, "Low": 2}
    for lst in groups.values():
        lst.sort(key=lambda q: _priority.get(q.get("priority", "Low"), 2))

    return {
        **groups,
        "stats": {
            "total":         len(qs),
            "open":          len(groups["open"]),
            "investigating": len(groups["investigating"]),
            "validated":     len(groups["validated"]),
            "rejected":      len(groups["rejected"]),
            "dormant":       len(groups["dormant"]),
            "reactivated":   len(groups["reactivated"]),
        },
    }


@router.get("/beliefs")
@limiter.limit("30/minute")
def belief_changes(request: Request):
    """Belief change log — what the system changed its mind about."""
    changes   = get_all_belief_changes()
    by_type: dict = {}
    for c in changes:
        ct = c.get("change_type", "minor")
        by_type.setdefault(ct, []).append(c)

    return {
        "changes":      changes,
        "by_type":      by_type,
        "stats": {
            "total":       len(changes),
            "strengthened":len(by_type.get("strengthened", [])),
            "weakened":    len(by_type.get("weakened", [])),
            "promoted":    len(by_type.get("promoted", [])),
            "archived":    len(by_type.get("archived", [])),
        },
    }


@router.get("/graph")
@limiter.limit("30/minute")
def knowledge_graph(request: Request):
    """
    Knowledge graph nodes and edges for the visual graph page.

    Node types: discovery, sector
    Edge types: affects (discovery→sector), related (discovery↔discovery)
    """
    mems = get_all_memories()

    nodes = []
    edges = []
    node_ids: set = set()

    # Category → color
    cat_colors = {
        "SectorPattern":    "#60a5fa",   # blue
        "MarketPattern":    "#c084fc",   # purple
        "MacroPattern":     "#f87171",   # red
        "QualityPattern":   "#fbbf24",   # amber
        "ValuationPattern": "#34d399",   # emerald
        "DataPattern":      "#9ca3af",   # gray
    }

    for mem in mems:
        if mem.get("status") == "historical":
            continue
        sig   = mem["signature"]
        color = cat_colors.get(mem.get("category", ""), "#9ca3af")
        score = mem.get("research_score", {}).get("total", 0)

        nodes.append({
            "id":       sig,
            "type":     "discovery",
            "label":    mem.get("title", sig)[:30],
            "color":    color,
            "size":     max(8, min(score // 5, 24)),
            "status":   mem.get("status", "emerging"),
            "category": mem.get("category", ""),
            "confidence": mem.get("confidence_history", [{}])[-1].get("confidence", 0)
                          if mem.get("confidence_history") else 0,
        })
        node_ids.add(sig)

        # Sector nodes
        for sector in mem.get("affected_sectors", []):
            if sector and sector not in node_ids:
                nodes.append({
                    "id":       sector,
                    "type":     "sector",
                    "label":    sector,
                    "color":    "#4b5563",
                    "size":     12,
                    "status":   "sector",
                    "category": "Sector",
                    "confidence": 0,
                })
                node_ids.add(sector)

            if sector and sector in node_ids:
                edges.append({
                    "source": sig,
                    "target": sector,
                    "type":   "affects",
                    "weight": 1,
                })

    # Cross-discovery edges: discoveries sharing the same sector are "related"
    sector_to_disc: dict = {}
    for mem in mems:
        if mem.get("status") == "historical":
            continue
        for sec in mem.get("affected_sectors", []):
            sector_to_disc.setdefault(sec, []).append(mem["signature"])

    seen_pairs: set = set()
    for sec, sigs in sector_to_disc.items():
        for i in range(len(sigs)):
            for j in range(i + 1, len(sigs)):
                pair = tuple(sorted([sigs[i], sigs[j]]))
                if pair not in seen_pairs:
                    edges.append({
                        "source": sigs[i],
                        "target": sigs[j],
                        "type":   "related",
                        "weight": 0.4,
                    })
                    seen_pairs.add(pair)

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "discovery_nodes": sum(1 for n in nodes if n["type"] == "discovery"),
            "sector_nodes":    sum(1 for n in nodes if n["type"] == "sector"),
            "total_edges":     len(edges),
        },
    }
