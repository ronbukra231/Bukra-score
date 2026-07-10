/**
 * Estate design language — the shell every room of the Research Estate
 * inherits. Dark, warm, restrained. Gold earned through restraint, not shine.
 *
 * Palette: stone black (#0c0a09), walnut shadow, soft bronze-gold (#c9a962).
 * Typography: serif for room names (library register), quiet sans for data.
 * Motion: slow and purposeful — 700ms as the house tempo, nothing faster
 * than 300ms. Navigation is physical: rooms are entered from the Hall and
 * left the same way.
 */
import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/index'
import { daylight } from './daylight'

export const GOLD = '#c9a962'
export const SERIF = `'Cormorant Garamond', 'Palatino Linotype', Palatino, Georgia, serif`

export function EstateShell({ room, roomHe, subtitle, subtitleHe, children, wide = false }: {
  room: string
  roomHe: string
  subtitle?: string
  subtitleHe?: string
  children: ReactNode
  wide?: boolean
}) {
  const { isHe } = useLanguage()
  return (
    <div className="min-h-screen bg-[#0c0a09] text-stone-300 antialiased">
      {/* Ambient light from above follows the investor's local time of day */}
      <div className="pointer-events-none fixed inset-0" style={{ background: daylight().ambient }} />
      {/* Floor shadow — the room has depth, not just darkness */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-64"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }} />

      <div className={`relative mx-auto px-8 md:px-12 py-14 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
        {/* Doorway back to the Hall */}
        <Link to="/estate"
          className="inline-flex items-center gap-3 text-stone-600 hover:text-[#c9a962] transition-colors duration-500 text-xs tracking-[0.25em] uppercase">
          <span aria-hidden>{isHe ? '→' : '←'}</span>
          {isHe ? 'האולם' : 'The Hall'}
        </Link>

        <header className="mt-14 mb-16">
          <h1 className="text-[2.75rem] leading-tight text-stone-100 tracking-wide font-light"
            style={{ fontFamily: SERIF }}>
            {isHe ? roomHe : room}
          </h1>
          {(subtitle || subtitleHe) && (
            <p className="mt-4 text-stone-500 text-[0.9rem] tracking-wide max-w-xl leading-relaxed font-light">
              {isHe ? subtitleHe : subtitle}
            </p>
          )}
          <div className="mt-10 h-px w-20" style={{ background: `linear-gradient(90deg, ${GOLD}55, transparent)` }} />
        </header>

        {children}

        <footer className="mt-24 pt-8 border-t border-stone-900 text-center text-stone-700 text-[11px] tracking-[0.25em] uppercase">
          {isHe ? 'בוקרא מייעצת · הביצוע תמיד אצל הברוקר' : 'Bukra advises · Execution always happens at your broker'}
        </footer>
      </div>
    </div>
  )
}

/** A surface that breathes — the estate's panel. Hairlines, never glow. */
export function EstatePanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-stone-800/60 bg-gradient-to-b from-stone-900/30 to-stone-950/60
      p-8 md:p-10 transition-colors duration-700 hover:border-stone-700/60 ${className}`}>
      {children}
    </div>
  )
}

/** Quiet section heading inside a room — small caps, generous air. */
export function EstateHeading({ en, he }: { en: string; he: string }) {
  const { isHe } = useLanguage()
  return (
    <h2 className="text-[11px] uppercase tracking-[0.3em] text-stone-500 mb-7">
      {isHe ? he : en}
    </h2>
  )
}

/** A figure awaiting its data — furnished, not "coming soon". */
export function EstateFigure({ value, label, labelHe }: { value: string | number | null; label: string; labelHe: string }) {
  const { isHe } = useLanguage()
  return (
    <div>
      <div className="text-4xl text-stone-100 font-light tracking-wide" style={{ fontFamily: SERIF }}>
        {value ?? <span className="text-stone-700">—</span>}
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-[0.25em] text-stone-600">
        {isHe ? labelHe : label}
      </div>
    </div>
  )
}
