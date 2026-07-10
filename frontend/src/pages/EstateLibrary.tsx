/**
 * The Library — every researched company as a private volume.
 *
 * The shelf holds books, not rows. Each volume: a spine of leather-dark
 * tone with a gold-stamped symbol, the standing conclusion, and the study
 * count. Opening a volume opens the research itself.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/index'
import { getEstateLibrary } from '../api/client'
import { EstateShell, EstateHeading, GOLD, SERIF } from '../estate/EstateShell'

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

/** Leather tones — each volume binds slightly differently, like a real shelf. */
const BINDINGS = ['#1c1410', '#17130f', '#1a1512', '#140f0c']

export default function EstateLibrary() {
  const { isHe } = useLanguage()
  const [volumes, setVolumes] = useState<Volume[] | null>(null)

  useEffect(() => {
    getEstateLibrary().then(d => setVolumes(d.companies ?? [])).catch(() => setVolumes([]))
  }, [])

  return (
    <EstateShell
      room="The Library" roomHe="הספרייה"
      subtitle="Every company ever studied. Every thesis, every revision — bound and kept."
      subtitleHe="כל חברה שנחקרה אי פעם. כל תזה, כל עדכון — כרוכים ונשמרים.">

      <EstateHeading en="The shelf" he="המדף" />

      {volumes && volumes.length === 0 && (
        <p className="text-stone-600 text-sm leading-relaxed max-w-md font-light">
          {isHe
            ? 'המדף ממתין לכרך הראשון. כל חברה שתיחקר בחדר המחקר תיכרך כאן לצמיתות — תזה מתפתחת, ציר זמן, ותחזיות שהמציאות תבחן.'
            : 'The shelf awaits its first volume. Every company studied in the Research Room is bound here permanently — an evolving thesis, a timeline, and predictions reality will grade.'}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {volumes?.map((v, i) => (
          <Link key={v.symbol} to={`/company/${v.symbol}`}
            className="group relative rounded-lg border border-stone-800/60 px-6 pt-10 pb-6 min-h-[200px]
              flex flex-col transition-all duration-700 hover:border-[#c9a962]/40 hover:-translate-y-0.5"
            style={{ background: `linear-gradient(to bottom, ${BINDINGS[i % BINDINGS.length]}, #0e0b09)` }}>
            {/* Spine band */}
            <div className="absolute inset-x-0 top-0 h-px" style={{ background: `${GOLD}22` }} />
            <div className="absolute inset-x-6 top-5 h-px" style={{ background: `${GOLD}33` }} />

            {/* Gold-stamped title */}
            <div className="text-2xl tracking-[0.08em] font-light transition-colors duration-700"
              style={{ fontFamily: SERIF, color: `${GOLD}cc` }}>
              {v.symbol}
            </div>
            <div className="mt-3 text-[11px] text-stone-500 font-light leading-relaxed">
              {v.status ?? ''}
            </div>

            <div className="mt-auto pt-6 flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-stone-600">
                {v.reports} {isHe ? 'מחקרים' : v.reports === 1 ? 'study' : 'studies'}
                {v.thesisVersion != null && ` · ${isHe ? 'תזה' : 'thesis'} ${v.thesisVersion}`}
              </span>
              {v.score != null && (
                <span className="text-sm text-stone-300">{v.score}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </EstateShell>
  )
}
