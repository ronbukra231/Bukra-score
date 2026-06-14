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

/** Optimised single-request endpoint — returns info + financials + score + rules + AI explanation. Cached 24 h server-side. */
export async function getCompanyPage(symbol: string) {
  const res = await fetch(`${BASE}/company/${symbol}/page`)
  if (!res.ok) throw new Error('שגיאה בטעינת נתוני החברה')
  return res.json()
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
