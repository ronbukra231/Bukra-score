import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/index'
import SimulatorShell, { SimPanel, SERIF } from '../../simulator/SimulatorShell'
import NoPortfolio from './NoPortfolio'
import SimulatorErrorState from '../../simulator/ErrorState'
import { recLabel, statusLabel, REC_STATUS_KEY } from '../../simulator/labels'
import { getDecisionHistory, SimulatorApiError } from '../../api/simulatorClient'
import type { Recommendation, RecommendationStatus } from '../../types/simulator'

const STATUSES = Object.keys(REC_STATUS_KEY) as RecommendationStatus[]

export default function DecisionHistoryPage() {
  const { t, isHe } = useLanguage()
  const [recs, setRecs] = useState<Recommendation[] | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [tickerFilter, setTickerFilter] = useState('')

  function load() {
    getDecisionHistory({ status: statusFilter || undefined, ticker: tickerFilter || undefined })
      .then(recs => { setRecs(recs); setError(null) })
      .catch(e => {
        if (e instanceof SimulatorApiError && e.status === 404) setNotFound(true)
        else setError(e)
      })
  }

  useEffect(() => { load() }, [statusFilter, tickerFilter])

  if (notFound) return <SimulatorShell><NoPortfolio /></SimulatorShell>
  if (error) return <SimulatorShell><SimulatorErrorState error={error} /></SimulatorShell>

  return (
    <SimulatorShell>
      <h2 className="text-xl text-stone-100 font-light mb-6" style={{ fontFamily: SERIF }}>{t.sim_decisionHistoryTitle}</h2>

      <div className="flex flex-wrap gap-3 mb-6">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-stone-900/60 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-300">
          <option value="">{t.sim_filterAll} — {t.sim_filterStatus}</option>
          {STATUSES.map(s => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
        </select>
        <input value={tickerFilter} onChange={e => setTickerFilter(e.target.value.toUpperCase())}
          placeholder={t.sim_filterCompany}
          className="bg-stone-900/60 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-300
            placeholder-stone-700" dir="ltr" />
      </div>

      <div className="space-y-3">
        {recs?.map(r => (
          <SimPanel key={r.id} className="!p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-stone-100" style={{ fontFamily: SERIF }}>{r.ticker}</span>
                <span className="text-stone-500 text-xs ms-2">{recLabel(t, r.recommendationType)}</span>
              </div>
              <span className="text-[11px] text-stone-500 border border-stone-800 rounded-full px-2.5 py-1">
                {statusLabel(t, r.recommendationStatus)}
              </span>
            </div>
            <p className="text-stone-400 text-sm mb-2">{r.reasonSummary}</p>
            {r.userDecisionNote && (
              <p className="text-stone-600 text-xs">{t.sim_userNote}: {r.userDecisionNote}</p>
            )}
            <div className="mt-2 text-[11px] text-stone-700" dir="ltr">
              {new Date(r.createdAt).toLocaleDateString(isHe ? 'he-IL' : 'en-US')}
            </div>
          </SimPanel>
        ))}
        {recs && recs.length === 0 && <p className="text-stone-600 text-sm">{t.sim_noActivity}</p>}
      </div>
    </SimulatorShell>
  )
}
