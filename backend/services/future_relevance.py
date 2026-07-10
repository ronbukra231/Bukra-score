"""
Future Relevance — placeholder engine.

Architecture is production-ready. The AI engine (real analysis) will replace
`_generate_placeholder_analysis()` in a future sprint. Everything else
(data model, scoring, status labels) is stable and final.

Separation:
  - Data model  : the dict shape returned by `compute_future_relevance()`
  - Scoring     : `_fr_score_from_financials()` — deterministic heuristic (placeholder)
  - AI Engine   : `_generate_placeholder_analysis()` — swap for real LLM call later
  - Status label: `_status_label()` — deterministic from score
"""

from datetime import datetime, timezone


# ── Status label (deterministic) ──────────────────────────────────────────────

def _status_label(score: int) -> str:
    if score >= 90: return "Future Leader"
    if score >= 80: return "Highly Relevant"
    if score >= 65: return "Stable but Challenged"
    if score >= 50: return "Future Uncertain"
    return "High Disruption Risk"


# ── Heuristic score (placeholder — replace with AI engine) ────────────────────

def _fr_score_from_financials(info: dict, score_data: dict) -> int:
    """
    Derive a plausible Future Relevance score from existing data.
    This is a PLACEHOLDER. Replace with real AI analysis later.

    Logic: base on Bukra Score + sector modifier + growth momentum.
    """
    bukra = score_data.get("score") or 50
    sector = (info.get("sector") or "").lower()

    # Sector modifiers (placeholder heuristic)
    sector_boost = {
        "technology":            15,
        "healthcare":            10,
        "communication services": 8,
        "consumer cyclical":      3,
        "industrials":            2,
        "financial services":     0,
        "energy":                -5,
        "utilities":             -8,
        "real estate":           -3,
        "consumer defensive":    -2,
        "basic materials":       -6,
    }.get(sector, 0)

    # Growth momentum modifier from Bukra breakdown
    breakdown = score_data.get("breakdown", {})
    growth_raw = breakdown.get("growth", 0)
    growth_mod  = round((growth_raw / 25) * 10 - 5)  # -5 to +5

    raw = bukra + sector_boost + growth_mod
    return max(0, min(100, round(raw)))


# ── AI Engine (placeholder — swap this function for real LLM call) ────────────

def _generate_placeholder_analysis(symbol: str, info: dict, score: int) -> dict:
    """
    Placeholder AI analysis. Returns demo content with the correct data shape.
    The real engine will accept the same signature and return the same shape.
    """
    name    = info.get("name", symbol)
    sector  = info.get("sector", "Technology")
    country = info.get("country", "United States")

    # ── Positive Drivers ─────────────────────────────────────────────────────
    drivers = [
        {
            "key":     "ai_adoption",
            "label":   "AI Adoption",
            "score":   min(100, score + 12),
            "summary": f"{name} is actively integrating AI capabilities across its core product lines, "
                       "positioning it to benefit from accelerating enterprise AI adoption.",
        },
        {
            "key":     "industry_outlook",
            "label":   "Industry Outlook",
            "score":   score,
            "summary": f"The {sector} sector is expected to grow at above-average rates through 2035, "
                       "driven by digital transformation and demographic tailwinds.",
        },
        {
            "key":     "competitive_moat",
            "label":   "Competitive Moat",
            "score":   max(30, score - 8),
            "summary": f"{name} maintains defensible competitive advantages through switching costs, "
                       "network effects, and proprietary data assets accumulated over time.",
        },
        {
            "key":     "innovation",
            "label":   "Innovation",
            "score":   min(100, score + 5),
            "summary": "R&D investment as a percentage of revenue has remained above industry median, "
                       "suggesting sustained commitment to next-generation product development.",
        },
        {
            "key":     "management_adaptability",
            "label":   "Management Adaptability",
            "score":   max(40, score - 5),
            "summary": "Leadership has demonstrated willingness to pivot business model and enter "
                       "adjacent markets when core growth opportunities slow.",
        },
        {
            "key":     "long_term_demand",
            "label":   "Long-Term Demand",
            "score":   score,
            "summary": f"Demand for {name}'s core products is structurally supported by secular trends "
                       "in digitalisation, automation, and global middle-class expansion.",
        },
    ]

    # ── Risk Factors ──────────────────────────────────────────────────────────
    risks = [
        {
            "key":      "technology_disruption",
            "label":    "Technology Disruption",
            "severity": "Medium",
            "summary":  "Rapid cycles in foundational technology (AI models, compute architectures) "
                        "could render existing product advantages obsolete faster than historical norms.",
        },
        {
            "key":      "regulation",
            "label":    "Regulation",
            "severity": "Medium" if sector.lower() in ("technology", "financial services") else "Low",
            "summary":  "Increasing regulatory scrutiny — particularly in data privacy, AI liability, "
                        "and antitrust — may raise compliance costs and limit product expansion.",
        },
        {
            "key":      "competition",
            "label":    "Competition",
            "severity": "High" if score < 70 else "Medium",
            "summary":  "Well-capitalised incumbents and venture-backed challengers continue to "
                        "enter the core market, compressing pricing power and margin outlook.",
        },
        {
            "key":      "consumer_behaviour",
            "label":    "Consumer Behaviour",
            "severity": "Low",
            "summary":  "Generational shifts in purchasing habits and platform preferences require "
                        "ongoing product evolution to maintain relevance with younger cohorts.",
        },
        {
            "key":      "geopolitical_risk",
            "label":    "Geopolitical Risk",
            "severity": "Low" if country == "United States" else "Medium",
            "summary":  "Supply chain exposure and revenue concentration in geopolitically sensitive "
                        "regions introduce earnings volatility not captured in financial models.",
        },
        {
            "key":      "industry_risks",
            "label":    "Industry Risks",
            "severity": "Low",
            "summary":  f"Sector-specific risks including cyclicality, commoditisation, and "
                        f"margin compression remain present in the {sector} sector over a 10–15 year horizon.",
        },
    ]

    # ── Long-Term Trends ──────────────────────────────────────────────────────
    trends = [
        {"key": "ai",            "label": "Artificial Intelligence",  "relevance": "High"},
        {"key": "automation",    "label": "Automation",               "relevance": "High"},
        {"key": "cloud",         "label": "Cloud Computing",          "relevance": "High"},
        {"key": "cybersecurity", "label": "Cybersecurity",            "relevance": "Medium"},
        {"key": "energy",        "label": "Energy Transition",        "relevance": "Medium"},
        {"key": "healthcare",    "label": "Healthcare Innovation",    "relevance": "Medium"},
        {"key": "semiconductors","label": "Semiconductors",           "relevance": "High"},
        {"key": "aging",         "label": "Population Aging",         "relevance": "Low"},
        {"key": "payments",      "label": "Digital Payments",         "relevance": "Medium"},
        {"key": "data",          "label": "Data Economy",             "relevance": "High"},
    ]

    # ── Scenarios ─────────────────────────────────────────────────────────────
    scenarios = [
        {
            "type":      "bull",
            "title":     "Bull Case — Technology Leadership",
            "summary":   (
                f"{name} successfully executes its AI integration roadmap, becoming a platform "
                "of choice across enterprise segments. Revenue compounds at 12–15% annually, "
                "operating margins expand by 400–600 bps, and the business achieves durable "
                "competitive moat through network effects and proprietary data. "
                "The company exits this decade as a category-defining market leader."
            ),
            "timeframe": "2030–2035",
        },
        {
            "type":      "base",
            "title":     "Base Case — Steady Compounder",
            "summary":   (
                f"{name} maintains its current position while gradually expanding into adjacent "
                "markets. Revenue growth moderates to 6–9% CAGR as core markets mature. "
                "The business invests steadily in next-generation capabilities and preserves "
                "its competitive position, generating consistent free cash flow that funds "
                "both reinvestment and shareholder returns."
            ),
            "timeframe": "2030–2035",
        },
        {
            "type":      "bear",
            "title":     "Bear Case — Market Share Erosion",
            "summary":   (
                f"Faster-than-expected disruption from AI-native competitors, combined with "
                "regulatory headwinds, forces {name} into a defensive posture. Growth stalls "
                "at 1–3% CAGR while margin compression accelerates. The business remains "
                "profitable but loses strategic relevance as customers migrate to alternatives "
                "offering superior economics or capabilities."
            ),
            "timeframe": "2030–2035",
        },
    ]

    # ── AI Summary ────────────────────────────────────────────────────────────
    status = _status_label(score)
    ai_summary = (
        f"{name} receives a Future Relevance score of {score}/100 ({status}). "
        f"The analysis evaluates the company's positioning across {len(trends)} long-term structural "
        f"trends over a 10–15 year horizon. "
        f"Key positive drivers include strong AI adoption potential and a defensible competitive moat "
        f"supported by switching costs and proprietary data. "
        f"The primary risk factors are intensifying competition and regulatory uncertainty in the "
        f"{sector} sector. "
        f"In the base case scenario, {name} is expected to maintain its strategic position while "
        f"navigating the transition to AI-native product architectures — though execution risk "
        f"remains meaningful."
    )

    return {
        "drivers":   drivers,
        "risks":     risks,
        "trends":    trends,
        "scenarios": scenarios,
        "aiSummary": ai_summary,
    }


# ── Public entry point ────────────────────────────────────────────────────────

def compute_future_relevance(symbol: str, info: dict, score_data: dict) -> dict:
    """
    Compute the Future Relevance analysis for a company.

    Returns a stable data shape. `isPlaceholder: True` until the real AI
    engine replaces `_generate_placeholder_analysis()`.

    Future upgrade path:
      1. Replace `_generate_placeholder_analysis()` with a real LLM call.
      2. Replace `_fr_score_from_financials()` with AI-derived scoring.
      3. Set `isPlaceholder: False` once the real engine is live.
    """
    score    = _fr_score_from_financials(info, score_data)
    analysis = _generate_placeholder_analysis(symbol, info, score)

    return {
        "score":          score,
        "confidence":     "Medium",           # upgrade to AI-derived once real engine live
        "status":         _status_label(score),
        "isPlaceholder":  True,
        "generatedAt":    datetime.now(timezone.utc).isoformat(),
        **analysis,
    }
