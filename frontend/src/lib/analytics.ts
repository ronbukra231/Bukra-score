/**
 * Bukra Analytics — production-grade GA4 integration.
 *
 * Architecture:
 *   - gtag.js is loaded in index.html so it appears in View Source and is
 *     detected by Google's tag checker, crawlers, and CSP auditors.
 *   - This file is a pure wrapper — no script injection, just window.gtag calls.
 *   - All tracking goes through one trackEvent() so switching providers
 *     (Mixpanel, PostHog, Amplitude, Clarity) requires changing only this file.
 *   - Debug mode: every event is console.log'd in development, silent in prod.
 *   - Privacy: anonymize_ip=true, no ad signals, no PII, no manual cookies.
 *
 * Usage:
 *   import * as analytics from '../lib/analytics'
 *   analytics.initAnalytics()           // call once at app boot (sets debug flag)
 *   analytics.trackPage('/company/AAPL')
 *   analytics.trackCompanyOpen('AAPL', 72, 'Technology')
 */

const IS_DEV = import.meta.env.DEV

let _initialised = false

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

/**
 * Called once at app boot (main.tsx).
 * gtag.js is already loaded from index.html — this just confirms the guard
 * and logs a confirmation in development.
 */
export function initAnalytics(): void {
  if (_initialised || typeof window === 'undefined') return
  _initialised = true
  _debug('init', { measurement_id: 'G-G2LSV3V5T9', gtag_present: typeof window.gtag === 'function' })
}

// ── Core primitives ───────────────────────────────────────────────────────────

/**
 * Low-level event dispatcher.
 * All higher-level helpers call this.
 * To add Mixpanel/PostHog/Amplitude: add the corresponding call here.
 */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  _debug(name, params)

  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return

  window.gtag('event', name, {
    ...params,
    app_version: __APP_VERSION__,
  })
}

/**
 * Send a page_view event. Call this from the route-change listener.
 */
export function trackPage(path: string, title?: string): void {
  _debug('page_view', { page_path: path, page_title: title ?? document.title })

  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return

  window.gtag('event', 'page_view', {
    page_path:     path,
    page_title:    title ?? document.title,
    page_location: window.location.href,
    app_version:   __APP_VERSION__,
  })
}

// ── Navigation & discovery ────────────────────────────────────────────────────

export function trackCompanySearch(symbol: string): void {
  trackEvent('company_search', { symbol: symbol.toUpperCase() })
}

export function trackCompanyOpen(symbol: string, score?: number, sector?: string): void {
  trackEvent('company_open', {
    symbol:      symbol.toUpperCase(),
    bukra_score: score,
    sector,
  })
}

export function trackRadarOpen(): void {
  trackEvent('radar_open')
}

export function trackMarketBrainOpen(patternCount?: number): void {
  trackEvent('market_brain_open', { pattern_count: patternCount })
}

export function trackIntelligenceOpen(): void {
  trackEvent('market_intelligence_open')
}

export function trackEventIntelligenceOpen(symbol: string, eventsCount?: number): void {
  trackEvent('event_intelligence_open', {
    symbol:       symbol.toUpperCase(),
    events_count: eventsCount,
  })
}

export function trackKnowledgeGraphOpen(nodeCount?: number, edgeCount?: number): void {
  trackEvent('knowledge_graph_open', {
    node_count: nodeCount,
    edge_count: edgeCount,
  })
}

export function trackResearchJournalOpen(): void {
  trackEvent('research_journal_open')
}

export function trackWorldModelOpen(): void {
  trackEvent('world_model_open')
}

export function trackPredictionCardOpen(): void {
  trackEvent('prediction_card_open')
}

// ── Scanner ───────────────────────────────────────────────────────────────────

export function trackScannerRun(): void {
  trackEvent('scanner_run', { timestamp: new Date().toISOString() })
}

export function trackScannerCompleted(
  companiesScanned: number,
  durationMs: number,
): void {
  trackEvent('scanner_completed', {
    companies_scanned: companiesScanned,
    scan_duration_ms:  durationMs,
  })
}

export function trackScannerFailed(reason?: string): void {
  trackEvent('scanner_failed', { reason })
}

// ── Company page interactions ─────────────────────────────────────────────────

export function trackWatchSignalsExpand(symbol: string, signalsCount?: number): void {
  trackEvent('watch_signals_expand', {
    symbol:            symbol.toUpperCase(),
    watch_signals_count: signalsCount,
  })
}

export function trackResearchNotesExpand(symbol: string): void {
  trackEvent('research_notes_expand', { symbol: symbol.toUpperCase() })
}

export function trackAIExplanationOpen(symbol: string): void {
  trackEvent('ai_explanation_open', { symbol: symbol.toUpperCase() })
}

// ── Error tracking ────────────────────────────────────────────────────────────

export function trackApiError(
  endpoint: string,
  statusCode?: number,
  symbol?: string,
): void {
  trackEvent('api_error', {
    endpoint,
    status_code: statusCode,
    symbol:      symbol?.toUpperCase(),
  })
}

export function trackScannerError(reason: string): void {
  trackEvent('scanner_error', { reason })
}

export function trackProviderTimeout(provider: string, symbol?: string): void {
  trackEvent('provider_timeout', {
    provider,
    symbol: symbol?.toUpperCase(),
  })
}

export function trackCompanyNotFound(symbol: string): void {
  trackEvent('company_not_found', { symbol: symbol.toUpperCase() })
}

export function trackBackendUnavailable(): void {
  trackEvent('backend_unavailable', { url: window.location.href })
}

// ── Performance ───────────────────────────────────────────────────────────────

/**
 * Report Web Vitals from the app entry point.
 * Pass directly to reportWebVitals() if you use that library,
 * or call this from onCLS/onFCP/onLCP callbacks.
 */
export function trackWebVital(
  name: 'FCP' | 'LCP' | 'CLS' | 'FID' | 'TTFB' | 'INP',
  value: number,
  rating: 'good' | 'needs-improvement' | 'poor',
): void {
  trackEvent('web_vital', { metric_name: name, metric_value: Math.round(value), rating })
}

export function trackRouteLoadTime(path: string, durationMs: number): void {
  trackEvent('route_load_time', { page_path: path, duration_ms: durationMs })
}

export function trackCompanyLoadTime(symbol: string, durationMs: number): void {
  trackEvent('company_load_time', {
    symbol:      symbol.toUpperCase(),
    duration_ms: durationMs,
  })
}

// ── Debug helper ──────────────────────────────────────────────────────────────

function _debug(name: string, params: Record<string, unknown>): void {
  if (!IS_DEV) return
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined),
  )
  console.log(
    `%c[analytics] %c${name}`,
    'color:#6366f1;font-weight:bold',
    'color:#a5b4fc',
    Object.keys(clean).length ? clean : '',
  )
}

// ── App version (injected at build time) ─────────────────────────────────────
// Add to vite.config.ts: define: { __APP_VERSION__: JSON.stringify(pkg.version) }
// Falls back gracefully if not defined.
declare const __APP_VERSION__: string | undefined
