/**
 * The Library — every company Bukra has ever researched.
 *
 * Not files. Knowledge. Each researched company is a volume on the shelf:
 * spine shows the essentials, opening it walks to the full analysis.
 * The shelf grows forever — research memory never forgets.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/index'
import { getEstateLibrary } from '../api/client'
import { EstateShell, EstateHeading, GOLD } from '../estate/EstateShell'

interface Volume {
  symbol: string
  reports: number
  firstResearched: string | null
  lastResearched: string | null
  score: number | null
  confidence: string | null
  status: string | null
  thesisVersion: number | null
}

function scoreTone(score: number | null): string {
  if (score == null) return '#57534e'
  if (score >= 80) return GOLD
  if (score >= 65) return '#a8a29e'
  return '#78716c'
}

export default function EstateLibrary() {
  const { isHe } = useLanguage()
  const [volumes, setVolumes] = useState<Volume[] | null>(null)

  useEffect(() => {
    getEstateLibrary().then(d => setVolumes(d.companies ?? [])).catch(() => setVolumes([]))
  }, [])

  return (
    <EstateShell
      room="The Library" roomHe="הספרייה"
      subtitle="Every company ever researched. Every thesis, every revision, every lesson — permanent."
      subtitleHe="כל חברה שנחקרה אי פעם. כל תזה, כל עדכון, כל לקח — לצמיתות.">

      <EstateHeading en="The shelf" he="המדף" />

      {volumes && volumes.length === 0 && (
        <p className="text-stone-600 text-sm leading-relaxed max-w-md">
          {isHe
            ? 'הספרייה עדיין ריקה. כל חברה שתיחקר בחדר המחקר תהפוך לכרך קבוע כאן — עם תזה מתפתחת, ציר זמן, ותחזיות שהמציאות תבחן.'
            : 'The library is still empty. Every company researched in the Research Room becomes a permanent volume here — with an evolving thesis, a timeline, and predictions reality will grade.'}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {volumes?.map(v => (
          <Link key={v.symbol} to={`/company/${v.symbol}`}
            className="group rounded-xl border border-stone-800/70 bg-stone-950/40 px-5 py-6
              transition-all duration-500 hover:border-[#c9a962]/40 hover:bg-stone-900/40">
            {/* Spine */}
            <div className="flex items-baseline justify-between">
              <span className="font-serif text-xl text-stone-100">{v.symbol}</span>
              {v.score != null && (
                <span className="text-sm font-medium" style={{ color: scoreTone(v.score) }}>{v.score}</span>
              )}
            </div>
            <div className="mt-3 text-xs text-stone-600 leading-relaxed">
              {v.status ?? ''}
            </div>
            <div className="mt-4 pt-4 border-t border-stone-800/50 flex justify-between text-[10px] uppercase tracking-[0.15em] text-stone-600">
              <span>
                {v.reports} {isHe ? 'מחקרים' : v.reports === 1 ? 'study' : 'studies'}
              </span>
              {v.thesisVersion != null && (
                <span>{isHe ? 'תזה' : 'thesis'} v{v.thesisVersion}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </EstateShell>
  )
}
