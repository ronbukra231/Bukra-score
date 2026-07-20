/**
 * Valuation & Pricing — the Bukra Valuation Engine section of the company page.
 *
 * Renders the API's structured valuation analysis: four headline cards,
 * the fair value range visual, what the market is pricing in (reverse DCF),
 * scenario analysis, "why this score", and the Index conclusion.
 * All dynamic sentences (conclusion, factors, notes) arrive from the backend
 * already in the active language; this component only renders labels.
 */
import { useState, type ReactNode } from 'react'
import { useLanguage } from '../i18n/index'
import type { Translations } from '../i18n/types'
import type { ValuationData, ValuationScenario } from '../types/valuation'

interface Props {
  data: ValuationData | null | undefined
  bukraScore?: number | null
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtMoney(v: number | null | undefined, currency: string, compact = false): string {
  if (v == null || !isFinite(v)) return '—'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 2,
    }).format(v)
  } catch {
    return v.toLocaleString()
  }
}

function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || !isFinite(v)) return '—'
  return `${(v * 100).toFixed(digits)}%`
}

/** Numbers keep LTR flow inside RTL text. */
function Num({ children }: { children: ReactNode }) {
  return <span dir="ltr" className="tabular-nums">{children}</span>
}

function scoreColor(s: number | null | undefined, invert = false) {
  if (s == null) return 'text-gray-500'
  const v = invert ? 100 - s : s
  if (v >= 65) return 'text-green-400'
  if (v >= 50) return 'text-amber-400'
  if (v >= 35) return 'text-orange-400'
  return 'text-red-400'
}

function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="relative group/tip inline-flex" tabIndex={0} aria-label={text}>
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 z-30
        rounded-xl bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-gray-300 leading-relaxed
        opacity-0 group-hover/tip:opacity-100 group-focus/tip:opacity-100 transition-opacity duration-200">
        {text}
      </span>
    </span>
  )
}

// ── Headline card ─────────────────────────────────────────────────────────────

function HeadCard({ title, tooltip, score, label, invert = false, estimateNote }: {
  title: string; tooltip: string; score: number | null | undefined
  label: string; invert?: boolean; estimateNote: string
}) {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <div className="flex items-center gap-1.5 mb-3">
        <h3 className="text-gray-300 text-sm font-semibold">{title}</h3>
        <Tooltip text={tooltip}>
          <span className="text-gray-600 hover:text-gray-400 cursor-help text-xs border border-gray-700 rounded-full w-4 h-4 inline-flex items-center justify-center">?</span>
        </Tooltip>
      </div>
      <div className={`text-4xl font-black ${scoreColor(score, invert)}`}>
        {score ?? '—'}<span className="text-gray-600 text-base font-normal">/100</span>
      </div>
      <div className="mt-1.5 text-sm text-gray-400">{label}</div>
      <div className="mt-2 text-[11px] text-gray-600">{estimateNote}</div>
    </div>
  )
}

// ── Fair value range visual ───────────────────────────────────────────────────

function RangeVisual({ data, t, isHe }: { data: ValuationData; t: Translations; isHe: boolean }) {
  const r = data.fairValueRange
  if (!r) return null
  const hasPerShare = r.bearPerShare != null && r.basePerShare != null && r.bullPerShare != null
  const bear = hasPerShare ? r.bearPerShare! : r.bearMarketCap
  const base = hasPerShare ? r.basePerShare! : r.baseMarketCap
  const bull = hasPerShare ? r.bullPerShare! : r.bullMarketCap
  const current = hasPerShare ? data.currentPrice : data.currentMarketCap
  if (bear == null || base == null || bull == null || current == null) return null

  // Scale spans the range plus 25% padding each side; the price marker is
  // clamped to the scale edges with an explicit out-of-range note, so
  // proportions are never misleading.
  const span = Math.max(bull - bear, 1e-9)
  const lo = bear - span * 0.25
  const hi = bull + span * 0.25
  const pos = (v: number) => Math.min(97, Math.max(3, ((v - lo) / (hi - lo)) * 100))
  const outside = current < bear ? 'below' : current > bull ? 'above' : 'inside'
  const fmt = (v: number) => hasPerShare ? fmtMoney(v, data.currency) : fmtMoney(v, data.currency, true)

  const mos = data.marginOfSafety
  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <h3 className="text-white font-semibold text-sm mb-6 uppercase tracking-wide">{t.val_rangeTitle}</h3>
      <div dir="ltr" className="relative h-24 select-none">
        {/* Track */}
        <div className="absolute top-8 inset-x-0 h-1.5 bg-gray-800 rounded-full" />
        {/* Bear→Bull band */}
        <div className="absolute top-8 h-1.5 bg-gradient-to-r from-red-500/40 via-amber-500/40 to-green-500/40 rounded-full"
          style={{ left: `${pos(bear)}%`, width: `${pos(bull) - pos(bear)}%` }} />
        {[{ v: bear, lbl: t.val_bear, c: 'text-red-400' },
          { v: base, lbl: t.val_base, c: 'text-amber-300' },
          { v: bull, lbl: t.val_bull, c: 'text-green-400' }].map(m => (
          <div key={m.lbl} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${pos(m.v)}%` }}>
            <div className={`text-[11px] ${m.c}`}>{m.lbl}</div>
            <div className="text-xs text-gray-300 tabular-nums">{fmt(m.v)}</div>
            <div className="mx-auto mt-1 w-px h-4 bg-gray-600" />
          </div>
        ))}
        {/* Current price marker */}
        <div className="absolute top-11 -translate-x-1/2 text-center" style={{ left: `${pos(current)}%` }}>
          <div className="mx-auto w-0.5 h-5 bg-white rounded" />
          <div className="mt-1 text-[11px] text-white whitespace-nowrap">{t.val_currentPrice}</div>
          <div className="text-xs text-white font-semibold tabular-nums">{fmt(current)}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="text-gray-400">
          {outside === 'below' ? t.val_belowRange : outside === 'above' ? t.val_aboveRange : t.val_insideRange}
        </span>
        {/* Positive MoS is relative to the base value (spec formula); downside
            is shown relative to the CURRENT price — a stock cannot fall >100%. */}
        {mos != null && mos >= 0 && (
          <span className="text-green-400">
            {t.val_marginOfSafety}: <Num>{mos.toFixed(0)}%</Num>
          </span>
        )}
        {mos != null && mos < 0 && data.estimatedUpsideDownside != null && (
          <span className="text-red-400">
            {t.val_estimatedDownside}: <Num>{Math.abs(data.estimatedUpsideDownside).toFixed(0)}%</Num>
          </span>
        )}
      </div>
    </div>
  )
}

// ── Priced-in (reverse DCF) ───────────────────────────────────────────────────

function PricedIn({ data, t }: { data: ValuationData; t: Translations }) {
  const rd = data.reverseDcf
  if (!rd) return null
  const rows: [string, string][] = [
    [t.val_impliedGrowth, fmtPct(rd.impliedFcfGrowth)],
    [t.val_historicalGrowth, fmtPct(rd.historicalGrowth)],
    [t.val_impliedMargin, fmtPct(rd.impliedFcfMargin)],
    [t.val_historicalMargin, fmtPct(rd.historicalFcfMargin)],
    [t.val_requiredRevenue, fmtMoney(rd.requiredRevenueAtHorizon, data.currency, true)],
    [t.val_requiredFcf, fmtMoney(rd.requiredFcfAtHorizon, data.currency, true)],
    [t.val_discountRate, fmtPct(rd.discountRate)],
    [t.val_terminalGrowth, fmtPct(rd.terminalGrowth)],
    [t.val_terminalDependency, rd.terminalValuePct != null ? `${rd.terminalValuePct.toFixed(0)}%` : '—'],
    [t.val_forecastYears, String(rd.forecastYears)],
  ]
  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <h3 className="text-white font-semibold text-sm uppercase tracking-wide">{t.val_pricedInTitle}</h3>
      <p className="mt-1 mb-5 text-gray-500 text-xs">{t.val_pricedInSubtitle}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-gray-400">{label}</span>
            <span className="text-gray-200 font-medium"><Num>{value}</Num></span>
          </div>
        ))}
      </div>
      {rd.solverCapped && <p className="mt-4 text-xs text-orange-400/90">{t.val_solverCapped}</p>}
      {rd.fcfProxyUsed && <p className="mt-2 text-xs text-gray-500">{t.val_fcfProxyNote}</p>}
    </div>
  )
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

function ScenarioCard({ name, label, sc, data, t, color }: {
  name: string; label: string; sc: ValuationScenario; data: ValuationData
  t: Translations; color: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 flex flex-col">
      <div className={`text-xs font-bold uppercase tracking-wide ${color}`}>{label}</div>
      {sc.available ? (
        <>
          <div className="mt-3 text-2xl font-bold text-white tabular-nums" dir="ltr">
            {sc.fairValuePerShare != null
              ? fmtMoney(sc.fairValuePerShare, data.currency)
              : fmtMoney(sc.fairEquityValue, data.currency, true)}
          </div>
          <div className="text-[11px] text-gray-500">
            {sc.fairValuePerShare != null ? t.val_fairValuePerShare : t.val_fairMarketCap}
          </div>
          {sc.upsideDownsidePct != null && (
            <div className={`mt-1.5 text-sm ${sc.upsideDownsidePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              <Num>{sc.upsideDownsidePct > 0 ? '+' : ''}{sc.upsideDownsidePct.toFixed(0)}%</Num>
              <span className="text-gray-500 text-xs"> {t.val_upsideDownside}</span>
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 text-gray-600 text-sm">—</div>
      )}
      <button onClick={() => setOpen(v => !v)}
        className="mt-4 text-start text-[11px] text-gray-500 hover:text-gray-300 transition"
        aria-expanded={open}>
        {t.val_assumptions} {open ? '▴' : '▾'}
      </button>
      {open && (
        <dl className="mt-2 space-y-1.5 border-t border-gray-800 pt-3">
          {Object.entries(sc.assumptions).map(([k, v]) => v != null && (
            <div key={k} className="flex justify-between gap-3 text-[11px]">
              <dt className="text-gray-500">{k}</dt>
              <dd className="text-gray-300"><Num>{typeof v === 'number' && Math.abs(v) < 1 ? fmtPct(v) : typeof v === 'number' ? fmtMoney(v, data.currency, true) : String(v)}</Num></dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

// ── Main section ──────────────────────────────────────────────────────────────

export default function ValuationSection({ data, bukraScore }: Props) {
  const { t, isHe } = useLanguage()
  const [showWhy, setShowWhy] = useState(false)

  if (!data) return null

  const bandLabel = (key: string | null | undefined, prefix: string): string => {
    if (!key) return '—'
    const full = `${prefix}${key}` as keyof Translations
    return (t[full] as string) ?? key
  }

  // Insufficient-data state — structured, honest, no fabricated range
  if (!data.available) {
    return (
      <section className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-lg font-bold text-white">{t.val_sectionTitle}</h2>
        <div className="mt-4 rounded-xl border border-gray-800 bg-gray-950/60 p-5">
          <div className="text-gray-300 text-sm font-medium">{t.val_insufficientTitle}</div>
          {data.insufficientReason && (
            <p className="mt-2 text-gray-500 text-sm leading-relaxed">{data.insufficientReason}</p>
          )}
          {data.dataQuality?.missingInputs?.length > 0 && (
            <p className="mt-3 text-xs text-gray-600">
              {t.val_missingInputs}: {data.dataQuality.missingInputs.join(', ')}
            </p>
          )}
        </div>
        <p className="mt-4 text-[11px] text-gray-600 leading-relaxed">{data.disclaimer}</p>
      </section>
    )
  }

  const matrixMsg =
    bukraScore != null && data.valuationScore != null
      ? bukraScore >= 70 && data.valuationScore >= 65 ? t.val_matrixBothHigh
      : bukraScore >= 70 && data.valuationScore < 50 ? t.val_matrixQualityHighPriceLow
      : null
      : null

  return (
    <section aria-label={t.val_sectionTitle}>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-white">{t.val_sectionTitle}</h2>
        <p className="text-gray-500 text-sm mt-0.5">{t.val_sectionSubtitle}</p>
      </div>

      {/* Four headline cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <HeadCard title={t.val_scoreTitle} tooltip={t.val_scoreTooltip}
          score={data.valuationScore} label={bandLabel(data.valuationScoreLabel, 'val_band_')}
          estimateNote={t.val_estimateNote} />
        <HeadCard title={t.val_gapTitle} tooltip={t.val_gapTooltip} invert
          score={data.expectationsGap} label={bandLabel(data.expectationsGapLabel, 'val_gap_')}
          estimateNote={t.val_estimateNote} />
        <HeadCard title={t.val_bubbleTitle} tooltip={t.val_bubbleTooltip} invert
          score={data.bubbleRisk} label={bandLabel(data.bubbleRiskLabel, 'val_bubble_')}
          estimateNote={t.val_estimateNote} />
        <HeadCard title={t.val_confTitle} tooltip={t.val_confTooltip}
          score={data.valuationConfidence?.score}
          label={(t[`val_conf_${data.valuationConfidence?.label}` as keyof Translations] as string) ?? '—'}
          estimateNote={t.val_estimateNote} />
      </div>

      {/* Quality vs price relationship */}
      {matrixMsg && (
        <div className="mb-5 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-1">{t.val_matrixTitle}</div>
          <p className="text-gray-300 text-sm leading-relaxed">{matrixMsg}</p>
          <p className="mt-1 text-gray-500 text-xs">{t.val_matrixNote}</p>
        </div>
      )}

      {data.sectorModelNote && (
        <p className="mb-5 text-xs text-amber-400/80 leading-relaxed">{data.sectorModelNote}</p>
      )}

      <div className="space-y-5">
        <RangeVisual data={data} t={t} isHe={isHe} />
        <PricedIn data={data} t={t} />

        {/* Scenarios */}
        {data.scenarios && (
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wide mb-3">{t.val_scenariosTitle}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ScenarioCard name="bear" label={t.val_bear} sc={data.scenarios.bear} data={data} t={t} color="text-red-400" />
              <ScenarioCard name="base" label={t.val_base} sc={data.scenarios.base} data={data} t={t} color="text-amber-300" />
              <ScenarioCard name="bull" label={t.val_bull} sc={data.scenarios.bull} data={data} t={t} color="text-green-400" />
            </div>
          </div>
        )}

        {/* Why this score — progressive disclosure */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800">
          <button onClick={() => setShowWhy(v => !v)} aria-expanded={showWhy}
            className="w-full flex items-center justify-between px-6 py-4 text-start">
            <span className="text-white font-semibold text-sm uppercase tracking-wide">{t.val_whyTitle}</span>
            <span className="text-gray-500 text-sm">{showWhy ? '▴' : '▾'}</span>
          </button>
          {showWhy && (
            <div className="px-6 pb-6 space-y-5 border-t border-gray-800 pt-5">
              {(data.positiveFactors?.length ?? 0) > 0 && (
                <div>
                  <div className="text-green-400 text-xs font-semibold mb-2">{t.val_positiveFactors}</div>
                  <ul className="space-y-1.5">
                    {data.positiveFactors!.map((f, i) => (
                      <li key={i} className="text-gray-300 text-sm leading-relaxed">· {f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(data.riskFactors?.length ?? 0) > 0 && (
                <div>
                  <div className="text-orange-400 text-xs font-semibold mb-2">{t.val_riskFactors}</div>
                  <ul className="space-y-1.5">
                    {data.riskFactors!.map((f, i) => (
                      <li key={i} className="text-gray-300 text-sm leading-relaxed">· {f}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs text-gray-500 border-t border-gray-800/60 pt-4">
                <div>{t.val_methodsUsed}: <span className="text-gray-400">{(data.valuationMethodsUsed ?? []).join(', ') || '—'}</span></div>
                <div>{t.val_dataQualityLabel}: <span className="text-gray-400">{(t[`val_dq_${data.dataQuality.level}` as keyof Translations] as string) ?? data.dataQuality.level}</span></div>
                {(data.missingInputs?.length ?? 0) > 0 && (
                  <div className="sm:col-span-2">{t.val_missingInputs}: <span className="text-gray-400">{data.missingInputs!.join(', ')}</span></div>
                )}
                <div>{t.val_calculatedAt}: <Num>{data.calculatedAt?.slice(0, 10)}</Num></div>
                <div>{t.val_methodology}: <Num>{data.methodologyVersion}</Num></div>
              </div>
            </div>
          )}
        </div>

        {/* Index conclusion */}
        {data.conclusion && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wide mb-3">{t.val_conclusionTitle}</h3>
            <p className="text-gray-300 text-sm leading-7">{data.conclusion}</p>
          </div>
        )}

        <p className="text-[11px] text-gray-600 leading-relaxed">{data.disclaimer}</p>
      </div>
    </section>
  )
}
