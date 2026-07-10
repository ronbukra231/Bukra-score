/**
 * The Hall — entry to the Research Estate.
 *
 * Not a menu. Five rooms, entered by walking toward them. Each doorway is a
 * tall panel that responds to approach (hover) with light, not motion.
 * The estate reacts subtly: rooms carry a quiet presence line describing
 * what has been happening inside while the investor was away.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/index'
import { getEstateLibrary } from '../api/client'
import { GOLD } from '../estate/EstateShell'

interface Room {
  path: string
  en: string; he: string
  descEn: string; descHe: string
  glyph: string          // a single restrained mark, not an icon set
}

const ROOMS: Room[] = [
  {
    path: '/capital-lab', en: 'The Research Room', he: 'חדר המחקר',
    descEn: 'Company analysis. The heart of the estate.',
    descHe: 'ניתוח חברות. לב האחוזה.',
    glyph: '◈',
  },
  {
    path: '/estate/portfolio', en: 'The Portfolio Office', he: 'משרד התיק הפרטי',
    descEn: 'Your holdings, read with Bukra’s judgement. Advice, never execution.',
    descHe: 'האחזקות שלך, נקראות בשיקול הדעת של בוקרא. ייעוץ — לעולם לא ביצוע.',
    glyph: '▤',
  },
  {
    path: '/estate/world', en: 'World Intelligence Center', he: 'מרכז המודיעין העולמי',
    descEn: 'The living world model. Events, causes, consequences.',
    descHe: 'מודל העולם החי. אירועים, סיבות, השלכות.',
    glyph: '◍',
  },
  {
    path: '/estate/library', en: 'The Library', he: 'הספרייה',
    descEn: 'Every company ever researched. Knowledge that compounds.',
    descHe: 'כל חברה שנחקרה אי פעם. ידע שנצבר לעד.',
    glyph: '▥',
  },
  {
    path: '/estate/strategy', en: 'The Strategy Room', he: 'חדר האסטרטגיה',
    descEn: 'How Bukra thinks. Causal chains, conviction, calibration.',
    descHe: 'איך בוקרא חושבת. שרשראות סיבתיות, קונביקציה, כיול.',
    glyph: '◇',
  },
]

export default function EstateHall() {
  const { isHe } = useLanguage()
  const [researched, setResearched] = useState<number | null>(null)

  // The estate quietly reports it has been working
  useEffect(() => {
    getEstateLibrary()
      .then(d => setResearched(d.companies?.length ?? 0))
      .catch(() => setResearched(null))
  }, [])

  return (
    <div className="min-h-screen bg-[#0c0a09] text-stone-300 flex flex-col">
      <div className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 45% at 50% -5%, rgba(201,169,98,0.08), transparent)' }} />

      <div className="relative max-w-6xl mx-auto px-8 py-20 flex-1 w-full">
        <header className="text-center mb-20">
          <div className="text-xs uppercase tracking-[0.4em] text-stone-600 mb-6">Bukra</div>
          <h1 className="font-serif text-5xl text-stone-100 tracking-wide">
            {isHe ? 'אחוזת המחקר' : 'The Research Estate'}
          </h1>
          <p className="mt-5 text-stone-500 text-sm tracking-wide">
            {isHe ? 'מקום שבו ידע נצבר בשקט.' : 'A place where knowledge compounds quietly.'}
          </p>
          {researched !== null && researched > 0 && (
            <p className="mt-8 text-stone-600 text-xs tracking-wider">
              {isHe
                ? `בוקרא המשיכה לעבוד — ${researched} חברות בספרייה.`
                : `Bukra kept working — ${researched} companies now in the Library.`}
            </p>
          )}
        </header>

        {/* The rooms — tall doorways, light responds to approach */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
          {ROOMS.map(room => (
            <Link key={room.path} to={room.path}
              className="group relative rounded-2xl border border-stone-800/80 bg-stone-950/50
                px-6 py-12 flex flex-col items-center text-center
                transition-all duration-500 hover:border-[#c9a962]/40 hover:bg-stone-900/40">
              {/* Light above the doorway */}
              <div className="absolute inset-x-8 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{ background: `linear-gradient(90deg, transparent, ${GOLD}88, transparent)` }} />
              <div className="text-2xl mb-6 text-stone-600 group-hover:text-[#c9a962] transition-colors duration-500"
                aria-hidden>{room.glyph}</div>
              <div className="font-serif text-lg text-stone-200 leading-snug">
                {isHe ? room.he : room.en}
              </div>
              <p className="mt-4 text-xs text-stone-600 leading-relaxed group-hover:text-stone-500 transition-colors duration-500">
                {isHe ? room.descHe : room.descEn}
              </p>
              <div className="mt-auto pt-8 text-[10px] uppercase tracking-[0.3em] text-stone-700
                group-hover:text-[#c9a962]/70 transition-colors duration-500">
                {isHe ? 'להיכנס' : 'Enter'}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <footer className="relative text-center pb-10 text-stone-700 text-xs tracking-widest">
        {isHe ? 'בוקרא מייעצת. הביצוע תמיד אצל הברוקר.' : 'Bukra advises. Execution always happens at your broker.'}
      </footer>
    </div>
  )
}
