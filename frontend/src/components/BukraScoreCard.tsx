import { useLanguage } from '../i18n/index'

interface ScoreData {
  score: number
  breakdown: Record<string, number>
  explanations: Record<string, string>
  max_scores: Record<string, number>
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

  if (!score || score.score === null) {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 text-gray-400">
        {t.score_noData}
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">{t.score_title}</h2>
          <p className="text-gray-400 text-sm">{t.score_subtitle}</p>
        </div>
        <div className="text-center">
          <div className={`text-5xl font-black ${totalColor(score.score)}`}>
            {score.score}
          </div>
          <div className="text-gray-400 text-xs">/100</div>
          <div className={`text-sm font-semibold mt-0.5 ${totalColor(score.score)}`}>
            {scoreGrade(score.score)}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(score.breakdown).map(([key, val]) => {
          const max = score.max_scores[key] || 25
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
              {/* Only show Hebrew backend explanations in Hebrew mode */}
              {isHe && score.explanations?.[key] && (
                <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                  {score.explanations[key]}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
