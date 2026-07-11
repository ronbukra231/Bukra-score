/**
 * The Research Room — where companies are studied.
 *
 * A study, not a screen: one desk (the search), and the volumes most
 * recently worked on. Entering a company opens the full analysis — the
 * existing engine, untouched. Everything here is invitation, not interface.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/index'
import { getEstateLibrary } from '../api/client'
import { EstateShell, EstateHeading, GOLD, SERIF } from '../estate/EstateShell'
import SearchBar from '../components/SearchBar'

interface Volume {
  symbol: string
  score: number | null
  status: string | null
  lastResearched: string | null
  thesisVersion: number | null
}

export default function ResearchRoom() {
  const { isHe } = useLanguage()
  const [recent, setRecent] = useState<Volume[] | null>(null)

  useEffect(() => {
    getEstateLibrary()
      .then(d => setRecent((d.companies ?? []).slice(0, 6)))
      .catch(() => setRecent([]))
  }, [])

  return (
    <EstateShell
      room="The Research Room" roomHe="חדר המחקר"
      subtitle="Bring a company to the desk. The Index studies its decade, not its day."
      subtitleHe="הבא חברה אל השולחן. המדד חוקר את העשור שלה, לא את היום שלה.">

      {/* The desk — one instrument, generous air */}
      <div className="max-w-xl mx-auto mb-20">
        <SearchBar large variant="estate" />
        <p className="mt-4 text-center text-stone-600 text-xs tracking-wide font-light">
          {isHe
            ? 'סימבול או שם חברה — התזה, הציון והרלוונטיות העתידית ייפתחו יחד.'
            : 'A symbol or a company name — the thesis, the score and the future relevance open together.'}
        </p>
      </div>

      {/* Recently studied — the volumes still on the desk */}
      {recent && recent.length > 0 && (
        <>
          <EstateHeading en="Still on the desk" he="עדיין על השולחן" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {recent.map(v => (
              <Link key={v.symbol} to={`/company/${v.symbol}`}
                className="group rounded-xl border border-stone-800/60 bg-gradient-to-b from-stone-900/20 to-stone-950/40
                  px-6 py-7 transition-all duration-700 hover:border-[#c9a962]/35">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl text-stone-100 font-light tracking-wide" style={{ fontFamily: SERIF }}>
                    {v.symbol}
                  </span>
                  {v.score != null && (
                    <span className="text-sm" style={{ color: v.score >= 80 ? GOLD : '#a8a29e' }}>{v.score}</span>
                  )}
                </div>
                {v.status && (
                  <div className="mt-2 text-[11px] text-stone-600 font-light">{v.status}</div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      {recent && recent.length === 0 && (
        <p className="text-center text-stone-600 text-sm font-light">
          {isHe
            ? 'השולחן עדיין נקי. החברה הראשונה שתיחקר תישאר כאן.'
            : 'The desk is still clear. The first company you study will remain here.'}
        </p>
      )}
    </EstateShell>
  )
}
