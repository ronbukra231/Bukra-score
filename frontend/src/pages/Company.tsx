import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowRight, ExternalLink, TrendingUp, Building2, Globe } from 'lucide-react'
import { getCompanyFull, getCompanyExplanation } from '../api/client'
import { useLanguage } from '../i18n/index'
import FinancialCharts from '../components/FinancialCharts'
import BukraScoreCard from '../components/BukraScoreCard'
import BukraRules from '../components/BukraRules'
import AIExplanation from '../components/AIExplanation'
import SearchBar from '../components/SearchBar'
import LanguageToggle from '../components/LanguageToggle'

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtMoney(val?: number | null) {
  if (val == null) return '—'
  const abs = Math.abs(val)
  if (abs >= 1e12) return `$${(val / 1e12).toFixed(2)}T`
  if (abs >= 1e9)  return `$${(val / 1e9).toFixed(2)}B`
  if (abs >= 1e6)  return `$${(val / 1e6).toFixed(0)}M`
  return `$${val.toLocaleString()}`
}

function fmtPrice(val?: number | null) {
  if (val == null) return '—'
  return `$${val.toFixed(2)}`
}

function fmtPct(val?: number | null, multiply = false) {
  if (val == null) return '—'
  const pct = multiply ? val * 100 : val
  return `${pct.toFixed(2)}%`
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div className="text-gray-400 text-xs mb-1">{label}</div>
      <div className="text-white font-bold text-lg leading-tight">{value}</div>
      {sub && <div className="text-gray-500 text-xs mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Tag chip ──────────────────────────────────────────────────────────────────
function Tag({ label }: { label: string }) {
  return (
    <span className="inline-block bg-gray-800 text-gray-300 text-xs rounded-lg px-2.5 py-1 border border-gray-700">
      {label}
    </span>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className }: { className: string }) {
  return <div className={`bg-gray-800 rounded animate-pulse ${className}`} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-16 w-28" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Company() {
  const { symbol } = useParams<{ symbol: string }>()
  const { t } = useLanguage()

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [explanation, setExplanation] = useState<any>(null)
  const [explainLoading, setExplainLoading] = useState(false)
  const [explainError, setExplainError] = useState('')

  useEffect(() => {
    if (!symbol) return
    const sym = symbol.toUpperCase()
    setLoading(true)
    setError('')
    setData(null)
    setExplanation(null)
    setExplainError('')

    getCompanyFull(sym)
      .then((d) => {
        setData(d)
        setExplainLoading(true)
        getCompanyExplanation(sym)
          .then(setExplanation)
          .catch((e) => setExplainError(e.message || 'שגיאה בטעינת הסבר AI'))
          .finally(() => setExplainLoading(false))
      })
      .catch((e) => setError(e.message || 'שגיאה בטעינת נתוני החברה'))
      .finally(() => setLoading(false))
  }, [symbol])

  const sym = symbol?.toUpperCase() ?? ''

  function retry() {
    setError('')
    setLoading(true)
    getCompanyFull(sym)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white transition flex-shrink-0">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex-1 max-w-md">
            <SearchBar />
          </div>
          <div className="text-gray-600 text-xs hidden md:block font-medium tracking-wide">
            {t.nav_appName}
          </div>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-400 text-sm">
                {t.co_loading} <span className="text-white font-mono font-bold">{sym}</span>
              </span>
            </div>
            <LoadingSkeleton />
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && !loading && (
          <div className="max-w-md mx-auto py-32 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-white text-xl font-bold mb-2">{t.co_errorTitle} {sym}</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={retry}
                className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl px-4 py-2 transition"
              >
                {t.co_retry}
              </button>
              <Link to="/" className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl px-4 py-2 transition">
                {t.co_back}
              </Link>
            </div>
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {data && !loading && (
          <div className="space-y-8">

            {/* Company header */}
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="bg-brand-600 text-white font-black text-base rounded-xl px-3 py-1 font-mono">
                    {sym}
                  </span>
                  {data.info.sector && <Tag label={data.info.sector} />}
                  {data.info.industry && data.info.industry !== data.info.sector && (
                    <Tag label={data.info.industry} />
                  )}
                  {data.info.country && data.info.country !== 'United States' && (
                    <Tag label={data.info.country} />
                  )}
                  {/* Accuracy system badge */}
                  <Link
                    to="/accuracy"
                    className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs rounded-full px-2.5 py-1 hover:bg-emerald-500/20 transition"
                  >
                    <TrendingUp className="w-3 h-3" />
                    {t.accuracy_title}
                  </Link>
                </div>

                <h1 className="text-2xl md:text-3xl font-black text-white mb-2 leading-tight">
                  {data.info.name}
                </h1>

                <div className="flex flex-wrap gap-4 text-sm">
                  {data.info.website && (
                    <a
                      href={data.info.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-brand-400 hover:text-brand-300 transition"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {data.info.website.replace(/https?:\/\//, '').replace(/\/$/, '')}
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  )}
                  {data.info.employees && (
                    <span className="inline-flex items-center gap-1.5 text-gray-500">
                      <Building2 className="w-3.5 h-3.5" />
                      {data.info.employees.toLocaleString()} {t.co_employees}
                    </span>
                  )}
                </div>
              </div>

              {data.info.price && (
                <div className="text-left md:text-right shrink-0">
                  <div className="text-3xl font-black text-white">{fmtPrice(data.info.price)}</div>
                  <div className="text-gray-400 text-sm">{data.info.currency || 'USD'} · {t.co_currentPrice}</div>
                  {data.info['52w_high'] && data.info['52w_low'] && (
                    <div className="text-gray-500 text-xs mt-1">
                      {t.co_weekRange} {fmtPrice(data.info['52w_low'])} – {fmtPrice(data.info['52w_high'])}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Key stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
              <Stat label={t.stat_marketCap}         value={fmtMoney(data.info.market_cap)} />
              <Stat label={t.stat_pe}                value={data.info.pe_ratio ? data.info.pe_ratio.toFixed(1) : '—'} />
              <Stat label={t.stat_high52}            value={fmtPrice(data.info['52w_high'])} />
              <Stat label={t.stat_low52}             value={fmtPrice(data.info['52w_low'])} />
              <Stat
                label={t.stat_dividend}
                value={data.info.dividend_yield ? fmtPct(data.info.dividend_yield, true) : '—'}
                sub={data.info.dividend_yield ? t.stat_annual : t.stat_noDividend}
              />
              <Stat label={t.stat_countryAndCurrency} value={`${data.info.country || '—'} / ${data.info.currency || 'USD'}`} />
            </div>

            {/* Main 2-column layout */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

              {/* Left column: Charts + About + AI */}
              <div className="xl:col-span-2 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-brand-400" />
                    <h2 className="text-white font-bold text-lg">{t.co_chartsTitle}</h2>
                    {data.financials?.source === 'mock' && (
                      <span className="text-amber-500 text-xs bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                        {t.co_mockBadge}
                      </span>
                    )}
                  </div>

                  {data.financials?.history?.length ? (
                    <FinancialCharts history={data.financials.history} />
                  ) : (
                    <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
                      <div className="text-3xl mb-3">📊</div>
                      <p className="text-gray-400 text-sm">
                        {t.co_noChartsTitle} {sym}
                      </p>
                      <p className="text-gray-600 text-xs mt-1">
                        {t.co_noChartsBody}
                      </p>
                    </div>
                  )}
                </div>

                {/* Company description (English always shown here) */}
                {data.info.description && (
                  <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                    <h3 className="text-white font-semibold text-sm mb-2">{t.co_about}</h3>
                    <p className="text-gray-400 text-sm leading-7 line-clamp-4">
                      {data.info.description}
                    </p>
                  </div>
                )}

                {/* AI Explanation */}
                <AIExplanation
                  explanation={explanation}
                  loading={explainLoading}
                  error={explainError}
                  englishDescription={data.info.description || ''}
                />
              </div>

              {/* Right column: Score + Rules */}
              <div className="space-y-6">
                <BukraScoreCard score={data.score} />
                <BukraRules history={data.financials?.history ?? []} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
