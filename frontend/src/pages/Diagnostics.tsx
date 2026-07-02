/**
 * /system-check — End-to-end auth + API diagnostics.
 *
 * Runs every check in the real browser session so nothing is simulated:
 * real Supabase session, real access token, real fetch to the live backend.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigured } from '../lib/supabase'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = 'ok' | 'warn' | 'error' | 'checking'

interface Check {
  id: string
  label: string
  status: Status
  value?: string   // what we actually observed
  detail?: string  // error message or extra context
  ms?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const S_ICON:  Record<Status, string> = { ok: '✓', warn: '⚠', error: '✗', checking: '…' }
const S_ROW:   Record<Status, string> = {
  ok:       'border-emerald-500/30 bg-emerald-500/5  text-emerald-300',
  warn:     'border-amber-500/30   bg-amber-500/5    text-amber-300',
  error:    'border-red-500/30     bg-red-500/5      text-red-300',
  checking: 'border-gray-700       bg-gray-800/30    text-gray-500',
}
const S_BADGE: Record<Status, string> = {
  ok:       'bg-emerald-500/20 text-emerald-400',
  warn:     'bg-amber-500/20   text-amber-400',
  error:    'bg-red-500/20     text-red-400',
  checking: 'bg-gray-800       text-gray-600',
}

const INIT: Check[] = [
  { id: 'session',      label: '1. Supabase session exists',          status: 'checking' },
  { id: 'token',        label: '2. Access token exists',              status: 'checking' },
  { id: 'api_url',      label: '3. VITE_API_URL value',               status: 'checking' },
  { id: 'request_url',  label: '4. Request URL that will be called',  status: 'checking' },
  { id: 'auth_header',  label: '5. Authorization header sent',        status: 'checking' },
  { id: 'health',       label: '6. Backend health / jwt_configured',  status: 'checking' },
  { id: 'guest_flag',   label: '7. Company API response: guest',      status: 'checking' },
  { id: 'has_score',    label: '8. Company API response: has score',  status: 'checking' },
  { id: 'has_fin',      label: '9. Company API response: financials', status: 'checking' },
  { id: 'render_ready', label: '10. Frontend can render this data',   status: 'checking' },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function Diagnostics() {
  const [checks, setChecks] = useState<Check[]>(INIT)
  const [running, setRunning] = useState(false)
  const [lastRun, setLastRun] = useState<Date | null>(null)

  function patch(id: string, update: Partial<Check>) {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, ...update } : c))
  }

  async function run() {
    setRunning(true)
    setChecks(INIT)

    // ── Check 1: Supabase session ──────────────────────────────────────────
    let accessToken: string | null = null
    try {
      if (!supabaseConfigured || !supabase) {
        patch('session', {
          status: 'error',
          value: 'no',
          detail: 'Supabase not configured (VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing)',
        })
      } else {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (data.session) {
          accessToken = data.session.access_token
          patch('session', {
            status: 'ok',
            value: 'yes',
            detail: `user: ${data.session.user.email}`,
          })
        } else {
          patch('session', {
            status: 'warn',
            value: 'no',
            detail: 'No active session — user is not signed in. Sign in first, then re-run.',
          })
        }
      }
    } catch (e: any) {
      patch('session', { status: 'error', value: 'error', detail: e.message })
    }

    // ── Check 2: Access token ──────────────────────────────────────────────
    if (accessToken) {
      // Show first 40 chars only — enough to confirm format
      patch('token', {
        status: 'ok',
        value: 'yes',
        detail: `${accessToken.slice(0, 40)}… (${accessToken.length} chars)`,
      })
    } else {
      patch('token', {
        status: checks[0].status === 'error' ? 'error' : 'warn',
        value: 'no',
        detail: 'No access token available. All API calls will be guest-only.',
      })
    }

    // ── Check 3: VITE_API_URL ──────────────────────────────────────────────
    const apiUrlEnv = import.meta.env.VITE_API_URL
    if (apiUrlEnv) {
      patch('api_url', {
        status: 'ok',
        value: apiUrlEnv,
        detail: 'Resolved from VITE_API_URL env var',
      })
    } else {
      patch('api_url', {
        status: 'warn',
        value: '/api (fallback)',
        detail: 'VITE_API_URL is not set — using relative /api. On Vercel this routes to index.html.',
      })
    }

    // ── Check 4: Request URL ───────────────────────────────────────────────
    const requestUrl = `${BASE}/company/AAPL/page`
    patch('request_url', {
      status: 'ok',
      value: requestUrl,
      detail: `BASE="${BASE}" + "/company/AAPL/page"`,
    })

    // ── Check 5: Authorization header ─────────────────────────────────────
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    }
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
      patch('auth_header', {
        status: 'ok',
        value: 'yes',
        detail: `Authorization: Bearer ${accessToken.slice(0, 30)}…`,
      })
    } else {
      patch('auth_header', {
        status: 'warn',
        value: 'no',
        detail: 'No token to send — request will be treated as guest by backend',
      })
    }

    // ── Check 6: Backend health ────────────────────────────────────────────
    const healthUrl = BASE.replace(/\/api$/, '') + '/health'
    try {
      const t0 = Date.now()
      const res = await fetch(healthUrl, { headers: { Accept: 'application/json' } })
      const ms = Date.now() - t0
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        patch('health', {
          status: 'error',
          value: `HTTP ${res.status} — not JSON`,
          detail: `content-type: ${ct}. VITE_API_URL is probably wrong — the URL returns HTML, not the backend.`,
          ms,
        })
      } else {
        const body = await res.json()
        const jwtOk = body.auth?.jwt_configured === true
        patch('health', {
          status: jwtOk ? 'ok' : 'error',
          value: `jwt_configured=${body.auth?.jwt_configured ?? 'missing'}`,
          detail: jwtOk
            ? `Backend alive. Provider: ${body.provider}`
            : 'SUPABASE_JWT_SECRET is not set on Render. Go to Render → your service → Environment → add SUPABASE_JWT_SECRET (from Supabase → Project Settings → API → JWT Secret).',
          ms,
        })
      }
    } catch (e: any) {
      patch('health', {
        status: 'error',
        value: 'unreachable',
        detail: `${e.message}. Check VITE_API_URL in Vercel env vars.`,
      })
    }

    // ── Checks 7–9: Company API call ───────────────────────────────────────
    let companyData: any = null
    try {
      const t0 = Date.now()
      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), 45_000)
      const res = await fetch(requestUrl, { headers, signal: controller.signal })
      clearTimeout(tid)
      const ms = Date.now() - t0

      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        const text = await res.text()
        const detail = `content-type="${ct}" HTTP ${res.status}. Body starts with: ${text.slice(0, 80)}`
        patch('guest_flag', { status: 'error', value: 'N/A', detail })
        patch('has_score',  { status: 'error', value: 'N/A', detail: 'Response was not JSON' })
        patch('has_fin',    { status: 'error', value: 'N/A', detail: 'Response was not JSON' })
      } else if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const detail = `HTTP ${res.status}: ${body.detail ?? JSON.stringify(body)}`
        patch('guest_flag', { status: 'error', value: `HTTP ${res.status}`, detail, ms })
        patch('has_score',  { status: 'error', value: 'N/A', detail })
        patch('has_fin',    { status: 'error', value: 'N/A', detail })
      } else {
        companyData = await res.json()

        // Check 7: guest flag
        const isGuest = companyData.guest === true
        if (!isGuest) {
          patch('guest_flag', { status: 'ok', value: 'false', detail: `Authenticated response received (${ms}ms)`, ms })
        } else if (!accessToken) {
          patch('guest_flag', { status: 'warn', value: 'true', detail: 'Expected — no access token was sent. Sign in to get full data.', ms })
        } else {
          patch('guest_flag', {
            status: 'error',
            value: 'true',
            detail: 'Token was sent but backend still returned guest. SUPABASE_JWT_SECRET on Render does not match your Supabase project JWT secret.',
            ms,
          })
        }

        // Check 8: score
        const score = companyData.score?.score
        if (score != null) {
          patch('has_score', { status: 'ok', value: 'yes', detail: `score.score = ${score}` })
        } else if (isGuest) {
          patch('has_score', { status: 'warn', value: 'no', detail: 'Score stripped from guest response — expected.' })
        } else {
          patch('has_score', { status: 'error', value: 'no', detail: 'Authenticated but score is missing. Backend may have failed to compute it.' })
        }

        // Check 9: financials
        const rows = companyData.financials?.history?.length ?? 0
        if (rows > 0) {
          patch('has_fin', { status: 'ok', value: 'yes', detail: `${rows} years of financial history` })
        } else if (isGuest) {
          patch('has_fin', { status: 'warn', value: 'no', detail: 'Financials stripped from guest response — expected.' })
        } else {
          patch('has_fin', {
            status: 'warn',
            value: 'no (0 rows)',
            detail: 'Authenticated but financials are empty. yfinance/yahooquery may have failed to fetch data for AAPL.',
          })
        }
      }
    } catch (e: any) {
      const isColdStart = e?.name === 'AbortError'
      const detail = isColdStart
        ? 'Request timed out (45s). Render backend may be cold-starting. Wait 30s and re-run.'
        : `Fetch error: ${e.message}`
      patch('guest_flag', { status: 'error', value: 'N/A', detail })
      patch('has_score',  { status: 'error', value: 'N/A', detail })
      patch('has_fin',    { status: 'error', value: 'N/A', detail })
    }

    // ── Check 10: Frontend render readiness ────────────────────────────────
    if (companyData && companyData.info?.name) {
      const canRender = !companyData.guest || true // info is always present
      const hasFullData = !companyData.guest && companyData.score?.score != null
      patch('render_ready', {
        status: hasFullData ? 'ok' : companyData.guest ? 'warn' : 'error',
        value: hasFullData ? 'yes — full data' : companyData.guest ? 'partial — info only (guest)' : 'partial — score missing',
        detail: hasFullData
          ? `Company "${companyData.info.name}" with score=${companyData.score.score} ready to render.`
          : companyData.guest
          ? 'Only company info available. Score and financials require sign-in + SUPABASE_JWT_SECRET on backend.'
          : 'Company info present but score is missing despite authentication.',
      })
    } else if (companyData) {
      patch('render_ready', {
        status: 'error',
        value: 'no',
        detail: `Response has no info.name. Keys present: ${Object.keys(companyData).join(', ')}`,
      })
    } else {
      patch('render_ready', {
        status: 'error',
        value: 'no',
        detail: 'No response data — a previous check failed.',
      })
    }

    setLastRun(new Date())
    setRunning(false)
  }

  useEffect(() => { run() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const errCount  = checks.filter(c => c.status === 'error').length
  const warnCount = checks.filter(c => c.status === 'warn').length
  const okCount   = checks.filter(c => c.status === 'ok').length
  const allOk     = errCount === 0 && warnCount === 0 && !running

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir="ltr">
      <div className="border-b border-gray-900 px-4 py-3 flex items-center gap-4">
        <Link to="/" className="text-gray-500 hover:text-white text-sm transition">← Home</Link>
        <span className="text-gray-700 text-xs">/system-check</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Status badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4 border ${
          running       ? 'bg-blue-500/10   text-blue-400   border-blue-500/20' :
          allOk         ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
          errCount > 0  ? 'bg-red-500/10    text-red-400    border-red-500/20' :
                          'bg-amber-500/10  text-amber-400  border-amber-500/20'
        }`}>
          <span className={running ? 'animate-pulse' : ''}>●</span>
          {running
            ? 'Running live checks…'
            : allOk
            ? 'All systems OK'
            : errCount > 0
            ? `${errCount} error${errCount > 1 ? 's' : ''} — see details below`
            : `${warnCount} warning${warnCount > 1 ? 's' : ''}`}
        </div>

        <h1 className="text-xl font-black mb-1">Auth + API Diagnostics</h1>
        <p className="text-gray-500 text-sm mb-6">
          {lastRun ? `Last run: ${lastRun.toLocaleTimeString()}` : 'First run in progress…'}
          {' · '}{okCount}/{checks.length} passed
        </p>

        {/* Checks */}
        <div className="space-y-2 mb-6">
          {checks.map(c => (
            <div key={c.id} className={`flex items-start gap-3 p-4 rounded-xl border ${S_ROW[c.status]}`}>
              <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-bold ${S_BADGE[c.status]} ${c.status === 'checking' ? 'animate-pulse' : ''}`}>
                {S_ICON[c.status]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-white">{c.label}</span>
                  {c.value != null && (
                    <span className="font-mono text-xs opacity-80 break-all">{c.value}</span>
                  )}
                  {c.ms != null && (
                    <span className="text-xs opacity-40 font-mono">{c.ms}ms</span>
                  )}
                </div>
                {c.detail && (
                  <p className="text-xs opacity-60 mt-1 leading-relaxed break-all">{c.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={run}
            disabled={running}
            className="bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 text-blue-300 text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
          >
            {running ? 'Running…' : 'Run Again'}
          </button>
          <button
            onClick={() => {
              // Clear all versioned caches
              Object.keys(localStorage).filter(k => k.startsWith('bukra_')).forEach(k => {
                try { localStorage.removeItem(k) } catch {}
              })
              run()
            }}
            disabled={running}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
          >
            Clear Cache + Recheck
          </button>
        </div>

        {/* Troubleshooting guidance for errors */}
        {!running && errCount > 0 && (
          <div className="space-y-3">
            <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">Next steps</p>
            {checks.filter(c => c.status === 'error').map(c => (
              <div key={c.id} className="bg-red-950/30 border border-red-800/40 rounded-xl p-4">
                <p className="text-red-300 font-semibold text-sm mb-1">{c.label}</p>
                <p className="text-red-400/70 text-xs leading-relaxed">{c.detail}</p>
              </div>
            ))}
          </div>
        )}

        <p className="text-gray-800 text-xs mt-10 text-center">
          bukra-score.vercel.app · /system-check · all checks run in your real browser session
        </p>
      </div>
    </div>
  )
}
