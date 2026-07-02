// In dev: Vite proxies /api → localhost:8000
// In production: set VITE_API_URL=https://your-backend.onrender.com/api
const BASE = import.meta.env.VITE_API_URL ?? '/api'

// ── Auth token helper ─────────────────────────────────────────────────────────
// Imported lazily to avoid circular deps (supabase.ts → client.ts would be circular)
async function getAuthHeaders(): Promise<HeadersInit> {
  try {
    // Dynamic import so this module stays importable even when Supabase isn't configured
    const { supabase } = await import('./supabase_ref')
    if (!supabase) return {}
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` }
    }
  } catch {}
  return {}
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

// ── Search ────────────────────────────────────────────────────────────────────
export async function searchCompanies(q: string) {
  const res = await fetchWithRetry(`${BASE}/search?q=${encodeURIComponent(q)}`, {}, 1, 10_000)
  if (!res.ok) throw new Error('לא נמצאו תוצאות')
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
    // Never return a guest-only cached response — it lacks score/financials
    if (entry.data?.guest === true) return null
    return entry.data
  } catch { return null }
}

function setPageCached(symbol: string, data: any) {
  // Don't cache guest-only responses — they have no score/financials
  if (data?.guest === true) return
  try {
    const raw = localStorage.getItem(PAGE_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : {}
    cache[symbol.toUpperCase()] = { ts: Date.now(), data }
    // Keep at most 20 entries (evict oldest)
    const keys = Object.keys(cache)
    if (keys.length > 20) {
      const oldest = keys.reduce((a, b) => cache[a].ts < cache[b].ts ? a : b)
      delete cache[oldest]
    }
    localStorage.setItem(PAGE_CACHE_KEY, JSON.stringify(cache))
  } catch { /* quota exceeded — ignore */ }
}

/** Clear the cached entry for a symbol (e.g. on auth change). */
export function invalidateCompanyCache(symbol?: string) {
  try {
    if (!symbol) {
      localStorage.removeItem(PAGE_CACHE_KEY)
      return
    }
    const raw = localStorage.getItem(PAGE_CACHE_KEY)
    if (!raw) return
    const cache = JSON.parse(raw)
    delete cache[symbol.toUpperCase()]
    localStorage.setItem(PAGE_CACHE_KEY, JSON.stringify(cache))
  } catch {}
}

/**
 * Single optimised endpoint — info + financials + score + rules + AI.
 * Cached 24 h server-side. Always sends Supabase JWT when available.
 */
export async function getCompanyPage(symbol: string): Promise<any> {
  const sym = symbol.toUpperCase()

  // Deduplicate concurrent requests for the same symbol
  const existing = _inflight.get(sym)
  if (existing) return existing

  const fetchFresh = async (): Promise<any> => {
    const headers = await getAuthHeaders()
    let res: Response
    try {
      res = await fetchWithRetry(`${BASE}/company/${sym}/page`, { headers }, 1, 45_000)
    } catch (err: any) {
      // AbortError = timeout; likely Render cold start
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
    const data = await res.json()
    setPageCached(sym, data)
    return data
  }

  const promise = fetchFresh().finally(() => _inflight.delete(sym))
  _inflight.set(sym, promise)
  return promise
}

/**
 * Stale-while-revalidate: returns AUTHENTICATED cached data instantly,
 * fires a background refresh with auth, calls onFresh when new data arrives.
 * Guest-only cached responses are never returned — they force a full reload.
 */
export function getCompanyPageSWR(
  symbol: string,
  onFresh: (data: any) => void,
): any | null {
  const sym = symbol.toUpperCase()
  const cached = getPageCached(sym) // already filters guest responses

  // Fire background refresh (with auth headers)
  getCompanyPage(sym)
    .then(fresh => {
      // Always deliver fresh data to the component — let it decide if re-render is needed
      if (fresh && fresh.info?.name) {
        onFresh(fresh)
      }
    })
    .catch(() => { /* background refresh failure — cached data still shown */ })

  return cached // null means no usable cache; caller shows full loading state
}

// ── Scanner ───────────────────────────────────────────────────────────────────

export async function getScannerLatest() {
  const res = await fetchWithRetry(`${BASE}/scanner/latest`, {}, 1, 15_000)
  if (!res.ok) throw new Error('שגיאה בטעינת תוצאות הסריקה')
  return res.json()
}

export async function postScannerRefresh() {
  const res = await fetch(`${BASE}/scanner/refresh`, { method: 'POST' })
  if (!res.ok) throw new Error('שגיאה בהפעלת הסריקה')
  return res.json()
}

export async function getScannerStatus() {
  const res = await fetchWithRetry(`${BASE}/scanner/status`, {}, 1, 10_000)
  if (!res.ok) throw new Error('שגיאה בקבלת סטטוס הסריקה')
  return res.json()
}

// ── Accuracy ──────────────────────────────────────────────────────────────────

export async function getAccuracySummary() {
  const res = await fetchWithRetry(`${BASE}/accuracy/summary`, {}, 1, 10_000)
  if (!res.ok) throw new Error('שגיאה בטעינת נתוני דיוק')
  return res.json()
}

export async function getAccuracyHistory(params?: {
  limit?: number; offset?: number; include_sample?: boolean; status?: string
}) {
  const q = new URLSearchParams()
  if (params?.limit   != null)        q.set('limit',          String(params.limit))
  if (params?.offset  != null)        q.set('offset',         String(params.offset))
  if (params?.status)                 q.set('status',         params.status)
  if (params?.include_sample != null) q.set('include_sample', String(params.include_sample))
  const res = await fetchWithRetry(`${BASE}/accuracy/history?${q}`, {}, 1, 10_000)
  if (!res.ok) throw new Error('שגיאה בטעינת היסטוריית דיוק')
  return res.json()
}

export async function postRecalculate() {
  const res = await fetch(`${BASE}/accuracy/recalculate`, { method: 'POST' })
  if (!res.ok) throw new Error('שגיאה בעדכון תוצאות')
  return res.json()
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export interface DiagnosticResult {
  name: string
  status: 'ok' | 'warn' | 'error' | 'checking'
  detail?: string
  ms?: number
}

export async function runDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []

  // 1. Backend health
  try {
    const t0 = Date.now()
    const res = await fetchWithRetry(`${BASE.replace('/api', '')}/health`, {}, 0, 8_000)
    const ms = Date.now() - t0
    if (res.ok) {
      const body = await res.json()
      const jwtOk = body.auth?.jwt_configured === true
      results.push({
        name: 'Backend Health',
        status: jwtOk ? 'ok' : 'warn',
        detail: jwtOk
          ? `ok — JWT auth enabled`
          : `ok — but SUPABASE_JWT_SECRET missing: all users get guest-only data (no score/financials)`,
        ms,
      })
    } else {
      results.push({ name: 'Backend Health', status: 'error', detail: `HTTP ${res.status}`, ms })
    }
  } catch (e: any) {
    results.push({ name: 'Backend Health', status: 'error', detail: e.message })
  }

  // 2. Auth state (Supabase)
  try {
    const { supabase, supabaseConfigured } = await import('./supabase_ref')
    if (!supabaseConfigured) {
      results.push({ name: 'Supabase Auth', status: 'warn', detail: 'Env vars missing — auth disabled' })
    } else if (!supabase) {
      results.push({ name: 'Supabase Auth', status: 'error', detail: 'Client failed to initialize' })
    } else {
      const t0 = Date.now()
      const { data: { session } } = await supabase.auth.getSession()
      results.push({
        name: 'Supabase Auth',
        status: 'ok',
        detail: session ? `Logged in as ${session.user.email}` : 'Not logged in (guest)',
        ms: Date.now() - t0,
      })
    }
  } catch (e: any) {
    results.push({ name: 'Supabase Auth', status: 'error', detail: e.message })
  }

  // 3. Company endpoint (AAPL — always available)
  try {
    const t0 = Date.now()
    const headers = await getAuthHeaders()
    const res = await fetchWithRetry(`${BASE}/company/AAPL/page`, { headers }, 0, 20_000)
    const ms = Date.now() - t0
    if (res.ok) {
      const body = await res.json()
      const hasScore = body.score?.score != null
      const hasFinancials = Array.isArray(body.financials?.history) && body.financials.history.length > 0
      const isGuest = body.guest === true
      if (isGuest) {
        results.push({ name: 'Company Endpoint', status: 'warn', detail: `AAPL returned guest-only (no auth token or JWT secret missing)`, ms })
      } else if (!hasScore) {
        results.push({ name: 'Company Endpoint', status: 'warn', detail: `AAPL: score missing (financials: ${hasFinancials})`, ms })
      } else {
        results.push({ name: 'Company Endpoint', status: 'ok', detail: `AAPL score=${body.score.score}, financials=${hasFinancials ? 'ok' : 'empty'}, cached=${body.from_cache}`, ms })
      }
    } else {
      results.push({ name: 'Company Endpoint', status: 'error', detail: `HTTP ${res.status}`, ms })
    }
  } catch (e: any) {
    results.push({ name: 'Company Endpoint', status: 'error', detail: e.message })
  }

  // 4. Search
  try {
    const t0 = Date.now()
    const res = await fetchWithRetry(`${BASE}/search?q=Apple`, {}, 0, 8_000)
    const ms = Date.now() - t0
    if (res.ok) {
      const body = await res.json()
      results.push({ name: 'Search', status: 'ok', detail: `${Array.isArray(body) ? body.length : 0} results`, ms })
    } else {
      results.push({ name: 'Search', status: 'error', detail: `HTTP ${res.status}`, ms })
    }
  } catch (e: any) {
    results.push({ name: 'Search', status: 'error', detail: e.message })
  }

  // 5. Scanner cache
  try {
    const t0 = Date.now()
    const res = await fetchWithRetry(`${BASE}/scanner/latest`, {}, 0, 8_000)
    const ms = Date.now() - t0
    if (res.ok) {
      const body = await res.json()
      results.push({ name: 'Scanner Cache', status: body.has_cache ? 'ok' : 'warn',
        detail: body.has_cache ? `${body.results?.length ?? 0} companies, last: ${body.last_updated ?? 'unknown'}` : 'No scan data yet', ms })
    } else {
      results.push({ name: 'Scanner Cache', status: 'error', detail: `HTTP ${res.status}`, ms })
    }
  } catch (e: any) {
    results.push({ name: 'Scanner Cache', status: 'error', detail: e.message })
  }

  // 6. Frontend cache
  try {
    const raw = localStorage.getItem(PAGE_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : {}
    const keys = Object.keys(cache)
    results.push({ name: 'Frontend Cache', status: 'ok', detail: `${keys.length} symbols cached (localStorage)` })
  } catch (e: any) {
    results.push({ name: 'Frontend Cache', status: 'warn', detail: `localStorage error: ${e.message}` })
  }

  // 7. Auth token delivery
  try {
    const headers = await getAuthHeaders() as Record<string, string>
    const hasToken = !!headers['Authorization']
    results.push({ name: 'Auth Token to API', status: hasToken ? 'ok' : 'warn',
      detail: hasToken ? 'Bearer token present — backend will authenticate you' : 'No token — API calls will be guest-only' })
  } catch (e: any) {
    results.push({ name: 'Auth Token to API', status: 'error', detail: e.message })
  }

  return results
}
