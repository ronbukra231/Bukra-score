/**
 * World Intelligence Center — the living world model as a wall of themes.
 *
 * Each global theme is a quiet panel: current understanding, direction,
 * momentum, confidence. Selecting a theme reveals how Bukra's understanding
 * evolved (append-only history). Global events appear as a restrained ledger,
 * never a news feed. Calm, not urgent — the world changes; the room notes it.
 */
import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/index'
import { getEstateWorld } from '../api/client'
import { EstateShell, EstatePanel, EstateHeading, GOLD } from '../estate/EstateShell'

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

function directionMark(direction: string) {
  if (direction === 'Improving') return { mark: '↗', cls: 'text-emerald-500/80' }
  if (direction === 'Deteriorating') return { mark: '↘', cls: 'text-red-400/70' }
  return { mark: '→', cls: 'text-stone-500' }
}

export default function WorldIntelligenceCenter() {
  const { isHe } = useLanguage()
  const [themes, setThemes] = useState<Record<string, Theme> | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    getEstateWorld()
      .then(d => { setThemes(d.themes); setEvents([...(d.events ?? [])].reverse()) })
      .catch(() => setThemes({}))
  }, [])

  const sel = selected && themes ? themes[selected] : null

  return (
    <EstateShell
      room="World Intelligence Center" roomHe="מרכז המודיעין העולמי"
      subtitle="Bukra’s living understanding of the world. Companies are never analyzed in isolation."
      subtitleHe="הבנת העולם החיה של בוקרא. חברות לעולם אינן מנותחות בבידוד.">

      <EstateHeading en="The world model" he="מודל העולם" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-14">
        {themes && Object.values(themes).map(t => {
          const label = THEME_LABELS[t.key] ?? { en: t.key, he: t.key }
          const dir = directionMark(t.direction)
          const active = selected === t.key
          return (
            <button key={t.key} onClick={() => setSelected(active ? null : t.key)}
              className={`text-left rounded-xl border px-5 py-5 transition-all duration-500
                ${active ? 'border-[#c9a962]/50 bg-stone-900/60' : 'border-stone-800/70 bg-stone-950/40 hover:border-stone-700'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-200">{isHe ? label.he : label.en}</span>
                <span className={`text-lg ${dir.cls}`} aria-hidden>{dir.mark}</span>
              </div>
              <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-stone-600">
                {t.momentum} · {t.confidence}
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected theme — progressive disclosure: the why, then the evolution */}
      {sel && (
        <EstatePanel className="mb-14">
          <EstateHeading
            en={THEME_LABELS[sel.key]?.en ?? sel.key}
            he={THEME_LABELS[sel.key]?.he ?? sel.key} />
          <p className="text-stone-300 text-sm leading-7">{sel.state}</p>
          {sel.history.length > 0 && (
            <div className="mt-8 border-t border-stone-800/60 pt-6 space-y-4">
              <div className="text-[10px] uppercase tracking-[0.25em] text-stone-600">
                {isHe ? 'איך ההבנה התפתחה' : 'How the understanding evolved'}
              </div>
              {sel.history.slice(-5).reverse().map((h, i) => (
                <div key={i} className="flex gap-4 text-xs">
                  <span className="text-stone-600 shrink-0 w-24">{h.date?.slice(0, 10)}</span>
                  <span className="text-stone-500 leading-relaxed">{h.state}</span>
                </div>
              ))}
            </div>
          )}
        </EstatePanel>
      )}

      <EstateHeading en="Global event memory" he="זיכרון אירועים עולמי" />
      {events.length === 0 ? (
        <p className="text-stone-600 text-sm leading-relaxed">
          {isHe
            ? 'טרם נרשמו אירועים עולמיים. כל אירוע משמעותי יהפוך כאן לידע קבוע — כולל מה ציפינו, מה קרה בפועל, ומה למדנו.'
            : 'No global events recorded yet. Every meaningful event will become permanent knowledge here — what we expected, what actually happened, and what we learned.'}
        </p>
      ) : (
        <div className="space-y-4">
          {events.slice(0, 20).map(ev => (
            <EstatePanel key={ev.id} className="!p-6">
              <div className="flex items-baseline justify-between gap-6">
                <span className="text-stone-200 text-sm">{ev.title}</span>
                <span className="text-stone-600 text-xs shrink-0">{ev.timestamp?.slice(0, 10)}</span>
              </div>
              {ev.resolvedAt && (
                <div className="mt-3 text-xs" style={{ color: `${GOLD}aa` }}>
                  {isHe ? 'נפתר' : 'Resolved'} — {ev.actualOutcome}
                </div>
              )}
            </EstatePanel>
          ))}
        </div>
      )}
    </EstateShell>
  )
}
