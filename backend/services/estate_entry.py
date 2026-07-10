"""
Estate Entry Controller — Bukra chooses where each session begins.

The investor never asks "where do I go now?" — every login is evaluated
against the intelligence layers and resolved to exactly ONE destination
with ONE human reason. Priority order (first match wins):

  1. Unresolved global event in the last 48h        → World Intelligence Center
  2. Material change in a researched company (48h)  → Research Room (companies listed)
  3. Nothing important                              → Portfolio Office (the home)

The calm case is a first-class outcome, not a fallback: "Nothing requires
your attention today" is celebrated, never apologized for. Reads existing
stores only — no engine is invoked and nothing is written.
"""

from datetime import datetime, timedelta, timezone

from services.world_intelligence import get_events
from services.future_relevance import memory as fr_memory

RECENT_HOURS = 48
MINUTES_PER_COMPANY = 3


def _txt(lang: str, he: str, en: str) -> str:
    return he if lang == "he" else en


def _recent(iso_ts: str) -> bool:
    try:
        ts = datetime.fromisoformat(iso_ts)
    except (TypeError, ValueError):
        return False
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - ts < timedelta(hours=RECENT_HOURS)


def _companies_with_changes() -> list:
    """Researched companies whose latest report carries material changes (48h)."""
    flagged = []
    for symbol, history in fr_memory._load().items():
        if not history:
            continue
        latest = history[-1]
        if latest.get("changes") and _recent(latest.get("timestamp", "")):
            flagged.append({"symbol": symbol, "changes": latest["changes"]})
    return flagged


def resolve_entry(lang: str = "he") -> dict:
    """
    One destination, one reason, at most two actions.
    urgency: "calm" | "attention" | "urgent" — drives ambient tone only,
    never manufactured pressure.
    """
    # 1 — Unresolved global events take precedence: the world moved.
    fresh_events = [e for e in get_events(resolved=False) if _recent(e.get("timestamp", ""))]
    if fresh_events:
        latest = fresh_events[-1]
        return {
            "destination": "/estate/world",
            "urgency":     "urgent",
            "reason":      _txt(lang,
                                f"אירוע עולמי זוהה: {latest['title']}.",
                                f"Global event detected: {latest['title']}."),
            "detail":      _txt(lang,
                                "בוקרא בחנה את ההשלכות. סקירת המודיעין ממתינה.",
                                "Bukra has assessed the consequences. The intelligence review is waiting."),
            "companiesToReview": [],
            "estimatedMinutes":  5,
            "primaryAction":   {"label": _txt(lang, "לסקירת המודיעין", "Review Intelligence"),
                                "to": "/estate/world"},
            "secondaryAction": {"label": _txt(lang, "למשרד התיק", "Open Portfolio"),
                                "to": "/estate/portfolio"},
        }

    # 2 — Companies whose assessment materially changed deserve attention.
    flagged = _companies_with_changes()
    if flagged:
        n = len(flagged)
        return {
            "destination": "/estate/library" if n > 1 else f"/company/{flagged[0]['symbol']}",
            "urgency":     "attention",
            "reason":      _txt(lang,
                                f"הערכת בוקרא השתנתה עבור {n} חברות." if n > 1
                                else f"הערכת בוקרא עבור {flagged[0]['symbol']} השתנתה.",
                                f"Bukra's assessment changed for {n} companies." if n > 1
                                else f"Bukra's assessment of {flagged[0]['symbol']} changed."),
            "detail":      flagged[0]["changes"][0] if flagged[0]["changes"] else "",
            "companiesToReview": [f["symbol"] for f in flagged],
            "estimatedMinutes":  max(MINUTES_PER_COMPANY, n * MINUTES_PER_COMPANY),
            "primaryAction":   {"label": _txt(lang, "לעיון עכשיו", "Review Now"),
                                "to": "/estate/library" if n > 1 else f"/company/{flagged[0]['symbol']}"},
            "secondaryAction": {"label": _txt(lang, "למשרד התיק", "Open Portfolio"),
                                "to": "/estate/portfolio"},
        }

    # 3 — Calm. The correct experience, stated with confidence.
    return {
        "destination": "/estate/portfolio",
        "urgency":     "calm",
        "reason":      _txt(lang, "שום דבר אינו דורש את תשומת לבך היום.",
                                  "Nothing requires your attention today."),
        "detail":      _txt(lang, "סבלנות היא עמדה. בוקרא ממשיכה לעבוד ברקע.",
                                  "Patience is a position. Bukra keeps working in the background."),
        "companiesToReview": [],
        "estimatedMinutes":  0,
        "primaryAction":   {"label": _txt(lang, "למשרד התיק", "Open Portfolio"),
                            "to": "/estate/portfolio"},
        "secondaryAction": None,
    }
