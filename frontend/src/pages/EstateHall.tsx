/**
 * The Hall — entry to the Research Estate.
 *
 * The daily flow: the Concierge speaks first (one card, one reason, at most
 * two actions), then two primary doorways — the Portfolio Office (the home)
 * and the Research Room (deep analysis). The three quieter wings sit below,
 * present but never competing for attention; the Entry Controller lights
 * one only when it is genuinely relevant today.
 *
 * The ambient light follows the investor's local time of day.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/index'
import { getEstateEntry } from '../api/client'
import { GOLD } from '../estate/EstateShell'
import { daylight } from '../estate/daylight'
import Concierge from '../estate/Concierge'

interface Door {
  path: string
  en: string; he: string
  descEn: string; descHe: string
  glyph: string
}

const PRIMARY: Door[] = [
  {
    path: '/estate/portfolio', en: 'The Portfolio Office', he: 'משרד התיק הפרטי',
    descEn: 'The home. Your holdings, read with Bukra’s judgement.',
    descHe: 'הבית. האחזקות שלך, נקראות בשיקול הדעת של בוקרא.',
    glyph: '▤',
  },
  {
    path: '/capital-lab', en: 'The Research Room', he: 'חדר המחקר',
    descEn: 'Deep analysis. The heart of the estate.',
    descHe: 'ניתוח מעמיק. לב האחוזה.',
    glyph: '◈',
  },
]

const WINGS: Door[] = [
  {
    path: '/estate/world', en: 'World Intelligence', he: 'מודיעין עולמי',
    descEn: 'The living world model.', descHe: 'מודל העולם החי.',
    glyph: '◍',
  },
  {
    path: '/estate/library', en: 'The Library', he: 'הספרייה',
    descEn: 'Everything ever researched.', descHe: 'כל מה שנחקר אי פעם.',
    glyph: '▥',
  },
  {
    path: '/estate/strategy', en: 'The Strategy Room', he: 'חדר האסטרטגיה',
    descEn: 'How Bukra thinks.', descHe: 'איך בוקרא חושבת.',
    glyph: '◇',
  },
]

export default function EstateHall() {
  const { isHe } = useLanguage()
  const [litWing, setLitWing] = useState<string | null>(null)

  // The Entry Controller may light one wing — only when it matters today
  useEffect(() => {
    getEstateEntry()
      .then(e => {
        const wing = WINGS.find(w => e.destination.startsWith(w.path))
        setLitWing(wing ? wing.path : null)
      })
      .catch(() => setLitWing(null))
  }, [])

  const light = daylight()

  return (
    <div className="min-h-screen bg-[#0c0a09] text-stone-300 flex flex-col">
      <div className="pointer-events-none fixed inset-0" style={{ background: light.ambient }} />

      <div className="relative max-w-5xl mx-auto px-8 py-16 flex-1 w-full">
        <header className="text-center mb-12">
          <div className="text-xs uppercase tracking-[0.4em] text-stone-600">Bukra</div>
        </header>

        {/* The Concierge — every session begins here */}
        <Concierge />

        {/* Two daily destinations */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6">
          {PRIMARY.map(door => (
            <Link key={door.path} to={door.path}
              className="group relative rounded-2xl border border-stone-800/80 bg-stone-950/50
                px-8 py-14 flex flex-col items-center text-center
                transition-all duration-500 hover:border-[#c9a962]/40 hover:bg-stone-900/40">
              <div className="absolute inset-x-10 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{ background: `linear-gradient(90deg, transparent, ${GOLD}88, transparent)` }} />
              <div className="text-3xl mb-6 text-stone-600 group-hover:text-[#c9a962] transition-colors duration-500"
                aria-hidden>{door.glyph}</div>
              <div className="font-serif text-2xl text-stone-100">{isHe ? door.he : door.en}</div>
              <p className="mt-4 text-sm text-stone-600 leading-relaxed group-hover:text-stone-500 transition-colors duration-500">
                {isHe ? door.descHe : door.descEn}
              </p>
            </Link>
          ))}
        </div>

        {/* The quieter wings — depth without competition */}
        <div className="mt-12">
          <div className="text-center text-[10px] uppercase tracking-[0.35em] text-stone-700 mb-6">
            {isHe ? 'האגפים השקטים' : 'The quieter wings'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {WINGS.map(door => {
              const lit = litWing === door.path
              return (
                <Link key={door.path} to={door.path}
                  className={`group rounded-xl border px-5 py-6 flex items-center gap-4
                    transition-all duration-500
                    ${lit
                      ? 'border-[#c9a962]/50 bg-stone-900/50'
                      : 'border-stone-800/60 bg-stone-950/30 hover:border-stone-700'}`}>
                  <span className={`text-lg transition-colors duration-500
                    ${lit ? 'text-[#c9a962]' : 'text-stone-700 group-hover:text-stone-500'}`}
                    aria-hidden>{door.glyph}</span>
                  <span>
                    <span className="block text-sm text-stone-300">{isHe ? door.he : door.en}</span>
                    <span className="block mt-0.5 text-[11px] text-stone-600">
                      {lit
                        ? (isHe ? 'משהו ממתין כאן היום' : 'Something waits here today')
                        : (isHe ? door.descHe : door.descEn)}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <footer className="relative text-center pb-10 text-stone-700 text-xs tracking-widest">
        {isHe ? 'בוקרא מייעצת. הביצוע תמיד אצל הברוקר.' : 'Bukra advises. Execution always happens at your broker.'}
      </footer>
    </div>
  )
}
