// In dev: Vite proxies /api → localhost:8000
// In production: set VITE_API_URL=https://your-backend.onrender.com/api
const BASE = import.meta.env.VITE_API_URL ?? '/api'

import { supabase } from '../lib/supabase'
import { getActiveLang } from '../i18n/index'

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {}
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

// ── Fetch with retry + timeout ────────────────────────────────────────────────
// Render free tier cold-starts in 30-60s. Per-attempt timeout must exceed that.
// Backoff must also be long enough for Render to wake before the next attempt.
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 1,
  timeoutMs = 45_000,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(tid)
      return res
    } catch (err: any) {
      clearTimeout(tid)
      const isLast = attempt === retries
      if (isLast) throw err
      // Long backoff so a cold-starting Render instance has time to wake up
      await new Promise(r => setTimeout(r, 8_000 * (attempt + 1)))
    }
  }
  throw new Error('Unexpected retry loop exit')
}

export async function searchCompanies(q: string) {
  const res = await fetchWithRetry(`${BASE}/search?q=${encodeURIComponent(q)}`, {}, 1, 10_000)
  if (!res.ok) throw new Error('לא נמצאו תוצאות')
  return res.json()
}

// ── Company page localStorage cache (30-min TTL, stale-while-revalidate) ─────
// Bump PAGE_CACHE_VERSION whenever the response schema changes — old entries
// will be evicted automatically on first load rather than causing silent data errors.
const PAGE_CACHE_VERSION = 'v4'
const PAGE_CACHE_KEY = `bukra_page_cache_${PAGE_CACHE_VERSION}`
const PAGE_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

// Evict caches from older versions on first run
;['bukra_page_cache', 'bukra_page_cache_v1', 'bukra_page_cache_v2', 'bukra_page_cache_v3'].forEach(k => {
  try { localStorage.removeItem(k) } catch {}
})
// Tracks in-flight requests to avoid duplicate simultaneous fetches
const _inflight: Map<string, Promise<any>> = new Map()

// Cache entries are keyed by symbol + language — Future Relevance content
// is generated server-side in the active UI language.
function pageCacheKey(symbol: string): string {
  return `${symbol.toUpperCase()}:${getActiveLang()}`
}

function getPageCached(symbol: string): any | null {
  try {
    const raw = localStorage.getItem(PAGE_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    const entry = cache[pageCacheKey(symbol)]
    if (!entry) return null
    if (Date.now() - entry.ts > PAGE_CACHE_TTL) return null
    // Never return a cached guest payload to a potentially logged-in session
    if (entry.data?.guest === true) return null
    return entry.data
  } catch { return null }
}

function setPageCached(symbol: string, data: any) {
  // Never cache guest-limited responses — a logged-in user would see stale guest data
  if (data?.guest === true) return
  try {
    const raw = localStorage.getItem(PAGE_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : {}
    cache[pageCacheKey(symbol)] = { ts: Date.now(), data }
    // Keep at most 20 entries
    const keys = Object.keys(cache)
    if (keys.length > 20) delete cache[keys[0]]
    localStorage.setItem(PAGE_CACHE_KEY, JSON.stringify(cache))
  } catch { /* quota exceeded — ignore */ }
}

/** Optimised single-request endpoint — returns info + financials + score + rules + AI explanation. */
export async function getCompanyPage(symbol: string): Promise<any> {
  const sym  = symbol.toUpperCase()
  const lang = getActiveLang()
  const inflightKey = `${sym}:${lang}`

  // Deduplicate concurrent requests for the same symbol + language
  const existing = _inflight.get(inflightKey)
  if (existing) return existing

  const fetchFresh = async (): Promise<any> => {
    const headers = await getAuthHeaders()
    let res: Response
    try {
      res = await fetchWithRetry(`${BASE}/company/${sym}/page?lang=${lang}`, { headers }, 1, 45_000)
    } catch (err: any) {
      const isColdStart = err?.name === 'AbortError' || err?.message?.includes('abort')
      const msg = isColdStart
        ? 'השרת מתעורר — אנא נסה שוב בעוד כמה שניות.'
        : 'בעיית חיבור. בדוק את החיבור לאינטרנט ונסה שוב.'
      const e: any = new Error(msg)
      e.retryable = true
      throw e
    }
    if (!res.ok) {
      const err: any = new Error(res.status === 404
        ? `לא מצאנו חברה עם הסימבול ${sym}. בדוק את האיות או נסה סימבול אחר.`
        : res.status === 503
        ? 'הנתונים אינם זמינים כרגע. אנא נסה שוב.'
        : 'שגיאה בטעינת נתוני החברה. אנא נסה שוב.')
      err.status = res.status
      throw err
    }
    // Guard against HTML responses (e.g. misconfigured proxy returning index.html)
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) {
      const e: any = new Error('תגובה לא תקינה מהשרת. אנא נסה שוב.')
      e.retryable = true
      throw e
    }
    const data = await res.json()
    setPageCached(sym, data)
    return data
  }

  const promise = fetchFresh().finally(() => _inflight.delete(inflightKey))
  _inflight.set(inflightKey, promise)
  return promise
}

/** Research Timeline — how the Future Relevance assessment evolved over time. */
export async function getFutureRelevanceTimeline(symbol: string) {
  const res = await fetchWithRetry(`${BASE}/company/${symbol.toUpperCase()}/future-relevance/timeline`, {}, 1, 15_000)
  if (!res.ok) throw new Error('שגיאה בטעינת ציר הזמן המחקרי')
  return res.json()
}

/**
 * Stale-while-revalidate: returns cached data instantly if available,
 * fires a background refresh, and calls onFresh when the new data arrives.
 * Guest payloads are never returned from cache — always re-fetched with auth.
 */
export function getCompanyPageSWR(
  symbol: string,
  onFresh: (data: any) => void
): any | null {
  const sym = symbol.toUpperCase()
  const cached = getPageCached(sym)

  // Fire background refresh regardless
  getCompanyPage(sym)
    .then(fresh => {
      if (!cached || JSON.stringify(fresh) !== JSON.stringify(cached)) {
        onFresh(fresh)
      }
    })
    .catch(() => { /* background refresh failure — cached data still shown */ })

  return cached // null means no cache, caller should show full loading state
}

// ── The Research Estate (read-only rooms) ─────────────────────────────────────

/** Portfolio Office — read-only cockpit. Bukra never places trades. */
export async function getEstatePortfolio() {
  const res = await fetchWithRetry(`${BASE}/estate/portfolio`, {}, 1, 15_000)
  if (!res.ok) throw new Error('שגיאה בטעינת משרד התיק')
  return res.json()
}

/** World Intelligence Center — living world model + global event memory. */
export async function getEstateWorld() {
  const res = await fetchWithRetry(`${BASE}/estate/world`, {}, 1, 15_000)
  if (!res.ok) throw new Error('שגיאה בטעינת מרכז המודיעין')
  return res.json()
}

/** The Library — every company ever researched. */
export async function getEstateLibrary() {
  const res = await fetchWithRetry(`${BASE}/estate/library`, {}, 1, 15_000)
  if (!res.ok) throw new Error('שגיאה בטעינת הספרייה')
  return res.json()
}

/** The Strategy Room — causal graph, learning loop, calibration. */
export async function getEstateBrain() {
  const res = await fetchWithRetry(`${BASE}/estate/brain`, {}, 1, 15_000)
  if (!res.ok) throw new Error('שגיאה בטעינת חדר האסטרטגיה')
  return res.json()
}

// ── Scanner (new cache-first API) ─────────────────────────────────────────────

/** Returns cached results from disk instantly. Never triggers a scan. */
export async function getScannerLatest() {
  const res = await fetch(`${BASE}/scanner/latest`)
  if (!res.ok) throw new Error('שגיאה בטעינת תוצאות הסריקה')
  return res.json()
}

/** Starts a background scan and returns immediately. */
export async function postScannerRefresh() {
  const res = await fetch(`${BASE}/scanner/refresh`, { method: 'POST' })
  if (!res.ok) throw new Error('שגיאה בהפעלת הסריקה')
  return res.json()
}

/** Live scan progress — safe to poll every 2 s while running. */
export async function getScannerStatus() {
  const res = await fetch(`${BASE}/scanner/status`)
  if (!res.ok) throw new Error('שגיאה בקבלת סטטוס הסריקה')
  return res.json()
}

// ── Accuracy ──────────────────────────────────────────────────────────────────

export async function getAccuracySummary() {
  const res = await fetch(`${BASE}/accuracy/summary`)
  if (!res.ok) throw new Error('שגיאה בטעינת נתוני דיוק')
  return res.json()
}

export async function getAccuracyHistory(params?: {
  limit?: number
  offset?: number
  include_sample?: boolean
  status?: string
}) {
  const q = new URLSearchParams()
  if (params?.limit   != null)        q.set('limit',          String(params.limit))
  if (params?.offset  != null)        q.set('offset',         String(params.offset))
  if (params?.status)                 q.set('status',         params.status)
  if (params?.include_sample != null) q.set('include_sample', String(params.include_sample))
  const res = await fetch(`${BASE}/accuracy/history?${q}`)
  if (!res.ok) throw new Error('שגיאה בטעינת היסטוריית דיוק')
  return res.json()
}

export async function postRecalculate() {
  const res = await fetch(`${BASE}/accuracy/recalculate`, { method: 'POST' })
  if (!res.ok) throw new Error('שגיאה בעדכון תוצאות')
  return res.json()
}
