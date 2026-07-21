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
  co_guestLockedTitle: string
  co_guestLockedBody: string
  co_guestSignIn: string

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

  // ── Future Relevance ──────────────────────────────────────────────────────
  fr_title: string
  fr_subtitle: string
  fr_noData: string
  fr_placeholder: string        // "AI analysis · Placeholder"
  fr_confidence: string
  fr_confidenceHigh: string
  fr_confidenceMedium: string
  fr_confidenceLow: string
  fr_driversTitle: string
  fr_risksTitle: string
  fr_trendsTitle: string
  fr_scenariosTitle: string
  fr_aiSummaryTitle: string
  fr_bull: string
  fr_base: string
  fr_bear: string
  fr_severityHigh: string
  fr_severityMedium: string
  fr_severityLow: string
  fr_relevanceHigh: string
  fr_relevanceMedium: string
  fr_relevanceLow: string
  fr_disclaimer: string
  fr_status90: string
  fr_status80: string
  fr_status65: string
  fr_status50: string
  fr_status0: string
  fr_timeframe: string
  fr_close: string
  fr_viewFull: string
  fr_thesisTitle: string
  fr_whatsNew: string

  // ── Valuation & Pricing ───────────────────────────────────────────────────
  val_sectionTitle: string
  val_sectionSubtitle: string
  val_scoreTitle: string
  val_scoreTooltip: string
  val_gapTitle: string
  val_gapTooltip: string
  val_bubbleTitle: string
  val_bubbleTooltip: string
  val_confTitle: string
  val_confTooltip: string
  val_estimateNote: string
  // Band labels
  val_band_very_attractive: string
  val_band_attractive: string
  val_band_reasonable: string
  val_band_expensive: string
  val_band_very_expensive: string
  val_band_extreme: string
  val_gap_conservative: string
  val_gap_reasonable: string
  val_gap_high: string
  val_gap_aggressive: string
  val_gap_extreme: string
  val_bubble_conservative: string
  val_bubble_reasonable: string
  val_bubble_elevated: string
  val_bubble_speculative: string
  val_bubble_extreme_risk: string
  val_conf_High: string
  val_conf_Medium: string
  val_conf_Low: string
  val_dq_complete: string
  val_dq_partial: string
  val_dq_limited: string
  val_dq_insufficient: string
  // Fair value range
  val_rangeTitle: string
  val_bear: string
  val_base: string
  val_bull: string
  val_currentPrice: string
  val_marginOfSafety: string
  val_estimatedDownside: string
  val_belowRange: string
  val_aboveRange: string
  val_insideRange: string
  // Market pricing (reverse DCF)
  val_pricedInTitle: string
  val_pricedInSubtitle: string
  val_impliedGrowth: string
  val_historicalGrowth: string
  val_impliedMargin: string
  val_historicalMargin: string
  val_requiredRevenue: string
  val_requiredFcf: string
  val_discountRate: string
  val_terminalGrowth: string
  val_terminalDependency: string
  val_forecastYears: string
  val_solverCapped: string
  val_fcfProxyNote: string
  // Scenarios
  val_scenariosTitle: string
  val_assumptions: string
  val_fairValuePerShare: string
  val_fairMarketCap: string
  val_upsideDownside: string
  // Why this score
  val_whyTitle: string
  val_positiveFactors: string
  val_riskFactors: string
  val_missingInputs: string
  val_methodsUsed: string
  val_dataQualityLabel: string
  val_calculatedAt: string
  val_methodology: string
  // Quality vs price matrix
  val_matrixTitle: string
  val_matrixQualityHighPriceLow: string
  val_matrixBothHigh: string
  val_matrixNote: string
  // States
  val_insufficientTitle: string
  val_loadingTitle: string
  val_conclusionTitle: string

  // ── Bukra Portfolio Simulator (Phase 1 — virtual money only) ─────────────
  sim_navLabel: string
  sim_disclaimerShort: string
  sim_disclaimerFull: string
  sim_virtualMoneyLabel: string
  sim_noRealTrade: string
  // Onboarding
  sim_onboardTitle: string
  sim_onboardIntro: string
  sim_stepCurrency: string
  sim_stepCapital: string
  sim_stepRisk: string
  sim_stepBenchmark: string
  sim_stepDisclaimer: string
  sim_stepReview: string
  sim_portfolioName: string
  sim_baseCurrency: string
  sim_startingCapital: string
  sim_riskProfileLabel: string
  sim_riskDisclaimer: string
  sim_benchmarkLabel: string
  sim_createPortfolio: string
  sim_creating: string
  sim_riskConservative: string
  sim_riskBalanced: string
  sim_riskGrowth: string
  sim_riskAggressive: string
  // Dashboard
  sim_dashboardTitle: string
  sim_portfolioValue: string
  sim_virtualCash: string
  sim_totalDeposits: string
  sim_totalReturn: string
  sim_totalReturnPct: string
  sim_sinceCreation: string
  sim_timeWeightedReturn: string
  sim_moneyWeightedReturn: string
  sim_addVirtualFunds: string
  sim_addFundsPlaceholder: string
  sim_addFundsConfirm: string
  sim_period1D: string
  sim_period1W: string
  sim_period1M: string
  sim_period3M: string
  sim_period1Y: string
  sim_periodAll: string
  sim_benchmarkComparison: string
  sim_benchmarkUnavailable: string
  sim_allocationBySector: string
  sim_allocationCash: string
  // Holdings
  sim_holdingsTitle: string
  sim_noHoldings: string
  sim_noHoldingsSub: string
  sim_quantity: string
  sim_avgCost: string
  sim_currentPrice: string
  sim_marketValue: string
  sim_unrealizedGL: string
  sim_weight: string
  sim_reasonForHolding: string
  // Summary
  sim_summaryTitle: string
  sim_numberOfHoldings: string
  sim_largestPosition: string
  sim_largestSector: string
  sim_cashPct: string
  sim_bestPerformer: string
  sim_worstPerformer: string
  sim_totalDividends: string
  sim_totalFees: string
  // Portfolio Health
  sim_healthTitle: string
  sim_healthStrong: string
  sim_healthBalanced: string
  sim_healthNeedsAttention: string
  sim_healthHighConcentration: string
  sim_healthHighValuationRisk: string
  sim_healthLimitedConfidence: string
  sim_healthNotGuarantee: string
  // Decision Center
  sim_decisionCenterTitle: string
  sim_decisionCenterSubtitle: string
  sim_noRecommendations: string
  sim_noRecommendationsSub: string
  sim_generateRecommendations: string
  sim_generating: string
  sim_recTypeAdd: string
  sim_recTypeIncrease: string
  sim_recTypeReduce: string
  sim_recTypeExit: string
  sim_recTypeHold: string
  sim_recTypeReview: string
  sim_recTypeAddCash: string
  sim_recTypeRebalance: string
  sim_statusPending: string
  sim_statusViewed: string
  sim_statusApproved: string
  sim_statusRejected: string
  sim_statusExpired: string
  sim_statusExecuted: string
  sim_statusCancelled: string
  sim_review: string
  sim_approve: string
  sim_reject: string
  sim_reviewLater: string
  sim_learnMore: string
  sim_expiresOn: string
  // Approval flow
  sim_approvalTitle: string
  sim_proposedAmount: string
  sim_proposedQuantity: string
  sim_currentWeight: string
  sim_targetWeight: string
  sim_estimatedFee: string
  sim_estimatedFx: string
  sim_mainReasons: string
  sim_mainRisks: string
  sim_diversificationImpact: string
  sim_cashImpact: string
  sim_confirmCheckbox: string
  sim_approveSimulated: string
  sim_cancel: string
  sim_rejectNotePlaceholder: string
  sim_approvalSuccess: string
  sim_approvalFailed: string
  // Activity / Audit / Decision history
  sim_activityTitle: string
  sim_noActivity: string
  sim_auditTitle: string
  sim_decisionHistoryTitle: string
  sim_filterStatus: string
  sim_filterCompany: string
  sim_filterType: string
  sim_filterAll: string
  sim_userNote: string
  sim_addNote: string
  // Errors / empty
  sim_errorGeneric: string
  sim_loading: string
  sim_noPortfolioYet: string
  sim_startSimulation: string
}
