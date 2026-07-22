/**
 * Portfolio Overview — the main simulator dashboard. "My Portfolio."
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../i18n/index'
import SimulatorShell, { SimPanel, SimFigure, GOLD, SERIF } from '../../simulator/SimulatorShell'
import NoPortfolio from './NoPortfolio'
import SimulatorErrorState from '../../simulator/ErrorState'
import { getDashboard, addVirtualFunds, SimulatorApiError } from '../../api/simulatorClient'
import type { DashboardData } from '../../types/simulator'

function fmt(v: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
  } catch { return v.toLocaleString() }
}
function pct(v: number | null) {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

export default function Overview() {
  const { t, isHe } = useLanguage()
  const [dash, setDash] = useState<DashboardData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [showDeposit, setShowDeposit] = useState(false)
  const [depositAmount, setDepositAmount] = useState(1000)
  const [busy, setBusy] = useState(false)

  function load() {
    getDashboard()
      .then(d => { setDash(d); setNotFound(false); setError(null) })
      .catch(e => {
        if (e instanceof SimulatorApiError && e.status === 404) setNotFound(true)
        else setError(e)
      })
  }

  useEffect(() => { load() }, [])

  async function handleDeposit() {
    setBusy(true)
    try {
      await addVirtualFunds(depositAmount)
      setShowDeposit(false)
      load()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  if (notFound) return <SimulatorShell><NoPortfolio /></SimulatorShell>
  if (error) return <SimulatorShell><SimulatorErrorState error={error} /></SimulatorShell>
  if (!dash) return <SimulatorShell><p className="text-stone-600 text-sm">{t.sim_loading}</p></SimulatorShell>

  const p = dash.portfolio
  const gl = p.currentValue - p.totalDeposits + p.totalWithdrawals

  return (
    <SimulatorShell>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SimPanel><SimFigure value={fmt(p.currentValue, p.baseCurrency)} label={t.sim_portfolioValue} /></SimPanel>
        <SimPanel><SimFigure value={fmt(p.currentCash, p.baseCurrency)} label={t.sim_virtualCash} /></SimPanel>
        <SimPanel>
          <SimFigure value={fmt(gl, p.baseCurrency)} label={t.sim_totalReturn}
            tone={gl >= 0 ? 'positive' : 'negative'} />
        </SimPanel>
        <SimPanel>
          <SimFigure value={pct(dash.return.netReturnPct)} label={t.sim_totalReturnPct}
            tone={(dash.return.netReturnPct ?? 0) >= 0 ? 'positive' : 'negative'} />
        </SimPanel>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <SimPanel>
          <div className="text-[11px] uppercase tracking-[0.2em] text-stone-600 mb-2">{t.sim_timeWeightedReturn}</div>
          <div className="text-xl text-stone-200" style={{ fontFamily: SERIF }}>{pct(dash.return.timeWeightedReturnPct)}</div>
        </SimPanel>
        <SimPanel>
          <div className="text-[11px] uppercase tracking-[0.2em] text-stone-600 mb-2">{t.sim_moneyWeightedReturn}</div>
          <div className="text-xl text-stone-200" style={{ fontFamily: SERIF }}>{pct(dash.return.moneyWeightedReturnPct)}</div>
        </SimPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <SimPanel className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-200 text-sm uppercase tracking-wide">{t.sim_allocationBySector}</h2>
            <span className="text-stone-600 text-xs">{t.sim_allocationCash}: {(dash.allocation.cashWeight * 100).toFixed(0)}%</span>
          </div>
          {dash.allocation.bySector.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-stone-500 text-sm mb-4">{t.sim_noHoldings}</p>
              <Link to="/simulator/build"
                className="inline-block rounded-full px-5 py-2 text-sm font-medium"
                style={{ background: GOLD, color: '#1c1410' }}>
                {t.sim_builderTitle}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {dash.allocation.bySector.map(s => (
                <div key={s.label} className="flex items-center gap-4">
                  <span className="w-32 text-sm text-stone-400 truncate">{s.label}</span>
                  <div className="flex-1 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.weight * 100}%`, background: GOLD }} />
                  </div>
                  <span className="w-12 text-end text-xs text-stone-500">{(s.weight * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </SimPanel>

        <SimPanel>
          <h2 className="text-stone-200 text-sm uppercase tracking-wide mb-4">{t.sim_summaryTitle}</h2>
          <dl className="space-y-2.5 text-sm">
            <Row label={t.sim_numberOfHoldings} value={String(dash.summary.numberOfHoldings)} />
            <Row label={t.sim_largestPosition} value={dash.summary.largestPosition || '—'} />
            <Row label={t.sim_bestPerformer} value={dash.summary.bestPerformer || '—'} />
            <Row label={t.sim_worstPerformer} value={dash.summary.worstPerformer || '—'} />
            <Row label={t.sim_totalDividends} value={fmt(dash.summary.totalDividends, p.baseCurrency)} />
            <Row label={t.sim_totalFees} value={fmt(dash.summary.totalFees, p.baseCurrency)} />
          </dl>
        </SimPanel>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button onClick={() => setShowDeposit(v => !v)}
          className="rounded-full border border-stone-700 px-5 py-2 text-sm text-stone-300 hover:border-[#c9a962]/50 transition-colors">
          {t.sim_addVirtualFunds}
        </button>
        {dash.pendingRecommendations > 0 && (
          <Link to="/simulator/decisions" className="text-sm" style={{ color: GOLD }}>
            {dash.pendingRecommendations} {isHe ? 'המלצות ממתינות ←' : 'pending recommendations →'}
          </Link>
        )}
      </div>

      {showDeposit && (
        <SimPanel className="mt-4 max-w-sm">
          <p className="text-amber-400/80 text-xs mb-3">{t.sim_virtualMoneyLabel}</p>
          <input type="number" min={1} value={depositAmount} dir="ltr"
            onChange={e => setDepositAmount(Number(e.target.value))}
            className="w-full bg-stone-900/60 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-100 mb-3
              focus:outline-none focus:border-[#c9a962]/50" placeholder={t.sim_addFundsPlaceholder} />
          <button onClick={handleDeposit} disabled={busy}
            className="w-full rounded-full py-2.5 text-sm font-medium disabled:opacity-50"
            style={{ background: GOLD, color: '#1c1410' }}>
            {t.sim_addFundsConfirm}
          </button>
        </SimPanel>
      )}
    </SimulatorShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-stone-300" dir="ltr">{value}</dd>
    </div>
  )
}
