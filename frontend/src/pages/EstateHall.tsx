/**
 * The Hall — entry to the Research Estate, the authenticated home.
 *
 * One question is answered here: "What deserves my attention today?"
 * The Concierge speaks first. Below it, two doorways — the Portfolio Office
 * and the Research Room. The quieter wings are a single line of small text
 * at the bottom; the Entry Controller warms one only when something
 * genuinely waits there.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/index'
import { getEstateEntry } from '../api/client'
import { GOLD, SERIF } from '../estate/EstateShell'
import { daylight } from '../estate/daylight'
import Concierge from '../estate/Concierge'

const WINGS = [
  { path: '/estate/world',    en: 'World Intelligence', he: 'מודיעין עולמי' },
  { path: '/estate/library',  en: 'The Library',        he: 'הספרייה' },
  { path: '/estate/strategy', en: 'The Strategy Room',  he: 'חדר האסטרטגיה' },
]

export default function EstateHall() {
  const { isHe } = useLanguage()
  const [litWing, setLitWing] = useState<string | null>(null)

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
    <div className="min-h-screen bg-[#0c0a09] text-stone-300 antialiased flex flex-col">
      <div className="pointer-events-none fixed inset-0" style={{ background: light.ambient }} />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-72"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)' }} />

      <div className="relative max-w-4xl mx-auto px-8 py-20 flex-1 w-full flex flex-col justify-center">
        <header className="text-center mb-14">
          <div className="text-[11px] uppercase tracking-[0.5em] text-stone-600">Bukra</div>
        </header>

        {/* The Concierge — the heart of the estate */}
        <Concierge />

        {/* Two doorways. Nothing more. */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Doorway to="/estate/portfolio"
            title={isHe ? 'משרד התיק הפרטי' : 'The Portfolio Office'}
            line={isHe ? 'המקום שבו הון מנוהל.' : 'Where capital is managed.'} />
          <Doorway to="/estate/research"
            title={isHe ? 'חדר המחקר' : 'The Research Room'}
            line={isHe ? 'המקום שבו חברות נחקרות.' : 'Where companies are studied.'} />
        </div>

        {/* The quieter wings — one line, small, present */}
        <div className="mt-16 flex items-center justify-center gap-10">
          {WINGS.map(w => {
            const lit = litWing === w.path
            return (
              <Link key={w.path} to={w.path}
                className={`text-[11px] tracking-[0.25em] uppercase transition-colors duration-700
                  ${lit ? 'text-[#c9a962]' : 'text-stone-600 hover:text-stone-400'}`}>
                {isHe ? w.he : w.en}
                {lit && <span className="ml-2" aria-hidden>·</span>}
              </Link>
            )
          })}
        </div>
      </div>

      <footer className="relative text-center pb-10 text-stone-700 text-[11px] tracking-[0.25em] uppercase">
        {isHe ? 'בוקרה היא פלטפורמת מחקר · הביצוע תמיד אצל הברוקר' : 'Bukra is a research platform · Execution always happens at your broker'}
      </footer>
    </div>
  )
}

function Doorway({ to, title, line }: { to: string; title: string; line: string }) {
  return (
    <Link to={to}
      className="group relative rounded-2xl border border-stone-800/70 bg-gradient-to-b from-stone-900/20 to-stone-950/50
        px-10 py-12 text-center transition-all duration-700 hover:border-[#c9a962]/35">
      <div className="absolute inset-x-12 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-1000"
        style={{ background: `linear-gradient(90deg, transparent, ${GOLD}77, transparent)` }} />
      <div className="text-2xl text-stone-100 font-light tracking-wide" style={{ fontFamily: SERIF }}>
        {title}
      </div>
      <p className="mt-3 text-[13px] text-stone-600 group-hover:text-stone-500 transition-colors duration-700 font-light">
        {line}
      </p>
    </Link>
  )
}
