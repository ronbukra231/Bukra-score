import { useLanguage } from '../i18n/index'

interface Contributors {
  positive: string[]
  negative: string[]
}

interface AnalystSummaryData {
  summary_he: string | null
  summary_en: string | null
  contributors_he: Contributors
  contributors_en: Contributors
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  is_fallback: boolean
}

interface Props {
  data: AnalystSummaryData | null
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfidenceRow({ level, t }: { level: 'HIGH' | 'MEDIUM' | 'LOW'; t: any }) {
  const cfg = {
    HIGH:   { dot: '🟢', label: t.analyst_confHigh,   note: t.analyst_confNoteHigh   },
    MEDIUM: { dot: '🟡', label: t.analyst_confMedium, note: t.analyst_confNoteMedium },
    LOW:    { dot: '🔴', label: t.analyst_confLow,    note: t.analyst_confNoteLow    },
  }
  const { dot, label, note } = cfg[level] ?? cfg.MEDIUM

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-xs">{t.analyst_confPrefix}</span>
        <span className="text-xs font-semibold text-gray-200">{dot} {label}</span>
      </div>
      <p className="text-gray-600 text-xs leading-relaxed">{note}</p>
    </div>
  )
}

function ContributorsSection({
  contributors, t, isHe
}: {
  contributors: Contributors
  t: any
  isHe: boolean
}) {
  const { positive, negative } = contributors
  if (!positive.length && !negative.length) return null

  return (
    <div className="space-y-3">
      <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
        {t.analyst_contributorsTitle}
      </h3>
      <div className="space-y-2" dir={isHe ? 'rtl' : 'ltr'}>
        {positive.map((line, i) => (
          <div key={`pos-${i}`} className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5 flex-shrink-0">🟢</span>
            <span className="text-gray-300 text-sm leading-6">{line}</span>
          </div>
        ))}
        {negative.map((line, i) => (
          <div key={`neg-${i}`} className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5 flex-shrink-0">🔴</span>
            <span className="text-gray-300 text-sm leading-6">{line}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ t }: { t: any }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎯</span>
        <h2 className="text-white font-bold text-base">{t.analyst_title}</h2>
      </div>
      <div className="flex items-center gap-3 text-gray-600 text-sm">
        <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <span>{t.analyst_loading}</span>
      </div>
      <div className="space-y-2">
        {[88, 72, 80, 64, 76].map((w, i) => (
          <div key={i} className="h-3 bg-gray-800 rounded animate-pulse" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SmartAnalystSummary({ data }: Props) {
  const { t, isHe } = useLanguage()

  if (!data) return <Skeleton t={t} />

  const summary      = isHe ? data.summary_he : (data.summary_en ?? data.summary_he)
  const contributors = isHe ? data.contributors_he : data.contributors_en

  if (!summary) return null

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">

      {/* ── Section 1: Narrative ── */}
      <div className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <h2 className="text-white font-bold text-base">{t.analyst_title}</h2>
        </div>
        <p
          className="text-gray-300 text-sm leading-7"
          dir={isHe ? 'rtl' : 'ltr'}
        >
          {summary}
        </p>
      </div>

      {/* ── Section 2: Contributors ── */}
      {contributors && (contributors.positive.length > 0 || contributors.negative.length > 0) && (
        <div className="border-t border-gray-800 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <h3 className="text-white font-semibold text-sm">{t.analyst_contributorsTitle}</h3>
          </div>
          <div className="space-y-2" dir={isHe ? 'rtl' : 'ltr'}>
            {contributors.positive.map((line, i) => (
              <div key={`pos-${i}`} className="flex items-start gap-2">
                <span className="text-sm leading-none mt-1 flex-shrink-0">🟢</span>
                <span className="text-gray-300 text-sm leading-6">{line}</span>
              </div>
            ))}
            {contributors.negative.map((line, i) => (
              <div key={`neg-${i}`} className="flex items-start gap-2">
                <span className="text-sm leading-none mt-1 flex-shrink-0">🔴</span>
                <span className="text-gray-300 text-sm leading-6">{line}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 3: Confidence + disclaimer ── */}
      <div className="border-t border-gray-800 px-6 py-4 space-y-3">
        <ConfidenceRow level={data.confidence} t={t} />
        <p className="text-gray-700 text-xs leading-relaxed" dir={isHe ? 'rtl' : 'ltr'}>
          {t.analyst_dataNote}
        </p>
      </div>

    </div>
  )
}
