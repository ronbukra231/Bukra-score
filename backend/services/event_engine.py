"""
Event Intelligence Engine — Mission Alpha 2.5

Responsibility: understand business events, NOT score companies.
Events create hypotheses. Financial statements confirm or reject them.
The Bukra Score is NEVER changed directly by events.
"""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

logger = logging.getLogger("bukra.event_engine")

# ── Enumerations (as string constants — avoids Enum serialization friction) ───

class EventCategory:
    ACQUISITION            = "Acquisition"
    MERGER                 = "Merger"
    STRATEGIC_PARTNERSHIP  = "Strategic Partnership"
    MAJOR_CUSTOMER_WIN     = "Major Customer Win"
    MAJOR_CUSTOMER_LOSS    = "Major Customer Loss"
    NEW_PRODUCT            = "New Product"
    AI_ANNOUNCEMENT        = "AI Announcement"
    SEMICONDUCTOR_DEMAND   = "Semiconductor Demand"
    REGULATION             = "Regulation"
    LAWSUIT                = "Lawsuit"
    EXECUTIVE_CHANGE       = "Executive Change"
    CEO_CHANGE             = "CEO Change"
    CFO_CHANGE             = "CFO Change"
    SHARE_BUYBACK          = "Share Buyback"
    DIVIDEND_CHANGE        = "Dividend Change"
    DEBT_REFINANCING       = "Debt Refinancing"
    SUPPLY_CHAIN           = "Supply Chain"
    MANUFACTURING_EXPANSION = "Manufacturing Expansion"
    FACTORY_OPENING        = "Factory Opening"
    FACTORY_DELAY          = "Factory Delay"
    GOVERNMENT_CONTRACT    = "Government Contract"
    MILITARY_CONTRACT      = "Military Contract"
    CLOUD_PARTNERSHIP      = "Cloud Partnership"
    ENERGY_COSTS           = "Energy Costs"
    INTEREST_RATE_SENSITIVITY = "Interest Rate Sensitivity"
    CURRENCY_EXPOSURE      = "Currency Exposure"
    CYBERSECURITY_INCIDENT = "Cybersecurity Incident"
    SECTOR_NEWS            = "Sector News"
    MACRO_ECONOMY          = "Macro Economy"
    COMPETITOR_EVENT       = "Competitor Event"
    SUPPLIER_EVENT         = "Supplier Event"
    CUSTOMER_EVENT         = "Customer Event"


class EventImportance:
    LOW      = "Low"
    MEDIUM   = "Medium"
    HIGH     = "High"
    CRITICAL = "Critical"


class EventSentiment:
    POSITIVE = "Positive"
    NEUTRAL  = "Neutral"
    NEGATIVE = "Negative"
    MIXED    = "Mixed"


class EventStatus:
    DETECTED   = "Detected"
    ANALYZING  = "Analyzing"
    MONITORING = "Monitoring"
    CONFIRMED  = "Confirmed"
    REJECTED   = "Rejected"


class TimeHorizon:
    IMMEDIATE     = "Immediate"
    NEXT_QUARTER  = "Next Quarter"
    SIX_MONTHS    = "6 Months"
    TWELVE_MONTHS = "12 Months"
    LONG_TERM     = "Long Term"


class FinancialEffect:
    REVENUE              = "Revenue"
    MARGINS              = "Margins"
    FCF                  = "FCF"
    OPERATING_INCOME     = "Operating Income"
    DEBT                 = "Debt"
    COMPETITIVE_POSITION = "Competitive Position"
    MARKET_SHARE         = "Market Share"
    CAPITAL_ALLOCATION   = "Capital Allocation"


# ── Data model ────────────────────────────────────────────────────────────────

def _make_id(symbol: str, headline: str, timestamp: str) -> str:
    raw = f"{symbol}|{headline[:60]}|{timestamp[:10]}"
    return hashlib.sha1(raw.encode()).hexdigest()[:12]


def build_event(
    *,
    symbol: str,
    company: str,
    headline: str,
    summary: str,
    source: str,
    url: str,
    category: str,
    importance: str,
    sentiment: str,
    confidence: float,
    affected_segments: Optional[List[str]] = None,
    affected_companies: Optional[List[str]] = None,
    expected_financial_effects: Optional[List[Dict[str, Any]]] = None,
    time_horizon: str = TimeHorizon.TWELVE_MONTHS,
    requires_confirmation: Optional[List[str]] = None,
    timestamp: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Construct a BusinessEvent dict. Called by news providers after parsing.
    The event_engine does NOT decide whether prices will move.
    It records what happened and what business effects are plausible.
    """
    now = timestamp or datetime.now(timezone.utc).isoformat()
    eid = _make_id(symbol, headline, now)

    return {
        "id":                         eid,
        "company":                    company,
        "symbol":                     symbol.upper(),
        "timestamp":                  now,
        "headline":                   headline,
        "summary":                    summary,
        "source":                     source,
        "url":                        url,
        "category":                   category,
        "importance":                 importance,
        "confidence":                 max(0.0, min(1.0, confidence)),
        "sentiment":                  sentiment,
        "affected_segments":          affected_segments or [],
        "affected_companies":         affected_companies or [],
        "expected_financial_effects": expected_financial_effects or [],
        "time_horizon":               time_horizon,
        "requires_confirmation":      requires_confirmation or [],
        "status":                     EventStatus.DETECTED,
        "supporting_evidence":        [],
        "contradicting_evidence":     [],
        "last_updated":               now,
    }


def make_effect(
    financial_line: str,
    direction: str,
    confidence: float,
    reasoning: str,
    time_horizon: str = TimeHorizon.TWELVE_MONTHS,
) -> Dict[str, Any]:
    """Build an entry for expected_financial_effects."""
    return {
        "financial_line": financial_line,
        "direction":      direction,
        "confidence":     max(0.0, min(1.0, confidence)),
        "reasoning":      reasoning,
        "time_horizon":   time_horizon,
    }


# ── Business thesis ───────────────────────────────────────────────────────────

_IMPORTANCE_WEIGHT: Dict[str, float] = {
    "Low": 0.5, "Medium": 1.0, "High": 2.0, "Critical": 3.5
}

_THESIS_DISCLAIMER: Dict[str, str] = {
    "Positive": (
        "The current business thesis could eventually improve the company's underlying quality "
        "if future financial statements confirm the observed developments."
    ),
    "Negative": (
        "The current business thesis could eventually weaken the company's underlying quality "
        "if future financial statements confirm the observed developments."
    ),
    "Neutral": "No strong directional thesis. Monitoring for confirmation.",
}


def derive_thesis(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Pure function. Given a list of stored events for a company,
    produce an honest business thesis.
    Never predicts prices. Never changes the Bukra Score.
    """
    if not events:
        return {
            "sentiment": "Neutral",
            "confidence": 0.0,
            "summary": "No events observed.",
            "monitoring": [],
            "positive_count": 0,
            "negative_count": 0,
            "critical_count": 0,
            "active_event_count": 0,
        }

    active = [e for e in events if e.get("status") != EventStatus.REJECTED]
    pos = [e for e in active if e.get("sentiment") == EventSentiment.POSITIVE]
    neg = [e for e in active if e.get("sentiment") == EventSentiment.NEGATIVE]
    critical = [e for e in active if e.get("importance") == EventImportance.CRITICAL]

    pos_w = sum(_IMPORTANCE_WEIGHT.get(e.get("importance", "Low"), 1.0) * e.get("confidence", 0.5) for e in pos)
    neg_w = sum(_IMPORTANCE_WEIGHT.get(e.get("importance", "Low"), 1.0) * e.get("confidence", 0.5) for e in neg)

    if pos_w > neg_w * 1.5:
        sentiment = "Positive"
    elif neg_w > pos_w * 1.5:
        sentiment = "Negative"
    else:
        sentiment = "Neutral"

    # Confidence: grows with weight, capped at 85% — we never claim certainty from events alone
    total_w = pos_w + neg_w
    confidence = min(0.85, (total_w / max(1, len(active))) * 0.4) if active else 0.0

    monitoring: List[str] = []
    for e in active:
        for req in e.get("requires_confirmation", []):
            if req not in monitoring:
                monitoring.append(req)

    critical_names = ", ".join(e.get("category", "event") for e in critical[:2])
    if critical:
        base = f"{len(critical)} critical event(s) under observation ({critical_names})."
    else:
        base = f"{len(active)} business event(s) being monitored."

    return {
        "sentiment":          sentiment,
        "confidence":         round(confidence, 3),
        "summary":            f"{base} {_THESIS_DISCLAIMER.get(sentiment, '')}",
        "monitoring":         monitoring[:8],
        "positive_count":     len(pos),
        "negative_count":     len(neg),
        "critical_count":     len(critical),
        "active_event_count": len(active),
    }
