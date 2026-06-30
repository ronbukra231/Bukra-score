/**
 * Event Intelligence Panel — shown on the Company page.
 *
 * Displays the current business thesis + event timeline for a single company.
 * The Bukra Score is NEVER changed by events shown here.
 * This panel separates FACT (financial statements) from HYPOTHESIS (events).
 */
import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/index'
import { Link } from 'react-router-dom'
import { trackEventIntelligenceOpen } from '../lib/analytics'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  Detected:  'text-gray-400 bg-gray-800 border-gray-700',
  Analyzing: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Monitoring:'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Confirmed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Rejected:  'text-red-500 bg-red-500/10 border-red-500/20',
}

const IMPORTANCE_DOT: Record<string, string> = {
  Low:      'bg-gray-600',
  Medium:   'bg-amber-500',
  High:     'bg-orange-500',
  Critical: 'bg-red-500',
}

const SENTIMENT_COLOR: Record<string, string> = {
  Positive: 'text-emerald-400',
  Negative: 'text-red-400',
  Neutral:  'text-gray-400',
  Mixed:    'text-amber-400',
}

const DIRECTION_ARROW: Record<string, string> = {
  positive:  '↑',
  negative:  '↓',
  neutral:   '→',
  uncertain: '?',
}

const DIRECTION_COLOR: Record<string, string> = {
  positive:  'text-emerald-400',
  negative:  'text-red-400',
  neutral:   'text-gray-400',
  uncertain: 'text-gray-600',
}

function statusLabel(status: string, t: any): string {
  const map: Record<string, string> = {
    Detected:  t.intel_statusDetected,
    Analyzing: t.intel_statusAnalyzing,
    Monitoring:t.intel_statusMonitoring,
    Confirmed: t.intel_statusConfirmed,
    Rejected:  t.intel_statusRejected,
  }
  return map[status] ?? status
}

function sentimentLabel(s: string, t: any): string {
  const map: Record<string, string> = {
    Positive: t.intel_sentimentPositive,
    Negative: t.intel_sentimentNegative,
    Neutral:  t.intel_sentimentNeutral,
    Mixed:    t.intel_sentimentMixed,
  }
  return map[s] ?? s
}

function importanceLabel(s: string, t: any): string {
  const map: Record<string, string> = {
    Low:      t.intel_importanceLow,
    Medium:   t.intel_importanceMedium,
    High:     t.intel_importanceHigh,
    Critical: t.intel_importanceCritical,
  }
  return map[s] ?? s
}

// ── Business thesis header ────────────────────────────────────────────────────

function ThesisHeader({ thesis, t }: { thesis: any; t: any }) {
  if (!thesis || thesis.active_event_count === 0) return null

  const sentColor = SENTIMENT_COLOR[thesis.sentiment] ?? 'text-gray-400'
  const sentLabel: Record<string, string> = {
    Positive: t.intel_thesisPositive,
    Negative: t.intel_thesisNegative,
    Neutral:  t.intel_thesisNeutral,
    Mixed:    t.intel_thesisMixed,
  }
  const pct = Math.round(thesis.confidence * 100)

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
          {t.intel_thesisTitle}
        </span>
        <span className={`text-sm font-bold ${sentColor}`}>
          {sentLabel[thesis.sentiment] ?? thesis.sentiment}
          {pct > 0 && <span className="text-gray-600 font-normal text-xs ml-2">({pct}% {t.intel_confidence})</span>}
        </span>
      </div>

      <p className="text-gray-400 text-xs leading-relaxed italic">{thesis.summary}</p>

      {thesis.monitoring?.length > 0 && (
        <div>
          <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1.5">{t.intel_monitoring}:</p>
          <div className="flex flex-wrap gap-1.5">
            {thesis.monitoring.map((item: string) => (
              <span key={item} className="text-[10px] text-blue-300 bg-blue-500/8 border border-blue-500/15 rounded-full px-2 py-0.5">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 text-[10px] text-gray-600 pt-1 border-t border-gray-800">
        <span className="text-emerald-600">{thesis.positive_count} חיובי</span>
        <span className="text-red-700">{thesis.negative_count} שלילי</span>
        {thesis.critical_count > 0 && (
          <span className="text-red-500 font-semibold">{thesis.critical_count} קריטי</span>
        )}
      </div>
    </div>
  )
}

// ── Single event card ─────────────────────────────────────────────────────────

function EventCard({ ev, t }: { ev: any; t: any }) {
  const [open, setOpen] = useState(false)
  const statusStyle = STATUS_STYLE[ev.status] ?? STATUS_STYLE.Detected
  const dotColor    = IMPORTANCE_DOT[ev.importance] ?? 'bg-gray-600'

  return (
    <div className="border-b border-gray-900 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-right py-3 flex items-start gap-3 hover:bg-gray-900/30 rounded-lg px-2 transition"
      >
        {/* Importance dot */}
        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />

        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-white text-sm leading-snug text-right">{ev.headline}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${statusStyle}`}>
              {statusLabel(ev.status, t)}
            </span>
            <span className="text-[10px] text-gray-600">{ev.category}</span>
            <span className={`text-[10px] font-medium ${SENTIMENT_COLOR[ev.sentiment] ?? 'text-gray-400'}`}>
              {sentimentLabel(ev.sentiment, t)}
            </span>
          </div>
        </div>

        <span className="text-gray-700 text-[10px] flex-shrink-0 mt-0.5">
          {ev.timestamp?.slice(0, 10)}
        </span>
      </button>

      {open && (
        <div className="pb-4 px-2 space-y-3">
          {/* Summary */}
          {ev.summary && (
            <p className="text-gray-400 text-xs leading-relaxed">{ev.summary}</p>
          )}

          {/* Expected financial effects */}
          {ev.expected_financial_effects?.length > 0 && (
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1.5">{t.intel_expectedEffects}</p>
              <div className="space-y-1.5">
                {ev.expected_financial_effects.map((eff: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`font-bold text-base leading-none ${DIRECTION_COLOR[eff.direction] ?? 'text-gray-500'}`}>
                      {DIRECTION_ARROW[eff.direction] ?? '?'}
                    </span>
                    <span className="text-gray-300">{eff.financial_line}</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-gray-500">{eff.time_horizon}</span>
                    <span className="text-gray-600 text-[10px]">({Math.round(eff.confidence * 100)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affected companies */}
          {ev.affected_companies?.length > 0 && (
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1.5">{t.intel_secondOrderEffects}</p>
              <div className="flex flex-wrap gap-1.5">
                {ev.affected_companies.map((sym: string) => (
                  <Link
                    key={sym}
                    to={`/company/${sym}`}
                    className="text-xs font-mono text-brand-400 bg-brand-500/8 border border-brand-500/20 rounded px-2 py-0.5 hover:border-brand-500/50 transition"
                  >
                    {sym}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Requires confirmation */}
          {ev.requires_confirmation?.length > 0 && (
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1.5">{t.intel_requiresConfirmation}</p>
              <ul className="space-y-0.5">
                {ev.requires_confirmation.map((r: string) => (
                  <li key={r} className="text-xs text-blue-400 before:content-['›'] before:text-gray-600 before:mr-2">{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence */}
          {ev.supporting_evidence?.length > 0 && (
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1">{t.intel_supportingEvidence}</p>
              <ul className="space-y-0.5">
                {ev.supporting_evidence.map((e: string) => (
                  <li key={e} className="text-[11px] text-emerald-600">{e}</li>
                ))}
              </ul>
            </div>
          )}
          {ev.contradicting_evidence?.length > 0 && (
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-1">{t.intel_contradictingEvidence}</p>
              <ul className="space-y-0.5">
                {ev.contradicting_evidence.map((e: string) => (
                  <li key={e} className="text-[11px] text-red-700">{e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Source */}
          {ev.url && (
            <p className="text-[10px] text-gray-700">
              {t.intel_source}: <span className="text-gray-500">{ev.source}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  symbol: string
}

export default function EventIntelligencePanel({ symbol }: Props) {
  const { t } = useLanguage()
  const [data,    setData]    = useState<{ events: any[]; thesis: any } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!symbol) return
    fetch(`${BASE}/events/company/${symbol}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setData(d)
        if (d?.events?.length > 0) {
          trackEventIntelligenceOpen(symbol, d.events.length)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [symbol])

  const events = data?.events ?? []
  const important = events.filter(e => e.importance === 'Critical' || e.importance === 'High')
  const rest      = events.filter(e => e.importance !== 'Critical' && e.importance !== 'High')

  if (loading) return null
  if (!data || events.length === 0) return null

  return (
    <div className="space-y-4">
      {/* Section title */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-base">🔭 {t.intel_pageTitle}</h3>
        <Link
          to="/intelligence"
          className="text-xs text-gray-500 hover:text-white transition"
        >
          {t.intel_navLabel} →
        </Link>
      </div>

      {/* Business thesis */}
      <ThesisHeader thesis={data.thesis} t={t} />

      {/* Important events first */}
      {important.length > 0 && (
        <div className="space-y-1">
          <p className="text-gray-600 text-[10px] uppercase tracking-wider px-2">{t.intel_mostImportant}</p>
          <div className="divide-y divide-gray-900">
            {important.slice(0, 5).map(ev => <EventCard key={ev.id} ev={ev} t={t} />)}
          </div>
        </div>
      )}

      {/* Rest */}
      {rest.length > 0 && (
        <div className="divide-y divide-gray-900">
          {rest.slice(0, 5).map(ev => <EventCard key={ev.id} ev={ev} t={t} />)}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-gray-700 text-[10px] leading-relaxed border-t border-gray-900 pt-3 px-1 italic">
        {t.intel_disclaimer}
      </p>
    </div>
  )
}
