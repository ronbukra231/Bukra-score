import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/index'
import type { FutureRelevanceData, FRScenarioType } from '../types/futureRelevance'
import { getFRStatus } from '../types/futureRelevance'

interface Props {
  data: FutureRelevanceData
  onClose: () => void
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${value}%` }} />
    </div>
  )
}

function barColor(s: number) {
  if (s >= 80) return 'bg-green-500'
  if (s >= 65) return 'bg-amber-500'
  if (s >= 50) return 'bg-orange-500'
  return 'bg-red-500'
}

function severityColor(sev: string) {
  if (sev === 'High')   return 'text-red-400 bg-red-500/10 border-red-500/20'
  if (sev === 'Medium') return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  return 'text-green-400 bg-green-500/10 border-green-500/20'
}

function relevanceColor(rel: string) {
  if (rel === 'High')   return 'bg-purple-500/15 border-purple-500/25 text-purple-300'
  if (rel === 'Medium') return 'bg-blue-500/15 border-blue-500/25 text-blue-300'
  return 'bg-gray-700 border-gray-600 text-gray-400'
}

function scenarioStyle(type: FRScenarioType): { border: string; badge: string; icon: string } {
  if (type === 'bull') return { border: 'border-green-500/25', badge: 'text-green-400 bg-green-500/10 border-green-500/25', icon: '↑' }
  if (type === 'bear') return { border: 'border-red-500/25',   badge: 'text-red-400 bg-red-500/10 border-red-500/25',       icon: '↓' }
  return                      { border: 'border-gray-700',      badge: 'text-gray-300 bg-gray-700 border-gray-600',           icon: '→' }
}

// ── Drawer ────────────────────────────────────────────────────────────────────

export default function FutureRelevanceDrawer({ data, onClose }: Props) {
  const { t } = useLanguage()
  const panelRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [expandedScenario, setExpandedScenario] = useState<FRScenarioType | null>(null)

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVisible(false)
        setTimeout(onClose, 300)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  const { score, confidence, aiSummary, drivers, risks, trends, scenarios } = data
  const status = getFRStatus(score)

  function scoreColor(s: number) {
    if (s >= 80) return 'text-green-400'
    if (s >= 65) return 'text-amber-400'
    if (s >= 50) return 'text-orange-400'
    return 'text-red-400'
  }

  const confLabel =
    confidence === 'High'   ? t.fr_confidenceHigh :
    confidence === 'Medium' ? t.fr_confidenceMedium :
                              t.fr_confidenceLow

  const scenarioLabel = (type: FRScenarioType) =>
    type === 'bull' ? t.fr_bull : type === 'base' ? t.fr_base : t.fr_bear

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label={t.fr_title}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300
          ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Panel — slides in from right, same pattern as BukraRules/IntelligencePanel drawers */}
      <div
        ref={panelRef}
        className={`relative ml-auto h-full w-full max-w-xl bg-gray-950 border-l border-gray-800
          flex flex-col overflow-hidden
          transition-transform duration-300 ease-out
          ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-800 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-white font-bold text-xl">{t.fr_title}</h2>
              {data.isPlaceholder && (
                <span className="text-xs bg-purple-500/15 border border-purple-500/25 text-purple-400
                  rounded-full px-2 py-0.5">
                  {t.fr_placeholder}
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm">{t.fr_subtitle}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-white transition text-2xl leading-none mt-0.5 ml-4"
            aria-label={t.fr_close}
          >
            ×
          </button>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

          {/* Overall score + confidence */}
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className={`text-6xl font-black ${scoreColor(score)}`}>{score}</div>
                <div className="text-gray-500 text-sm">/100</div>
              </div>
              <div className="text-right">
                <div className={`text-xl font-bold ${scoreColor(score)}`}>{status.label}</div>
                <div className="text-gray-400 text-sm mt-1">
                  {t.fr_confidence}:&nbsp;
                  <span className="text-gray-200 font-medium">{confLabel}</span>
                </div>
              </div>
            </div>
            <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor(score)}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          {/* Knowledge evolution — shown only when something materially changed */}
          {data.changesSinceLast && data.changesSinceLast.length > 0 && (
            <div className="bg-blue-500/5 rounded-xl p-4 border border-blue-500/15">
              <div className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-2">
                {t.fr_whatsNew}
              </div>
              <ul className="space-y-1">
                {data.changesSinceLast.map((c, i) => (
                  <li key={i} className="text-gray-300 text-sm leading-relaxed">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Investment Thesis */}
          {data.thesis?.currentThesis && (
            <section>
              <h3 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide">
                {t.fr_thesisTitle}
              </h3>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-300 text-sm leading-7">{data.thesis.currentThesis}</p>
              </div>
            </section>
          )}

          {/* AI Summary */}
          {aiSummary && (
            <section>
              <h3 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide">
                {t.fr_aiSummaryTitle}
              </h3>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-300 text-sm leading-7">{aiSummary}</p>
              </div>
            </section>
          )}

          {/* Positive Drivers */}
          {drivers?.length > 0 && (
            <section>
              <h3 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide">
                {t.fr_driversTitle}
              </h3>
              <div className="space-y-4">
                {drivers.map(d => (
                  <div key={d.key} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-200 text-sm font-medium">{d.label}</span>
                      <span className={`text-sm font-bold ${scoreColor(d.score)}`}>{d.score}</span>
                    </div>
                    <ScoreBar value={d.score} color={barColor(d.score)} />
                    <p className="text-gray-500 text-xs mt-2 leading-relaxed">{d.summary}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Risk Factors */}
          {risks?.length > 0 && (
            <section>
              <h3 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide">
                {t.fr_risksTitle}
              </h3>
              <div className="space-y-3">
                {risks.map(r => {
                  const sc = severityColor(r.severity)
                  const sevLabel =
                    r.severity === 'High'   ? t.fr_severityHigh :
                    r.severity === 'Medium' ? t.fr_severityMedium :
                                              t.fr_severityLow
                  return (
                    <div key={r.key} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-200 text-sm font-medium">{r.label}</span>
                        <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border ${sc}`}>
                          {sevLabel}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs leading-relaxed">{r.summary}</p>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Long-term trends */}
          {trends?.length > 0 && (
            <section>
              <h3 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide">
                {t.fr_trendsTitle}
              </h3>
              <div className="flex flex-wrap gap-2">
                {trends.map(tr => {
                  const relLabel =
                    tr.relevance === 'High'   ? t.fr_relevanceHigh :
                    tr.relevance === 'Medium' ? t.fr_relevanceMedium :
                                                t.fr_relevanceLow
                  return (
                    <span
                      key={tr.key}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full
                        px-3 py-1.5 border ${relevanceColor(tr.relevance)}`}
                      title={relLabel}
                    >
                      {tr.label}
                    </span>
                  )
                })}
              </div>
            </section>
          )}

          {/* Scenarios */}
          {scenarios?.length > 0 && (
            <section>
              <h3 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide">
                {t.fr_scenariosTitle}
              </h3>
              <div className="space-y-3">
                {scenarios.map(sc => {
                  const style = scenarioStyle(sc.type)
                  const isExpanded = expandedScenario === sc.type
                  return (
                    <div
                      key={sc.type}
                      className={`bg-gray-900 rounded-xl border ${style.border} overflow-hidden`}
                    >
                      <button
                        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                        onClick={() => setExpandedScenario(isExpanded ? null : sc.type)}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 border ${style.badge}`}>
                            {style.icon} {scenarioLabel(sc.type)}
                          </span>
                          <span className="text-gray-200 text-sm font-medium">{sc.title}</span>
                        </div>
                        <span className={`text-gray-500 text-sm transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                          ▾
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-800/60">
                          <p className="text-gray-400 text-sm leading-7 mt-3">{sc.summary}</p>
                          {sc.timeframe && (
                            <div className="mt-2 text-xs text-gray-600">
                              {t.fr_timeframe}: {sc.timeframe}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Disclaimer */}
          <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/60">
            <p className="text-gray-600 text-xs leading-relaxed">{t.fr_disclaimer}</p>
          </div>

        </div>
      </div>
    </div>
  )
}
