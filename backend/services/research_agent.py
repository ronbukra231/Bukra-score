"""
Bukra Research Agent — post-scan discovery orchestrator.

Called after every scanner run. Analyzes all accumulated company snapshots,
runs all pattern detectors, updates the knowledge base, and writes a
Research Note summarising what the system learned (or didn't) from the scan.

Safe to call from a background thread — never raises, never blocks.
"""
import logging
import time

from services.scan_history    import get_all_snapshots
from services.discovery_engine import run_all_detectors
from services.knowledge_base   import (
    upsert_discovery,
    mark_unseen_stale,
    append_research_note,
    get_active_discoveries,
)

logger = logging.getLogger("bukra.research_agent")


# ── Public entry point ────────────────────────────────────────────────────────

def run_research_scan():
    """
    Full research cycle. Never raises — all errors are logged and swallowed
    so a failed research scan can never crash the scanner thread.
    """
    try:
        _do_research_scan()
    except Exception as e:
        logger.error("[research_agent] scan failed unexpectedly: %s", e)


# ── Core logic ─────────────────────────────────────────────────────────────────

def _do_research_scan():
    now            = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    snapshots_dict = get_all_snapshots()
    snapshots      = list(snapshots_dict.values())

    if len(snapshots) < 2:
        _write_minimal_note(now, snapshots)
        logger.info("[research_agent] insufficient data (%d companies), skipping pattern scan", len(snapshots))
        return

    # ── Run pattern detectors ─────────────────────────────────────────────────
    candidates = run_all_detectors(snapshots)

    # ── Reconcile candidates with knowledge base ───────────────────────────────
    existing_sigs  = {d.get("signature") for d in get_active_discoveries()}
    seen_sigs: set = set()
    new_count      = 0
    confirmed_count = 0

    for candidate in candidates:
        sig = candidate["signature"]
        is_new = sig not in existing_sigs
        upsert_discovery(candidate)
        seen_sigs.add(sig)
        if is_new:
            new_count += 1
        else:
            confirmed_count += 1

    # Fade out discoveries that were not detected in this scan
    mark_unseen_stale(seen_sigs)

    # ── Build the Research Note ────────────────────────────────────────────────
    note_lines = []

    if new_count > 0:
        note_lines.append(f"התגלו {new_count} דפוסים חדשים הדורשים מעקב.")
    if confirmed_count > 0:
        note_lines.append(f"{confirmed_count} דפוסים קיימים אושרו מחדש בסריקה זו.")
    if not candidates:
        note_lines.append("לא זוהו דפוסים חריגים בסריקה זו — נתוני השוק נמצאים בטווחים הרגילים.")

    # Categorise what was found
    sector_disc  = [c for c in candidates if c.get("category") == "SectorPattern"]
    macro_disc   = [c for c in candidates if c.get("category") in ("MacroPattern", "MarketPattern")]
    quality_disc = [c for c in candidates if c.get("category") == "QualityPattern"]
    data_disc    = [c for c in candidates if c.get("category") == "DataPattern"]

    if sector_disc:
        sectors = list(set(
            sec for c in sector_disc for sec in c.get("affected_sectors", [])
        ))
        note_lines.append(f"דפוסים סקטוריאליים זוהו: {', '.join(sectors[:4])}.")
    if macro_disc:
        note_lines.append(f"זוהו {len(macro_disc)} דפוסים רוחביים שחוצים סקטורים.")
    if quality_disc:
        note_lines.append("אזהרות איכות מהימנות זוהו — נתונים אמינים מגבים את ההערכה.")
    if data_disc:
        note_lines.append("פערי נתונים שיטתיים זוהו בסקטורים מסוימים.")

    note = {
        "scan_date":              now,
        "companies_analyzed":     len(snapshots),
        "candidates_found":       len(candidates),
        "new_discoveries":        new_count,
        "confirmed_discoveries":  confirmed_count,
        "notes":                  note_lines,
        "summary":                " ".join(note_lines) if note_lines else "סריקה הושלמה ללא תגליות.",
    }
    append_research_note(note)

    logger.info(
        "[research_agent] done — %d companies, %d candidates, %d new, %d confirmed",
        len(snapshots), len(candidates), new_count, confirmed_count,
    )


def _write_minimal_note(now: str, snapshots: list):
    n = len(snapshots)
    note = {
        "scan_date":             now,
        "companies_analyzed":    n,
        "candidates_found":      0,
        "new_discoveries":       0,
        "confirmed_discoveries": 0,
        "notes":                 [
            f"נסרקו {n} חברות — נדרשות לפחות 2 לניתוח דפוסים."
        ],
        "summary": "אין מספיק נתונים לניתוח דפוסים.",
    }
    append_research_note(note)
