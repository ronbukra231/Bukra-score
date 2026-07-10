/**
 * World Intelligence Center — the situation room.
 *
 * One globe, drawn in hairlines. Beneath it, only what is moving: themes
 * whose direction is not neutral, and unresolved events. The full world
 * model stays behind one quiet line — progressive disclosure, never a
 * dashboard. The room answers a single question: what is changing?
 */
import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../i18n/index'
import { getEstateWorld } from '../api/client'
import { EstateShell, EstatePanel, EstateHeading, GOLD, SERIF } from '../estate/EstateShell'

interface Theme {
  key: string; state: string; confidence: string
  direction: string; momentum: string; updatedAt: string | null
  history: { date: string; state: string }[]
}

const THEME_LABELS: Record<string, { en: string; he: string }> = {
  artificial_intelligence: { en: 'Artificial Intelligence', he: 'בינה מלאכותית' },
  energy:            { en: 'Energy',             he: 'אנרגיה' },
  inflation:         { en: 'Inflation',          he: 'אינפלציה' },
  interest_rates:    { en: 'Interest Rates',     he: 'ריביות' },
  semiconductors:    { en: 'Semiconductors',     he: 'מוליכים למחצה' },
  cybersecurity:     { en: 'Cybersecurity',      he: 'סייבר' },
  defense:           { en: 'Defense',            he: 'ביטחון' },
  healthcare:        { en: 'Healthcare',         he: 'בריאות' },
  consumer_behaviour:{ en: 'Consumer Behaviour', he: 'התנהגות צרכנים' },
  demographics:      { en: 'Demographics',       he: 'דמוגרפיה' },
  climate:           { en: 'Climate',            he: 'אקלים' },
  regulation:        { en: 'Regulation',         he: 'רגולציה' },
  trade:             { en: 'Trade',              he: 'סחר' },
  supply_chains:     { en: 'Supply Chains',      he: 'שרשראות אספקה' },
  shipping:          { en: 'Shipping',           he: 'ספנות' },
  technology:        { en: 'Technology',         he: 'טכנולוגיה' },
  geopolitics:       { en: 'Geopolitics',        he: 'גיאופוליטיקה' },
}

function label(t: Theme, isHe: boolean) {
  const l = THEME_LABELS[t.key]
  return l ? (isHe ? l.he : l.en) : t.key
}

/** The globe — hairline meridians, one warm point of light. Never a map app. */
function Globe({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 240 240" className="w-52 h-52 mx-auto" aria-hidden>
      <circle cx="120" cy="120" r="100" fill="none" stroke="#292524" strokeWidth="1" />
      {/* Meridians */}
      <ellipse cx="120" cy="120" rx="100" ry="100" fill="none" stroke="#1c1917" strokeWidth="1" />
      <ellipse cx="120" cy="120" rx="60"  ry="100" fill="none" stroke="#292524" strokeWidth="0.8" />
      <ellipse cx="120" cy="120" rx="25"  ry="100" fill="none" stroke="#292524" strokeWidth="0.8" />
      {/* Parallels */}
      <ellipse cx="120" cy="120" rx="100" ry="38" fill="none" stroke="#292524" strokeWidth="0.8" />
      <ellipse cx="120" cy="120" rx="86"  ry="70" fill="none" stroke="#1c1917" strokeWidth="0.8" />
      <line x1="20" y1="120" x2="220" y2="120" stroke="#292524" strokeWidth="0.8" />
      {/* One warm presence — brighter only when the world is moving */}
      <circle cx="148" cy="88" r="2.5" fill={GOLD} opacity={active ? 0.9 : 0.35}>
        {active && <animate attributeName="opacity" values="0.5;0.9;0.5" dur="6s" repeatCount="indefinite" />}
      </circle>
    </svg>
  )
}

export default function WorldIntelligenceCenter() {
  const { isHe } = useLanguage()
  const [themes, setThemes] = useState<Record<string, Theme> | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    getEstateWorld()
      .then(d => { setThemes(d.themes); setEvents([...(d.events ?? [])].reverse()) })
      .catch(() => setThemes({}))
  }, [])

  const all = useMemo(() => themes ? Object.values(themes) : [], [themes])
  const moving = useMemo(() => all.filter(t => t.direction !== 'Stable' || t.momentum !== 'Steady'), [all])
  const openEvents = events.filter(e => !e.resolvedAt)
  const worldIsMoving = moving.length > 0 || openEvents.length > 0
  const sel = selected && themes ? themes[selected] : null

  return (
    <EstateShell
      room="World Intelligence" roomHe="מודיעין עולמי"
      subtitle="What is changing in the world."
      subtitleHe="מה משתנה בעולם.">

      {/* The globe and the single answer */}
      <div className="text-center mb-16">
        <Globe active={worldIsMoving} />
        <p className="mt-8 text-xl text-stone-200 font-light tracking-wide" style={{ fontFamily: SERIF }}>
          {worldIsMoving
            ? (isHe ? 'העולם זז. הפרטים למטה.' : 'The world is moving. The particulars are below.')
            : (isHe ? 'העולם רגוע. שום מגמה אינה חורגת ממסלולה.' : 'The world is calm. No theme has left its course.')}
        </p>
      </div>

      {/* Only what moves — the signals */}
      {(moving.length > 0 || openEvents.length > 0) && (
        <div className="mb-16 space-y-4 max-w-2xl mx-auto">
          {openEvents.slice(0, 3).map(ev => (
            <EstatePanel key={ev.id} className="!p-6">
              <div className="flex items-baseline justify-between gap-6">
                <span className="text-stone-200 text-sm font-light">{ev.title}</span>
                <span className="text-stone-600 text-xs shrink-0">{ev.timestamp?.slice(0, 10)}</span>
              </div>
            </EstatePanel>
          ))}
          {moving.map(t => (
            <button key={t.key} onClick={() => setSelected(selected === t.key ? null : t.key)}
              className={`w-full text-left rounded-xl border px-6 py-5 transition-all duration-700
                ${selected === t.key ? 'border-[#c9a962]/40 bg-stone-900/40' : 'border-stone-800/60 bg-stone-950/30 hover:border-stone-700'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-200 font-light">{label(t, isHe)}</span>
                <span className={t.direction === 'Improving' ? 'text-emerald-600' : 'text-red-400/70'} aria-hidden>
                  {t.direction === 'Improving' ? '↗' : '↘'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected theme — the why, then how the understanding evolved */}
      {sel && (
        <EstatePanel className="mb-16 max-w-2xl mx-auto">
          <EstateHeading en={label(sel, false)} he={label(sel, true)} />
          <p className="text-stone-300 text-sm leading-7 font-light">{sel.state}</p>
          {sel.history.length > 0 && (
            <div className="mt-8 border-t border-stone-800/50 pt-6 space-y-4">
              {sel.history.slice(-4).reverse().map((h, i) => (
                <div key={i} className="flex gap-5 text-xs">
                  <span className="text-stone-600 shrink-0 w-20">{h.date?.slice(0, 10)}</span>
                  <span className="text-stone-500 leading-relaxed font-light">{h.state}</span>
                </div>
              ))}
            </div>
          )}
        </EstatePanel>
      )}

      {/* The full model — one quiet line away */}
      <div className="text-center">
        <button onClick={() => setShowAll(v => !v)}
          className="text-[11px] uppercase tracking-[0.25em] text-stone-600 hover:text-stone-400 transition-colors duration-500">
          {showAll ? (isHe ? 'לצמצם' : 'Fold away') : (isHe ? 'מודל העולם המלא' : 'The full world model')}
        </button>
        {showAll && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3 text-left">
            {all.map(t => (
              <button key={t.key} onClick={() => setSelected(selected === t.key ? null : t.key)}
                className="rounded-xl border border-stone-800/50 bg-stone-950/30 px-5 py-4
                  hover:border-stone-700 transition-colors duration-500 text-left">
                <span className="text-[13px] text-stone-400 font-light">{label(t, isHe)}</span>
                <span className="block mt-1 text-[10px] uppercase tracking-[0.2em] text-stone-700">
                  {t.direction} · {t.confidence}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </EstateShell>
  )
}
