import { useLanguage } from '../i18n/index'
import { TrendingUp, TrendingDown, Minus, ShieldCheck, ShieldAlert, Shield, AlertTriangle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

interface Confidence {
  level: 'High' | 'Medium' | 'Low'
  score: number
  reasons: string[]
  data_years: number
  completeness_pct: number
}

interface Trend {
  direction: 'Improving' | 'Stable' | 'Weakening'
  metrics: Record<string, string>
  summary: string
}

interface Signal {
  signal: string
  category: string
  severity: 'High' | 'Medium' | 'Low'
}

interface ScoreChange {
  prev_score: number
  curr_score: number
  delta: number
  direction: 'up' | 'down' | 'unchanged'
  main_factor: string | null
  main_factor_label: string | null
  explanation: string
  is_significant: boolean
}

interface IntelligenceData {
  confidence: Confidence
  trend: Trend
  signals: Signal[]
  score_change: ScoreChange | null
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConfidenceBadge({ level, t }: { level: 'High' | 'Medium' | 'Low'; t: any }) {
  const configs = {
    High:   { label: t.intel_confidenceHigh,   cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', Icon: ShieldCheck },
    Medium: { label: t.intel_confidenceMedium, cls: 'bg-amber-500/15  text-amber-400  border-amber-500/30',  Icon: Shield },
    Low:    { label: t.intel_confidenceLow,    cls: 'bg-red-500/15    text-red-400    border-red-500/30',    Icon: ShieldAlert },
  }
  const { label, cls, Icon } = configs[level] ?? configs.Low
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

function TrendBadge({ direction, t }: { direction: 'Improving' | 'Stable' | 'Weakening'; t: any }) {
  const configs = {
    Improving: { label: t.intel_trendImproving, cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', Icon: TrendingUp },
    Stable:    { label: t.intel_trendStable,    cls: 'bg-gray-500/15   text-gray-400   border-gray-500/30',    Icon: Minus },
    Weakening: { label: t.intel_trendWeakening, cls: 'bg-red-500/15    text-red-400    border-red-500/30',    Icon: TrendingDown },
  }
  const { label, cls, Icon } = configs[direction] ?? configs.Stable
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

function SeverityDot({ severity }: { severity: 'High' | 'Medium' | 'Low' }) {
  const cls = {
    High:   'bg-red-500',
    Medium: 'bg-amber-500',
    Low:    'bg-gray-500',
  }[severity] ?? 'bg-gray-500'
  return <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${cls}`} />
}

function ScoreChangeBadge({ change, t }: { change: ScoreChange; t: any }) {
  const isUp      = change.direction === 'up'
  const isDown    = change.direction === 'down'
  const unchanged = change.direction === 'unchanged'

  const colors = unchanged
    ? 'bg-gray-800 border-gray-700 text-gray-400'
    : isUp
      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
      : 'bg-red-500/10 border-red-500/25 text-red-400'

  const Icon = unchanged ? Minus : isUp ? ArrowUpCircle : ArrowDownCircle

  return (
    <div className={`rounded-xl border p-4 ${colors}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
              {t.intel_scoreChangeTitle}
            </span>
            {!unchanged && (
              <span className="font-black text-sm">
                {change.prev_score} → {change.curr_score}
                {' '}
                <span className="opacity-70 font-normal text-xs">
                  ({isUp ? '+' : ''}{change.delta})
                </span>
              </span>
            )}
            {change.is_significant && (
              <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded font-medium">
                {t.intel_significantChange}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed opacity-90">{change.explanation}</p>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function IntelligencePanel({ intelligence }: { intelligence: IntelligenceData | null }) {
  const { t } = useLanguage()

  if (!intelligence) return null

  const { confidence, trend, signals, score_change } = intelligence

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-800">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-white font-bold text-sm">{t.intel_panelTitle}</h3>
          <span className="text-gray-600 text-xs">Bukra Intelligence</span>
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* Confidence + Trend badges */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs">{t.intel_confidenceLabel}</span>
            <div className="flex items-center gap-2">
              <ConfidenceBadge level={confidence.level} t={t} />
              {confidence.data_years > 0 && (
                <span className="text-gray-600 text-xs">{confidence.data_years} {t.intel_dataYears}</span>
              )}
            </div>
          </div>

          {confidence.reasons.length > 0 && (
            <p className="text-gray-500 text-xs leading-relaxed">
              {confidence.reasons[0]}
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs">{t.intel_trendLabel}</span>
            <TrendBadge direction={trend.direction} t={t} />
          </div>

          {trend.summary && (
            <p className="text-gray-500 text-xs leading-relaxed">
              {trend.summary}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800" />

        {/* Watch signals */}
        <div>
          <span className="text-gray-400 text-xs font-medium block mb-3">{t.intel_signalsLabel}</span>
          {signals.length === 0 ? (
            <p className="text-gray-600 text-xs">{t.intel_noSignals}</p>
          ) : (
            <ul className="space-y-2.5">
              {signals.map((sig, i) => (
                <li key={i} className="flex items-start gap-2">
                  <SeverityDot severity={sig.severity} />
                  <span className="text-gray-300 text-xs leading-relaxed">{sig.signal}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Score change */}
        {score_change && (
          <>
            <div className="border-t border-gray-800" />
            <ScoreChangeBadge change={score_change} t={t} />
          </>
        )}

      </div>
    </div>
  )
}
