import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from 'recharts'
import { useLanguage } from '../../i18n/index'
import SimulatorShell, { SimPanel, GOLD, SERIF } from '../../simulator/SimulatorShell'
import NoPortfolio from './NoPortfolio'
import { getPerformance, SimulatorApiError } from '../../api/simulatorClient'
import type { PerformanceData } from '../../types/simulator'

const PERIODS = ['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const

export default function PerformancePage() {
  const { t, isHe } = useLanguage()
  const [period, setPeriod] = useState<typeof PERIODS[number]>('1Y')
  const [data, setData] = useState<PerformanceData | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    getPerformance(period).then(setData).catch(e => {
      if (e instanceof SimulatorApiError && e.status === 404) setNotFound(true)
    })
  }, [period])

  if (notFound) return <SimulatorShell><NoPortfolio /></SimulatorShell>

  // Merge portfolio + benchmark series by date for a single normalized chart
  const merged: Record<string, { date: string; portfolio?: number; benchmark?: number }> = {}
  data?.portfolioSeries.forEach(p => { merged[p.date] = { ...merged[p.date], date: p.date, portfolio: p.portfolioIndex } })
  data?.benchmark.series.forEach(b => { merged[b.date] = { ...merged[b.date], date: b.date, benchmark: b.benchmarkIndex } })
  const chartData = Object.values(merged).sort((a, b) => a.date.localeCompare(b.date))

  const periodLabels: Record<string, keyof typeof t> = {
    '1D': 'sim_period1D', '1W': 'sim_period1W', '1M': 'sim_period1M',
    '3M': 'sim_period3M', '1Y': 'sim_period1Y', ALL: 'sim_periodAll',
  }

  return (
    <SimulatorShell>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl text-stone-100 font-light" style={{ fontFamily: SERIF }}>{t.sim_benchmarkComparison}</h2>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors
                ${period === p ? 'text-stone-900' : 'text-stone-500 hover:text-stone-300'}`}
              style={period === p ? { background: GOLD } : undefined}>
              {t[periodLabels[p]] as string}
            </button>
          ))}
        </div>
      </div>

      <SimPanel>
        {!data ? (
          <p className="text-stone-600 text-sm">{t.sim_loading}</p>
        ) : chartData.length === 0 ? (
          <p className="text-stone-600 text-sm">{t.sim_benchmarkUnavailable}</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="#1f2937" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#78716c', fontSize: 11 }} axisLine={false} tickLine={false}
                  minTickGap={40} />
                <YAxis tick={{ fill: '#78716c', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}%`} />
                <ReferenceLine y={0} stroke="#44403c" />
                <Tooltip contentStyle={{ background: '#1c1917', border: '1px solid #292524', borderRadius: 8 }}
                  formatter={(v: number) => `${v.toFixed(2)}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="portfolio" name={t.sim_dashboardTitle} stroke={GOLD} dot={false} strokeWidth={2} />
                {data.benchmark.available && (
                  <Line type="monotone" dataKey="benchmark" name={data.benchmark.benchmarkSymbol} stroke="#78716c" dot={false} strokeWidth={1.5} />
                )}
              </LineChart>
            </ResponsiveContainer>
            {!data.benchmark.available && (
              <p className="mt-3 text-stone-600 text-xs">{t.sim_benchmarkUnavailable}</p>
            )}
          </>
        )}
      </SimPanel>
    </SimulatorShell>
  )
}
