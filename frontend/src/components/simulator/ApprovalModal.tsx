/**
 * Approval confirmation panel — the one place a simulated action becomes
 * real (in the virtual sense). The checkbox is never preselected and
 * approval is disabled until it is checked, matching the required flow
 * exactly: review reason, risks, amount, impact, then explicit consent.
 */
import { useState } from 'react'
import { useLanguage } from '../../i18n/index'
import { GOLD, SERIF } from '../../estate/EstateShell'
import { SimBanner } from '../../simulator/SimulatorShell'
import { approveRecommendation, rejectRecommendation } from '../../api/simulatorClient'
import { recLabel } from '../../simulator/labels'
import { resolveErrorMessage } from '../../simulator/ErrorState'
import type { Recommendation } from '../../types/simulator'

function fmtPct(v: number) { return `${(v * 100).toFixed(1)}%` }

export default function ApprovalModal({ rec, onClose, onDone }: {
  rec: Recommendation; onClose: () => void; onDone: () => void
}) {
  const { t, isHe } = useLanguage()
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<'approved' | 'rejected' | null>(null)
  const [note, setNote] = useState('')

  const impact = rec.expectedPortfolioImpact

  async function handleApprove() {
    setBusy(true); setError('')
    try {
      await approveRecommendation(rec.id, confirmed)
      setResult('approved')
      setTimeout(() => { onDone(); onClose() }, 1600)
    } catch (e) {
      setError(resolveErrorMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  async function handleReject() {
    setBusy(true); setError('')
    try {
      await rejectRecommendation(rec.id, note || undefined)
      setResult('rejected')
      setTimeout(() => { onDone(); onClose() }, 1000)
    } catch (e) {
      setError(resolveErrorMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-stone-800 bg-[#12100e] p-7">
        <div className="mb-4"><SimBanner compact /></div>

        {result ? (
          <div className="text-center py-8">
            <div className="text-lg text-stone-100 mb-2" style={{ fontFamily: SERIF }}>
              {result === 'approved' ? t.sim_approvalSuccess : t.sim_statusRejected}
            </div>
            <p className="text-stone-500 text-sm">{t.sim_noRealTrade}</p>
          </div>
        ) : (
          <>
            <h2 className="text-xl text-stone-100 font-light mb-1" style={{ fontFamily: SERIF }}>{t.sim_approvalTitle}</h2>
            <p className="text-stone-400 text-sm mb-5">{rec.ticker} — {recLabel(t, rec.recommendationType)}</p>

            <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
              <Field label={t.sim_proposedAmount} value={rec.proposedAmount != null ? Math.abs(rec.proposedAmount).toLocaleString() : '—'} />
              <Field label={t.sim_proposedQuantity} value={rec.proposedQuantity != null ? Math.abs(rec.proposedQuantity).toFixed(4) : '—'} />
              <Field label={t.sim_currentWeight} value={fmtPct(impact.currentWeight)} />
              <Field label={t.sim_targetWeight} value={fmtPct(impact.proposedWeight)} />
              <Field label={t.sim_estimatedFee} value="~0.1%" />
              <Field label={t.sim_estimatedFx} value="—" />
            </div>

            <div className="mb-4">
              <div className="text-emerald-400 text-xs font-semibold mb-1.5">{t.sim_mainReasons}</div>
              <ul className="space-y-1">
                {rec.supportingFactors.slice(0, 4).map((f, i) => <li key={i} className="text-stone-300 text-sm">· {f}</li>)}
              </ul>
            </div>
            <div className="mb-5">
              <div className="text-orange-400 text-xs font-semibold mb-1.5">{t.sim_mainRisks}</div>
              <ul className="space-y-1">
                {rec.riskFactors.slice(0, 4).map((f, i) => <li key={i} className="text-stone-300 text-sm">· {f}</li>)}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6 text-xs text-stone-500 border-t border-stone-800/60 pt-4">
              <div>{t.sim_cashImpact}: <span dir="ltr" className="text-stone-300">{impact.cashAfterExecution.toLocaleString()}</span></div>
              <div>{t.sim_diversificationImpact}: <span className="text-stone-300">{impact.holdingsCountAfter}</span></div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer mb-5">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                className="mt-1 accent-[#c9a962]" />
              <span className="text-stone-300 text-sm leading-relaxed">{t.sim_confirmCheckbox}</span>
            </label>

            <input value={note} onChange={e => setNote(e.target.value)} placeholder={t.sim_rejectNotePlaceholder}
              className="w-full bg-stone-900/50 border border-stone-800 rounded-lg px-3 py-2 text-sm text-stone-200
                placeholder-stone-700 mb-4 focus:outline-none focus:border-stone-700" />

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            <div className="flex gap-3">
              <button onClick={handleReject} disabled={busy}
                className="flex-1 rounded-full border border-stone-700 py-2.5 text-sm text-stone-300 hover:border-red-500/40 transition disabled:opacity-50">
                {t.sim_reject}
              </button>
              <button onClick={handleApprove} disabled={busy || !confirmed}
                className="flex-1 rounded-full py-2.5 text-sm font-medium disabled:opacity-30 transition"
                style={{ background: GOLD, color: '#1c1410' }}>
                {busy ? t.sim_generating : t.sim_approveSimulated}
              </button>
            </div>
            <button onClick={onClose} disabled={busy}
              className="w-full mt-3 text-center text-stone-600 hover:text-stone-400 text-xs">
              {t.sim_cancel}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-stone-600 text-[11px] uppercase tracking-wide">{label}</div>
      <div className="text-stone-200" dir="ltr">{value}</div>
    </div>
  )
}
