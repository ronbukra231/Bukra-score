/**
 * Estate design language — the shell every room of the Research Estate
 * inherits. Dark, warm, restrained. Gold earned through restraint, not shine.
 *
 * Palette: stone black (#0c0a09), warm walnut shadow, muted gold (#c9a962).
 * Typography: serif for room names (library/museum register), sans for data.
 * Navigation is physical: rooms are entered from the Hall and left the same way.
 */
import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/index'
import { daylight } from './daylight'

export const GOLD = '#c9a962'

export function EstateShell({ room, roomHe, subtitle, subtitleHe, children }: {
  room: string
  roomHe: string
  subtitle?: string
  subtitleHe?: string
  children: ReactNode
}) {
  const { isHe } = useLanguage()
  return (
    <div className="min-h-screen bg-[#0c0a09] text-stone-300">
      {/* Ambient light from above follows the investor's local time of day */}
      <div className="pointer-events-none fixed inset-0" style={{ background: daylight().ambient }} />

      <div className="relative max-w-6xl mx-auto px-8 py-12">
        {/* Doorway back to the Hall */}
        <Link to="/estate"
          className="inline-flex items-center gap-2 text-stone-500 hover:text-[#c9a962] transition-colors duration-300 text-sm tracking-wide">
          <span aria-hidden>{isHe ? '→' : '←'}</span>
          {isHe ? 'חזרה לאולם' : 'Return to the Hall'}
        </Link>

        <header className="mt-10 mb-14">
          <h1 className="font-serif text-4xl text-stone-100 tracking-wide">
            {isHe ? roomHe : room}
          </h1>
          {(subtitle || subtitleHe) && (
            <p className="mt-3 text-stone-500 text-sm tracking-wide max-w-xl leading-relaxed">
              {isHe ? subtitleHe : subtitle}
            </p>
          )}
          <div className="mt-8 h-px w-24" style={{ background: `linear-gradient(90deg, ${GOLD}66, transparent)` }} />
        </header>

        {children}
      </div>
    </div>
  )
}

/** A surface that breathes — the estate's card. */
export function EstatePanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-stone-800/80 bg-stone-950/60 backdrop-blur-sm
      p-8 transition-colors duration-500 hover:border-stone-700/80 ${className}`}>
      {children}
    </div>
  )
}

/** Quiet section heading inside a room. */
export function EstateHeading({ en, he }: { en: string; he: string }) {
  const { isHe } = useLanguage()
  return (
    <h2 className="text-xs uppercase tracking-[0.25em] text-stone-500 mb-6">
      {isHe ? he : en}
    </h2>
  )
}
