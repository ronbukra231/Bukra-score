import { useEffect, useState, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, RefreshCw, Filter, Clock, Database } from 'lucide-react'
import { getScannerLatest, postScannerRefresh, getScannerStatus } from '../api/client'
import { useLanguage } from '../i18n/index'
import SearchBar from '../components/SearchBar'
import LanguageToggle from '../components/LanguageToggle'
import PredictionAccuracyCard from '../components/PredictionAccuracyCard'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScanResult {
  ticker: string
  company_name: string
  sector: string
  industry: string
  price: number | null
  market_cap: number | null
  pe_ratio: number | null
  dividend_yield: number | null
  bukra_score: number
  rules_passed: number
  rules_available: number
  investment_status: string
  main_strength_key: string | null
  strength_detail: string
}

interface CacheData {
  has_cache: boolean
  results: ScanResult[]
  last_updated: string | null
  universe_size: number
  scanned_count: number
  failed_tickers: string[]
  scan_duration_seconds: number | null
}

interface ScanStatus {
  status: 'idle' | 'running' | 'completed' | 'failed'
  progress: number
  total: number
  started_at: string | null
  last_updated: string | null
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtCap(v: number | null) {
  if (v == null) return '—'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(0)}B`
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

function fmtPE(v: number | null) {
  if (v == null) return '—'
  return v.toFixed(1)
}

function fmtDateTime(iso: string | null, lang: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '' }
}

// ── Score colours ─────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 90) return 'text-emerald-400'
  if (s >= 80) return 'text-blue-400'
  if (s >= 70) return 'text-amber-400'
  return 'text-gray-400'
}

function scoreBg(s: number) {
  if (s >= 90) return 'bg-emerald-500/10 border-emerald-500/30'
  if (s >= 80) return 'bg-blue-500/10 border-blue-500/30'
  if (s >= 70) return 'bg-amber-500/10 border-amber-500/30'
  return 'bg-gray-800 border-gray-700'
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { color: string; bg: string; key: string }> = {
  strong_candidate: { color: 'text-green-400', bg: 'bg-green-500/10 border border-green-500/25',  key: 'rules_verdictStrong'    },
  watchlist:        { color: 'text-blue-400',  bg: 'bg-blue-500/10 border border-blue-500/25',   key: 'rules_verdictWatchlist' },
  mixed:            { color: 'text-amber-400', bg: 'bg-amber-500/10 border border-amber-500/25', key: 'rules_verdictMixed'     },
  avoid:            { color: 'text-red-400',   bg: 'bg-red-500/10 border border-red-500/25',     key: 'rules_verdictAvoid'     },
  no_data:          { color: 'text-gray-500',  bg: 'bg-gray-800 border border-gray-700',          key: 'rules_verdictNoData'    },
}

function StatusBadge({ status, t }: { status: string; t: any }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.no_data
  return (
    <span className={`text-xs font-medium rounded-full px-2 py-0.5 whitespace-nowrap ${cfg.color} ${cfg.bg}`}>
      {t[cfg.key]}
    </span>
  )
}

// ── Rank badge ────────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="w-8 text-center text-sm font-black text-yellow-400">🥇</span>
  if (rank === 2) return <span className="w-8 text-center text-sm font-black text-gray-300">🥈</span>
  if (rank === 3) return <span className="w-8 text-center text-sm font-black text-amber-600">🥉</span>
  return <span className="w-8 text-center text-sm font-mono text-gray-500">{rank}</span>
}

// ── Strength labels ───────────────────────────────────────────────────────────

const STRENGTH_KEY_MAP: Record<string, { he: string; en: string }> = {
  growth:        { he: 'צמיחה',   en: 'Growth'        },
  profitability: { he: 'רווחיות', en: 'Profitability'  },
  cash_flow:     { he: 'תזרים',   en: 'Cash Flow'      },
  stability:     { he: 'יציבות',  en: 'Stability'      },
  debt:          { he: 'חוב',     en: 'Debt'           },
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ progress, total, thin = false }: { progress: number; total: number; thin?: boolean }) {
  const pct = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0
  return (
    <div className={`w-full bg-gray-800 rounded-full ${thin ? 'h-1' : 'h-1.5'}`}>
      <div
        className="bg-brand-500 rounded-full transition-all duration-300 h-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Scanner() {
  const { t, lang, isHe } = useLanguage()
  const navigate = useNavigate()

  // Cache state — displayed data
  const [cache,   setCache]   = useState<CacheData | null>(null)
  const [loading, setLoading] = useState(true)

  // Refresh state — background scan progress
  const [scanStatus,   setScanStatus]   = useState<ScanStatus | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Filters
  const [showFilters,   setShowFilters]   = useState(false)
  const [sectorFilter,  setSectorFilter]  = useState('all')
  const [minScore,      setMinScore]      = useState(0)
  const [onlyFiveStars, setOnlyFiveStars] = useState(false)

  // ── Load cached results on mount (instant, no scan) ──────────────────────
  useEffect(() => {
    getScannerLatest()
      .then(setCache)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // ── Polling helper ────────────────────────────────────────────────────────
  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const st: ScanStatus = await getScannerStatus()
        setScanStatus(st)

        if (st.status === 'completed' || st.status === 'failed' || st.status === 'idle') {
          stopPolling()
          // Reload cache from disk
          const fresh = await getScannerLatest()
          setCache(fresh)
          setIsRefreshing(false)
        }
      } catch { /* keep polling */ }
    }, 2000)
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  useEffect(() => () => stopPolling(), [])

  // ── Refresh button ────────────────────────────────────────────────────────
  async function handleRefresh() {
    if (isRefreshing) return
    setIsRefreshing(true)
    setScanStatus(null)
    try {
      const res = await postScannerRefresh()
      if (res.status === 'already_running') {
        // Already running — just poll for progress
        startPolling()
        return
      }
      // started — poll for progress
      startPolling()
    } catch (e) {
      console.error('[scanner] refresh error:', e)
      setIsRefreshing(false)
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const allSectors = useMemo(() => {
    if (!cache?.results?.length) return []
    const s = new Set(cache.results.map(r => r.sector).filter(Boolean))
    return [...s].sort()
  }, [cache])

  const displayed = useMemo(() => {
    if (!cache?.results?.length) return []
    return cache.results
      .filter(r => sectorFilter === 'all' || r.sector === sectorFilter)
      .filter(r => r.bukra_score >= minScore)
      .filter(r => !onlyFiveStars || (r.rules_passed === r.rules_available && r.rules_available >= 4))
      .slice(0, 30)
      .map((r, i) => ({ ...r, rank: i + 1 }))
  }, [cache, sectorFilter, minScore, onlyFiveStars])

  const hasResults = (cache?.results?.length ?? 0) > 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950">

      {/* ── Sticky nav ── */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white transition flex-shrink-0">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex-1 max-w-md"><SearchBar /></div>
          <Link to="/radar" className="text-brand-400 hover:text-brand-300 text-xs font-semibold hidden md:block transition">
            {t.radar_navLabel} ⬡
          </Link>
          <Link to="/journal" className="text-purple-400 hover:text-purple-300 text-xs font-semibold hidden md:block transition">
            {t.journal_navLabel} ⬡
          </Link>
          <Link to="/memory" className="text-violet-400 hover:text-violet-300 text-xs font-semibold hidden md:block transition">
            {t.memory_navLabel} 🧠
          </Link>
          <Link to="/questions" className="text-blue-400 hover:text-blue-300 text-xs font-semibold hidden md:block transition">
            {t.questions_navLabel}
          </Link>
          <Link to="/beliefs" className="text-orange-400 hover:text-orange-300 text-xs font-semibold hidden md:block transition">
            {t.beliefs_navLabel}
          </Link>
          <Link to="/graph" className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold hidden md:block transition">
            {t.graph_navLabel}
          </Link>
          <LanguageToggle />
        </div>
        {/* Thin refresh progress strip at very top */}
        {isRefreshing && (
          <ProgressBar
            progress={scanStatus?.progress ?? 0}
            total={scanStatus?.total ?? 1}
            thin
          />
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white mb-2">{t.scanner_title}</h1>
              <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">{t.scanner_subtitle}</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 text-sm font-medium rounded-xl px-4 py-2.5 transition flex-shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {t.scanner_refresh}
            </button>
          </div>

          {/* ── Metadata row ── */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
            {cache?.last_updated && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {t.scanner_lastUpdated}: {fmtDateTime(cache.last_updated, lang)}
              </span>
            )}
            {cache?.has_cache && (
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                {cache.scanned_count} {isHe ? 'חברות נסרקו' : 'companies scanned'}
                {cache.universe_size > 0 && ` / ${cache.universe_size}`}
              </span>
            )}
            {(cache?.failed_tickers?.length ?? 0) > 0 && (
              <span className="text-gray-600">
                · {cache!.failed_tickers.length} {t.scanner_failedNote}
              </span>
            )}
            {cache?.scan_duration_seconds != null && (
              <span className="text-gray-700">
                {t.scanner_duration}: {cache.scan_duration_seconds}s
              </span>
            )}
          </div>

          {/* ── Refresh progress (shown while scan runs, old results stay visible) ── */}
          {isRefreshing && (
            <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  {t.scanner_refreshing}
                  {scanStatus && scanStatus.total > 0 && (
                    <span className="text-gray-500">
                      — {scanStatus.progress} / {scanStatus.total} {isHe ? 'חברות' : 'companies'}
                    </span>
                  )}
                </span>
                <span className="text-gray-600">
                  {hasResults ? (isHe ? 'מציג תוצאות קודמות' : 'Showing previous results') : ''}
                </span>
              </div>
              <ProgressBar
                progress={scanStatus?.progress ?? 0}
                total={scanStatus?.total ?? 1}
              />
            </div>
          )}
        </div>

        {/* ── Empty state — no cache yet ── */}
        {!loading && !hasResults && (
          <div className="text-center py-24">
            <div className="text-5xl mb-5">📊</div>
            <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
              {t.scanner_noCache}
            </p>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold rounded-xl px-6 py-3 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {t.scanner_startRefresh}
            </button>
          </div>
        )}

        {/* ── Loading skeleton (only on very first page load before cache resolves) ── */}
        {loading && (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-gray-900 rounded-xl h-14 animate-pulse border border-gray-800" />
            ))}
          </div>
        )}

        {/* ── Filters (only when we have results) ── */}
        {hasResults && (
          <div className="mb-6">
            <button
              onClick={() => setShowFilters(f => !f)}
              className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition mb-3"
            >
              <Filter className="w-4 h-4" />
              {isHe ? 'סינון' : 'Filters'}
              {(sectorFilter !== 'all' || minScore > 0 || onlyFiveStars) && (
                <span className="bg-brand-600 text-white text-xs rounded-full px-1.5 py-0.5">✦</span>
              )}
            </button>

            {showFilters && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-wrap gap-4">
                {/* Sector */}
                <div className="flex flex-col gap-1 min-w-[140px]">
                  <label className="text-gray-400 text-xs">{t.scanner_filter_sector}</label>
                  <select
                    value={sectorFilter}
                    onChange={e => setSectorFilter(e.target.value)}
                    className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-brand-500"
                  >
                    <option value="all">{t.scanner_filter_all}</option>
                    {allSectors.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Min score */}
                <div className="flex flex-col gap-1 min-w-[140px]">
                  <label className="text-gray-400 text-xs">{t.scanner_filter_minScore}</label>
                  <select
                    value={minScore}
                    onChange={e => setMinScore(Number(e.target.value))}
                    className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-brand-500"
                  >
                    <option value={0}>{t.scanner_filter_anyScore}</option>
                    <option value={60}>60+</option>
                    <option value={70}>70+</option>
                    <option value={80}>80+</option>
                    <option value={90}>90+</option>
                  </select>
                </div>

                {/* 5/5 rules */}
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyFiveStars}
                      onChange={e => setOnlyFiveStars(e.target.checked)}
                      className="accent-brand-500 w-4 h-4"
                    />
                    <span className="text-gray-300 text-sm">{t.scanner_filter_fiveStars}</span>
                  </label>
                </div>

                {/* Reset */}
                {(sectorFilter !== 'all' || minScore > 0 || onlyFiveStars) && (
                  <div className="flex items-end pb-1">
                    <button
                      onClick={() => { setSectorFilter('all'); setMinScore(0); setOnlyFiveStars(false) }}
                      className="text-gray-500 hover:text-white text-xs transition"
                    >
                      {isHe ? 'איפוס סינון' : 'Reset filters'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Results table ── */}
        {hasResults && displayed.length > 0 && (
          <div className={`overflow-x-auto rounded-2xl border border-gray-800 transition-opacity duration-300 ${isRefreshing ? 'opacity-60' : 'opacity-100'}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 border-b border-gray-800">
                  <th className="px-4 py-3 text-gray-400 font-medium text-center w-12">{t.scanner_col_rank}</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-start">{t.scanner_col_ticker}</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-start hidden md:table-cell">{t.scanner_col_company}</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-start hidden lg:table-cell">{t.scanner_col_sector}</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">{t.scanner_col_score}</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">{t.scanner_col_rules}</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-start hidden sm:table-cell">{t.scanner_col_status}</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-end hidden xl:table-cell">{t.scanner_col_marketCap}</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-end hidden lg:table-cell">{t.scanner_col_pe}</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-start hidden 2xl:table-cell">{t.scanner_col_strength}</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((r, idx) => {
                  const isTop3 = r.rank <= 3
                  const strengthLabel = r.main_strength_key
                    ? (STRENGTH_KEY_MAP[r.main_strength_key]?.[lang === 'he' ? 'he' : 'en'] ?? r.main_strength_key)
                    : ''
                  return (
                    <tr
                      key={r.ticker}
                      onClick={() => navigate(`/company/${r.ticker}`)}
                      className={`
                        border-b border-gray-800/60 cursor-pointer transition hover:bg-gray-800/50
                        ${isTop3 ? 'bg-gray-900/60' : idx % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/20'}
                      `}
                    >
                      <td className="px-4 py-3.5 text-center">
                        <RankBadge rank={r.rank} />
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="bg-brand-600 text-white text-xs font-bold rounded-lg px-2 py-1 font-mono">
                          {r.ticker}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <div className="text-white font-medium truncate max-w-[180px]">{r.company_name}</div>
                        {r.industry && (
                          <div className="text-gray-500 text-xs truncate max-w-[180px]">{r.industry}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className="text-gray-400 text-xs">{r.sector}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl border font-black text-lg ${scoreBg(r.bukra_score)} ${scoreColor(r.bukra_score)}`}>
                          {r.bukra_score}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-sm font-bold ${r.rules_passed === r.rules_available && r.rules_available > 0 ? 'text-green-400' : 'text-gray-300'}`}>
                          {r.rules_passed}/{r.rules_available}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <StatusBadge status={r.investment_status} t={t} />
                      </td>
                      <td className="px-4 py-3.5 text-end hidden xl:table-cell">
                        <span className="text-gray-300 font-mono text-xs">{fmtCap(r.market_cap)}</span>
                      </td>
                      <td className="px-4 py-3.5 text-end hidden lg:table-cell">
                        <span className="text-gray-400 text-xs">{fmtPE(r.pe_ratio)}</span>
                      </td>
                      <td className="px-4 py-3.5 hidden 2xl:table-cell">
                        {strengthLabel && (
                          <span className="text-brand-400 text-xs font-medium">{strengthLabel}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Filtered but no match ── */}
        {hasResults && displayed.length === 0 && (
          <div className="text-center py-24 text-gray-500">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-sm">{t.scanner_noResults}</p>
          </div>
        )}

        {/* ── Accuracy card ── */}
        {hasResults && (
          <div className="mt-8 max-w-lg">
            <PredictionAccuracyCard compact />
          </div>
        )}

      </div>
    </div>
  )
}
