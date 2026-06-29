export type Lang = 'he' | 'en'
// Add future languages here: 'ru' | 'es' | 'fr'

export interface Translations {
  // ── Navigation ───────────────────────────────────────────────────────────
  nav_appName: string
  nav_langToggle: string  // what switching TO (shows "EN" when currently Hebrew)

  // ── Home page ─────────────────────────────────────────────────────────────
  home_badge: string
  home_heading1: string
  home_heading2: string
  home_subtitle: string
  home_footer: string
  // New hero copy
  home_h1_line1: string
  home_h1_line2: string
  home_subheadline: string
  home_description: string
  // Explanation card
  home_explainTitle: string
  home_explainBody: string
  home_explainP1: string
  home_explainP2: string
  home_explainP3: string
  home_explainP4: string
  home_explainP5: string
  home_explainFooter1: string
  home_explainFooter2: string
  // CTA
  home_ctaPrimary: string

  // ── Search ────────────────────────────────────────────────────────────────
  search_placeholder: string
  search_loading: string

  // ── Company page ──────────────────────────────────────────────────────────
  co_loading: string
  co_errorTitle: string
  co_retry: string
  co_back: string
  co_currentPrice: string
  co_weekRange: string
  co_employees: string
  co_about: string
  co_chartsTitle: string
  co_mockBadge: string
  co_noChartsTitle: string
  co_noChartsBody: string
  co_loadingStep1: string
  co_loadingStep2: string
  co_loadingStep3: string

  // ── Stat card labels ──────────────────────────────────────────────────────
  stat_marketCap: string
  stat_pe: string
  stat_high52: string
  stat_low52: string
  stat_dividend: string
  stat_countryAndCurrency: string
  stat_noDividend: string
  stat_annual: string

  // ── Financial charts ──────────────────────────────────────────────────────
  chart_revenue: string
  chart_netIncome: string
  chart_netMargin: string
  chart_fcf: string
  chart_debt: string
  chart_cash: string
  chart_revenue_tip: string
  chart_netIncome_tip: string
  chart_margin_tip: string
  chart_fcf_tip: string
  chart_debt_tip: string
  chart_cash_tip: string

  // ── Bukra Score ───────────────────────────────────────────────────────────
  score_title: string
  score_subtitle: string
  score_noData: string
  score_partialData: string
  score_growth: string
  score_profitability: string
  score_cashFlow: string
  score_stability: string
  score_debt: string
  score_excellent: string
  score_veryGood: string
  score_average: string
  score_weak: string
  score_poor: string

  // ── Bukra Rules ───────────────────────────────────────────────────────────
  rules_title: string
  rules_subtitle: string
  rules_passedOf: string
  rules_statusPass: string
  rules_statusFail: string
  rules_statusUnavail: string
  rules_notAvailSuffix: string  // "(X לא זמין)" suffix
  rules_verdictStrong: string
  rules_verdictWatchlist: string
  rules_verdictMixed: string
  rules_verdictAvoid: string
  rules_verdictNoData: string
  // Rule labels (static)
  rules_r1_label: string
  rules_r2_label: string
  rules_r3_label: string
  rules_r4_label: string
  rules_r5_label: string

  // ── AI Explanation ────────────────────────────────────────────────────────
  ai_title: string
  ai_noKeyBadge: string
  ai_loading: string
  ai_error: string
  ai_s_whatDoes: string
  ai_s_revenue: string
  ai_s_whyAttractive: string
  ai_s_risks: string
  ai_s_eli5: string
  // Hebrew-only keys (shown only in Hebrew mode)
  ai_noKeyMessageHe: string
  ai_showOriginal: string
  ai_hideOriginal: string
  ai_setupNoteHe: string

  // ── Smart Analyst Summary ─────────────────────────────────────────────────
  analyst_title: string
  analyst_loading: string
  analyst_deterministicBadge: string
  analyst_contributorsTitle: string
  analyst_confPrefix: string
  analyst_confHigh: string
  analyst_confMedium: string
  analyst_confLow: string
  analyst_confNoteHigh: string
  analyst_confNoteMedium: string
  analyst_confNoteLow: string
  analyst_strongestLabel: string
  analyst_weakestLabel: string

  // ── Scanner ───────────────────────────────────────────────────────────────
  scanner_title: string
  scanner_subtitle: string
  scanner_loadingMsg: string
  scanner_scanningMsg: string   // e.g. "סורק 37 / 210 חברות..."
  scanner_doneMsg: string       // e.g. "נסרקו 185 חברות | עודכן לאחרונה: ..."
  scanner_refresh: string
  scanner_noResults: string
  scanner_failedNote: string    // "X חברות לא נסרקו"
  scanner_col_rank: string
  scanner_col_ticker: string
  scanner_col_company: string
  scanner_col_sector: string
  scanner_col_score: string
  scanner_col_rules: string
  scanner_col_status: string
  scanner_col_marketCap: string
  scanner_col_pe: string
  scanner_col_strength: string
  scanner_filter_sector: string
  scanner_filter_minScore: string
  scanner_filter_fiveStars: string
  scanner_filter_all: string
  scanner_filter_anyScore: string
  scanner_noCache: string
  scanner_refreshing: string
  scanner_lastUpdated: string
  scanner_universeSize: string
  scanner_duration: string
  scanner_startRefresh: string
  // CTA on home page
  home_scanBtn: string
  home_scanSub: string

  // ── Prediction Accuracy System ────────────────────────────────────────────
  accuracy_title: string
  accuracy_subtitle: string
  accuracy_reliabilityScore: string
  accuracy_completed: string
  accuracy_pending: string
  accuracy_beatSPY: string
  accuracy_avgReturn: string
  accuracy_sampleNote: string
  accuracy_noHistory: string
  accuracy_methodology: string
  accuracy_methodologyDetail: string
  accuracy_bestPrediction: string
  accuracy_worstPrediction: string
  accuracy_byBucket: string
  accuracy_bucket90plus: string
  accuracy_bucket80_89: string
  accuracy_bucket70_79: string
  accuracy_bucketBelow70: string
  accuracy_recalculate: string
  accuracy_lastUpdated: string
  accuracy_realData: string
  accuracy_sampleData: string
  accuracy_checks: string
  accuracy_pendingChecks: string
  accuracy_viewAll: string
  accuracy_noData: string
  accuracy_correct: string
  accuracy_incorrect: string
  accuracy_vsSpyAvg: string
  accuracy_pendingBadge: string
  accuracy_sampleBadge: string
  accuracy_realBadge: string
  accuracy_ticker: string
  accuracy_score: string
  accuracy_date: string
  accuracy_return3m: string
  accuracy_spyReturn: string
  accuracy_status: string
  accuracy_beat: string
  accuracy_missed: string
  accuracy_pageTitle: string
  accuracy_pageSubtitle: string
  // Alpha & confidence (v2)
  accuracy_alpha: string
  accuracy_avgAlpha: string
  accuracy_bestAlpha: string
  accuracy_worstAlpha: string
  accuracy_rollingAlpha: string
  accuracy_hitRate: string
  accuracy_confidence: string
  accuracy_confidenceLabel: string
  accuracy_confidenceDesc_Aplus: string
  accuracy_confidenceDesc_A: string
  accuracy_confidenceDesc_B: string
  accuracy_confidenceDesc_C: string
  accuracy_confidenceDesc_D: string
  // Performance dashboard
  accuracy_perfDashboard: string
  accuracy_predictionCount: string
  accuracy_resolvedCount: string
  // Score range table
  accuracy_scoreRanges: string
  accuracy_range: string
  accuracy_sampleSize: string
  accuracy_col_avgReturn: string
  accuracy_col_avgAlpha: string
  accuracy_col_hitRate: string
  // Philosophy
  accuracy_philosophy: string
  accuracy_philosophyBody: string
  // Range labels
  accuracy_range95_100: string
  accuracy_range90_94: string
  accuracy_range85_89: string
  accuracy_range80_84: string
  accuracy_range75_79: string
  accuracy_range70_74: string
  accuracy_range65_69: string
  accuracy_range60_64: string
  accuracy_rangeBelow60: string
  // Transparency
  accuracy_transparencyTitle: string
  accuracy_realPredictions: string
  accuracy_samplePredictions: string
  accuracy_pendingEvals: string
  accuracy_alphaCol: string

  // ── Footer ────────────────────────────────────────────────────────────────
  footer_legal: string
  footer_dataNote: string

  // ── SmartAnalystSummary disclaimer ────────────────────────────────────────
  analyst_dataNote: string

  // ── Legal page ────────────────────────────────────────────────────────────
  legal_title: string
  legal_subtitle: string
  legal_lastUpdated: string

  // ── Intelligence panel (per-company) ─────────────────────────────────────
  intel_panelTitle: string
  intel_confidenceLabel: string
  intel_trendLabel: string
  intel_signalsLabel: string
  intel_noSignals: string
  intel_confidenceHigh: string
  intel_confidenceMedium: string
  intel_confidenceLow: string
  intel_trendImproving: string
  intel_trendStable: string
  intel_trendWeakening: string
  intel_dataYears: string
  intel_scoreChangeTitle: string
  intel_scoreUp: string
  intel_scoreDown: string
  intel_scoreUnchanged: string
  intel_significantChange: string

  // ── Radar page ────────────────────────────────────────────────────────────
  radar_title: string
  radar_subtitle: string
  radar_tagline: string
  radar_lastScan: string
  radar_totalSignals: string
  radar_companiesScanned: string
  radar_noData: string
  radar_noDataSub: string
  radar_goToScanner: string
  radar_qualityUpgrades: string
  radar_qualityDowngrades: string
  radar_valuationWarnings: string
  radar_marginPressure: string
  radar_revenueMomentum: string
  radar_debtAlerts: string
  radar_priceOpportunities: string
  radar_highQualityWatchlist: string
  radar_dataWarnings: string
  radar_severityHigh: string
  radar_severityMedium: string
  radar_severityLow: string
  radar_score: string
  radar_trend: string
  radar_confidence: string
  radar_navLabel: string
}
