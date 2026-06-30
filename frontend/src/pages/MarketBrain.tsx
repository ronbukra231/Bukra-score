import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Brain, Zap, TrendingUp, TrendingDown, GitBranch } from 'lucide-react'
import { useLanguage } from '../i18n/index'
import LanguageToggle from '../components/LanguageToggle'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

async function fetchStats()    { const r = await fetch(`${BASE}/world-model/stats`);    if (!r.ok) throw new Error(); return r.json() }
async function fetchPatterns() { const r = await fetch(`${BASE}/world-model/patterns`); if (!r.ok) throw new Error(); return r.json() }
async function fetchKnowledge(){ const r = await fetch(`${BASE}/world-model/knowledge`);if (!r.ok) throw new Error(); return r.json() }

// ── Confidence bar ────────────────────────────────────────────────────────────

function ConfBar({ value }: { value: number }) {
  const pct   = Math.round(value * 100)
  const color = pct >= 70 ? '#34d399' : pct >= 45 ? '#fbbf24' : '#6b7280'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-20 bg-gray-800 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  )
}

// ── Pattern status pill ───────────────────────────────────────────────────────

function PatternStatus({ frequency, t }: { frequency: number; t: any }) {
  if (frequency >= 3)
    return <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">{t.brain_statusConfirmed}</span>
  return <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">{t.brain_statusEmerging}</span>
}

// ── Pattern card ──────────────────────────────────────────────────────────────

function PatternCard({ p, t }: { p: any; t: any }) {
  const [open, setOpen] = useState(false)
  const hasOutcomes = (p.outcome_count ?? 0) > 0

  return (
    <div className="border-b border-gray-900 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-right py-4 px-0 flex items-start gap-4 hover:bg-gray-900/40 transition rounded-lg px-3"
      >
        {/* Pattern ID */}
        <span className="text-[10px] font-mono text-gray-700 mt-0.5 flex-shrink-0 w-12 text-left">
          {p.pattern_id}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <PatternStatus frequency={p.frequency} t={t} />
            <span className="text-[10px] text-gray-600">
              {p.frequency} {t.brain_patternCompanies}
            </span>
            {(p.sectors || []).slice(0, 2).map((s: string) => (
              <span key={s} className="text-[10px] text-gray-600 bg-gray-800 rounded px-1.5 py-0.5">{s}</span>
            ))}
          </div>
          <p className="text-white text-sm leading-snug">{p.label}</p>
        </div>

        <div className="flex-shrink-0 pt-0.5">
          <ConfBar value={p.confidence} />
        </div>
      </button>

      {open && (
        <div className="pb-5 px-3 space-y-4">
          {/* Success rate */}
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <span>
              {t.brain_patternSuccessRate}:{' '}
              {hasOutcomes
                ? <strong className="text-gray-300">{Math.round((p.success_rate ?? 0) * 100)}%</strong>
                : <span className="text-gray-700 italic">{t.brain_patternNoOutcomes}</span>}
            </span>
            {hasOutcomes && (
              <span>{p.positive_outcome_count}/{p.outcome_count} תוצאות חיוביות</span>
            )}
            <span>{t.brain_patternFirstSeen}: <strong className="text-gray-400">{p.first_seen}</strong></span>
          </div>

          {/* Companies */}
          {(p.companies || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {p.companies.map((sym: string) => (
                <Link
                  key={sym}
                  to={`/company/${sym}`}
                  className="text-xs font-mono text-brand-400 bg-brand-500/8 border border-brand-500/20 rounded px-2 py-0.5 hover:border-brand-500/50 transition"
                >
                  {sym}
                </Link>
              ))}
            </div>
          )}

          {/* Signature breakdown */}
          <div className="bg-gray-900 rounded-xl p-3 font-mono text-[11px] text-gray-500 space-y-1">
            {p.pattern_signature.split('|').map((part: string) => {
              const [k, v] = part.split(':')
              const valColor = v === 'up' || v === 'improving' ? 'text-emerald-400'
                : v === 'down' || v === 'worsening' ? 'text-red-400'
                : 'text-gray-400'
              return (
                <div key={part} className="flex gap-2">
                  <span className="text-gray-700 w-14">{k}</span>
                  <span className={valColor}>{v}</span>
                </div>
              )
            })}
          </div>

          {/* Evidence count */}
          <div className="text-xs text-gray-700">
            {p.supporting_evidence?.length ?? 0} תצפיות תומכות
            {(p.contradicting_evidence?.length ?? 0) > 0 && (
              <span className="text-red-800 ml-3">
                {p.contradicting_evidence.length} סותרות
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Relationship row ──────────────────────────────────────────────────────────

const EDGE_COLORS: Record<string, string> = {
  confirmed:          'text-emerald-400',
  contradicted:       'text-red-400',
  preceded:           'text-brand-400',
  associated_with:    'text-gray-400',
  sector_correlation: 'text-amber-400',
}

function EdgeRow({ e }: { e: any }) {
  const srcLabel = e.source.split('::')[1]?.replace(/_/g, ' ') ?? e.source
  const tgtLabel = e.target.split('::')[1]?.replace(/_/g, ' ') ?? e.target
  const typeColor = EDGE_COLORS[e.type] ?? 'text-gray-500'

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-900 last:border-0 text-xs">
      <span className="text-gray-300 min-w-0 flex-1 truncate">{srcLabel}</span>
      <span className={`flex-shrink-0 font-medium text-[10px] ${typeColor}`}>{e.type.replace(/_/g, ' ')}</span>
      <span className="text-gray-300 min-w-0 flex-1 truncate text-left">{tgtLabel}</span>
      <span className="font-mono text-gray-600 flex-shrink-0 w-8 text-right">{e.weight}</span>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon, count, children }: {
  title: string; icon: React.ReactNode; count?: number; children: React.ReactNode
}) {
  return (
    <section className="space-y-1">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-gray-500">{icon}</span>
        <h2 className="text-white font-bold text-sm tracking-wide uppercase">{title}</h2>
        {count != null && (
          <span className="text-gray-700 text-xs bg-gray-900 rounded-full px-2 py-0.5">{count}</span>
        )}
      </div>
      {children}
    </section>
  )
}

// ── Mini belief card ──────────────────────────────────────────────────────────

function BeliefCard({ p, direction }: { p: any; direction: 'up' | 'down' }) {
  const sr  = p.success_rate != null ? Math.round(p.success_rate * 100) : null
  const col = direction === 'up' ? 'text-emerald-400' : 'text-red-400'
  return (
    <div className="bg-gray-900 rounded-xl p-3 space-y-1">
      <p className="text-white text-xs leading-snug">{p.label}</p>
      <div className="flex items-center gap-3 text-[10px] text-gray-500">
        <span>{p.frequency} חברות</span>
        {sr != null && <span className={col}>{sr}% הצלחה</span>}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketBrain() {
  const { t, isHe } = useLanguage()
  const [stats,    setStats]    = useState<any>(null)
  const [patterns, setPatterns] = useState<any[]>([])
  const [graph,    setGraph]    = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)

  useEffect(() => {
    Promise.all([fetchStats(), fetchPatterns(), fetchKnowledge()])
      .then(([s, p, g]) => {
        setStats(s)
        setPatterns(p.patterns ?? [])
        setGraph(g)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const confirmed = patterns.filter(p => p.frequency >= 3)
  const emerging  = patterns.filter(p => p.frequency < 3)
  const isEmpty   = !loading && !error && patterns.length === 0

  return (
    <div className="min-h-screen bg-gray-950" dir={isHe ? 'rtl' : 'ltr'}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white transition flex-shrink-0">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Brain className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <span className="text-white font-bold text-sm truncate">{t.brain_title}</span>
            <span className="text-gray-700 hidden sm:block">—</span>
            <span className="text-gray-500 text-xs hidden sm:block truncate">{t.brain_subtitle}</span>
          </div>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-14">

        {/* ── Title block ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-violet-400" />
            <h1 className="text-2xl font-black text-white">{t.brain_title}</h1>
          </div>
          <p className="text-gray-600 text-sm max-w-xl leading-relaxed italic">
            "{t.brain_tagline}"
          </p>

          {/* Stats row */}
          {stats && !isEmpty && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {[
                [stats.total_patterns,          t.brain_statPatterns],
                [stats.total_observations,       t.brain_statObservations],
                [stats.total_companies_observed, t.brain_statCompanies],
                [stats.patterns_with_outcomes,   t.brain_statWithOutcomes],
                [stats.graph?.total_nodes,       t.brain_statNodes],
                [stats.graph?.total_edges,       t.brain_statEdges],
              ].map(([val, label]) => (
                <div key={String(label)} className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3">
                  <div className="text-xl font-black text-white tabular-nums">{val ?? 0}</div>
                  <div className="text-gray-600 text-[10px] mt-0.5 uppercase tracking-wider">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center gap-3 py-20 justify-center">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-600 text-sm">הגרף נטען...</span>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="py-20 text-center text-gray-600 text-sm">שגיאה בטעינת המוח. ודא שהשרת פועל.</div>
        )}

        {/* ── Empty ── */}
        {isEmpty && (
          <div className="py-24 text-center space-y-4">
            <Brain className="w-12 h-12 text-gray-800 mx-auto" />
            <p className="text-white font-bold text-lg">{t.brain_noData}</p>
            <p className="text-gray-600 text-sm max-w-sm mx-auto">{t.brain_noDataSub}</p>
            <Link to="/scanner" className="inline-block mt-4 text-sm text-brand-400 hover:text-brand-300 transition">
              פתח סריקה →
            </Link>
          </div>
        )}

        {/* ── Confirmed patterns ── */}
        {!loading && !error && confirmed.length > 0 && (
          <Section title={t.brain_sectionPatterns} icon={<GitBranch className="w-4 h-4" />} count={confirmed.length}>
            <div className="divide-y divide-gray-900">
              {confirmed.map(p => <PatternCard key={p.pattern_id} p={p} t={t} />)}
            </div>
          </Section>
        )}

        {/* ── Strengthened / Weakened beliefs (side by side) ── */}
        {stats && ((stats.recently_strengthened?.length > 0) || (stats.recently_weakened?.length > 0)) && (
          <div className="grid sm:grid-cols-2 gap-6">
            {stats.recently_strengthened?.length > 0 && (
              <Section title={t.brain_sectionStrengthened} icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}>
                <div className="space-y-2">
                  {stats.recently_strengthened.map((p: any) => (
                    <BeliefCard key={p.pattern_id} p={p} direction="up" />
                  ))}
                </div>
              </Section>
            )}
            {stats.recently_weakened?.length > 0 && (
              <Section title={t.brain_sectionWeakened} icon={<TrendingDown className="w-4 h-4 text-red-500" />}>
                <div className="space-y-2">
                  {stats.recently_weakened.map((p: any) => (
                    <BeliefCard key={p.pattern_id} p={p} direction="down" />
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {/* ── Emerging patterns ── */}
        {!loading && !error && emerging.length > 0 && (
          <Section title={t.brain_sectionEmerging} icon={<Zap className="w-4 h-4" />} count={emerging.length}>
            <div className="divide-y divide-gray-900">
              {emerging.map(p => <PatternCard key={p.pattern_id} p={p} t={t} />)}
            </div>
          </Section>
        )}

        {/* ── Strongest knowledge relationships ── */}
        {graph && (graph.edges?.length > 0) && (
          <Section
            title={t.brain_sectionRelationships}
            icon={<GitBranch className="w-4 h-4" />}
            count={graph.stats?.total_edges}
          >
            <div className="bg-gray-900/40 border border-gray-800 rounded-2xl px-4 py-1">
              <div className="flex items-center gap-3 py-2 border-b border-gray-800 text-[10px] text-gray-700 uppercase tracking-widest">
                <span className="flex-1">מקור</span>
                <span className="flex-shrink-0 w-24 text-center">קשר</span>
                <span className="flex-1 text-left">יעד</span>
                <span className="w-8 text-right">{t.brain_edgeWeight}</span>
              </div>
              {graph.edges.slice(0, 20).map((e: any, i: number) => (
                <EdgeRow key={i} e={e} />
              ))}
              {graph.edges.length > 20 && (
                <div className="py-3 text-center text-gray-700 text-xs">
                  + {graph.edges.length - 20} קשרים נוספים
                </div>
              )}
            </div>

            {/* Node type summary */}
            {graph.stats?.nodes_by_type && (
              <div className="flex flex-wrap gap-3 pt-2">
                {Object.entries(graph.stats.nodes_by_type).map(([type, count]) => (
                  <div key={type} className="text-xs text-gray-600">
                    <span className="text-gray-400 font-medium">{String(count)}</span> {type.replace(/_/g,' ')}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Footer principle ── */}
        {!loading && !error && (
          <div className="border-t border-gray-900 pt-8 pb-4">
            <p className="text-gray-700 text-xs leading-relaxed max-w-lg">
              {isHe
                ? 'כל שורת קוד חדשה צריכה להגדיל את יכולתה של בוקרה להבין שווקים מחר יותר מאשר היום. לא נייעל פיצ׳רים. נייעל אינטליגנציה מצטברת.'
                : "Every new line of code should increase Bukra's ability to understand markets tomorrow more than today. Never optimize for features. Optimize for compounding intelligence."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
