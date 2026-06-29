"""
Bukra Research Agent — post-scan orchestrator.

Execution order after every scanner run:
  1. discovery_engine  — detect cross-company patterns
  2. knowledge_base    — basic discovery CRUD
  3. memory_engine     — confidence timeline + research score
  4. knowledge_evolution — record belief changes
  5. question_generator  — generate next research questions
  6. research_notes    — write a note summarising what was learned

Safe to call from a background thread — never raises.
"""
import logging
import time

from services.scan_history      import get_all_snapshots
from services.discovery_engine  import run_all_detectors
from services.knowledge_base    import (
    upsert_discovery,
    mark_unseen_stale,
    append_research_note,
    get_active_discoveries,
)
from services.memory_engine     import update_memory, mark_memory_historical, get_memory
from services.knowledge_evolution import record_evolution, record_archival
from services.question_generator  import generate_and_save, get_all_questions

logger = logging.getLogger("bukra.research_agent")


# ── Public entry point ────────────────────────────────────────────────────────

def run_research_scan():
    """Full research cycle. Never raises."""
    try:
        _do_research_scan()
    except Exception as e:
        logger.error("[research_agent] scan failed unexpectedly: %s", e)


# ── Core logic ─────────────────────────────────────────────────────────────────

def _do_research_scan():
    now           = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    snapshots     = list(get_all_snapshots().values())

    if len(snapshots) < 2:
        _write_minimal_note(now, snapshots)
        return

    # ── 1. Pattern detection ──────────────────────────────────────────────────
    candidates = run_all_detectors(snapshots)

    # ── 2. Reconcile with knowledge base ─────────────────────────────────────
    existing_active = {d.get("signature"): d for d in get_active_discoveries()}
    seen_sigs: set  = set()
    new_count       = 0
    confirmed_count = 0

    for candidate in candidates:
        sig     = candidate["signature"]
        is_new  = sig not in existing_active

        # 2a. Basic knowledge base update
        upsert_discovery(candidate)

        # 2b. Memory engine — timeline + research score
        old_mem = get_memory(sig)
        new_mem = update_memory(
            candidate,
            prev_confidence = existing_active.get(sig, {}).get("confidence", 0.0),
            prev_status     = existing_active.get(sig, {}).get("status", "emerging"),
        )

        # 2c. Knowledge evolution — record belief changes
        try:
            record_evolution(old_mem, new_mem, candidate)
        except Exception as e:
            logger.warning("[research_agent] knowledge_evolution failed for %s: %s", sig, e)

        seen_sigs.add(sig)
        if is_new:
            new_count += 1
        else:
            confirmed_count += 1

    # ── 3. Fade unseen discoveries ────────────────────────────────────────────
    for sig, disc in existing_active.items():
        if sig not in seen_sigs:
            old_conf_list = get_memory(sig)
            old_conf = 0.0
            if old_conf_list:
                ch = old_conf_list.get("confidence_history", [])
                if ch:
                    old_conf = ch[-1].get("confidence", 0.0)
            mark_memory_historical(sig, disc)
            try:
                record_archival(sig, disc.get("title", sig), old_conf)
            except Exception as e:
                logger.warning("[research_agent] archival record failed for %s: %s", sig, e)

    mark_unseen_stale(seen_sigs)

    # ── 4. Generate research questions ────────────────────────────────────────
    try:
        all_mems = []  # passed to generator for context
        generate_and_save(candidates, all_mems)
    except Exception as e:
        logger.warning("[research_agent] question_generator failed: %s", e)

    # ── 5. Research note ──────────────────────────────────────────────────────
    _write_scan_note(now, snapshots, candidates, new_count, confirmed_count)

    logger.info(
        "[research_agent] done — %d companies, %d candidates, %d new, %d confirmed",
        len(snapshots), len(candidates), new_count, confirmed_count,
    )


def _write_scan_note(now, snapshots, candidates, new_count, confirmed_count):
    lines = []
    if new_count:
        lines.append(f"התגלו {new_count} דפוסים חדשים הדורשים מעקב.")
    if confirmed_count:
        lines.append(f"{confirmed_count} דפוסים קיימים אושרו מחדש.")
    if not candidates:
        lines.append("לא זוהו דפוסים חריגים — נתוני השוק בטווחים הרגילים.")

    for c in candidates:
        cat = c.get("category", "")
        if cat == "MacroPattern":
            lines.append(f"אות מאקרו: {c.get('title','')}")
        elif cat == "SectorPattern":
            lines.append(f"דפוס סקטוריאלי: {c.get('title','')}")

    note = {
        "scan_date":             now,
        "companies_analyzed":    len(snapshots),
        "candidates_found":      len(candidates),
        "new_discoveries":       new_count,
        "confirmed_discoveries": confirmed_count,
        "notes":                 lines,
        "summary":               " ".join(lines) if lines else "סריקה הושלמה.",
    }
    append_research_note(note)


def _write_minimal_note(now, snapshots):
    n = len(snapshots)
    append_research_note({
        "scan_date":             now,
        "companies_analyzed":    n,
        "candidates_found":      0,
        "new_discoveries":       0,
        "confirmed_discoveries": 0,
        "notes":                 [f"נסרקו {n} חברות — נדרשות ≥2 לניתוח דפוסים."],
        "summary":               "אין מספיק נתונים לניתוח דפוסים.",
    })
