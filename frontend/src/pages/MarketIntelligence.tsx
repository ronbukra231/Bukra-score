/**
 * Market Intelligence page — Mission Alpha 2.5
 *
 * This is NOT a news aggregator.
 * It is an interpreted view of business events across all companies.
 *
 * What is changing? Why? Who is affected?
 * Who may benefit? Who may suffer? What evidence exists?
 * What still needs confirmation?
 *
 * The Bukra Score is NEVER changed by anything on this page.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Eye, CheckCircle, XCircle, Clock, Zap, Link2 } from 'lucide-react'
import { useLanguage } from '../i18n/index'
import LanguageToggle from '../components/LanguageToggle'
import { trackIntelligenceOpen } from '../lib/analytics'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

async function fetchThemes()        { const r = await fetch(`${BASE}/events/themes`);        if (!r.ok) throw new Error(); return r.json() }
async function fetchRelationships() { const r = await fetch(`${BASE}/events/relationships`); if (!r.ok) throw new Error(); return r.json() }
async function fetchRecent()        { const r = await fetch(`${BASE}/events/market?limit=30`);if (!r.ok) throw new Error(); return r.json() }
async function fetchStats()         { const r = await fetch(`${BASE}/events/stats`);          if (!r.ok) throw new Error(); return r.json() }

// ── Status chip ────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  Detected:  'text-gray-400 bg-gray-800/80 border-gray-700',
  Analyzing: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Monitoring:'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Confirmed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Rejected:  'text-red-500 bg-red-500/10 border-red-500/20',
}

const SENTIMENT_COLOR: Record<string, string> = {
  Positive: 'text-emerald-400',
  Negative: 'text-red-400',
  Neutral:  'text-gray-500',
  Mixed:    'text-amber-400',
}

const IMPORTANCE_DOT: Record<string, string> = {
  Low:      'bg-gray-700',
  Medium:   'bg-amber-500',
  High:     'bg-orange-500',
  Critical: 'bg-red-500 animate-pulse',
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${STATUS_STYLE[status] ?? STATUS_STYLE.Detected}`}>
      {status}
    </span>
  )
}

// ── Theme card ────────────────────────────────────────────────────────────────

function ThemeCard({ theme, t }: { theme: any; t: any }) {
  const confPct   = Math.round(theme.confirmation_rate * 100)
  const sentiment = theme.positive > theme.negative ? 'pos' : theme.negative > theme.positive ? 'neg' : 'neutral'
  const sentColor = sentiment === 'pos' ? 'text-emerald-400' : sentiment === 'neg' ? 'text-red-400' : 'text-gray-500'

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-white font-semibold text-sm leading-snug">{theme.category}</h3>
        <span className="text-gray-600 text-xs flex-shrink-0">{theme.total} {t.intel_themeCount}</span>
      </div>

      {/* Confirmation bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-gray-600">
          <span>{t.intel_themeConfirmRate}</span>
          <span className={confPct >= 60 ? 'text-emerald-500' : confPct >= 30 ? 'text-amber-500' : 'text-gray-600'}>
            {confPct}%
          </span>
        </div>
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-1 rounded-full"
            style={{
              width: `${confPct}%`,
              background: confPct >= 60 ? '#34d399' : confPct >= 30 ? '#fbbf24' : '#4b5563',
            }}
          />
        </div>
      </div>

      {/* Status breakdown */}
      <div className="flex gap-3 text-[10px]">
        <span className="text-emerald-600">{theme.confirmed} ✓</span>
        <span className="text-red-700">{theme.rejected} ✗</span>
        <span className="text-blue-500">{theme.active} ●</span>
        <span className={`ml-auto ${sentColor}`}>
          {theme.positive}↑ {theme.negative}↓
        </span>
      </div>

      {/* Affected companies */}
      {theme.companies?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {theme.companies.slice(0, 6).map((sym: string) => (
            <Link
              key={sym}
              to={`/company/${sym}`}
              className="text-[10px] font-mono text-brand-400 bg-brand-500/8 border border-brand-500/15 rounded px-1.5 py-0.5 hover:border-brand-500/40 transition"
            >
              {sym}
            </Link>
          ))}
          {theme.companies.length > 6 && (
            <span className="text-[10px] text-gray-700">+{theme.companies.length - 6}</span>
          )}
        </div>
      )}

      {/* Recent headline */}
      {theme.recent_headline && (
        <p className="text-gray-600 text-[10px] leading-snug italic truncate">{theme.recent_headline}</p>
      )}
    </div>
  )
}

// ── Cross-sector chain ────────────────────────────────────────────────────────

function ChainRow({ rel }: { rel: any }) {
  const sentColor = SENTIMENT_COLOR[rel.sentiment] ?? 'text-gray-500'
  return (
    <div className="py-3 border-b border-gray-900 last:border-0">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          to={`/company/${rel.source_symbol}`}
          className="font-mono font-bold text-white hover:text-brand-400 transition"
        >
          {rel.source_symbol}
        </Link>
        <span className="text-gray-700">→</span>
        <span className="text-gray-400 text-[10px]">{rel.category}</span>
        <span className="text-gray-700">→</span>
        <div className="flex gap-1.5 flex-wrap">
          {rel.affected_companies.slice(0, 5).map((sym: string) => (
            <Link
              key={sym}
              to={`/company/${sym}`}
              className="font-mono text-brand-400 hover:text-brand-300 transition"
            >
              {sym}
            </Link>
          ))}
          {rel.affected_companies.length > 5 && (
            <span className="text-gray-700">+{rel.affected_companies.length - 5}</span>
          )}
        </div>
        <span className={`ml-auto flex-shrink-0 text-[10px] font-medium ${sentColor}`}>
          {rel.sentiment}
        </span>
      </div>
      <p className="text-gray-600 text-[10px] mt-1 leading-snug">{rel.headline}</p>
    </div>
  )
}

// ── Recent event row ──────────────────────────────────────────────────────────

function EventRow({ ev }: { ev: any }) {
  const dotColor = IMPORTANCE_DOT[ev.importance] ?? 'bg-gray-700'
  const sentColor = SENTIMENT_COLOR[ev.sentiment] ?? 'text-gray-500'
  return (
    <div className="py-3 border-b border-gray-900 last:border-0 flex items-start gap-3">
      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <Link
            to={`/company/${ev.symbol}`}
            className="text-xs font-mono font-bold text-brand-400 hover:text-brand-300 transition flex-shrink-0"
          >
            {ev.symbol}
          </Link>
          <StatusChip status={ev.status} />
          <span className="text-[10px] text-gray-600">{ev.category}</span>
          <span className={`text-[10px] font-medium ${sentColor}`}>{ev.sentiment}</span>
        </div>
        <p className="text-white text-xs leading-snug">{ev.headline}</p>
      </div>
      <span className="text-gray-700 text-[10px] flex-shrink-0">{ev.timestamp?.slice(0, 10)}</span>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-gray-500">{icon}</span>
      <h2 className="text-white font-bold text-sm tracking-wide uppercase">{title}</h2>
      {count != null && (
        <span className="text-gray-700 text-xs bg-gray-900 rounded-full px-2 py-0.5">{count}</span>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketIntelligence() {
  const { t, isHe } = useLanguage()
  const [themes,  setThemes]  = useState<any>(null)
  const [chains,  setChains]  = useState<any[]>([])
  const [recent,  setRecent]  = useState<any[]>([])
  const [stats,   setStats]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    trackIntelligenceOpen()
    Promise.all([fetchThemes(), fetchRelationships(), fetchRecent(), fetchStats()])
      .then(([th, ch, re, st]) => {
        setThemes(th)
        setChains(ch.relationships ?? [])
        setRecent(re.events ?? [])
        setStats(st)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const isEmpty = !loading && !error && (themes?.total_events ?? 0) === 0

  const confirmedThemes = (themes?.themes ?? []).filter((th: any) => th.confirmed > 0)
  const growingThemes   = (themes?.themes ?? []).filter((th: any) => th.active > 0)
  const rejectedThemes  = (themes?.themes ?? []).filter((th: any) => th.rejected > 0 && th.confirmed === 0)

  return (
    <div className="min-h-screen bg-gray-950" dir={isHe ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-900">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white transition flex-shrink-0">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Eye className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <span className="text-white font-bold text-sm truncate">{t.intel_pageTitle}</span>
            <span className="text-gray-700 hidden sm:block">—</span>
            <span className="text-gray-500 text-xs hidden sm:block truncate">{t.intel_pageSubtitle}</span>
          </div>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-16">

        {/* Title + tagline */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-teal-400" />
            <h1 className="text-2xl font-black text-white">{t.intel_pageTitle}</h1>
          </div>
          <p className="text-gray-600 text-sm max-w-xl leading-relaxed italic">"{t.intel_pageTagline}"</p>

          {/* Stats */}
          {stats && !isEmpty && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                [stats.total_events,    t.intel_statTotal,      'text-white'],
                [stats.by_status?.Confirmed ?? 0, t.intel_statConfirmed, 'text-emerald-400'],
                [stats.by_status?.Monitoring ?? 0 + (stats.by_status?.Analyzing ?? 0), t.intel_statMonitoring, 'text-blue-400'],
                [stats.categories_seen, t.intel_statCategories, 'text-gray-300'],
              ].map(([val, label, col]) => (
                <div key={String(label)} className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3">
                  <div className={`text-xl font-black tabular-nums ${col}`}>{val ?? 0}</div>
                  <div className="text-gray-600 text-[10px] mt-0.5 uppercase tracking-wider">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 py-20 justify-center">
            <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-600 text-sm">טוען אינטליגנציה שוקית...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="py-20 text-center text-gray-600 text-sm">שגיאה בטעינה. ודא שהשרת פועל.</div>
        )}

        {/* Empty */}
        {isEmpty && (
          <div className="py-24 text-center space-y-4">
            <Eye className="w-12 h-12 text-gray-800 mx-auto" />
            <p className="text-white font-bold text-lg">{t.intel_noEvents}</p>
            <p className="text-gray-600 text-sm max-w-sm mx-auto">{t.intel_noEventsSub}</p>
          </div>
        )}

        {/* Cross-sector relationships — most striking view */}
        {chains.length > 0 && (
          <section>
            <SectionTitle
              icon={<Link2 className="w-4 h-4" />}
              title={t.intel_chains}
              count={chains.length}
            />
            <p className="text-gray-600 text-xs mb-4 -mt-2">{t.intel_chainDesc}</p>
            <div className="bg-gray-900/40 border border-gray-800 rounded-2xl px-4 py-1">
              {chains.slice(0, 15).map((rel, i) => <ChainRow key={i} rel={rel} />)}
            </div>
          </section>
        )}

        {/* Most confirmed themes */}
        {confirmedThemes.length > 0 && (
          <section>
            <SectionTitle
              icon={<CheckCircle className="w-4 h-4 text-emerald-500" />}
              title={t.intel_mostConfirmed}
              count={confirmedThemes.length}
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {confirmedThemes.slice(0, 6).map((th: any) => <ThemeCard key={th.category} theme={th} t={t} />)}
            </div>
          </section>
        )}

        {/* Growing / active narratives */}
        {growingThemes.length > 0 && (
          <section>
            <SectionTitle
              icon={<Zap className="w-4 h-4 text-amber-400" />}
              title={t.intel_fastestGrowing}
              count={growingThemes.length}
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {growingThemes.slice(0, 6).map((th: any) => <ThemeCard key={th.category} theme={th} t={t} />)}
            </div>
          </section>
        )}

        {/* Recent events timeline */}
        {recent.length > 0 && (
          <section>
            <SectionTitle
              icon={<Clock className="w-4 h-4" />}
              title={t.intel_eventTimeline}
              count={recent.length}
            />
            <div className="bg-gray-900/40 border border-gray-800 rounded-2xl px-4 py-1">
              {recent.slice(0, 20).map(ev => <EventRow key={ev.id} ev={ev} />)}
            </div>
          </section>
        )}

        {/* Rejected narratives */}
        {rejectedThemes.length > 0 && (
          <section>
            <SectionTitle
              icon={<XCircle className="w-4 h-4 text-red-600" />}
              title={t.intel_rejectedNarr}
              count={rejectedThemes.length}
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rejectedThemes.map((th: any) => <ThemeCard key={th.category} theme={th} t={t} />)}
            </div>
          </section>
        )}

        {/* Disclaimer */}
        {!loading && !error && (
          <div className="border-t border-gray-900 pt-8 pb-4">
            <p className="text-gray-700 text-xs leading-relaxed max-w-2xl italic">
              {t.intel_disclaimer}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
