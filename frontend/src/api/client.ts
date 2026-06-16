// In dev: Vite proxies /api → localhost:8000
// In production: set VITE_API_URL=https://your-backend.onrender.com/api
const BASE = import.meta.env.VITE_API_URL ?? '/api'

export async function searchCompanies(q: string) {
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('לא נמצאו תוצאות')
  return res.json()
}

export async function getCompanyFull(symbol: string) {
  const res = await fetch(`${BASE}/company/${symbol}/full`)
  if (!res.ok) throw new Error('שגיאה בטעינת נתוני החברה')
  return res.json()
}

// ── Company page localStorage cache (30-min TTL, stale-while-revalidate) ─────
const PAGE_CACHE_KEY = 'bukra_page_cache'
const PAGE_CACHE_TTL = 30 * 60 * 1000 // 30 minutes
// Tracks in-flight requests to avoid duplicate simultaneous fetches
const _inflight: Map<string, Promise<any>> = new Map()

function getPageCached(symbol: string): any | null {
  try {
    const raw = localStorage.getItem(PAGE_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    const entry = cache[symbol.toUpperCase()]
    if (!entry) return null
    if (Date.now() - entry.ts > PAGE_CACHE_TTL) return null
    return entry.data
  } catch { return null }
}

function setPageCached(symbol: string, data: any) {
  try {
    const raw = localStorage.getItem(PAGE_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : {}
    cache[symbol.toUpperCase()] = { ts: Date.now(), data }
    // Keep at most 20 entries
    const keys = Object.keys(cache)
    if (keys.length > 20) delete cache[keys[0]]
    localStorage.setItem(PAGE_CACHE_KEY, JSON.stringify(cache))
  } catch { /* quota exceeded — ignore */ }
}

/** Optimised single-request endpoint — returns info + financials + score + rules + AI explanation. Cached 24 h server-side. */
export async function getCompanyPage(symbol: string): Promise<any> {
  const sym = symbol.toUpperCase()

  // Deduplicate concurrent requests for the same symbol
  const existing = _inflight.get(sym)
  if (existing) return existing

  const fetchFresh = async (): Promise<any> => {
    const res = await fetch(`${BASE}/company/${sym}/page`)
    if (!res.ok) {
      const err: any = new Error(res.status === 404
        ? `לא מצאנו חברה עם הסימבול ${sym}. בדוק את האיות או נסה סימבול אחר.`
        : 'שגיאה בטעינת נתוני החברה. אנא נסה שוב.')
      err.status = res.status
      throw err
    }
    const data = await res.json()
    setPageCached(sym, data)
    return data
  }

  const promise = fetchFresh().finally(() => _inflight.delete(sym))
  _inflight.set(sym, promise)
  return promise
}

/**
 * Stale-while-revalidate: returns cached data instantly if available,
 * fires a background refresh, and calls onFresh when the new data arrives.
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

export async function getCompanyExplanation(symbol: string) {
  const res = await fetch(`${BASE}/company/${symbol}/explain`)
  if (!res.ok) throw new Error('שגיאה בטעינת הסבר AI')
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

/** Legacy — kept so any old callers still work. */
export async function getScanner(force = false) {
  const res = await fetch(`${BASE}/scanner/top${force ? '?force=true' : ''}`)
  if (!res.ok) throw new Error('שגיאה בטעינת תוצאות הסריקה')
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
