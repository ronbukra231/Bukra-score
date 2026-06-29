"""
Bukra Discovery Engine — cross-company pattern detection.

Analyzes the aggregated intelligence snapshot data to find patterns
invisible when looking at companies one by one. Each detector is
self-contained: it receives the full snapshot list and returns zero
or more DiscoveryCandidate dicts.

A DiscoveryCandidate is a plain dict with these required keys:
  signature          – deterministic string used for dedup across scans
  discovery_type     – detector name
  title              – short Hebrew title
  summary            – full Hebrew summary sentence(s)
  evidence           – list of Hebrew evidence strings (≤8 items)
  confidence         – float 0–1 (the detector's self-assessed reliability)
  importance         – "High" | "Medium" | "Low"
  category           – "SectorPattern" | "MarketPattern" | "MacroPattern" |
                       "QualityPattern" | "ValuationPattern" | "DataPattern"
  affected_companies – list of symbols
  affected_sectors   – list of sectors

The knowledge_base.upsert_discovery() adds id, timestamps, occurrences, etc.
"""
import logging
from typing import Optional

logger = logging.getLogger("bukra.discovery_engine")

# Minimum dataset sizes — below these the detector returns [].
_MIN_SECTOR   = 3   # companies per sector for sector-level patterns
_MIN_MARKET   = 5   # total companies for market-wide patterns
_MIN_BROAD    = 5   # total companies for broad-direction patterns
_MIN_POL      = 10  # total companies for polarisation analysis
_MIN_DEBT_SEC = 3   # distinct sectors with DebtAlert for cross-sector stress


# ── Snapshot accessors ────────────────────────────────────────────────────────

def _trend(snap: dict) -> str:
    return snap.get("trend", {}).get("direction", "Stable")


def _confidence_level(snap: dict) -> str:
    return snap.get("confidence", {}).get("level", "Low")


def _score(snap: dict) -> Optional[float]:
    v = snap.get("score")
    return float(v) if v is not None else None


def _signals(snap: dict) -> list:
    return snap.get("signals", [])


def _has_signal_category(snap: dict, category: str) -> bool:
    return any(s.get("category") == category for s in _signals(snap))


def _group_by_sector(snapshots: list) -> dict:
    groups: dict = {}
    for snap in snapshots:
        sector = (snap.get("sector") or "Unknown").strip()
        groups.setdefault(sector, []).append(snap)
    return groups


def _pct(n: int, total: int) -> float:
    return round(n / total, 3) if total > 0 else 0.0


# ── Detector 1: Sector-wide quality shift ─────────────────────────────────────

def _detect_sector_quality_shift(snapshots: list) -> list:
    """
    Finds sectors where ≥60% of companies are Weakening (risk discovery)
    or ≥65% are Improving (opportunity discovery).
    Requires ≥3 companies in the sector.
    """
    groups     = _group_by_sector(snapshots)
    candidates = []

    for sector, snaps in groups.items():
        if len(snaps) < _MIN_SECTOR or sector == "Unknown":
            continue

        total     = len(snaps)
        weakening = sum(1 for s in snaps if _trend(s) == "Weakening")
        improving = sum(1 for s in snaps if _trend(s) == "Improving")
        weak_pct  = _pct(weakening, total)
        impr_pct  = _pct(improving, total)

        if weak_pct >= 0.60:
            affected = [s["symbol"] for s in snaps if _trend(s) == "Weakening"]
            conf     = round(weak_pct * 0.90, 2)
            candidates.append({
                "signature":          f"sector_weakening:{sector}",
                "discovery_type":     "SectorWeakening",
                "title":              f"היחלשות רוחבית בסקטור {sector}",
                "summary":            (
                    f"{int(weak_pct*100)}% מחברות {sector} שנסרקו מציגות מגמת "
                    f"היחלשות ({weakening} מתוך {total}). "
                    "דפוס זה אינו מוסבר על ידי חברה בודדת — מדובר בתנועה סקטוריאלית."
                ),
                "evidence":           [
                    f"{s['symbol']} ({(s.get('name') or '')[:22]}): היחלשות, ציון {_score(s)}"
                    for s in snaps if _trend(s) == "Weakening"
                ][:8],
                "confidence":         conf,
                "importance":         "High" if weak_pct >= 0.75 else "Medium",
                "category":           "SectorPattern",
                "affected_companies": affected,
                "affected_sectors":   [sector],
            })

        elif impr_pct >= 0.65:
            affected = [s["symbol"] for s in snaps if _trend(s) == "Improving"]
            conf     = round(impr_pct * 0.82, 2)
            candidates.append({
                "signature":          f"sector_improving:{sector}",
                "discovery_type":     "SectorImproving",
                "title":              f"שיפור רוחבי בסקטור {sector}",
                "summary":            (
                    f"{int(impr_pct*100)}% מחברות {sector} שנסרקו מציגות מגמת "
                    f"שיפור ({improving} מתוך {total}). "
                    "חוזק סקטוריאלי שמופיע בנתונים הפיננסיים — לא רק במחיר."
                ),
                "evidence":           [
                    f"{s['symbol']} ({(s.get('name') or '')[:22]}): שיפור, ציון {_score(s)}"
                    for s in snaps if _trend(s) == "Improving"
                ][:8],
                "confidence":         conf,
                "importance":         "Medium",
                "category":           "SectorPattern",
                "affected_companies": affected,
                "affected_sectors":   [sector],
            })

    return candidates


# ── Detector 2: Signal category surge ─────────────────────────────────────────

_SIGNAL_LABELS_HE = {
    "MarginPressure":   "לחץ על מרווחים",
    "DebtAlert":        "לחץ חוב",
    "RevenueMomentum":  "שינוי במומנטום הצמיחה",
    "ValuationWarning": "אזהרות שווי",
    "QualityDowngrade": "ירידת איכות",
    "QualityUpgrade":   "שיפור איכות",
    "PriceOpportunity": "הזדמנויות מחיר",
    "DataWarning":      "אזהרות נתונים",
}


def _detect_signal_surge(snapshots: list) -> list:
    """
    A signal category appearing in >25% of all scanned companies indicates
    a market-wide pattern — not individual company idiosyncrasies.
    Requires ≥5 companies total.
    """
    if len(snapshots) < _MIN_MARKET:
        return []

    total            = len(snapshots)
    category_counts: dict  = {}
    category_symbols: dict = {}

    for snap in snapshots:
        seen: set = set()
        for sig in _signals(snap):
            cat = sig.get("category", "")
            if cat and cat not in seen:
                category_counts[cat]  = category_counts.get(cat, 0) + 1
                category_symbols.setdefault(cat, []).append(snap["symbol"])
                seen.add(cat)

    candidates = []
    for cat, count in category_counts.items():
        pct = _pct(count, total)
        if pct < 0.25:
            continue
        label      = _SIGNAL_LABELS_HE.get(cat, cat)
        conf       = round(min(pct * 1.15, 0.90), 2)
        importance = "High" if pct >= 0.45 else "Medium"
        affected_sectors = list(set(
            (s.get("sector") or "")
            for s in snapshots
            if s["symbol"] in category_symbols[cat]
        ))
        candidates.append({
            "signature":          f"signal_surge:{cat}",
            "discovery_type":     "SignalCategorySurge",
            "title":              f"ריכוז חריג: {label}",
            "summary":            (
                f"{int(pct*100)}% מהחברות הסרוקות ({count} מתוך {total}) "
                f"מציגות {label}. "
                "ריכוז ברמה זו מצביע על דפוס שוקי — לא על בעיה נקודתית."
            ),
            "evidence":           [f"{sym}: אות — {label}" for sym in category_symbols[cat][:8]],
            "confidence":         conf,
            "importance":         importance,
            "category":           "MarketPattern",
            "affected_companies": category_symbols[cat],
            "affected_sectors":   affected_sectors,
        })

    return candidates


# ── Detector 3: Valuation-quality disconnect ───────────────────────────────────

def _detect_valuation_disconnect(snapshots: list) -> list:
    """
    When ≥3 high-quality companies (score ≥70) simultaneously carry a
    PriceOpportunity signal, the market is pricing quality below its
    fundamental level — a cross-company signal, not a single stock call.
    """
    opp = [
        s for s in snapshots
        if _has_signal_category(s, "PriceOpportunity") and (_score(s) or 0) >= 70
    ]
    if len(opp) < 3:
        return []

    conf    = round(min(0.52 + len(opp) * 0.05, 0.84), 2)
    symbols = [s["symbol"] for s in opp]
    sectors = list(set((s.get("sector") or "") for s in opp))

    return [{
        "signature":          "valuation_quality_disconnect",
        "discovery_type":     "ValuationQualityDisconnect",
        "title":              "ניתוק בין ערך עסקי למחיר השוק",
        "summary":            (
            f"{len(opp)} חברות בעלות ציון גבוה (≥70) נסחרות קרוב לשפל השנתי. "
            "כשמספר חברות איכות נמצאות בתת-תמחור בו-זמנית, מדובר בסנטימנט שוקי "
            "שאינו עקבי עם הנתונים הפיננסיים."
        ),
        "evidence":           [
            f"{s['symbol']} ({(s.get('name') or '')[:22]}): ציון {_score(s)}, קרוב לשפל שנתי"
            for s in opp[:8]
        ],
        "confidence":         conf,
        "importance":         "High",
        "category":           "ValuationPattern",
        "affected_companies": symbols,
        "affected_sectors":   sectors,
    }]


# ── Detector 4: High-confidence weakening ─────────────────────────────────────

def _detect_high_confidence_weakening(snapshots: list) -> list:
    """
    Companies where data quality is High AND trend is Weakening — these are
    the most reliable negative signals because the assessment isn't limited
    by sparse data. ≥2 such companies makes this a discovery.
    """
    reliable = [
        s for s in snapshots
        if _confidence_level(s) == "High" and _trend(s) == "Weakening"
    ]
    if len(reliable) < 2:
        return []

    conf    = round(min(0.62 + len(reliable) * 0.04, 0.90), 2)
    symbols = [s["symbol"] for s in reliable]
    sectors = list(set((s.get("sector") or "") for s in reliable))

    return [{
        "signature":          "high_confidence_weakening",
        "discovery_type":     "HighConfidenceWeakening",
        "title":              "אזהרות מהימנות: ירידת איכות עסקית",
        "summary":            (
            f"{len(reliable)} חברות עם נתונים אמינים (רמת ביטחון גבוהה) "
            "מציגות מגמת היחלשות. האות חזק יותר כאן — הנתונים מלאים, "
            "ולכן ההערכה אינה מוגבלת על ידי פערי מידע."
        ),
        "evidence":           [
            f"{s['symbol']}: ביטחון גבוה + מגמת היחלשות, ציון {_score(s)}"
            for s in reliable[:8]
        ],
        "confidence":         conf,
        "importance":         "High",
        "category":           "QualityPattern",
        "affected_companies": symbols,
        "affected_sectors":   sectors,
    }]


# ── Detector 5: Score polarisation ────────────────────────────────────────────

def _detect_score_polarization(snapshots: list) -> list:
    """
    Detects bimodal score distribution — many high + many low with thin middle.
    Signals a 'quality divide' between strong and weak businesses.
    Requires ≥10 companies.
    """
    if len(snapshots) < _MIN_POL:
        return []

    scores = [_score(s) for s in snapshots if _score(s) is not None]
    if len(scores) < _MIN_POL:
        return []

    total    = len(scores)
    high_cnt = sum(1 for v in scores if v >= 70)
    mid_cnt  = sum(1 for v in scores if 45 <= v < 70)
    low_cnt  = sum(1 for v in scores if v < 45)

    high_pct = _pct(high_cnt, total)
    mid_pct  = _pct(mid_cnt,  total)
    low_pct  = _pct(low_cnt,  total)

    if high_pct + low_pct >= 0.70 and mid_pct < 0.25:
        conf = round(0.52 + (0.70 - mid_pct), 2)
        return [{
            "signature":          "score_polarization",
            "discovery_type":     "ScorePolarization",
            "title":              "קיטוב בין חברות איכות לחברות חלשות",
            "summary":            (
                f"{int(high_pct*100)}% מהחברות הסרוקות מציגות ציון ≥70, "
                f"{int(low_pct*100)}% מציגות ציון <45, "
                f"ורק {int(mid_pct*100)}% באזור הביניים. "
                "הבחנה חדה בין עסקים חזקים לחלשים — מעט 'ממוצע'."
            ),
            "evidence":           [
                f"{high_cnt} חברות עם ציון ≥70 (איכות גבוהה)",
                f"{mid_cnt} חברות עם ציון 45–70 (בינוני)",
                f"{low_cnt} חברות עם ציון <45 (איכות נמוכה)",
            ],
            "confidence":         conf,
            "importance":         "Medium",
            "category":           "MarketPattern",
            "affected_companies": [s["symbol"] for s in snapshots if _score(s) is not None],
            "affected_sectors":   [],
        }]

    return []


# ── Detector 6: Broad market direction ────────────────────────────────────────

def _detect_broad_market_direction(snapshots: list) -> list:
    """
    ≥60% of all scanned companies sharing the same trend direction is a
    macro-level signal that crosses sector boundaries.
    Requires ≥5 companies.
    """
    if len(snapshots) < _MIN_BROAD:
        return []

    total     = len(snapshots)
    improving = sum(1 for s in snapshots if _trend(s) == "Improving")
    weakening = sum(1 for s in snapshots if _trend(s) == "Weakening")
    impr_pct  = _pct(improving, total)
    weak_pct  = _pct(weakening, total)

    if impr_pct >= 0.60:
        conf    = round(impr_pct * 0.84, 2)
        symbols = [s["symbol"] for s in snapshots if _trend(s) == "Improving"]
        return [{
            "signature":          "broad_market:Improving",
            "discovery_type":     "BroadMarketDirection",
            "title":              "שיפור רחב: רוב החברות הסרוקות משתפרות",
            "summary":            (
                f"{int(impr_pct*100)}% מהחברות הסרוקות ({improving} מתוך {total}) "
                "מציגות מגמת שיפור בנתונים הפיננסיים — "
                "דפוס רוחבי שחוצה גבולות סקטוריאליים."
            ),
            "evidence":           [f"{improving} מתוך {total} חברות במגמת שיפור"],
            "confidence":         conf,
            "importance":         "High",
            "category":           "MacroPattern",
            "affected_companies": symbols,
            "affected_sectors":   list(set(
                (s.get("sector") or "") for s in snapshots if _trend(s) == "Improving"
            )),
        }]

    if weak_pct >= 0.60:
        conf    = round(weak_pct * 0.84, 2)
        symbols = [s["symbol"] for s in snapshots if _trend(s) == "Weakening"]
        return [{
            "signature":          "broad_market:Weakening",
            "discovery_type":     "BroadMarketDirection",
            "title":              "היחלשות רחבה: רוב החברות הסרוקות נחלשות",
            "summary":            (
                f"{int(weak_pct*100)}% מהחברות הסרוקות ({weakening} מתוך {total}) "
                "מציגות מגמת היחלשות בנתונים הפיננסיים — "
                "אות מאקרו-כלכלי שחוצה סקטורים."
            ),
            "evidence":           [f"{weakening} מתוך {total} חברות במגמת היחלשות"],
            "confidence":         conf,
            "importance":         "High",
            "category":           "MacroPattern",
            "affected_companies": symbols,
            "affected_sectors":   list(set(
                (s.get("sector") or "") for s in snapshots if _trend(s) == "Weakening"
            )),
        }]

    return []


# ── Detector 7: Cross-sector debt stress ──────────────────────────────────────

def _detect_cross_sector_debt_stress(snapshots: list) -> list:
    """
    DebtAlert signals appearing across 3+ distinct sectors indicates systemic
    stress — not a sector-specific financing issue.
    """
    sector_has_debt: dict  = {}
    debt_companies: list   = []

    for snap in snapshots:
        if _has_signal_category(snap, "DebtAlert"):
            sector = (snap.get("sector") or "Unknown").strip()
            sector_has_debt[sector] = True
            debt_companies.append(snap["symbol"])

    named_sectors = [s for s in sector_has_debt if s != "Unknown"]
    if len(named_sectors) < _MIN_DEBT_SEC:
        return []

    conf = round(min(0.52 + len(named_sectors) * 0.05, 0.84), 2)

    return [{
        "signature":          "debt_stress_cross_sector",
        "discovery_type":     "DebtStressCrossSector",
        "title":              "לחץ חוב רוחבי — חוצה מספר סקטורים",
        "summary":            (
            f"אותות לחץ חוב זוהו ב-{len(named_sectors)} סקטורים שונים: "
            f"{', '.join(named_sectors[:4])}. "
            "כאשר לחץ חוב מופיע בסקטורים שונים בו-זמנית, "
            "הסיכוי שמדובר בתופעה מאקרו-כלכלית עולה."
        ),
        "evidence":           [f"{sym}: אות לחץ חוב" for sym in debt_companies[:8]],
        "confidence":         conf,
        "importance":         "High",
        "category":           "MacroPattern",
        "affected_companies": debt_companies,
        "affected_sectors":   named_sectors,
    }]


# ── Detector 8: Sector data gap ───────────────────────────────────────────────

def _detect_sector_data_gap(snapshots: list) -> list:
    """
    A sector where >50% of companies have Low confidence = systematic data
    availability issue. This is itself a discovery about the dataset, not
    about company quality.
    Requires ≥3 companies in the sector.
    """
    groups     = _group_by_sector(snapshots)
    candidates = []

    for sector, snaps in groups.items():
        if len(snaps) < _MIN_SECTOR or sector == "Unknown":
            continue

        low_conf = sum(1 for s in snaps if _confidence_level(s) == "Low")
        pct      = _pct(low_conf, len(snaps))
        if pct < 0.50:
            continue

        conf = round(min(0.58 + pct * 0.22, 0.80), 2)
        candidates.append({
            "signature":          f"sector_data_gap:{sector}",
            "discovery_type":     "SectorDataGap",
            "title":              f"פער נתונים שיטתי — סקטור {sector}",
            "summary":            (
                f"{int(pct*100)}% מחברות {sector} הסרוקות ({low_conf} מתוך {len(snaps)}) "
                "מציגות רמת ביטחון נמוכה בנתוניהן. "
                "ייתכן שמידע פיננסי מוגבל זמין לסקטור זה — "
                "מסקנות על חברות אלו כפופות לאי-ודאות גבוהה יותר."
            ),
            "evidence":           [
                f"{s['symbol']}: ביטחון נמוך ({s.get('confidence',{}).get('data_years',0)} שנות נתונים)"
                for s in snaps if _confidence_level(s) == "Low"
            ][:8],
            "confidence":         conf,
            "importance":         "Low",
            "category":           "DataPattern",
            "affected_companies": [s["symbol"] for s in snaps if _confidence_level(s) == "Low"],
            "affected_sectors":   [sector],
        })

    return candidates


# ── Main entry point ───────────────────────────────────────────────────────────

_ALL_DETECTORS = [
    _detect_sector_quality_shift,
    _detect_signal_surge,
    _detect_valuation_disconnect,
    _detect_high_confidence_weakening,
    _detect_score_polarization,
    _detect_broad_market_direction,
    _detect_cross_sector_debt_stress,
    _detect_sector_data_gap,
]


def run_all_detectors(snapshots: list) -> list:
    """
    Run every pattern detector against the full snapshot dataset.
    Returns a flat list of DiscoveryCandidate dicts.
    Detector failures are logged but never crash the research cycle.
    """
    candidates = []
    for detector in _ALL_DETECTORS:
        try:
            results = detector(snapshots)
            candidates.extend(results)
        except Exception as e:
            logger.warning("[discovery_engine] %s failed: %s", detector.__name__, e)

    logger.info(
        "[discovery_engine] %d candidates from %d companies",
        len(candidates), len(snapshots),
    )
    return candidates
