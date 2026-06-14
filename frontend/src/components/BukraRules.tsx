import { useLanguage } from '../i18n/index'
import type { Translations } from '../i18n/types'

interface YearData {
  year: string
  revenue?: number | null
  net_income?: number | null
  net_margin?: number | null
  free_cash_flow?: number | null
  total_debt?: number | null
  cash?: number | null
  stockholders_equity?: number | null
}

type RuleStatus = 'pass' | 'fail' | 'unavailable'

interface Rule {
  label: string
  detail: string
  status: RuleStatus
}

function evaluateRules(history: YearData[], t: Translations, isHe: boolean): Rule[] {
  const sorted = [...history]
    .filter(h => h.revenue != null || h.net_income != null)
    .sort((a, b) => a.year.localeCompare(b.year))

  const latestWithDebt = [...sorted].reverse()
    .find(h => h.total_debt != null || h.cash != null || h.stockholders_equity != null)
  const latest = latestWithDebt ?? sorted[sorted.length - 1]

  // ── 1. Revenue growth ──────────────────────────────────────────────────────
  const revs = sorted.map(h => h.revenue).filter((v): v is number => v != null)
  let revRule: Rule
  if (revs.length < 2) {
    revRule = {
      label: t.rules_r1_label,
      detail: isHe ? 'אין מספיק נתונים' : 'Not enough data',
      status: 'unavailable',
    }
  } else {
    const growing = revs.filter((v, i) => i > 0 && v > revs[i - 1]).length
    const total = revs.length - 1
    const passed = growing >= Math.ceil(total * 0.6)
    revRule = {
      label: t.rules_r1_label,
      detail: passed
        ? (isHe ? `הכנסות עלו ב-${growing} מתוך ${total} שנים` : `Revenue grew in ${growing} of ${total} years`)
        : (isHe ? `הכנסות עלו רק ב-${growing} מתוך ${total} שנים` : `Revenue only grew in ${growing} of ${total} years`),
      status: passed ? 'pass' : 'fail',
    }
  }

  // ── 2. Net income growth ───────────────────────────────────────────────────
  const nis = sorted.map(h => h.net_income).filter((v): v is number => v != null)
  let niRule: Rule
  if (nis.length < 2) {
    niRule = {
      label: t.rules_r2_label,
      detail: isHe ? 'אין מספיק נתונים' : 'Not enough data',
      status: 'unavailable',
    }
  } else {
    const growing = nis.filter((v, i) => i > 0 && v > nis[i - 1]).length
    const total = nis.length - 1
    const passed = growing >= Math.ceil(total * 0.6)
    niRule = {
      label: t.rules_r2_label,
      detail: passed
        ? (isHe ? `רווח נקי עלה ב-${growing} מתוך ${total} שנים` : `Net income grew in ${growing} of ${total} years`)
        : (isHe ? `רווח נקי עלה רק ב-${growing} מתוך ${total} שנים` : `Net income only grew in ${growing} of ${total} years`),
      status: passed ? 'pass' : 'fail',
    }
  }

  // ── 3. Net margin ≥ 30% ────────────────────────────────────────────────────
  const margins = sorted.slice(-3).map(h => h.net_margin).filter((v): v is number => v != null)
  let marginRule: Rule
  if (margins.length === 0) {
    marginRule = {
      label: t.rules_r3_label,
      detail: isHe ? 'אין נתוני שולי רווח' : 'No margin data',
      status: 'unavailable',
    }
  } else {
    const avg = margins.reduce((a, b) => a + b, 0) / margins.length
    const threshold = isHe ? '(סף: 30%)' : '(threshold: 30%)'
    marginRule = {
      label: t.rules_r3_label,
      detail: isHe
        ? `שולי רווח ממוצעים: ${avg.toFixed(1)}% ${threshold}`
        : `Avg net margin: ${avg.toFixed(1)}% ${threshold}`,
      status: avg >= 30 ? 'pass' : 'fail',
    }
  }

  // ── 4. Free cash flow positive ─────────────────────────────────────────────
  const fcfs = sorted.map(h => h.free_cash_flow).filter((v): v is number => v != null)
  let fcfRule: Rule
  if (fcfs.length === 0) {
    fcfRule = {
      label: t.rules_r4_label,
      detail: isHe ? 'אין נתוני תזרים' : 'No cash flow data',
      status: 'unavailable',
    }
  } else {
    const positive = fcfs.filter(v => v > 0).length
    const allPositive = positive === fcfs.length
    fcfRule = {
      label: t.rules_r4_label,
      detail: allPositive
        ? (isHe ? `תזרים חיובי בכל ${fcfs.length} השנים` : `Positive FCF in all ${fcfs.length} years`)
        : (isHe ? `תזרים חיובי ב-${positive} מתוך ${fcfs.length} שנים` : `Positive FCF in ${positive} of ${fcfs.length} years`),
      status: allPositive ? 'pass' : 'fail',
    }
  }

  // ── 5. Debt health ─────────────────────────────────────────────────────────
  const debt   = latest?.total_debt
  const cash   = latest?.cash
  const equity = latest?.stockholders_equity
  let debtRule: Rule

  if (debt == null && cash == null) {
    debtRule = {
      label: t.rules_r5_label,
      detail: isHe ? 'אין נתוני חוב' : 'No debt data',
      status: 'unavailable',
    }
  } else if (debt == null) {
    debtRule = {
      label: t.rules_r5_label,
      detail: isHe ? 'אין נתוני חוב — מזומן זמין' : 'No debt data — cash available',
      status: 'unavailable',
    }
  } else {
    let passed = false
    let detail = ''
    if (equity != null && equity > 0) {
      const de = debt / equity
      const cashOk = cash != null && cash >= debt * 0.5
      passed = de < 1.0 || cashOk
      detail = passed
        ? (isHe ? `יחס חוב/הון: ${de.toFixed(2)} — בריא` : `Debt/Equity: ${de.toFixed(2)} — healthy`)
        : (isHe ? `יחס חוב/הון: ${de.toFixed(2)} — גבוה` : `Debt/Equity: ${de.toFixed(2)} — high`)
    } else if (cash != null) {
      passed = cash >= debt
      detail = passed
        ? (isHe ? 'מזומן עולה על החוב' : 'Cash exceeds debt')
        : (isHe ? 'חוב עולה על המזומן' : 'Debt exceeds cash')
    } else {
      detail = isHe ? 'נתוני הון חסרים' : 'Missing equity data'
    }
    debtRule = { label: t.rules_r5_label, detail, status: passed ? 'pass' : 'fail' }
  }

  return [revRule, niRule, marginRule, fcfRule, debtRule]
}

function statusConfig(passed: number, unavailable: number, t: Translations): { label: string; color: string; bg: string } {
  const available = 5 - unavailable
  if (available === 0) return { label: t.rules_verdictNoData, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/30' }
  const ratio = passed / available
  if (passed === 5)  return { label: t.rules_verdictStrong,    color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' }
  if (ratio >= 0.75) return { label: t.rules_verdictWatchlist, color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/30' }
  if (ratio >= 0.5)  return { label: t.rules_verdictMixed,     color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' }
  return { label: t.rules_verdictAvoid, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' }
}

export default function BukraRules({ history }: { history: YearData[] }) {
  const { t, isHe } = useLanguage()

  if (!history || history.length === 0) return null

  const rules = evaluateRules(history, t, isHe)
  const passed = rules.filter(r => r.status === 'pass').length
  const unavailable = rules.filter(r => r.status === 'unavailable').length
  const status = statusConfig(passed, unavailable, t)

  const STATUS_ICON: Record<RuleStatus, string> = { pass: '✓', fail: '✗', unavailable: '—' }
  const STATUS_COLOR: Record<RuleStatus, string> = {
    pass: 'bg-green-500/20 text-green-400',
    fail: 'bg-red-500/20 text-red-400',
    unavailable: 'bg-gray-700 text-gray-500',
  }
  const LABEL_COLOR: Record<RuleStatus, string> = {
    pass: 'text-white',
    fail: 'text-gray-400',
    unavailable: 'text-gray-500',
  }

  const statusText: Record<RuleStatus, string> = {
    pass: t.rules_statusPass,
    fail: t.rules_statusFail,
    unavailable: t.rules_statusUnavail,
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-white font-bold text-lg">{t.rules_title}</h2>
          <p className="text-gray-400 text-xs mt-0.5">{t.rules_subtitle}</p>
        </div>
        <div className="text-center">
          <div className="text-3xl font-black text-white">
            {passed}
            <span className="text-gray-500 text-lg font-normal">/{5 - unavailable}</span>
          </div>
          <div className="text-gray-400 text-xs">{t.rules_passedOf}</div>
        </div>
      </div>

      {/* Rules list */}
      <div className="space-y-3 mb-5">
        {rules.map((rule) => (
          <div key={rule.label} className="flex items-start gap-3">
            <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${STATUS_COLOR[rule.status]}`}>
              {STATUS_ICON[rule.status]}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${LABEL_COLOR[rule.status]}`}>{rule.label}</div>
              <div className="text-gray-500 text-xs mt-0.5">{rule.detail}</div>
            </div>
            <div className={`text-xs font-medium shrink-0 ${
              rule.status === 'pass' ? 'text-green-400' :
              rule.status === 'fail' ? 'text-red-400' : 'text-gray-600'
            }`}>
              {statusText[rule.status]}
            </div>
          </div>
        ))}
      </div>

      {/* Status badge */}
      <div className={`rounded-xl border px-4 py-3 text-center ${status.bg}`}>
        <div className={`font-bold text-sm ${status.color}`}>
          {passed}/{5 - unavailable} {t.rules_passedOf}
          {unavailable > 0 && (
            <span className="text-gray-500 font-normal text-xs mr-1">
              ({unavailable} {t.rules_notAvailSuffix})
            </span>
          )}
        </div>
        <div className={`text-xs mt-0.5 ${status.color} opacity-80`}>{status.label}</div>
      </div>
    </div>
  )
}
