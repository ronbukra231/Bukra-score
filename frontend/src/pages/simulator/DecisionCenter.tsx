/**
 * Decision Center — the recommendation inbox. Reinforces user control at
 * every turn: the Index identifies, the user decides. No "approve all."
 */
import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/index'
import SimulatorShell, { SimPanel, GOLD, SERIF } from '../../simulator/SimulatorShell'
import NoPortfolio from './NoPortfolio'
import SimulatorErrorState from '../../simulator/ErrorState'
import ApprovalModal from '../../components/simulator/ApprovalModal'
import { recLabel, statusLabel } from '../../simulator/labels'
import { getDashboard, getRecommendations, generateRecommendations, viewRecommendation, SimulatorApiError } from '../../api/simulatorClient'
import type { Recommendation } from '../../types/simulator'

export default function DecisionCenter() {
  const { t } = useLanguage()
  const [recs, setRecs] = useState<Recommendation[] | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<unknown>(null)          // page failed to load at all
  const [actionError, setActionError] = useState<unknown>(null)  // "Check for recommendations" failed
  const [generating, setGenerating] = useState(false)
  const [active, setActive] = useState<Recommendation | null>(null)

  function load() {
    getRecommendations('PENDING')
      .then(recs => { setRecs(recs); setError(null) })
      .catch(e => {
        if (e instanceof SimulatorApiError && e.status === 404) setNotFound(true)
        else setError(e)
      })
  }

  useEffect(() => {
    getDashboard().then(load).catch(e => {
      if (e instanceof SimulatorApiError && e.status === 404) setNotFound(true)
      else setError(e)
    })
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setActionError(null)
    try {
      await generateRecommendations()
      load()
    } catch (e) {
      setActionError(e)
    } finally {
      setGenerating(false)
    }
  }

  async function openReview(rec: Recommendation) {
    setActive(rec)
    if (rec.recommendationStatus === 'PENDING') {
      try { await viewRecommendation(rec.id) } catch { /* non-fatal */ }
    }
  }

  if (notFound) return <SimulatorShell><NoPortfolio /></SimulatorShell>
  if (error) return <SimulatorShell><SimulatorErrorState error={error} /></SimulatorShell>

  return (
    <SimulatorShell>
      <div className="mb-6">
        <h2 className="text-xl text-stone-100 font-light" style={{ fontFamily: SERIF }}>{t.sim_decisionCenterTitle}</h2>
        <p className="text-stone-500 text-sm mt-1 max-w-2xl">{t.sim_decisionCenterSubtitle}</p>
      </div>

      {actionError != null && <div className="mb-4"><SimulatorErrorState error={actionError} /></div>}

      <button onClick={handleGenerate} disabled={generating}
        className="mb-6 rounded-full border border-stone-700 px-5 py-2 text-sm text-stone-300
          hover:border-[#c9a962]/50 transition disabled:opacity-50">
        {generating ? t.sim_generating : t.sim_generateRecommendations}
      </button>

      {recs && recs.length === 0 && (
        <div className="text-center py-16">
          <div className="text-lg text-stone-300 mb-2" style={{ fontFamily: SERIF }}>{t.sim_noRecommendations}</div>
          <p className="text-stone-600 text-sm">{t.sim_noRecommendationsSub}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recs?.map(rec => (
          <SimPanel key={rec.id} className="!p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-lg text-stone-100" style={{ fontFamily: SERIF }}>{rec.ticker}</div>
                <div className="text-xs uppercase tracking-wide" style={{ color: GOLD }}>{recLabel(t, rec.recommendationType)}</div>
              </div>
              <span className="text-[11px] text-stone-500 border border-stone-800 rounded-full px-2.5 py-1">
                {statusLabel(t, rec.recommendationStatus)}
              </span>
            </div>

            <p className="text-stone-400 text-sm leading-relaxed mb-4 line-clamp-3">{rec.reasonSummary}</p>

            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <MiniStat label="Bukra" value={rec.bukraScoreSnapshot} />
              <MiniStat label="Valuation" value={rec.valuationScoreSnapshot} />
              <MiniStat label="Bubble" value={rec.bubbleRiskSnapshot} invert />
            </div>

            <div className="flex gap-2">
              <button onClick={() => openReview(rec)}
                className="flex-1 rounded-full py-2 text-sm font-medium"
                style={{ background: GOLD, color: '#1c1410' }}>
                {t.sim_review}
              </button>
            </div>
          </SimPanel>
        ))}
      </div>

      {active && (
        <ApprovalModal rec={active} onClose={() => setActive(null)} onDone={load} />
      )}
    </SimulatorShell>
  )
}

function MiniStat({ label, value, invert = false }: { label: string; value: number | null; invert?: boolean }) {
  const color = value == null ? 'text-stone-700'
    : invert ? (value < 40 ? 'text-emerald-400' : value < 65 ? 'text-amber-400' : 'text-red-400')
    : (value >= 65 ? 'text-emerald-400' : value >= 40 ? 'text-amber-400' : 'text-red-400')
  return (
    <div className="rounded-lg bg-stone-900/50 py-2">
      <div className={`text-sm font-semibold ${color}`}>{value ?? '—'}</div>
      <div className="text-[10px] text-stone-600">{label}</div>
    </div>
  )
}
