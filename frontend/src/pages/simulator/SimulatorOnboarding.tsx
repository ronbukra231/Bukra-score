/**
 * Onboarding wizard — currency, capital, risk profile, benchmark, disclaimer,
 * create. No simulated trade happens here; creating the portfolio only
 * seeds virtual cash. Recommendations (if any) are generated afterward and
 * each requires individual review — there is no "approve all" here or ever.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../i18n/index'
import { GOLD, SERIF } from '../../estate/EstateShell'
import { createPortfolio, generateRecommendations } from '../../api/simulatorClient'
import type { Currency, RiskProfile } from '../../types/simulator'

const RISK_PROFILES: RiskProfile[] = ['conservative', 'balanced', 'growth', 'aggressive']
const CURRENCIES: Currency[] = ['USD', 'ILS']
const CAPITAL_PRESETS = [10000, 25000, 50000, 100000]

export default function SimulatorOnboarding({ onCreated }: { onCreated: () => void }) {
  const { t, isHe } = useLanguage()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [currency, setCurrency] = useState<Currency>('USD')
  const [capital, setCapital] = useState(10000)
  const [risk, setRisk] = useState<RiskProfile>('balanced')
  const [benchmark, setBenchmark] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const steps = [t.sim_stepCurrency, t.sim_stepCapital, t.sim_stepRisk, t.sim_stepBenchmark, t.sim_stepDisclaimer, t.sim_stepReview]

  async function handleCreate() {
    setBusy(true)
    setError('')
    try {
      await createPortfolio({
        name: t.sim_dashboardTitle, baseCurrency: currency, initialCapital: capital,
        riskProfile: risk, benchmarkSymbol: benchmark || null,
      })
      try { await generateRecommendations() } catch { /* non-fatal — dashboard can trigger later */ }
      onCreated()
      navigate('/simulator')
    } catch (e: any) {
      setError(e.message || t.sim_errorGeneric)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0c0a09] text-stone-300 antialiased flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl text-center text-stone-100 font-light tracking-wide mb-2" style={{ fontFamily: SERIF }}>
          {t.sim_onboardTitle}
        </h1>
        <p className="text-center text-stone-500 text-sm mb-10 leading-relaxed">{t.sim_onboardIntro}</p>

        <div className="flex items-center justify-center gap-2 mb-10">
          {steps.map((s, i) => (
            <div key={s} className={`h-1 w-8 rounded-full transition-colors duration-500 ${i <= step ? '' : 'bg-stone-800'}`}
              style={i <= step ? { background: GOLD } : undefined} />
          ))}
        </div>

        <div className="rounded-2xl border border-stone-800/60 bg-stone-950/40 p-8 min-h-[280px]">
          {step === 0 && (
            <div>
              <h2 className="text-stone-200 text-sm uppercase tracking-wide mb-5">{t.sim_baseCurrency}</h2>
              <div className="grid grid-cols-2 gap-4">
                {CURRENCIES.map(c => (
                  <button key={c} onClick={() => setCurrency(c)}
                    className={`rounded-xl border py-6 text-lg transition-colors duration-300
                      ${currency === c ? 'border-[#c9a962] text-stone-100' : 'border-stone-800 text-stone-500 hover:border-stone-700'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-stone-200 text-sm uppercase tracking-wide mb-2">{t.sim_startingCapital}</h2>
              <p className="text-amber-400/80 text-xs mb-5">{t.sim_virtualMoneyLabel}</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {CAPITAL_PRESETS.map(v => (
                  <button key={v} onClick={() => setCapital(v)}
                    className={`rounded-xl border py-4 text-base transition-colors duration-300
                      ${capital === v ? 'border-[#c9a962] text-stone-100' : 'border-stone-800 text-stone-500 hover:border-stone-700'}`}>
                    {v.toLocaleString()} {currency}
                  </button>
                ))}
              </div>
              <input type="number" min={1} value={capital}
                onChange={e => setCapital(Number(e.target.value))}
                className="w-full bg-stone-900/60 border border-stone-800 rounded-xl px-4 py-3 text-stone-100
                  focus:outline-none focus:border-[#c9a962]/50" dir="ltr" />
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-stone-200 text-sm uppercase tracking-wide mb-2">{t.sim_riskProfileLabel}</h2>
              <p className="text-stone-600 text-xs mb-5 leading-relaxed">{t.sim_riskDisclaimer}</p>
              <div className="space-y-2.5">
                {RISK_PROFILES.map(r => (
                  <button key={r} onClick={() => setRisk(r)}
                    className={`w-full text-start rounded-xl border px-5 py-3.5 transition-colors duration-300
                      ${risk === r ? 'border-[#c9a962] text-stone-100' : 'border-stone-800 text-stone-500 hover:border-stone-700'}`}>
                    {t[`sim_risk${r.charAt(0).toUpperCase()}${r.slice(1)}` as keyof typeof t] as string}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-stone-200 text-sm uppercase tracking-wide mb-5">{t.sim_benchmarkLabel}</h2>
              <input value={benchmark} onChange={e => setBenchmark(e.target.value.toUpperCase())}
                placeholder={currency === 'ILS' ? 'TA35.TA' : 'SPY'}
                className="w-full bg-stone-900/60 border border-stone-800 rounded-xl px-4 py-3 text-stone-100
                  placeholder-stone-700 focus:outline-none focus:border-[#c9a962]/50" dir="ltr" />
              <p className="mt-3 text-stone-600 text-xs">
                {isHe ? 'ניתן להשאיר ריק לברירת מחדל.' : 'Leave blank for the default.'}
              </p>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-stone-200 text-sm uppercase tracking-wide mb-4">{t.sim_stepDisclaimer}</h2>
              <p className="text-stone-400 text-sm leading-relaxed mb-6">{t.sim_disclaimerFull}</p>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  className="mt-1 accent-[#c9a962]" />
                <span className="text-stone-300 text-sm leading-relaxed">{t.sim_confirmCheckbox}</span>
              </label>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="text-stone-200 text-sm uppercase tracking-wide mb-5">{t.sim_stepReview}</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between"><dt className="text-stone-500">{t.sim_baseCurrency}</dt><dd className="text-stone-200">{currency}</dd></div>
                <div className="flex justify-between"><dt className="text-stone-500">{t.sim_startingCapital}</dt><dd className="text-stone-200" dir="ltr">{capital.toLocaleString()} {currency}</dd></div>
                <div className="flex justify-between"><dt className="text-stone-500">{t.sim_riskProfileLabel}</dt><dd className="text-stone-200">{t[`sim_risk${risk.charAt(0).toUpperCase()}${risk.slice(1)}` as keyof typeof t] as string}</dd></div>
                <div className="flex justify-between"><dt className="text-stone-500">{t.sim_benchmarkLabel}</dt><dd className="text-stone-200">{benchmark || (isHe ? 'ברירת מחדל' : 'default')}</dd></div>
              </dl>
              {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
            className="text-stone-500 hover:text-stone-300 text-sm disabled:opacity-0 transition">
            {isHe ? 'הקודם' : 'Back'}
          </button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              disabled={step === 4 && !agreed}
              className="rounded-full px-6 py-2.5 text-sm font-medium transition-colors duration-300 disabled:opacity-30"
              style={{ background: GOLD, color: '#1c1410' }}>
              {isHe ? 'הבא' : 'Next'}
            </button>
          ) : (
            <button onClick={handleCreate} disabled={busy || !agreed}
              className="rounded-full px-6 py-2.5 text-sm font-medium transition-colors duration-300 disabled:opacity-40"
              style={{ background: GOLD, color: '#1c1410' }}>
              {busy ? t.sim_creating : t.sim_createPortfolio}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
