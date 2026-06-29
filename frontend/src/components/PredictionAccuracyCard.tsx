import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Clock, AlertCircle, ChevronRight, Zap } from 'lucide-react'
import { getAccuracySummary } from '../api/client'
import { useLanguage } from '../i18n/index'

interface Summary {
  accuracy_pct: number | null
  hit_rate: number | null
  avg_alpha: number | null
  confidence_grade: string
  completed_count: number
  pending_count: number
  real_count: number
  real_pending_count: number
  sample_count: number
  has_real_data: boolean
  data_mode: 'real' | 'sample_only'
  minimum_for_accuracy: number
  last_real_scan: string | null
  buckets: Record<string, { count: number; avg_return: number | null; avg_alpha: number | null; beat_spy_pct: number | null }>
}

// ── Colour helpers ────────────────────────────────────────────────────────────

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

function retColor(v: number | null) {
  if (v == null) return 'text-gray-400'
  return v >= 0 ? 'text-emerald-400' : 'text-red-400'
}

// ── Confidence badge ──────────────────────────────────────────────────────────

const GRADE_CFG: Record<string, { bg: string; text: string }> = {
  'A+': { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400' },
  'A':  { bg: 'bg-blue-500/15 border-blue-500/30',       text: 'text-blue-400'    },
  'B':  { bg: 'bg-amber-500/15 border-amber-500/30',     text: 'text-amber-400'   },
  'C':  { bg: 'bg-orange-500/15 border-orange-500/30',   text: 'text-orange-400'  },
  'D':  { bg: 'bg-gray-800 border-gray-700',             text: 'text-gray-400'    },
}

function ConfidenceBadge({ grade }: { grade: string }) {
  const cfg = GRADE_CFG[grade] ?? GRADE_CFG['D']
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2.5 py-0.5 text-xs font-black ${cfg.bg} ${cfg.text}`}>
      <Zap className="w-3 h-3" />
      {grade}
    </span>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function PredictionAccuracyCard({ compact = false }: { compact?: boolean }) {
  const { t, isHe } = useLanguage()
  const [data,    setData]    = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    getAccuracySummary()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-pulse">
        <div className="h-4 w-40 bg-gray-800 rounded mb-3" />
        <div className="h-10 w-24 bg-gray-800 rounded mb-2" />
        <div className="h-3 w-32 bg-gray-800 rounded" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-gray-500 text-sm flex items-center gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {t.accuracy_noData}
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-800">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <TrendingUp className="w-4 h-4 text-brand-400 flex-shrink-0" />
              <span className="text-gray-300 text-xs font-semibold uppercase tracking-widest">
                {t.accuracy_title}
              </span>
            </div>
            <p className="text-gray-500 text-xs">{t.accuracy_reliabilityScore}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ConfidenceBadge grade={data.confidence_grade} />
            {data.data_mode === 'sample_only' && (
              <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs rounded-full px-2 py-0.5 font-medium">
                {t.accuracy_sampleBadge}
              </span>
            )}
          </div>
        </div>

        {/* ── Key metrics row ── */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className={`text-3xl font-black leading-none ${accColor(data.accuracy_pct)}`}>
              {data.accuracy_pct != null ? `${data.accuracy_pct}%` : '—'}
            </div>
            <div className="text-gray-500 text-[10px] mt-0.5">{t.accuracy_reliabilityScore}</div>
          </div>
          <div>
            <div className={`text-3xl font-black leading-none font-mono ${alphaColor(data.avg_alpha)}`}>
              {data.avg_alpha != null ? `${data.avg_alpha > 0 ? '+' : ''}${data.avg_alpha}%` : '—'}
            </div>
            <div className="text-gray-500 text-[10px] mt-0.5">{t.accuracy_avgAlpha}</div>
          </div>
          <div>
            <div className={`text-3xl font-black leading-none ${accColor(data.hit_rate)}`}>
              {data.hit_rate != null ? `${data.hit_rate}%` : '—'}
            </div>
            <div className="text-gray-500 text-[10px] mt-0.5">{t.accuracy_hitRate}</div>
          </div>
        </div>

        {/* ── Counts ── */}
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          <span>{t.accuracy_completed}: <span className="text-gray-300 font-medium">{data.completed_count}</span></span>
          <span className="text-gray-700">·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {t.accuracy_pending}: <span className="text-gray-300 font-medium ml-1">{data.pending_count}</span>
          </span>
        </div>

        {/* ── Data state notices ── */}
        {data.data_mode === 'sample_only' && (
          <p className="mt-3 text-amber-400/70 text-xs leading-relaxed bg-amber-500/5 border border-amber-500/10 rounded-xl px-3 py-2">
            {data.real_pending_count > 0
              ? isHe
                ? `${data.real_pending_count} סריקות אמיתיות נשמרו — ממתינות ל-90 יום לפני שניתן למדוד דיוק. הנתונים המוצגים הם לדוגמה בלבד.`
                : `${data.real_pending_count} real scans saved — waiting 90 days before accuracy can be measured. Stats shown are demo data.`
              : t.accuracy_noHistory}
          </p>
        )}
        {data.has_real_data && data.real_count < (data.minimum_for_accuracy ?? 10) && (
          <p className="mt-3 text-blue-400/70 text-xs leading-relaxed bg-blue-500/5 border border-blue-500/10 rounded-xl px-3 py-2">
            {isHe
              ? `${data.real_count} ניתוחים אמיתיים — יש צורך ב-${data.minimum_for_accuracy} לפחות לסטטיסטיקה משמעותית. נתונים מצטברים עם כל סריקה.`
              : `${data.real_count} real scans — ${data.minimum_for_accuracy} needed for meaningful statistics. Data grows with every scan.`}
          </p>
        )}
      </div>

      {/* ── Bucket rows (full card only) ── */}
      {!compact && (
        <div className="divide-y divide-gray-800/60">
          {([
            [t.accuracy_bucket90plus,  data.buckets.score_90plus],
            [t.accuracy_bucket80_89,   data.buckets.score_80_89],
            [t.accuracy_bucket70_79,   data.buckets.score_70_79],
            [t.accuracy_bucketBelow70, data.buckets.score_below_70],
          ] as [string, typeof data.buckets.score_90plus][]).map(([label, b]) => (
            <div key={label} className="px-5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-400">{label}</span>
              <div className="flex items-center gap-4">
                {b.avg_alpha != null && (
                  <span className={`font-mono font-bold ${alphaColor(b.avg_alpha)}`}>
                    α {b.avg_alpha > 0 ? '+' : ''}{b.avg_alpha}%
                  </span>
                )}
                {b.beat_spy_pct != null && (
                  <span className={`font-bold ${accColor(b.beat_spy_pct)}`}>
                    {b.beat_spy_pct}% {t.accuracy_beatSPY}
                  </span>
                )}
                {b.avg_return == null && b.beat_spy_pct == null && (
                  <span className="text-gray-600">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="px-5 py-3 border-t border-gray-800/60">
        <Link
          to="/accuracy"
          className="flex items-center justify-between text-xs text-gray-500 hover:text-brand-400 transition"
        >
          <span>
            {data.real_count > 0
              ? `${data.real_count} ${isHe ? 'ניתוחים אמיתיים' : 'real analyses'}`
              : t.accuracy_sampleNote}
          </span>
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
        </Link>
      </div>
    </div>
  )
}
