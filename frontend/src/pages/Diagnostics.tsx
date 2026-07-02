import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { runDiagnostics } from '../api/client'
import type { DiagnosticResult } from '../api/client'

const STATUS_ICON  = { ok: '✓', warn: '⚠', error: '✗', checking: '…' }
const STATUS_COLOR = {
  ok:       'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
  warn:     'text-amber-400   border-amber-500/30   bg-amber-500/5',
  error:    'text-red-400     border-red-500/30     bg-red-500/5',
  checking: 'text-gray-500   border-gray-700        bg-gray-800/30',
}
const ICON_BG = {
  ok:       'bg-emerald-500/15 text-emerald-400',
  warn:     'bg-amber-500/15   text-amber-400',
  error:    'bg-red-500/15     text-red-400',
  checking: 'bg-gray-800       text-gray-600',
}

const CHECKS = [
  'Backend Health',
  'Supabase Auth',
  'Company Endpoint',
  'Search',
  'Scanner Cache',
  'Frontend Cache',
  'Auth Token to API',
]

export default function Diagnostics() {
  const [results, setResults] = useState<DiagnosticResult[]>(
    CHECKS.map(name => ({ name, status: 'checking' as const }))
  )
  const [running, setRunning] = useState(false)
  const [lastRun, setLastRun] = useState<Date | null>(null)

  async function run() {
    setRunning(true)
    setResults(CHECKS.map(name => ({ name, status: 'checking' })))
    try {
      const r = await runDiagnostics()
      setResults(r)
      setLastRun(new Date())
    } catch (e: any) {
      setResults(prev => prev.map(p => p.status === 'checking'
        ? { ...p, status: 'error', detail: e.message }
        : p
      ))
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => { run() }, [])

  const okCount    = results.filter(r => r.status === 'ok').length
  const warnCount  = results.filter(r => r.status === 'warn').length
  const errorCount = results.filter(r => r.status === 'error').length
  const allOk      = errorCount === 0 && !running

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir="ltr">
      {/* Nav */}
      <div className="border-b border-gray-900 px-4 py-3 flex items-center gap-4">
        <Link to="/" className="text-gray-500 hover:text-white text-sm transition">← Home</Link>
        <span className="text-gray-700 text-xs">System Diagnostics</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4 ${
            running ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
            allOk   ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            errorCount > 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            <span className={running ? 'animate-pulse' : ''}>{running ? '●' : allOk ? '●' : errorCount > 0 ? '●' : '●'}</span>
            {running ? 'Running checks…' : allOk ? 'All systems operational' : errorCount > 0 ? `${errorCount} error${errorCount > 1 ? 's' : ''} detected` : `${warnCount} warning${warnCount > 1 ? 's' : ''}`}
          </div>

          <h1 className="text-2xl font-black mb-1">Bukra Score · System Status</h1>
          <p className="text-gray-500 text-sm">
            {lastRun ? `Last checked: ${lastRun.toLocaleTimeString()}` : 'Running first check…'}
            {' · '}{okCount}/{results.length} checks passed
          </p>
        </div>

        {/* Results */}
        <div className="space-y-2 mb-8">
          {results.map(r => (
            <div key={r.name} className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${STATUS_COLOR[r.status]}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm ${ICON_BG[r.status]} ${r.status === 'checking' ? 'animate-pulse' : ''}`}>
                {STATUS_ICON[r.status]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold">{r.name}</p>
                  {r.ms != null && (
                    <span className="text-xs opacity-50 font-mono">{r.ms}ms</span>
                  )}
                </div>
                {r.detail && (
                  <p className="text-xs opacity-70 mt-0.5 leading-relaxed font-mono break-all">{r.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={run}
            disabled={running}
            className="bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 text-blue-300 text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
          >
            {running ? 'Running…' : 'Run Again'}
          </button>
          <button
            onClick={() => {
              try { localStorage.removeItem('bukra_page_cache') } catch {}
              run()
            }}
            disabled={running}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
          >
            Clear Cache + Recheck
          </button>
        </div>

        {/* Guidance */}
        {!running && (errorCount > 0 || warnCount > 0) && (
          <div className="mt-8 space-y-3">
            <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">Troubleshooting</p>
            {results.filter(r => r.status !== 'ok' && r.status !== 'checking').map(r => (
              <div key={r.name} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <p className="text-sm font-semibold text-gray-300 mb-1">{r.name}</p>
                {r.name === 'Backend Health' && (
                  <p className="text-gray-500 text-xs">Backend is unreachable. Check that your FastAPI server is running and VITE_API_URL is set correctly in Vercel environment variables.</p>
                )}
                {r.name === 'Supabase Auth' && (
                  <p className="text-gray-500 text-xs">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel → Project Settings → Environment Variables. Then redeploy.</p>
                )}
                {r.name === 'Auth Token to API' && (
                  <p className="text-gray-500 text-xs">No token means all API calls return guest-only data even when logged in. Log in first, then re-run. If still failing, check Supabase env vars.</p>
                )}
                {r.name === 'Company Endpoint' && r.detail?.includes('guest-only') && (
                  <p className="text-gray-500 text-xs">Backend is not verifying your JWT. Set SUPABASE_JWT_SECRET on your Render/Railway backend environment. Value found in Supabase → Project Settings → API → JWT Secret.</p>
                )}
                {r.name === 'Company Endpoint' && r.detail?.includes('score missing') && (
                  <p className="text-gray-500 text-xs">Score is missing for AAPL. This usually means the financial data provider (yfinance/yahooquery) failed to fetch data. Check backend logs.</p>
                )}
                {r.name === 'Scanner Cache' && (
                  <p className="text-gray-500 text-xs">No scanner data yet. Go to /scanner and click "Run Scan" to generate initial data. The scanner runs automatically every Monday.</p>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-gray-800 text-xs mt-10 text-center">
          /system-check · Bukra Capital internal diagnostics
        </p>
      </div>
    </div>
  )
}
