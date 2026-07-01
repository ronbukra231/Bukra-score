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
  home_slogan: string
  home_slogan_sub: string
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

  // ── Research Memory ───────────────────────────────────────────────────────
  memory_navLabel: string
  memory_title: string
  memory_subtitle: string
  memory_tagline: string
  memory_activeSection: string
  memory_confirmedSection: string
  memory_historicalSection: string
  memory_noData: string
  memory_noDataSub: string
  memory_confidenceTimeline: string
  memory_evidenceHistory: string
  memory_validationEvents: string
  memory_fourQuestionsTitle: string
  memory_q1: string
  memory_q2: string
  memory_q3: string
  memory_q4: string
  memory_researchScore: string
  memory_scoreTotal: string
  memory_evidenceQty: string
  memory_evidenceQual: string
  memory_historicalCons: string
  memory_crossSectorCons: string
  memory_fpControl: string
  memory_statTotal: string
  memory_statConfirmed: string
  memory_statEmerging: string

  // ── Research Questions ────────────────────────────────────────────────────
  questions_navLabel: string
  questions_title: string
  questions_subtitle: string
  questions_tagline: string
  questions_open: string
  questions_investigating: string
  questions_validated: string
  questions_rejected: string
  questions_dormant: string
  questions_reactivated: string
  questions_hypothesis: string
  questions_relatedDisc: string
  questions_noData: string
  questions_priorityHigh: string
  questions_priorityMedium: string
  questions_priorityLow: string
  questions_generatedBy: string
  questions_sector: string
  questions_tags: string
  questions_statTotal: string

  // ── Belief Changes ────────────────────────────────────────────────────────
  beliefs_navLabel: string
  beliefs_title: string
  beliefs_subtitle: string
  beliefs_tagline: string
  beliefs_noData: string
  beliefs_noDataSub: string
  beliefs_typeStrengthened: string
  beliefs_typeWeakened: string
  beliefs_typePromoted: string
  beliefs_typeArchived: string
  beliefs_typeMinor: string
  beliefs_oldBelief: string
  beliefs_newBelief: string
  beliefs_reason: string
  beliefs_confidenceBefore: string
  beliefs_confidenceAfter: string
  beliefs_statTotal: string
  beliefs_statStrengthened: string
  beliefs_statWeakened: string
  beliefs_statArchived: string

  // ── Knowledge Graph ───────────────────────────────────────────────────────
  graph_navLabel: string
  graph_title: string
  graph_subtitle: string
  graph_tagline: string
  graph_noData: string
  graph_discoveryNode: string
  graph_sectorNode: string
  graph_legend: string
  graph_catSector: string
  graph_catMarket: string
  graph_catMacro: string
  graph_catQuality: string
  graph_catValuation: string
  graph_catData: string

  // ── Research Journal ──────────────────────────────────────────────────────
  journal_navLabel: string
  journal_title: string
  journal_subtitle: string
  journal_tagline: string
  journal_latestNote: string
  journal_companiesAnalyzed: string
  journal_newDiscoveries: string
  journal_confirmedDiscoveries: string
  journal_activeSection: string
  journal_confirmedSection: string
  journal_historicalSection: string
  journal_noData: string
  journal_noDataSub: string
  journal_goToScanner: string
  journal_statusEmerging: string
  journal_statusConfirmed: string
  journal_statusHistorical: string
  journal_statusRejected: string
  journal_firstDetected: string
  journal_lastConfirmed: string
  journal_occurrences: string
  journal_confidence: string
  journal_importance: string
  journal_affectedCompanies: string
  journal_affectedSectors: string
  journal_requiresValidation: string
  journal_evidence: string
  journal_statTotal: string
  journal_statConfirmed: string
  journal_statScans: string
  journal_importanceHigh: string
  journal_importanceMedium: string
  journal_importanceLow: string
  journal_categoryLabel: string
  journal_catSector: string
  journal_catMarket: string
  journal_catMacro: string
  journal_catQuality: string
  journal_catValuation: string
  journal_catData: string
  journal_researchNotes: string
  journal_emptyNotes: string

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

  // ── Event Intelligence ────────────────────────────────────────────────────
  intel_navLabel: string
  intel_pageTitle: string
  intel_pageSubtitle: string
  intel_pageTagline: string
  intel_thesisTitle: string
  intel_thesisPositive: string
  intel_thesisNegative: string
  intel_thesisNeutral: string
  intel_thesisMixed: string
  intel_monitoring: string
  intel_noEvents: string
  intel_noEventsSub: string
  intel_eventTimeline: string
  intel_mostImportant: string
  intel_confirmationNeeded: string
  intel_expectedEffects: string
  intel_statusDetected: string
  intel_statusAnalyzing: string
  intel_statusMonitoring: string
  intel_statusConfirmed: string
  intel_statusRejected: string
  intel_importanceLow: string
  intel_importanceMedium: string
  intel_importanceHigh: string
  intel_importanceCritical: string
  intel_sentimentPositive: string
  intel_sentimentNegative: string
  intel_sentimentNeutral: string
  intel_sentimentMixed: string
  intel_effectRevenue: string
  intel_effectMargins: string
  intel_effectFCF: string
  intel_effectOpIncome: string
  intel_effectDebt: string
  intel_effectCompetitive: string
  intel_effectMarketShare: string
  intel_effectCapAlloc: string
  intel_horizonImmediate: string
  intel_horizonNextQ: string
  intel_horizon6M: string
  intel_horizon12M: string
  intel_horizonLT: string
  intel_confidence: string
  intel_source: string
  intel_affectedCompanies: string
  intel_secondOrderEffects: string
  intel_requiresConfirmation: string
  intel_supportingEvidence: string
  intel_contradictingEvidence: string
  intel_themes: string
  intel_themeConfirmRate: string
  intel_themeCount: string
  intel_chains: string
  intel_chainDesc: string
  intel_noChains: string
  intel_fastestGrowing: string
  intel_mostConfirmed: string
  intel_rejectedNarr: string
  intel_macroEvents: string
  intel_statTotal: string
  intel_statConfirmed: string
  intel_statMonitoring: string
  intel_statCategories: string
  intel_disclaimer: string

  // ── Market Brain (World Model) ──────────────────────────────────────────────
  brain_navLabel: string
  brain_title: string
  brain_subtitle: string
  brain_tagline: string
  brain_noData: string
  brain_noDataSub: string
  brain_statPatterns: string
  brain_statObservations: string
  brain_statCompanies: string
  brain_statWithOutcomes: string
  brain_statNodes: string
  brain_statEdges: string
  brain_sectionPatterns: string
  brain_sectionEmerging: string
  brain_sectionStrengthened: string
  brain_sectionWeakened: string
  brain_sectionRelationships: string
  brain_patternFreq: string
  brain_patternConfidence: string
  brain_patternSuccessRate: string
  brain_patternCompanies: string
  brain_patternSectors: string
  brain_patternFirstSeen: string
  brain_patternNoOutcomes: string
  brain_edgeWeight: string
  brain_edgeType: string
  brain_nodeType: string
  brain_nodeObservations: string
  brain_statusEmerging: string
  brain_statusConfirmed: string
  brain_statusLearning: string

  // ── Research Desk ─────────────────────────────────────────────────────────
  desk_title: string
  desk_subtitle: string
  desk_greeting_prefix: string
  desk_stats_companies: string
  desk_stats_saved: string
  desk_stats_searches: string
  desk_stats_watchlist: string
  desk_recent_title: string
  desk_recent_empty: string
  desk_recent_empty_sub: string
  desk_recent_btn: string
  desk_watchlist_title: string
  desk_watchlist_empty: string
  desk_watchlist_empty_sub: string
  desk_watchlist_add: string
  desk_watchlist_saved: string
  desk_activity_title: string
  desk_activity_empty: string
  desk_activity_researched: string
  desk_activity_searched: string
  desk_activity_saved: string
  desk_activity_removed: string
  desk_coming_title: string
  desk_coming_badge: string
  desk_coming_portfolio: string
  desk_coming_alerts: string
  desk_coming_score_alerts: string
  desk_coming_report: string
  desk_coming_ai: string
  desk_nav: string
  desk_all_companies: string
  desk_notes_count: string
  desk_last_visit: string
  desk_updates_since: string

  // ── Collections ───────────────────────────────────────────────────────────
  coll_header: string
  coll_under_research: string
  coll_watchlist: string
  coll_buy_candidates: string
  coll_high_conviction: string
  coll_rejected: string
  coll_my_collections: string
  coll_new: string
  coll_name_placeholder: string
  coll_desc_placeholder: string
  coll_create: string
  coll_cancel: string
  coll_empty: string
  coll_delete: string

  // ── Save Modal ─────────────────────────────────────────────────────────────
  save_title: string
  save_subtitle: string
  save_done: string
  save_new_collection: string
  save_added: string

  // ── Research Notes ─────────────────────────────────────────────────────────
  notes_title: string
  notes_placeholder: string
  notes_private: string
  notes_last_edit: string
  notes_delete: string
  notes_empty: string
  notes_open: string

  // ── Quick Actions (Company page) ───────────────────────────────────────────
  qa_save: string
  qa_notes: string
  qa_compare: string
  qa_share: string
  qa_saved_in: string
  qa_open_desk: string

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth_login: string
  auth_signup: string
  auth_logout: string
  auth_continueGoogle: string
  auth_email: string
  auth_password: string
  auth_or: string
  auth_noAccount: string
  auth_haveAccount: string
  auth_backHome: string
  auth_guestTitle: string
  auth_guestBody: string
  auth_guestSignIn: string
  auth_guestSignUp: string
}
