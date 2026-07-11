/**
 * The Strategy Room — Bukra's own brain, made tangible.
 *
 * Causal chains rendered as quiet sequences of consequence. The learning
 * loop shown as it truly is: predictions made, predictions graded,
 * calibration measured. No theatre — the room shows real machinery,
 * including honest emptiness where reality hasn't graded Bukra yet.
 */
import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/index'
import { getEstateBrain } from '../api/client'
import { EstateShell, EstatePanel, EstateHeading, GOLD, SERIF } from '../estate/EstateShell'

interface Edge { cause: string; effect: string; polarity: number; strength: number; origin: string }
interface Brain {
  causalGraph: { edges: Edge[] }
  calibration: { resolvedPredictions: number; pendingPredictions: number; buckets: Record<string, any> }
  learning: { pendingPredictions: number; resolvedPredictions: number }
}

const label = (node: string) => node.replace(/_/g, ' ')

export default function StrategyRoom() {
  const { isHe } = useLanguage()
  const [brain, setBrain] = useState<Brain | null>(null)

  useEffect(() => {
    getEstateBrain().then(setBrain).catch(() => setBrain(null))
  }, [])

  return (
    <EstateShell
      room="The Strategy Room" roomHe="חדר האסטרטגיה"
      subtitle="How the Index thinks: chains of consequence, a learning loop, and honest calibration."
      subtitleHe="איך המדד חושב: שרשראות של השלכות, לולאת למידה, וכיול כן.">

      {/* The learning loop — the heart, shown honestly */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
        <EstatePanel>
          <EstateHeading en="Predictions awaiting reality" he="תחזיות ממתינות למציאות" />
          <div className="text-4xl text-stone-100 font-light" style={{ fontFamily: SERIF }}>
            {brain?.learning.pendingPredictions ?? '—'}
          </div>
          <p className="mt-3 text-xs text-stone-600 leading-relaxed">
            {isHe ? 'כל מחקר הוא תחזית שהמציאות תבחן.' : 'Every study is a prediction reality will grade.'}
          </p>
        </EstatePanel>
        <EstatePanel>
          <EstateHeading en="Graded by reality" he="נבחנו על ידי המציאות" />
          <div className="text-4xl text-stone-100 font-light" style={{ fontFamily: SERIF }}>
            {brain?.learning.resolvedPredictions ?? '—'}
          </div>
          <p className="mt-3 text-xs text-stone-600 leading-relaxed">
            {isHe ? 'מכאן המדד לומד כמה ביטחון מגיע לו.' : 'This is where the Index learns how much confidence it deserves.'}
          </p>
        </EstatePanel>
        <EstatePanel>
          <EstateHeading en="Calibration" he="כיול" />
          {brain && Object.keys(brain.calibration.buckets).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(brain.calibration.buckets).map(([bucket, b]: [string, any]) => (
                <div key={bucket} className="flex justify-between text-xs">
                  <span className="text-stone-500">{bucket}% {isHe ? 'קונביקציה' : 'conviction'}</span>
                  <span className="text-stone-300">{Math.round(b.meanAccuracy * 100)}% {isHe ? 'דיוק' : 'accurate'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-600 leading-relaxed">
              {isHe
                ? 'אין עדיין מספיק תחזיות שנבחנו. המדד נשאר זהיר עד שהמציאות תבחן את עבודתו.'
                : 'Not enough graded predictions yet. The Index remains cautious until reality has graded its work.'}
            </p>
          )}
        </EstatePanel>
      </div>

      {/* Causal intelligence — chains of consequence */}
      <EstateHeading en="Chains of consequence" he="שרשראות של השלכות" />
      <p className="text-stone-600 text-xs mb-8 max-w-lg leading-relaxed">
        {isHe
          ? 'המדד אינו חושב כמו מנוע חדשות. כל אירוע נבחן דרך השלכותיו — ועוצמת הקשר דועכת ככל שהשרשרת מתארכת.'
          : 'The Index does not think like a news engine. Every event is read through its consequences — and certainty decays as the chain lengthens.'}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {brain?.causalGraph.edges.map((e, i) => (
          <div key={i} className="rounded-xl border border-stone-800/70 bg-stone-950/40 px-5 py-4
            flex items-center gap-3 text-sm">
            <span className="text-stone-300 capitalize">{label(e.cause)}</span>
            <span className="shrink-0" style={{ color: `${GOLD}99` }} aria-hidden>
              {e.polarity > 0 ? '⟶' : '⟶'}
            </span>
            <span className="text-stone-400 capitalize">{label(e.effect)}</span>
            <span className={`ml-auto text-xs shrink-0 ${e.polarity > 0 ? 'text-emerald-500/70' : 'text-red-400/60'}`}>
              {e.polarity > 0 ? '+' : '−'}
            </span>
            <span className="text-[10px] text-stone-600 w-8 text-right shrink-0">
              {Math.round(e.strength * 100)}%
            </span>
          </div>
        ))}
      </div>
    </EstateShell>
  )
}
