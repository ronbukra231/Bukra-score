import { useState } from 'react'
import { useLanguage } from '../i18n/index'
import type { FutureRelevanceData } from '../types/futureRelevance'
import { getFRStatus } from '../types/futureRelevance'
import FutureRelevanceDrawer from './FutureRelevanceDrawer'

interface Props {
  data: FutureRelevanceData | null | undefined
}

export default function FutureRelevanceCard({ data }: Props) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)

  if (!data) {
    return (
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 text-gray-400 text-sm">
        {t.fr_noData}
      </div>
    )
  }

  const { score, confidence } = data
  const status = getFRStatus(score)

  function scoreColor(s: number) {
    if (s >= 80) return 'text-green-400'
    if (s >= 65) return 'text-amber-400'
    if (s >= 50) return 'text-orange-400'
    return 'text-red-400'
  }

  function barColor(s: number) {
    if (s >= 80) return 'bg-green-500'
    if (s >= 65) return 'bg-amber-500'
    if (s >= 50) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const confLabel =
    confidence === 'High'   ? t.fr_confidenceHigh :
    confidence === 'Medium' ? t.fr_confidenceMedium :
                              t.fr_confidenceLow

  return (
    <>
      {/* Card — clickable, same style as BukraScoreCard */}
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left bg-gray-900 rounded-2xl p-6 border border-gray-800
          hover:border-gray-700 transition-all duration-200 cursor-pointer group"
        aria-label={`${t.fr_title} — ${score}/100`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-lg font-bold text-white">{t.fr_title}</h2>
              {data.isPlaceholder && (
                <span className="text-xs bg-purple-500/15 border border-purple-500/25 text-purple-400
                  rounded-full px-2 py-0.5">
                  {t.fr_placeholder}
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm">{t.fr_subtitle}</p>
          </div>

          {/* Score */}
          <div className="text-center shrink-0">
            <div className={`text-5xl font-black ${scoreColor(score)}`}>{score}</div>
            <div className="text-gray-400 text-xs">/100</div>
            <div className={`text-sm font-semibold mt-0.5 ${scoreColor(score)}`}>
              {status.label}
            </div>
          </div>
        </div>

        {/* Score bar */}
        <div className="mb-5">
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor(score)}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        {/* Confidence + top drivers */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {t.fr_confidence}:&nbsp;
            <span className="text-gray-300 font-medium">{confLabel}</span>
          </span>
          <span className="text-gray-600 group-hover:text-gray-400 transition">
            {t.fr_driversTitle} →
          </span>
        </div>

        {/* Top 3 drivers preview */}
        {data.drivers?.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {data.drivers.slice(0, 3).map(d => (
              <div key={d.key}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-300 text-sm">{d.label}</span>
                  <span className="text-white text-sm font-semibold">{d.score}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor(d.score)}`}
                    style={{ width: `${d.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Click hint */}
        <div className="mt-5 text-center">
          <span className="text-xs text-gray-600 group-hover:text-gray-400 transition
            border border-gray-800 group-hover:border-gray-700 rounded-full px-3 py-1">
            {t.fr_viewFull}
          </span>
        </div>
      </button>

      {/* Drawer */}
      {open && (
        <FutureRelevanceDrawer data={data} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
