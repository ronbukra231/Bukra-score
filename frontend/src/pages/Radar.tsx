import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Radar, TrendingUp, TrendingDown, AlertTriangle, DollarSign, BarChart2, ShieldAlert, Star, Zap, Database, Clock } from 'lucide-react'
import { useLanguage } from '../i18n/index'
import LanguageToggle from '../components/LanguageToggle'
import { trackRadarOpen, trackApiError } from '../lib/analytics'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

async function getRadar() {
  const res = await fetch(`${BASE}/intelligence/radar`)
  if (!res.ok) throw new Error('שגיאה בטעינת נתוני הרדאר')
  return res.json()
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function scoreColor(score: number | null) {
  if (score == null) return 'text-gray-400'
  if (score >= 75) return 'text-emerald-400'
  if (score >= 55) return 'text-amber-400'
  return 'text-red-400'
}

// ── Severity badge ────────────────────────────────────────────────────────────

function SeverityBadge({ severity, t }: { severity: string; t: any }) {
  const configs: Record<string, string> = {
    High:   'bg-red-500/15 text-red-400 border-red-500/30',
    Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Low:    'bg-gray-700/50 text-gray-400 border-gray-600/50',
  }
  const labels: Record<string, string> = {
    High:   t.radar_severityHigh,
    Medium: t.radar_severityMedium,
    Low:    t.radar_severityLow,
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${configs[severity] ?? configs.Low}`}>
      {labels[severity] ?? severity}
    </span>
  )
}

// ── Trend badge ───────────────────────────────────────────────────────────────

function TrendBadge({ trend, t }: { trend: string | undefined; t: any }) {
  if (!trend) return null
  const configs: Record<string, string> = {
    Improving: 'text-emerald-400',
    Stable:    'text-gray-400',
    Weakening: 'text-red-400',
  }
  const labels: Record<string, string> = {
    Improving: t.intel_trendImproving,
    Stable:    t.intel_trendStable,
    Weakening: t.intel_trendWeakening,
  }
  return (
    <span className={`text-xs font-medium ${configs[trend] ?? 'text-gray-400'}`}>
      {labels[trend] ?? trend}
    </span>
  )
}

// ── Signal card ───────────────────────────────────────────────────────────────

function SignalCard({ item }: { item: any }) {
  return (
    <Link
      to={`/company/${item.symbol}`}
      className="block bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-black text-white text-sm font-mono bg-gray-800 rounded-lg px-2 py-0.5 flex-shrink-0 group-hover:bg-brand-600/20 transition">
            {item.symbol}
          </span>
          <span className="text-gray-400 text-xs truncate">{item.name}</span>
        </div>
        {item.severity && <SeverityBadge severity={item.severity} t={{radar_severityHigh:'High',radar_severityMedium:'Medium',radar_severityLow:'Low'}} />}
      </div>
      <p className="text-gray-300 text-xs leading-relaxed mb-3">{item.signal}</p>
      <div className="flex items-center gap-3 text-xs text-gray-600">
        {item.score != null && (
          <span className={`font-bold ${scoreColor(item.score)}`}>ציון {item.score}</span>
        )}
        {item.sector && <span className="truncate">{item.sector}</span>}
      </div>
    </Link>
  )
}

// ── Watchlist card ────────────────────────────────────────────────────────────

function WatchlistCard({ item, t }: { item: any; t: any }) {
  return (
    <Link
      to={`/company/${item.symbol}`}
      className="block bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-emerald-500/30 transition group"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-black text-white text-sm font-mono bg-gray-800 rounded-lg px-2 py-0.5 group-hover:bg-emerald-500/10 transition">
          {item.symbol}
        </span>
        <span className={`font-black text-lg ${scoreColor(item.score)}`}>{item.score}</span>
      </div>
      <p className="text-gray-400 text-xs mb-2 truncate">{item.name}</p>
      <div className="flex items-center gap-3 text-xs text-gray-600">
        <span>{t.radar_trend}: <TrendBadge trend={item.trend} t={t} /></span>
        <span>{t.radar_confidence}: <span className="text-gray-400">{item.confidence}</span></span>
      </div>
    </Link>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

interface SectionConfig {
  key: string
  label: string
  icon: React.ReactNode
  accentCls: string
}

function Section({ config, items, t, isWatchlist }: {
  config: SectionConfig
  items: any[]
  t: any
  isWatchlist?: boolean
}) {
  if (items.length === 0) return null
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <span className={`${config.accentCls}`}>{config.icon}</span>
        <h2 className="text-white font-bold text-base">{config.label}</h2>
        <span className="text-gray-600 text-xs bg-gray-800 rounded-full px-2 py-0.5">{items.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.slice(0, 9).map((item: any, i: number) =>
          isWatchlist
            ? <WatchlistCard key={i} item={item} t={t} />
            : <SignalCard key={i} item={item} />
        )}
      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RadarPage() {
  const { t } = useLanguage()
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    trackRadarOpen()
    getRadar()
      .then(d  => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false); trackApiError('/api/radar') })
  }, [])

  const isEmpty = data && data.total_companies_scanned === 0

  const sections: SectionConfig[] = [
    { key: 'high_quality_watchlist', label: t.radar_highQualityWatchlist, icon: <Star className="w-4 h-4" />,        accentCls: 'text-amber-400' },
    { key: 'quality_upgrades',       label: t.radar_qualityUpgrades,      icon: <TrendingUp className="w-4 h-4" />,  accentCls: 'text-emerald-400' },
    { key: 'price_opportunities',    label: t.radar_priceOpportunities,    icon: <Zap className="w-4 h-4" />,         accentCls: 'text-brand-400' },
    { key: 'revenue_momentum',       label: t.radar_revenueMomentum,       icon: <BarChart2 className="w-4 h-4" />,   accentCls: 'text-blue-400' },
    { key: 'margin_pressure',        label: t.radar_marginPressure,        icon: <DollarSign className="w-4 h-4" />,  accentCls: 'text-amber-400' },
    { key: 'debt_alerts',            label: t.radar_debtAlerts,            icon: <AlertTriangle className="w-4 h-4" />, accentCls: 'text-red-400' },
    { key: 'valuation_warnings',     label: t.radar_valuationWarnings,     icon: <ShieldAlert className="w-4 h-4" />, accentCls: 'text-orange-400' },
    { key: 'quality_downgrades',     label: t.radar_qualityDowngrades,     icon: <TrendingDown className="w-4 h-4" />, accentCls: 'text-red-400' },
    { key: 'data_warnings',          label: t.radar_dataWarnings,          icon: <Database className="w-4 h-4" />,    accentCls: 'text-gray-400' },
  ]

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Sticky nav */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" aria-label="חזרה לדף הבית" className="text-gray-400 hover:text-white transition flex-shrink-0">
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <Radar className="w-4 h-4 text-brand-400" />
            <span className="text-white font-bold text-sm">{t.radar_title}</span>
          </div>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">

        {/* Page header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-brand-400" />
            <h1 className="text-2xl font-black text-white">{t.radar_title}</h1>
            <span className="text-gray-600 text-lg font-light">—</span>
            <span className="text-gray-400 text-base">{t.radar_subtitle}</span>
          </div>
          <p className="text-gray-500 text-sm max-w-2xl leading-relaxed italic">
            "{t.radar_tagline}"
          </p>

          {/* Stats bar */}
          {data && !isEmpty && (
            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5" />
                <span>{t.radar_lastScan}: {fmtDate(data.last_scan)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Zap className="w-3.5 h-3.5 text-brand-400" />
                <span><strong className="text-gray-300">{data.total_signals}</strong> {t.radar_totalSignals}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <BarChart2 className="w-3.5 h-3.5" />
                <span><strong className="text-gray-300">{data.total_companies_scanned}</strong> {t.radar_companiesScanned}</span>
              </div>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 py-20 justify-center">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">טוען נתוני רדאר...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="py-20 text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && !loading && (
          <div className="py-24 text-center space-y-4">
            <Radar className="w-12 h-12 text-gray-700 mx-auto" />
            <h2 className="text-white font-bold text-xl">{t.radar_noData}</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">{t.radar_noDataSub}</p>
            <Link
              to="/scanner"
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition mt-4"
            >
              {t.radar_goToScanner}
            </Link>
          </div>
        )}

        {/* Signal sections */}
        {data && !isEmpty && !loading && (
          <div className="space-y-12">
            {sections.map(sec => (
              <Section
                key={sec.key}
                config={sec}
                items={data[sec.key] ?? []}
                t={t}
                isWatchlist={sec.key === 'high_quality_watchlist'}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
