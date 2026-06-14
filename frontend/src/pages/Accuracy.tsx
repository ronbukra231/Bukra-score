import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, RefreshCw, TrendingUp, TrendingDown,
  Clock, Info, CheckCircle, XCircle, Zap, Target, BarChart3, Shield,
} from 'lucide-react'
import { getAccuracySummary, getAccuracyHistory, postRecalculate } from '../api/client'
import { useLanguage } from '../i18n/index'
import SearchBar from '../components/SearchBar'
import LanguageToggle from '../components/LanguageToggle'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RangeStat {
  count: number
  avg_return: number | null
  avg_alpha: number | null
  hit_rate: number | null
}

interface BucketStat {
  count: number
  avg_return: number | null
  avg_alpha: number | null
  beat_spy_pct: number | null
}

interface Prediction {
  ticker: string
  company_name: string
  sector: string
  bukra_score: number
  return_3m: number | null
  spy_return_3m: number | null
  alpha_3m: number | null
  beat_spy: boolean
  snapshot_date: string
  is_sample: boolean
}

interface Summary {
  accuracy_pct: number | null
  hit_rate: number | null
  avg_alpha: number | null
  best_alpha: number | null
  worst_alpha: number | null
  rolling_alpha: number | null
  confidence_grade: string
  completed_count: number
  pending_count: number
  real_count: number
  sample_count: number
  has_real_data: boolean
  measurable_count: number
  correct_count: number
  avg_spy_return_3m: number | null
  last_updated: string
  best_prediction: Prediction | null
  worst_prediction: Prediction | null
  buckets: Record<string, BucketStat>
  score_ranges: Record<string, RangeStat>
}

interface Snapshot {
  id: number
  ticker: string
  company_name: string
  sector: string
  bukra_score: number
  snapshot_date: string
  is_sample: number
  return_3m: number | null
  spy_return_3m: number | null
  alpha_3m: number | null
  beat_spy_3m: number | null
  outcome_status: string
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmt(v: number | null, decimals = 1, prefix = '') {
  if (v == null) return '—'
  return `${prefix}${v > 0 ? '+' : ''}${v.toFixed(decimals)}%`
}

function retColor(v: number | null) {
  if (v == null) return 'text-gray-400'
  return v >= 0 ? 'text-emerald-400' : 'text-red-400'
}

function accColor(v: number | null) {
  if (v == null) return 'text-gray-400'
  if (v >= 75) return 'text-emerald-400'
  if (v >= 60) return 'text-blue-400'
  if (v >= 45) return 'text-amber-400'
  return 'text-red-400'
}

function alphaColor(v: number | null) {
  if (v == null) return 'text-gray-400'
  if (v > 5)  return 'text-emerald-400'
  if (v > 0)  return 'text-blue-400'
  if (v > -3) return 'text-amber-400'
  return 'text-red-400'
}

function scoreColor(s: number) {
  if (s >= 90) return 'text-emerald-400'
  if (s >= 80) return 'text-blue-400'
  if (s >= 70) return 'text-amber-400'
  return 'text-gray-400'
}

function fmtDate(iso: string | null, lang: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch { return iso }
}

// ── Confidence badge ──────────────────────────────────────────────────────────

const GRADE_CFG: Record<string, { bg: string; text: string; border: string }> = {
  'A+': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  'A':  { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400'    },
  'B':  { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400'   },
  'C':  { bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  text: 'text-orange-400'  },
  'D':  { bg: 'bg-gray-800',       border: 'border-gray-700',       text: 'text-gray-400'    },
}

function ConfidenceBadge({ grade, size = 'md' }: { grade: string; size?: 'sm' | 'md' | 'lg' }) {
  const cfg = GRADE_CFG[grade] ?? GRADE_CFG['D']
  const sz  = size === 'lg' ? 'text-3xl px-5 py-2' : size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
  return (
    <span className={`inline-flex items-center gap-1.5 font-black border rounded-xl ${sz} ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <Zap className={size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'} />
      {grade}
    </span>
  )
}

function confDesc(grade: string, t: any): string {
  const map: Record<string, string> = {
    'A+': t.accuracy_confidenceDesc_Aplus,
    'A':  t.accuracy_confidenceDesc_A,
    'B':  t.accuracy_confidenceDesc_B,
    'C':  t.accuracy_confidenceDesc_C,
    'D':  t.accuracy_confidenceDesc_D,
  }
  return map[grade] ?? map['D']
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, valueClass = 'text-white',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3 text-gray-500">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-3xl font-black leading-none font-mono ${valueClass}`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs mt-1.5">{sub}</div>}
    </div>
  )
}

// ── Prediction card (best / worst) ────────────────────────────────────────────

function PredictionCard({ pred, title, positive, t, lang }: {
  pred: Prediction | null
  title: string
  positive: boolean
  t: any
  lang: string
}) {
  if (!pred) return null
  return (
    <div className={`bg-gray-900 border rounded-2xl p-4 ${positive ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
      <div className="flex items-center gap-2 mb-3">
        {positive
          ? <TrendingUp className="w-4 h-4 text-emerald-400" />
          : <TrendingDown className="w-4 h-4 text-red-400" />}
        <span className="text-gray-400 text-xs font-semibold">{title}</span>
        {pred.is_sample && (
          <span className="ms-auto text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full px-1.5 py-0.5">
            {t.accuracy_sampleBadge}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mb-1">
        <Link
          to={`/company/${pred.ticker}`}
          className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg px-2 py-0.5 font-mono transition"
        >
          {pred.ticker}
        </Link>
        <span className={`text-sm font-bold ${scoreColor(pred.bukra_score)}`}>{pred.bukra_score}</span>
      </div>
      <p className="text-gray-400 text-xs truncate mb-2">{pred.company_name}</p>
      <div className="space-y-0.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{t.accuracy_return3m}:</span>
          <span className={`font-bold font-mono ${retColor(pred.return_3m)}`}>{fmt(pred.return_3m)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{t.accuracy_alphaCol}:</span>
          <span className={`font-bold font-mono ${alphaColor(pred.alpha_3m)}`}>{fmt(pred.alpha_3m)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">SPY:</span>
          <span className={`font-mono ${retColor(pred.spy_return_3m)}`}>{fmt(pred.spy_return_3m)}</span>
        </div>
      </div>
      <div className="text-gray-600 text-[10px] mt-2">{fmtDate(pred.snapshot_date, lang)}</div>
    </div>
  )
}

// ── Score range table ─────────────────────────────────────────────────────────

const RANGE_KEYS: Array<[string, string]> = [
  ['95_100',  'accuracy_range95_100'],
  ['90_94',   'accuracy_range90_94'],
  ['85_89',   'accuracy_range85_89'],
  ['80_84',   'accuracy_range80_84'],
  ['75_79',   'accuracy_range75_79'],
  ['70_74',   'accuracy_range70_74'],
  ['65_69',   'accuracy_range65_69'],
  ['60_64',   'accuracy_range60_64'],
  ['below60', 'accuracy_rangeBelow60'],
]

function ScoreRangeTable({ ranges, t }: { ranges: Record<string, RangeStat>; t: any }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-900 border-b border-gray-800">
            <th className="px-4 py-3 text-gray-400 font-medium text-start">{t.accuracy_range}</th>
            <th className="px-4 py-3 text-gray-400 font-medium text-center">{t.accuracy_sampleSize}</th>
            <th className="px-4 py-3 text-gray-400 font-medium text-end">{t.accuracy_col_avgReturn}</th>
            <th className="px-4 py-3 text-gray-400 font-medium text-end">{t.accuracy_col_avgAlpha}</th>
            <th className="px-4 py-3 text-gray-400 font-medium text-end">{t.accuracy_col_hitRate}</th>
          </tr>
        </thead>
        <tbody>
          {RANGE_KEYS.map(([key, labelKey], idx) => {
            const s = ranges[key]
            const isEmpty = !s || s.count === 0
            return (
              <tr
                key={key}
                className={`border-b border-gray-800/50 ${idx % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/20'}`}
              >
                <td className="px-4 py-3">
                  <span className="text-gray-300 text-sm font-medium">{(t as any)[labelKey]}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  {isEmpty
                    ? <span className="text-gray-700 text-xs">—</span>
                    : <span className="text-gray-300 font-medium">{s.count}</span>}
                </td>
                <td className="px-4 py-3 text-end">
                  {isEmpty || s.avg_return == null
                    ? <span className="text-gray-700 text-xs">—</span>
                    : <span className={`font-mono font-bold text-xs ${retColor(s.avg_return)}`}>{fmt(s.avg_return)}</span>}
                </td>
                <td className="px-4 py-3 text-end">
                  {isEmpty || s.avg_alpha == null
                    ? <span className="text-gray-700 text-xs">—</span>
                    : <span className={`font-mono font-bold text-xs ${alphaColor(s.avg_alpha)}`}>{fmt(s.avg_alpha)}</span>}
                </td>
                <td className="px-4 py-3 text-end">
                  {isEmpty || s.hit_rate == null
                    ? <span className="text-gray-700 text-xs">—</span>
                    : (
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-800 rounded-full h-1.5 hidden md:block">
                          <div
                            className={`h-1.5 rounded-full ${s.hit_rate >= 60 ? 'bg-emerald-500' : s.hit_rate >= 45 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${s.hit_rate}%` }}
                          />
                        </div>
                        <span className={`font-bold text-xs ${accColor(s.hit_rate)}`}>{s.hit_rate}%</span>
                      </div>
                    )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Snapshot history table ────────────────────────────────────────────────────

function HistoryTable({ rows, t, lang }: { rows: Snapshot[]; t: any; lang: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-900 border-b border-gray-800">
            <th className="px-4 py-3 text-gray-400 font-medium text-start">{t.accuracy_ticker}</th>
            <th className="px-4 py-3 text-gray-400 font-medium text-center">{t.accuracy_score}</th>
            <th className="px-4 py-3 text-gray-400 font-medium text-start hidden sm:table-cell">{t.accuracy_date}</th>
            <th className="px-4 py-3 text-gray-400 font-medium text-end">{t.accuracy_return3m}</th>
            <th className="px-4 py-3 text-gray-400 font-medium text-end hidden md:table-cell">{t.accuracy_alphaCol}</th>
            <th className="px-4 py-3 text-gray-400 font-medium text-end hidden lg:table-cell">SPY</th>
            <th className="px-4 py-3 text-gray-400 font-medium text-center">{t.accuracy_status}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={`border-b border-gray-800/50 ${i % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/20'}`}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/company/${r.ticker}`}
                    className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg px-2 py-0.5 font-mono transition"
                  >
                    {r.ticker}
                  </Link>
                  {r.is_sample ? (
                    <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full px-1.5 py-0.5">
                      {t.accuracy_sampleBadge}
                    </span>
                  ) : (
                    <span className="text-[10px] bg-brand-500/10 border border-brand-500/20 text-brand-400 rounded-full px-1.5 py-0.5">
                      {t.accuracy_realBadge}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`font-bold ${scoreColor(r.bukra_score)}`}>{r.bukra_score}</span>
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">
                {fmtDate(r.snapshot_date, lang)}
              </td>
              <td className="px-4 py-3 text-end">
                {r.return_3m != null
                  ? <span className={`font-bold font-mono text-xs ${retColor(r.return_3m)}`}>{fmt(r.return_3m)}</span>
                  : <span className="text-gray-600 text-xs flex items-center justify-end gap-1"><Clock className="w-3 h-3" />{t.accuracy_pendingBadge}</span>}
              </td>
              <td className="px-4 py-3 text-end hidden md:table-cell">
                {r.alpha_3m != null
                  ? <span className={`font-bold font-mono text-xs ${alphaColor(r.alpha_3m)}`}>{fmt(r.alpha_3m)}</span>
                  : <span className="text-gray-700 text-xs">—</span>}
              </td>
              <td className="px-4 py-3 text-end hidden lg:table-cell">
                {r.spy_return_3m != null
                  ? <span className={`font-mono text-xs ${retColor(r.spy_return_3m)}`}>{fmt(r.spy_return_3m)}</span>
                  : <span className="text-gray-700 text-xs">—</span>}
              </td>
              <td className="px-4 py-3 text-center">
                {r.outcome_status === 'pending'
                  ? <Clock className="w-4 h-4 text-gray-600 mx-auto" />
                  : r.beat_spy_3m === 1
                    ? <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                    : <XCircle    className="w-4 h-4 text-red-400 mx-auto" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Accuracy() {
  const { t, lang, isHe } = useLanguage()

  const [summary,     setSummary]     = useState<Summary | null>(null)
  const [rows,        setRows]        = useState<Snapshot[]>([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [histLoading, setHistLoading] = useState(true)
  const [recalcing,   setRecalcing]   = useState(false)
  const [showSample,  setShowSample]  = useState(true)
  const [tab,         setTab]         = useState<'all' | 'completed' | 'pending'>('all')

  const loadSummary = useCallback(async () => {
    try { setSummary(await getAccuracySummary()) } catch {}
  }, [])

  const loadHistory = useCallback(async () => {
    setHistLoading(true)
    try {
      const res = await getAccuracyHistory({
        limit: 200,
        include_sample: showSample,
        status: tab === 'all' ? undefined : tab,
      })
      setRows(res.rows)
      setTotal(res.total)
    } catch {} finally {
      setHistLoading(false)
    }
  }, [showSample, tab])

  useEffect(() => {
    setLoading(true)
    loadSummary().finally(() => setLoading(false))
  }, [loadSummary])

  useEffect(() => { loadHistory() }, [loadHistory])

  async function handleRecalculate() {
    setRecalcing(true)
    try {
      await postRecalculate()
      setTimeout(async () => {
        await Promise.all([loadSummary(), loadHistory()])
        setRecalcing(false)
      }, 5000)
    } catch { setRecalcing(false) }
  }

  const s = summary

  return (
    <div className="min-h-screen bg-gray-950">

      {/* ── Nav ── */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white transition flex-shrink-0">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex-1 max-w-md"><SearchBar /></div>
          <div className="text-gray-600 text-xs hidden md:block font-medium tracking-wide">{t.nav_appName}</div>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">

        {/* ── Page header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-2">{t.accuracy_pageTitle}</h1>
            <p className="text-gray-400 text-sm max-w-2xl">{t.accuracy_pageSubtitle}</p>
          </div>
          <button
            onClick={handleRecalculate}
            disabled={recalcing}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm font-medium rounded-xl px-4 py-2.5 transition flex-shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${recalcing ? 'animate-spin' : ''}`} />
            {t.accuracy_recalculate}
          </button>
        </div>

        {/* ── No real data banner ── */}
        {!loading && s && !s.has_real_data && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 text-amber-400/80 text-sm leading-relaxed">
            {t.accuracy_noHistory}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        )}

        {s && (
          <>
            {/* ── Performance dashboard ── */}
            <section>
              <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-brand-400" />
                {t.accuracy_perfDashboard}
              </h2>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  icon={<Target className="w-4 h-4" />}
                  label={t.accuracy_reliabilityScore}
                  value={s.accuracy_pct != null ? `${s.accuracy_pct}%` : '—'}
                  sub={`${s.correct_count} / ${s.measurable_count} ${isHe ? 'נכונים' : 'correct'}`}
                  valueClass={accColor(s.accuracy_pct)}
                />
                <StatCard
                  icon={<TrendingUp className="w-4 h-4" />}
                  label={t.accuracy_avgAlpha}
                  value={s.avg_alpha != null ? `${s.avg_alpha > 0 ? '+' : ''}${s.avg_alpha}%` : '—'}
                  sub={`${t.accuracy_rollingAlpha}: ${s.rolling_alpha != null ? `${s.rolling_alpha > 0 ? '+' : ''}${s.rolling_alpha}%` : '—'}`}
                  valueClass={alphaColor(s.avg_alpha)}
                />
                <StatCard
                  icon={<BarChart3 className="w-4 h-4" />}
                  label={t.accuracy_hitRate}
                  value={s.hit_rate != null ? `${s.hit_rate}%` : '—'}
                  sub={`${isHe ? 'מתוך' : 'of'} ${s.completed_count} ${isHe ? 'מוכרעות' : 'resolved'}`}
                  valueClass={accColor(s.hit_rate)}
                />
                <StatCard
                  icon={<Clock className="w-4 h-4" />}
                  label={t.accuracy_predictionCount}
                  value={String(s.completed_count + s.pending_count)}
                  sub={`${s.pending_count} ${t.accuracy_pendingChecks}`}
                  valueClass="text-white"
                />
              </div>

              {/* Confidence + alpha range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Confidence card */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                    <Zap className="w-4 h-4" />
                    {t.accuracy_confidenceLabel}
                  </div>
                  <div className="flex items-center gap-4">
                    <ConfidenceBadge grade={s.confidence_grade} size="lg" />
                    <p className="text-gray-400 text-sm leading-relaxed">{confDesc(s.confidence_grade, t)}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className={`font-black font-mono text-base ${alphaColor(s.best_alpha)}`}>
                        {s.best_alpha != null ? `+${s.best_alpha.toFixed(1)}%` : '—'}
                      </div>
                      <div className="text-gray-500 mt-0.5">{t.accuracy_bestAlpha}</div>
                    </div>
                    <div>
                      <div className={`font-black font-mono text-base ${retColor(s.worst_alpha)}`}>
                        {s.worst_alpha != null ? `${s.worst_alpha.toFixed(1)}%` : '—'}
                      </div>
                      <div className="text-gray-500 mt-0.5">{t.accuracy_worstAlpha}</div>
                    </div>
                    <div>
                      <div className={`font-black font-mono text-base ${alphaColor(s.avg_spy_return_3m)}`}>
                        {s.avg_spy_return_3m != null ? `+${s.avg_spy_return_3m}%` : '—'}
                      </div>
                      <div className="text-gray-500 mt-0.5">{t.accuracy_vsSpyAvg}</div>
                    </div>
                  </div>
                </div>

                {/* Best + worst predictions */}
                <div className="space-y-3">
                  <PredictionCard pred={s.best_prediction}  title={t.accuracy_bestPrediction}  positive={true}  t={t} lang={lang} />
                  <PredictionCard pred={s.worst_prediction} title={t.accuracy_worstPrediction} positive={false} t={t} lang={lang} />
                </div>
              </div>
            </section>

            {/* ── Score range analysis ── */}
            <section>
              <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-brand-400" />
                {t.accuracy_scoreRanges}
              </h2>
              <ScoreRangeTable ranges={s.score_ranges} t={t} />
            </section>

            {/* ── Transparency ── */}
            <section>
              <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-400" />
                {t.accuracy_transparencyTitle}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-brand-600/5 border border-brand-600/20 rounded-2xl p-4 text-center">
                  <div className="text-3xl font-black text-brand-400">{s.real_count}</div>
                  <div className="text-gray-400 text-xs mt-1">{t.accuracy_realPredictions}</div>
                </div>
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 text-center">
                  <div className="text-3xl font-black text-amber-400">{s.sample_count}</div>
                  <div className="text-gray-400 text-xs mt-1">{t.accuracy_samplePredictions}</div>
                  <div className="text-amber-600/70 text-[10px] mt-0.5">{t.accuracy_sampleNote}</div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
                  <div className="text-3xl font-black text-gray-300 flex items-center justify-center gap-2">
                    <Clock className="w-6 h-6 text-gray-500" />
                    {s.pending_count}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">{t.accuracy_pendingEvals}</div>
                </div>
              </div>
            </section>

            {/* ── Philosophy ── */}
            <section className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-brand-400 flex-shrink-0" />
                <h2 className="text-white font-bold">{t.accuracy_philosophy}</h2>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">{t.accuracy_philosophyBody}</p>
              <p className="text-gray-600 text-xs mt-3 leading-relaxed">
                {isHe
                  ? 'נוסחת דיוק: "נכון" = ציון ≥85 וניצח SPY לאחר 3M, או ציון <70 ולא ניצח SPY. אלפא = תשואת מניה − תשואת SPY באותה תקופה.'
                  : 'Accuracy formula: "correct" = score ≥85 AND beat SPY after 3M, or score <70 AND did not beat SPY. Alpha = stock return − SPY return over the same period.'}
              </p>
            </section>
          </>
        )}

        {/* ── Snapshot history ── */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-white font-bold text-lg">{isHe ? 'היסטוריית תמונות מצב' : 'Snapshot History'}</h2>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Tab filter */}
              <div className="flex rounded-xl bg-gray-900 border border-gray-800 overflow-hidden text-xs">
                {(['all', 'completed', 'pending'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setTab(s)}
                    className={`px-3 py-1.5 transition ${tab === s ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    {s === 'all'       ? (isHe ? 'הכל'     : 'All')
                     : s === 'completed' ? (isHe ? 'הוכרעו'  : 'Resolved')
                     :                   (isHe ? 'ממתין'   : 'Pending')}
                  </button>
                ))}
              </div>
              {/* Sample toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={showSample}
                  onChange={e => setShowSample(e.target.checked)}
                  className="accent-brand-500 w-3.5 h-3.5"
                />
                {t.accuracy_sampleData}
              </label>
            </div>
          </div>

          {histLoading
            ? <div className="space-y-2">{[...Array(6)].map((_,i) => (
                <div key={i} className="h-12 bg-gray-900 rounded-xl animate-pulse border border-gray-800" />
              ))}</div>
            : rows.length > 0
              ? <HistoryTable rows={rows} t={t} lang={lang} />
              : <div className="text-center py-16 text-gray-600 text-sm">{t.accuracy_noData}</div>}

          {total > rows.length && (
            <p className="text-center text-gray-600 text-xs mt-3">
              {isHe ? `מציג ${rows.length} מתוך ${total}` : `Showing ${rows.length} of ${total}`}
            </p>
          )}
        </section>

      </div>
    </div>
  )
}
