import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/index'
import SimulatorShell, { SimPanel, SERIF } from '../../simulator/SimulatorShell'
import NoPortfolio from './NoPortfolio'
import SimulatorErrorState from '../../simulator/ErrorState'
import { getDashboard, SimulatorApiError } from '../../api/simulatorClient'
import type { DashboardData, Holding } from '../../types/simulator'

function fmt(v: number | null, currency: string) {
  if (v == null) return '—'
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v) }
  catch { return v.toLocaleString() }
}

export default function HoldingsPage() {
  const { t, isHe } = useLanguage()
  const [dash, setDash] = useState<DashboardData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    getDashboard().then(setDash).catch(e => {
      if (e instanceof SimulatorApiError && e.status === 404) setNotFound(true)
      else setError(e)
    })
  }, [])

  if (notFound) return <SimulatorShell><NoPortfolio /></SimulatorShell>
  if (error) return <SimulatorShell><SimulatorErrorState error={error} /></SimulatorShell>
  if (!dash) return <SimulatorShell><p className="text-stone-600 text-sm">{t.sim_loading}</p></SimulatorShell>

  if (dash.holdings.length === 0) {
    return (
      <SimulatorShell>
        <div className="text-center py-16">
          <div className="text-lg text-stone-300 mb-2" style={{ fontFamily: SERIF }}>{t.sim_noHoldings}</div>
          <p className="text-stone-600 text-sm">{t.sim_noHoldingsSub}</p>
        </div>
      </SimulatorShell>
    )
  }

  const currency = dash.portfolio.baseCurrency

  return (
    <SimulatorShell>
      <h2 className="text-xl text-stone-100 font-light mb-6" style={{ fontFamily: SERIF }}>{t.sim_holdingsTitle}</h2>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-stone-800/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-800/60 text-stone-600 text-[11px] uppercase tracking-wide">
              <Th>{isHe ? 'סימבול' : 'Ticker'}</Th>
              <Th>{t.sim_quantity}</Th>
              <Th>{t.sim_avgCost}</Th>
              <Th>{t.sim_currentPrice}</Th>
              <Th>{t.sim_marketValue}</Th>
              <Th>{t.sim_unrealizedGL}</Th>
              <Th>{t.sim_weight}</Th>
            </tr>
          </thead>
          <tbody>
            {dash.holdings.map(h => <Row key={h.id} h={h} currency={currency} />)}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {dash.holdings.map(h => (
          <SimPanel key={h.id} className="!p-5">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-lg text-stone-100" style={{ fontFamily: SERIF }}>{h.ticker}</span>
              <span className="text-sm text-stone-400">{(h.portfolioWeight! * 100).toFixed(1)}%</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-stone-600">{t.sim_quantity}: </span><span className="text-stone-300" dir="ltr">{h.quantity.toFixed(4)}</span></div>
              <div><span className="text-stone-600">{t.sim_currentPrice}: </span><span className="text-stone-300" dir="ltr">{fmt(h.currentPrice, currency)}</span></div>
              <div><span className="text-stone-600">{t.sim_marketValue}: </span><span className="text-stone-300" dir="ltr">{fmt(h.currentMarketValue, currency)}</span></div>
              <div>
                <span className="text-stone-600">{t.sim_unrealizedGL}: </span>
                <span dir="ltr" className={(h.unrealizedGainLoss || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {fmt(h.unrealizedGainLoss, currency)}
                </span>
              </div>
            </div>
            {h.reasonForHolding && <p className="mt-3 text-stone-500 text-xs">{h.reasonForHolding}</p>}
          </SimPanel>
        ))}
      </div>
    </SimulatorShell>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-start px-4 py-3 font-normal">{children}</th>
}

function Row({ h, currency }: { h: Holding; currency: string }) {
  const gl = h.unrealizedGainLoss ?? 0
  return (
    <tr className="border-b border-stone-900 hover:bg-stone-900/30">
      <td className="px-4 py-3 text-stone-100" style={{ fontFamily: SERIF }}>{h.ticker}</td>
      <td className="px-4 py-3 text-stone-300" dir="ltr">{h.quantity.toFixed(4)}</td>
      <td className="px-4 py-3 text-stone-300" dir="ltr">{fmt(h.averageCost, currency)}</td>
      <td className="px-4 py-3 text-stone-300" dir="ltr">{fmt(h.currentPrice, currency)}</td>
      <td className="px-4 py-3 text-stone-300" dir="ltr">{fmt(h.currentMarketValue, currency)}</td>
      <td className={`px-4 py-3 ${gl >= 0 ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr">
        {fmt(h.unrealizedGainLoss, currency)} ({(h.unrealizedGainLossPercent ?? 0).toFixed(1)}%)
      </td>
      <td className="px-4 py-3 text-stone-400" dir="ltr">{((h.portfolioWeight || 0) * 100).toFixed(1)}%</td>
    </tr>
  )
}
