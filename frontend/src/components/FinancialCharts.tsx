import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, ReferenceLine,
} from 'recharts'
import { useLanguage } from '../i18n/index'

interface YearData {
  year: string
  revenue?: number | null
  net_income?: number | null
  net_margin?: number | null
  free_cash_flow?: number | null
  total_debt?: number | null
  cash?: number | null
}

function fmt(val: number) {
  const abs = Math.abs(val)
  if (abs >= 1e12) return `$${(val / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `$${(val / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(val / 1e6).toFixed(0)}M`
  return `$${val.toFixed(0)}`
}

function fmtPct(val: number) {
  return `${val.toFixed(1)}%`
}

const BLUE  = '#0ea5e9'
const GREEN = '#22c55e'
const RED   = '#ef4444'
const AMBER = '#f59e0b'

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <h3 className="text-gray-300 text-sm font-semibold mb-4">{title}</h3>
      {children}
    </div>
  )
}

function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

export default function FinancialCharts({ history }: { history: YearData[] }) {
  const data = [...history].reverse()
  const { t } = useLanguage()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

      <ChartCard title={t.chart_revenue}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip formatter={fmt} />} />
            <Bar dataKey="revenue" name={t.chart_revenue_tip} fill={BLUE} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t.chart_netIncome}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip formatter={fmt} />} />
            <ReferenceLine y={0} stroke="#374151" />
            <Bar dataKey="net_income" name={t.chart_netIncome_tip} radius={[4, 4, 0, 0]} fill={GREEN} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t.chart_netMargin}>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <CartesianGrid stroke="#1f2937" vertical={false} />
            <Tooltip content={<CustomTooltip formatter={fmtPct} />} />
            <ReferenceLine y={0} stroke="#374151" />
            <Line
              type="monotone"
              dataKey="net_margin"
              name={t.chart_margin_tip}
              stroke={AMBER}
              strokeWidth={2.5}
              dot={{ fill: AMBER, r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t.chart_fcf}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip formatter={fmt} />} />
            <ReferenceLine y={0} stroke="#374151" />
            <Bar dataKey="free_cash_flow" name={t.chart_fcf_tip} radius={[4, 4, 0, 0]} fill={GREEN} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t.chart_debt}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip formatter={fmt} />} />
            <Bar dataKey="total_debt" name={t.chart_debt_tip} fill={RED} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t.chart_cash}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip formatter={fmt} />} />
            <Bar dataKey="cash" name={t.chart_cash_tip} fill={BLUE} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

    </div>
  )
}
