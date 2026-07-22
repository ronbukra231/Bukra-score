import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/index'
import SimulatorShell, { SimPanel, SimFigure, SERIF } from '../../simulator/SimulatorShell'
import NoPortfolio from './NoPortfolio'
import SimulatorErrorState from '../../simulator/ErrorState'
import { getHealth, SimulatorApiError } from '../../api/simulatorClient'
import type { PortfolioHealth } from '../../types/simulator'

const STATUS_KEY: Record<string, string> = {
  'Strong': 'sim_healthStrong', 'Balanced': 'sim_healthBalanced',
  'Needs Attention': 'sim_healthNeedsAttention', 'High Concentration': 'sim_healthHighConcentration',
  'High Valuation Risk': 'sim_healthHighValuationRisk', 'Limited Data Confidence': 'sim_healthLimitedConfidence',
}
const STATUS_COLOR: Record<string, string> = {
  'Strong': 'text-emerald-400', 'Balanced': 'text-amber-300',
  'Needs Attention': 'text-orange-400', 'High Concentration': 'text-red-400',
  'High Valuation Risk': 'text-red-400', 'Limited Data Confidence': 'text-orange-400',
}

export default function HealthPage() {
  const { t } = useLanguage()
  const [health, setHealth] = useState<PortfolioHealth | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    getHealth().then(setHealth).catch(e => {
      if (e instanceof SimulatorApiError && e.status === 404) setNotFound(true)
      else setError(e)
    })
  }, [])

  if (notFound) return <SimulatorShell><NoPortfolio /></SimulatorShell>
  if (error) return <SimulatorShell><SimulatorErrorState error={error} /></SimulatorShell>
  if (!health) return <SimulatorShell><p className="text-stone-600 text-sm">{t.sim_loading}</p></SimulatorShell>

  return (
    <SimulatorShell>
      <h2 className="text-xl text-stone-100 font-light mb-2" style={{ fontFamily: SERIF }}>{t.sim_healthTitle}</h2>
      <p className="text-stone-600 text-xs mb-6">{t.sim_healthNotGuarantee}</p>

      <SimPanel className="mb-6">
        <div className={`text-3xl font-light ${STATUS_COLOR[health.status] || 'text-stone-200'}`} style={{ fontFamily: SERIF }}>
          {t[STATUS_KEY[health.status] as keyof typeof t] as string || health.status}
        </div>
      </SimPanel>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SimPanel><SimFigure value={String(health.numberOfHoldings)} label={t.sim_numberOfHoldings} /></SimPanel>
        <SimPanel><SimFigure value={`${(health.cashAllocation * 100).toFixed(0)}%`} label={t.sim_allocationCash} /></SimPanel>
        <SimPanel><SimFigure value={`${(health.largestPositionWeight * 100).toFixed(0)}%`} label={t.sim_largestPosition} /></SimPanel>
        <SimPanel><SimFigure value={`${(health.largestSectorWeight * 100).toFixed(0)}%`} label={t.sim_largestSector} /></SimPanel>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SimPanel><SimFigure value={health.averageBukraScore != null ? String(health.averageBukraScore) : '—'} label="Avg. Bukra Score" /></SimPanel>
        <SimPanel><SimFigure value={health.averageValuationScore != null ? String(health.averageValuationScore) : '—'} label="Avg. Valuation Score" /></SimPanel>
        <SimPanel><SimFigure value={health.weightedBubbleRisk != null ? String(health.weightedBubbleRisk) : '—'} label="Weighted Bubble Risk" /></SimPanel>
        <SimPanel><SimFigure value={health.weightedValuationConfidence != null ? String(health.weightedValuationConfidence) : '—'} label="Weighted Confidence" /></SimPanel>
      </div>

      {health.drivers.length > 0 && (
        <SimPanel>
          <h3 className="text-stone-200 text-sm uppercase tracking-wide mb-3">
            {t.sim_healthNotGuarantee}
          </h3>
          <ul className="space-y-2">
            {health.drivers.map(d => (
              <li key={d.key} className="text-stone-400 text-sm flex justify-between">
                <span>{d.key.replace(/_/g, ' ')}</span>
                <span dir="ltr" className="text-stone-300">{(d.value * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </SimPanel>
      )}
    </SimulatorShell>
  )
}
