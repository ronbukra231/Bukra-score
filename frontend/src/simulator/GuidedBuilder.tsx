/**
 * Guided Portfolio Builder — the premium "elite investment committee"
 * onboarding experience. One recommendation at a time. Bukra never buys or
 * sells on its own; the user always makes the final call. Every accepted
 * investment recalculates the next recommendation from the portfolio's new
 * state (holdings, cash, sector exposure, risk profile) — nothing here is a
 * preloaded list.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/index'
import { GOLD, SERIF } from '../estate/EstateShell'
import { SimBanner } from './SimulatorShell'
import {
  getNextBuilderRecommendation, approveRecommendation, rejectRecommendation, getDashboard,
  type BuilderDoneReason,
} from '../api/simulatorClient'
import { resolveErrorMessage } from './ErrorState'
import type { Recommendation } from '../types/simulator'
import type { Translations } from '../i18n/types'

type Phase = 'loading' | 'card' | 'done' | 'error'

function fmtMoney(v: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
  } catch { return v.toLocaleString() }
}

export default function GuidedBuilder() {
  const { t, isHe } = useLanguage()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('loading')
  const [rec, setRec] = useState<Recommendation | null>(null)
  const [prevRec, setPrevRec] = useState<Recommendation | null>(null)
  const [excluded, setExcluded] = useState<string[]>([])
  const [investing, setInvesting] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [invested, setInvested] = useState(0)
  const [currency, setCurrency] = useState('USD')
  const [doneReason, setDoneReason] = useState<BuilderDoneReason>('no_opportunities')

  async function fetchNext(excludeList: string[], previous: Recommendation | null) {
    setPhase('loading')
    setShowAnalysis(false)
    try {
      const next = await getNextBuilderRecommendation(excludeList)
      if ('done' in next) {
        setRec(null)
        setPrevRec(null)
        setDoneReason(next.reason ?? 'no_opportunities')
        setPhase('done')
      } else {
        setRec(next)
        setPrevRec(previous)
        setPhase('card')
      }
    } catch (e) {
      setError(e)
      setPhase('error')
    }
  }

  useEffect(() => {
    getDashboard().then(d => setCurrency(d.portfolio.baseCurrency)).catch(() => {})
    fetchNext([], null)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInvest() {
    if (!rec) return
    setInvesting(true)
    try {
      await approveRecommendation(rec.id, true)
      setInvested(n => n + 1)
      const nextExcluded = [...excluded, rec.ticker]
      setExcluded(nextExcluded)
      await fetchNext(nextExcluded, null)
    } catch (e) {
      setError(e)
      setPhase('error')
    } finally {
      setInvesting(false)
    }
  }

  async function handleSuggestAnother() {
    if (!rec) return
    const current = rec
    try { await rejectRecommendation(rec.id) } catch { /* non-fatal — still move on */ }
    const nextExcluded = [...excluded, current.ticker]
    setExcluded(nextExcluded)
    await fetchNext(nextExcluded, current)
  }

  function handleSkip() {
    navigate('/simulator')
  }

  return (
    <div className="min-h-screen bg-[#0c0a09] text-stone-300 antialiased px-6 py-12 flex flex-col items-center">
      <div className="w-full max-w-2xl mb-8"><SimBanner /></div>

      {phase === 'error' && error != null && (
        <div className="w-full max-w-2xl">
          <p className="text-red-400 text-sm mb-4">{resolveErrorMessage(error, t)}</p>
          <button onClick={handleSkip} className="text-sm" style={{ color: GOLD }}>
            {t.sim_builderGoToPortfolio} →
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="w-full max-w-2xl text-center py-24">
          <div className="inline-block h-8 w-8 rounded-full border-2 border-stone-700 animate-spin"
            style={{ borderTopColor: GOLD }} />
          <p className="text-stone-600 text-sm mt-6">{t.sim_loading}</p>
        </div>
      )}

      {phase === 'done' && (
        <div className="w-full max-w-2xl text-center py-16">
          <h1 className="text-3xl text-stone-100 font-light mb-4" style={{ fontFamily: SERIF }}>
            {doneReason === 'temporary_data_unavailable' ? t.sim_builderTemporaryDataIssue
              : invested > 0 ? t.sim_builderDoneTitle : t.sim_builderNoMoreOpportunities}
          </h1>
          <p className="text-stone-500 text-sm leading-relaxed mb-10 max-w-md mx-auto">
            {doneReason === 'temporary_data_unavailable' ? t.sim_builderTemporaryDataIssueSub
              : invested > 0 ? t.sim_builderDoneSub : t.sim_builderNoMoreOpportunitiesSub}
          </p>
          <button onClick={handleSkip}
            className="rounded-full px-8 py-3 text-sm font-medium"
            style={{ background: GOLD, color: '#1c1410' }}>
            {t.sim_builderGoToPortfolio}
          </button>
        </div>
      )}

      {phase === 'card' && rec && (
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl text-stone-100 font-light mb-3" style={{ fontFamily: SERIF }}>
              {t.sim_builderTitle}
            </h1>
            <p className="text-stone-500 text-sm max-w-md mx-auto leading-relaxed">{t.sim_builderSubtitle}</p>
          </div>

          {prevRec && (
            <div className="mb-6 rounded-xl border border-stone-800/60 bg-stone-950/40 px-5 py-3 text-sm text-stone-400">
              {t.sim_builderDifferenceIntro} {diffExplanation(prevRec, rec, t, isHe)}
            </div>
          )}

          <div key={rec.id} className="rounded-2xl border border-[#c9a962]/25 bg-gradient-to-b from-stone-950/60 to-stone-950/20 p-8 shadow-[0_0_60px_-15px_rgba(201,169,98,0.15)] animate-[fadein_0.4s_ease]">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-3xl text-stone-100" style={{ fontFamily: SERIF }}>{rec.ticker}</div>
                <div className="text-xs uppercase tracking-[0.2em] mt-1" style={{ color: GOLD }}>
                  {convictionLabel(rec, t)}
                </div>
              </div>
              {typeof rec.metadata?.opportunityScore === 'number' && (
                <div className="text-end">
                  <div className="text-2xl text-stone-100" style={{ fontFamily: SERIF }}>
                    {Math.round(rec.metadata.opportunityScore)}
                  </div>
                  <div className="text-[10px] text-stone-600 uppercase tracking-wide">{t.sim_builderOpportunityScore}</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-7">
              <Stat label={t.sim_builderRecommendedAllocation} value={`${(rec.targetWeight * 100).toFixed(1)}%`} />
              <Stat label={t.sim_builderVirtualInvestment} value={fmtMoney(rec.proposedAmount || 0, currency)} />
              <Stat label={t.sim_builderRemainingCash}
                value={fmtMoney(rec.expectedPortfolioImpact.cashAfterExecution, currency)} />
            </div>

            <div className="mb-5">
              <div className="text-emerald-400 text-xs font-semibold mb-2 uppercase tracking-wide">
                {t.sim_builderWhyRecommend}
              </div>
              <ul className="space-y-1.5">
                {rec.supportingFactors.map((f, i) => (
                  <li key={i} className="text-stone-300 text-sm leading-relaxed">• {f}</li>
                ))}
              </ul>
            </div>

            <div className="mb-2">
              <div className="text-orange-400 text-xs font-semibold mb-2 uppercase tracking-wide">
                {t.sim_builderRisks}
              </div>
              <ul className="space-y-1.5">
                {rec.riskFactors.map((f, i) => (
                  <li key={i} className="text-stone-300 text-sm leading-relaxed">• {f}</li>
                ))}
              </ul>
            </div>

            {showAnalysis && (
              <div className="mt-6 pt-6 border-t border-stone-800/60 grid grid-cols-2 gap-3 text-sm">
                <Row label="Bukra Score" value={String(rec.bukraScoreSnapshot ?? '—')} />
                <Row label={isHe ? 'ציון תמחור' : 'Valuation Score'} value={String(rec.valuationScoreSnapshot ?? '—')} />
                <Row label={isHe ? 'סיכון תמחור ספקולטיבי' : 'Bubble Risk'} value={String(rec.bubbleRiskSnapshot ?? '—')} />
                <Row label={isHe ? 'רמת ביטחון' : 'Confidence'} value={rec.confidenceSnapshot ?? '—'} />
                <Row label={isHe ? 'מחיר נוכחי' : 'Current price'} value={rec.currentPriceSnapshot != null ? rec.currentPriceSnapshot.toFixed(2) : '—'} />
                <Row label={isHe ? 'טווח שווי הוגן' : 'Fair value range'}
                  value={rec.fairValueSnapshot?.basePerShare != null ? rec.fairValueSnapshot.basePerShare.toFixed(2) : '—'} />
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button onClick={handleInvest} disabled={investing}
              className="rounded-full py-3.5 text-sm font-medium transition disabled:opacity-50"
              style={{ background: GOLD, color: '#1c1410' }}>
              {investing ? t.sim_builderInvesting : t.sim_builderInvest}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleSuggestAnother} disabled={investing}
                className="rounded-full border border-stone-700 py-2.5 text-sm text-stone-300 hover:border-[#c9a962]/50 transition disabled:opacity-50">
                {t.sim_builderSuggestAnother}
              </button>
              <button onClick={() => setShowAnalysis(v => !v)} disabled={investing}
                className="rounded-full border border-stone-700 py-2.5 text-sm text-stone-300 hover:border-[#c9a962]/50 transition disabled:opacity-50">
                {showAnalysis ? t.sim_builderHideAnalysis : t.sim_builderShowAnalysis}
              </button>
            </div>
            <button onClick={handleSkip} disabled={investing}
              className="text-center text-stone-600 hover:text-stone-400 text-xs mt-1">
              {t.sim_builderSkipForNow}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-900/50 py-3 px-2 text-center">
      <div className="text-stone-100 text-base" style={{ fontFamily: SERIF }} dir="ltr">{value}</div>
      <div className="text-[10px] text-stone-600 uppercase tracking-wide mt-1">{label}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-stone-600">{label}</span>
      <span className="text-stone-300" dir="ltr">{value}</span>
    </div>
  )
}

function convictionLabel(rec: Recommendation, t: Translations) {
  const score = rec.metadata?.opportunityScore
  if (typeof score !== 'number') return t.sim_builderConvictionStandard
  if (score >= 92) return t.sim_builderConvictionVeryHigh
  if (score >= 85) return t.sim_builderConvictionExceptional
  return t.sim_builderConvictionStandard
}

function diffExplanation(prev: Recommendation, next: Recommendation, _t: Translations, isHe: boolean): string {
  const dScore = (next.bukraScoreSnapshot ?? 0) - (prev.bukraScoreSnapshot ?? 0)
  const dVal = (next.valuationScoreSnapshot ?? 0) - (prev.valuationScoreSnapshot ?? 0)
  const dBubble = (next.bubbleRiskSnapshot ?? 0) - (prev.bubbleRiskSnapshot ?? 0)
  const parts: string[] = []
  if (Math.abs(dScore) >= 5) {
    parts.push(dScore > 0
      ? (isHe ? 'איכות עסקית גבוהה יותר' : 'stronger business quality')
      : (isHe ? 'איכות עסקית מעט נמוכה יותר' : 'a slightly lower business quality'))
  }
  if (Math.abs(dVal) >= 5) {
    parts.push(dVal > 0
      ? (isHe ? 'תמחור אטרקטיבי יותר' : 'a more attractive valuation')
      : (isHe ? 'תמחור פחות אטרקטיבי' : 'a less attractive valuation'))
  }
  if (Math.abs(dBubble) >= 5) {
    parts.push(dBubble < 0
      ? (isHe ? 'סיכון תמחור ספקולטיבי נמוך יותר' : 'lower speculative valuation risk')
      : (isHe ? 'סיכון תמחור ספקולטיבי גבוה יותר' : 'higher speculative valuation risk'))
  }
  if (parts.length === 0) {
    return isHe ? 'הזדמנות שונה, בעלת פרופיל דומה.' : 'A different opportunity with a broadly similar profile.'
  }
  return parts.join(', ') + '.'
}
