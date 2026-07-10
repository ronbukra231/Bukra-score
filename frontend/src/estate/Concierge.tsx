/**
 * The Concierge — not a chatbot. One elegant card at the start of every
 * session: a greeting, one reason, at most two actions. It renders the
 * Entry Controller's decision verbatim and adds nothing.
 *
 * The calm state is presented with the same dignity as the urgent one —
 * "nothing requires your attention" is a conclusion, not an absence.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/index'
import { useAuth } from '../contexts/AuthContext'
import { getEstateEntry } from '../api/client'
import { GOLD } from './EstateShell'
import { daylight } from './daylight'

interface Entry {
  destination: string
  urgency: 'calm' | 'attention' | 'urgent'
  reason: string
  detail: string
  companiesToReview: string[]
  estimatedMinutes: number
  primaryAction: { label: string; to: string }
  secondaryAction: { label: string; to: string } | null
}

const URGENCY_LINE: Record<Entry['urgency'], string> = {
  calm:      '#57534e',
  attention: `${GOLD}88`,
  urgent:    `${GOLD}cc`,
}

export default function Concierge() {
  const { isHe } = useLanguage()
  const { user } = useAuth()
  const [entry, setEntry] = useState<Entry | null>(null)

  useEffect(() => {
    getEstateEntry().then(setEntry).catch(() => setEntry(null))
  }, [])

  const light = daylight()
  const name  = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0]
    ?? user?.email?.split('@')[0] ?? ''

  return (
    <div className="relative rounded-2xl border border-stone-800/80 bg-stone-950/70 backdrop-blur-sm
      px-10 py-10 max-w-2xl mx-auto text-center overflow-hidden">
      {/* One thread of light — its warmth is the only urgency signal */}
      <div className="absolute inset-x-16 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${entry ? URGENCY_LINE[entry.urgency] : '#57534e'}, transparent)` }} />

      <p className="text-stone-500 text-sm tracking-wide">
        {isHe ? light.greetingHe : light.greetingEn}{name ? `, ${name}` : ''}.
      </p>

      {entry ? (
        <>
          <h2 className="mt-4 font-serif text-2xl text-stone-100 leading-snug">
            {entry.reason}
          </h2>
          {entry.detail && (
            <p className="mt-3 text-stone-500 text-sm leading-relaxed max-w-md mx-auto">
              {entry.detail}
            </p>
          )}
          {entry.estimatedMinutes > 0 && (
            <p className="mt-5 text-xs tracking-[0.2em] uppercase text-stone-600">
              {isHe ? `זמן עיון משוער: ${entry.estimatedMinutes} דקות`
                    : `Estimated review time: ${entry.estimatedMinutes} minutes`}
            </p>
          )}
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link to={entry.primaryAction.to}
              className="rounded-full px-7 py-2.5 text-sm tracking-wide text-stone-950 font-medium
                transition-opacity duration-300 hover:opacity-90"
              style={{ background: GOLD }}>
              {entry.primaryAction.label}
            </Link>
            {entry.secondaryAction && (
              <Link to={entry.secondaryAction.to}
                className="rounded-full px-7 py-2.5 text-sm tracking-wide text-stone-400
                  border border-stone-700 hover:border-stone-500 hover:text-stone-200
                  transition-colors duration-300">
                {entry.secondaryAction.label}
              </Link>
            )}
          </div>
        </>
      ) : (
        /* Entry engine unreachable — the estate still welcomes, portfolio is home */
        <div className="mt-6">
          <Link to="/estate/portfolio"
            className="rounded-full px-7 py-2.5 text-sm tracking-wide text-stone-950 font-medium inline-block"
            style={{ background: GOLD }}>
            {isHe ? 'למשרד התיק' : 'Open Portfolio'}
          </Link>
        </div>
      )}
    </div>
  )
}
