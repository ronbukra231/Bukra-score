import { useLanguage } from '../i18n/index'

interface ScoreData {
  score: number | null
  breakdown: Record<string, number>
  explanations: Record<string, string>
  max_scores: Record<string, number>
  confidence?: string
  errors?: Record<string, string>
}

function scoreColor(score: number, max: number) {
  const pct = score / max
  if (pct >= 0.75) return 'bg-green-500'
  if (pct >= 0.5) return 'bg-amber-500'
  return 'bg-red-500'
}

function totalColor(score: number) {
  if (score >= 75) return 'text-green-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

export default function BukraScoreCard({ score }: { score: ScoreData }) {
  const { t, isHe } = useLanguage()

  const LABELS: Record<string, string> = {
    growth: t.score_growth,
    profitability: t.score_profitability,
    cash_flow: t.score_cashFlow,
    stability: t.score_stability,
    debt: t.score_debt,
  }

  function scoreGrade(s: number) {
    if (s >= 80) return t.score_excellent
    if (s >= 65) return t.score_veryGood
    if (s >= 50) return t.score_average
    if (s >= 35) return t.score_weak
    return t.score_poor
  }

  // No score object at all
  if (!score) {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 text-gray-400 text-sm">
        {t.score_noData}
      </div>
    )
  }

  const hasBreakdown = score.breakdown && Object.keys(score.breakdown).length > 0

  // score is null — try computing from breakdown
  const displayScore: number | null = score.score !== null && score.score !== undefined
    ? score.score
    : hasBreakdown
      ? Object.values(score.breakdown).reduce((a, b) => a + b, 0)
      : null

  // Truly no data at all
  if (displayScore === null) {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 text-gray-400 text-sm">
        {t.score_noData}
      </div>
    )
  }

  const isPartial = score.score === null || score.score === undefined

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">{t.score_title}</h2>
          <p className="text-gray-400 text-sm">{t.score_subtitle}</p>
          {isPartial && (
            <p className="text-amber-500 text-xs mt-1">{t.score_partialData}</p>
          )}
        </div>
        <div className="text-center">
          <div className={`text-5xl font-black ${totalColor(displayScore)}`}>
            {displayScore}
          </div>
          <div className="text-gray-400 text-xs">/100</div>
          <div className={`text-sm font-semibold mt-0.5 ${totalColor(displayScore)}`}>
            {scoreGrade(displayScore)}
          </div>
        </div>
      </div>

      {hasBreakdown && (
        <div className="space-y-4">
          {Object.entries(score.breakdown).map(([key, val]) => {
            const max = score.max_scores?.[key] || 25
            const pct = Math.round((val / max) * 100)
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-300 text-sm">{LABELS[key] || key}</span>
                  <span className="text-white text-sm font-semibold">{val}/{max}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${scoreColor(val, max)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {isHe && score.explanations?.[key] && (
                  <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                    {score.explanations[key]}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
