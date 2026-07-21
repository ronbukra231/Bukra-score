/**
 * Bukra Portfolio Simulator shell — shared header, sub-navigation, and the
 * persistent simulation banner. Reuses the Estate's visual language
 * (dark stone, warm gold, serif headings) so this feels like part of the
 * same private investment room, not a bolted-on trading app.
 *
 * Every page rendered inside this shell is virtual: no real broker, no real
 * trade, no real deposit or withdrawal exists anywhere behind it.
 */
import { type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLanguage } from '../i18n/index'
import { GOLD, SERIF } from '../estate/EstateShell'

const TABS = [
  { path: '/simulator', en: 'Overview', he: 'סקירה כללית', exact: true },
  { path: '/simulator/decisions', en: 'Decision Center', he: 'מרכז ההחלטות' },
  { path: '/simulator/holdings', en: 'Holdings', he: 'החזקות' },
  { path: '/simulator/performance', en: 'Performance', he: 'ביצועים' },
  { path: '/simulator/activity', en: 'Activity', he: 'פעילות' },
  { path: '/simulator/history', en: 'Decision History', he: 'היסטוריית החלטות' },
  { path: '/simulator/health', en: 'Portfolio Health', he: 'בריאות התיק' },
]

export function SimBanner({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage()
  return (
    <div className={`rounded-lg border border-amber-500/25 bg-amber-500/[0.06] text-amber-300/90
      ${compact ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2.5 text-xs'} inline-flex items-center gap-2`}>
      <span aria-hidden>◆</span>
      <span>{t.sim_disclaimerShort}</span>
    </div>
  )
}

export default function SimulatorShell({ children }: { children: ReactNode }) {
  const { t, isHe } = useLanguage()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[#0c0a09] text-stone-300 antialiased">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        <Link to="/estate/portfolio"
          className="inline-flex items-center gap-3 text-stone-600 hover:text-[#c9a962] transition-colors duration-500 text-xs tracking-[0.25em] uppercase">
          <span aria-hidden>{isHe ? '→' : '←'}</span>
          {isHe ? 'משרד התיק' : 'The Portfolio Office'}
        </Link>

        <header className="mt-8 mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl text-stone-100 font-light tracking-wide" style={{ fontFamily: SERIF }}>
              {t.sim_navLabel}
            </h1>
          </div>
          <SimBanner />
        </header>

        <nav className="flex flex-wrap gap-1 border-b border-stone-800/70 mb-8" aria-label={t.sim_navLabel}>
          {TABS.map(tab => {
            const active = tab.exact ? location.pathname === tab.path : location.pathname.startsWith(tab.path)
            return (
              <Link key={tab.path} to={tab.path}
                className={`px-4 py-2.5 text-sm transition-colors duration-300 border-b-2 -mb-px
                  ${active ? 'text-stone-100 border-[#c9a962]' : 'text-stone-500 border-transparent hover:text-stone-300'}`}>
                {isHe ? tab.he : tab.en}
              </Link>
            )
          })}
        </nav>

        {children}

        <footer className="mt-16 pt-6 border-t border-stone-900 text-stone-700 text-[11px] leading-relaxed">
          {t.sim_disclaimerFull}
        </footer>
      </div>
    </div>
  )
}

export function SimPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-stone-800/60 bg-gradient-to-b from-stone-900/30 to-stone-950/60
      p-6 md:p-8 ${className}`}>
      {children}
    </div>
  )
}

export function SimFigure({ value, label, tone = 'default' }: {
  value: string; label: string; tone?: 'default' | 'positive' | 'negative'
}) {
  const color = tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-red-400' : 'text-stone-100'
  return (
    <div>
      <div className={`text-3xl font-light tracking-wide ${color}`} style={{ fontFamily: SERIF }}>{value}</div>
      <div className="mt-1.5 text-[11px] uppercase tracking-[0.2em] text-stone-600">{label}</div>
    </div>
  )
}

export { GOLD, SERIF }
