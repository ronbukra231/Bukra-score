import { useLanguage } from '../i18n/index'

interface AnalystSummaryData {
  summary_he: string | null
  summary_en: string | null
  strongest_signal: string | null
  weakest_signal: string | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  is_ai: boolean
  is_fallback: boolean
}

interface Props {
  data: AnalystSummaryData | null
  companyName: string
}

function ConfidenceBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const { t } = useLanguage()
  const map: Record<string, { label: string; cls: string }> = {
    HIGH:   { label: t.analyst_confHigh,   cls: 'bg-green-500/10 border-green-500/30 text-green-400' },
    MEDIUM: { label: t.analyst_confMedium, cls: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
    LOW:    { label: t.analyst_confLow,    cls: 'bg-red-500/10  border-red-500/30  text-red-400'   },
  }
  const { label, cls } = map[level] ?? map.MEDIUM
  return (
    <span className={`inline-flex items-center gap-1 text-xs border rounded-full px-2.5 py-0.5 font-medium ${cls}`}>
      {t.analyst_confPrefix} {label}
    </span>
  )
}

export default function SmartAnalystSummary({ data, companyName }: Props) {
  const { t, isHe } = useLanguage()

  // Skeleton while parent is still fetching
  if (!data) {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-brand-400 text-sm font-bold">◈</span>
          <h2 className="text-white font-bold text-base">{t.analyst_title}</h2>
        </div>
        <div className="flex items-center gap-3 text-gray-500 text-sm">
          <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span>{t.analyst_loading}</span>
        </div>
        <div className="mt-4 space-y-2">
          {[90, 75, 85, 60].map((w, i) => (
            <div key={i} className="h-3 bg-gray-800 rounded animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    )
  }

  const summary = isHe ? data.summary_he : (data.summary_en ?? data.summary_he)

  if (!summary) return null

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-brand-400 text-sm font-bold">◈</span>
        <h2 className="text-white font-bold text-base">{t.analyst_title}</h2>
        {data.is_ai
          ? <span className="text-xs bg-brand-600/15 border border-brand-500/25 text-brand-400 rounded-full px-2.5 py-0.5">✦ AI</span>
          : <span className="text-xs bg-gray-800 border border-gray-700 text-gray-500 rounded-full px-2.5 py-0.5">{t.analyst_deterministicBadge}</span>
        }
        <ConfidenceBadge level={data.confidence} />
      </div>

      {/* Summary text */}
      <p
        className="text-gray-300 text-sm leading-7"
        dir={isHe ? 'rtl' : 'ltr'}
      >
        {summary}
      </p>

      {/* Signal badges */}
      {(data.strongest_signal || data.weakest_signal) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {data.strongest_signal && (
            <div className="flex items-center gap-1.5 bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-1.5">
              <span className="text-green-500 text-xs">▲</span>
              <div>
                <div className="text-gray-500 text-[10px] leading-none mb-0.5">{t.analyst_strongestLabel}</div>
                <div className="text-green-400 text-xs font-semibold">{data.strongest_signal}</div>
              </div>
            </div>
          )}
          {data.weakest_signal && (
            <div className="flex items-center gap-1.5 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-1.5">
              <span className="text-red-500 text-xs">▼</span>
              <div>
                <div className="text-gray-500 text-[10px] leading-none mb-0.5">{t.analyst_weakestLabel}</div>
                <div className="text-red-400 text-xs font-semibold">{data.weakest_signal}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
