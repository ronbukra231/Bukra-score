import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Brain, CheckCircle2, AlertCircle, Archive, ChevronDown, ChevronUp } from 'lucide-react'
import { useLanguage } from '../i18n/index'
import LanguageToggle from '../components/LanguageToggle'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

async function getMemory() {
  const res = await fetch(`${BASE}/memory/`)
  if (!res.ok) throw new Error('שגיאה בטעינת נתוני הזיכרון')
  return res.json()
}

// ── Confidence Sparkline ──────────────────────────────────────────────────────

function ConfidenceSparkline({ history }: { history: { date: string; confidence: number; reason: string }[] }) {
  if (!history || history.length === 0) return null
  const W = 200, H = 48, pad = 6
  const confs = history.map(h => h.confidence)
  const min = Math.min(...confs, 0)
  const max = Math.max(...confs, 1)
  const range = max - min || 1

  const points = confs.map((c, i) => {
    const x = pad + (i / Math.max(confs.length - 1, 1)) * (W - pad * 2)
    const y = H - pad - ((c - min) / range) * (H - pad * 2)
    return `${x},${y}`
  }).join(' ')

  const last = history[history.length - 1]
  const lastPct = Math.round(last.confidence * 100)
  const color = lastPct >= 75 ? '#34d399' : lastPct >= 55 ? '#fbbf24' : '#f87171'

  return (
    <div className="space-y-1">
      <svg width={W} height={H} className="overflow-visible">
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {history.map((h, i) => {
          const x = pad + (i / Math.max(confs.length - 1, 1)) * (W - pad * 2)
          const y = H - pad - ((h.confidence - min) / range) * (H - pad * 2)
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />
        })}
      </svg>
      <div className="flex justify-between text-xs text-gray-600">
        <span>{history[0] ? `${Math.round(history[0].confidence * 100)}%` : ''}</span>
        <span className="font-bold" style={{ color }}>{lastPct}%</span>
      </div>
    </div>
  )
}

// ── Research score bar ────────────────────────────────────────────────────────

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100)
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-mono text-gray-400">{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full">
        <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    emerging:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
    confirmed:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    historical: 'bg-gray-700/40 text-gray-500 border-gray-600/30',
  }
  const labels: Record<string, string> = {
    emerging: 'בחינה', confirmed: 'מאושרת', historical: 'היסטורית',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${configs[status] ?? configs.emerging}`}>
      {labels[status] ?? status}
    </span>
  )
}

// ── Memory card ───────────────────────────────────────────────────────────────

function MemoryCard({ mem, t }: { mem: any; t: any }) {
  const [open, setOpen] = useState(false)
  const score  = mem.research_score || {}
  const fq     = mem.four_questions || {}
  const events = mem.validation_history || []
  const evHist = mem.evidence_history || []

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        className="w-full text-right p-5 flex items-start gap-3 hover:bg-gray-800/40 transition"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <StatusBadge status={mem.status} />
            <span className="text-xs text-gray-600">{mem.category}</span>
            {score.total != null && (
              <span className="text-xs bg-brand-600/10 text-brand-400 border border-brand-500/20 rounded-full px-2 py-0.5 font-mono">
                {t.memory_researchScore}: {score.total}/100
              </span>
            )}
          </div>
          <h3 className="text-white font-bold text-sm leading-tight mb-2">{mem.title}</h3>

          {/* Sparkline inline */}
          {(mem.confidence_history || []).length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-1">{t.memory_confidenceTimeline}</div>
              <ConfidenceSparkline history={mem.confidence_history} />
            </div>
          )}
        </div>
        <div className="text-gray-600 flex-shrink-0 mt-1">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded */}
      {open && (
        <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-5">

          {/* 4 research questions */}
          {(fq.observation || fq.significance || fq.supporting_evidence || fq.invalidation_criteria) && (
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                {t.memory_fourQuestionsTitle}
              </div>
              <div className="space-y-3">
                {[
                  { label: t.memory_q1, text: fq.observation },
                  { label: t.memory_q2, text: fq.significance },
                  { label: t.memory_q3, text: fq.supporting_evidence },
                  { label: t.memory_q4, text: fq.invalidation_criteria, accent: true },
                ].filter(q => q.text).map((q, i) => (
                  <div key={i} className={`p-3 rounded-xl border text-right ${q.accent ? 'bg-red-500/5 border-red-500/15' : 'bg-gray-800/60 border-gray-700/50'}`}>
                    <div className={`text-xs font-semibold mb-1 ${q.accent ? 'text-red-400' : 'text-gray-500'}`}>{q.label}</div>
                    <div className="text-gray-300 text-xs leading-relaxed">{q.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Research score breakdown */}
          {score.total != null && (
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                {t.memory_researchScore} — {score.total}/100
              </div>
              <div className="space-y-2">
                <ScoreBar label={t.memory_evidenceQty}    value={score.evidence_quantity ?? 0}     max={25} />
                <ScoreBar label={t.memory_evidenceQual}   value={score.evidence_quality ?? 0}      max={25} />
                <ScoreBar label={t.memory_historicalCons} value={score.historical_consistency ?? 0} max={20} />
                <ScoreBar label={t.memory_crossSectorCons}value={score.cross_sector_consistency ?? 0} max={15} />
                <ScoreBar label={t.memory_fpControl}      value={score.false_positive_control ?? 0} max={15} />
              </div>
            </div>
          )}

          {/* Evidence history */}
          {evHist.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">{t.memory_evidenceHistory}</div>
              <div className="space-y-1.5">
                {evHist.slice(-5).map((e: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(e.date).toLocaleDateString('he-IL', { day:'numeric', month:'short' })}</span>
                    <span className="text-emerald-400">+{e.count} חברות</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation timeline */}
          {events.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">{t.memory_validationEvents}</div>
              <div className="border-r-2 border-gray-700 pr-3 space-y-3">
                {events.map((ev: any, i: number) => (
                  <div key={i} className="relative">
                    <div className="absolute right-[-1.1rem] top-1 w-2 h-2 rounded-full bg-brand-500" />
                    <div className="text-xs text-gray-600 mb-0.5">
                      {new Date(ev.date).toLocaleDateString('he-IL', { day:'numeric', month:'short', year:'numeric' })}
                    </div>
                    <div className="text-xs text-gray-400 text-right leading-relaxed">{ev.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affected companies */}
          {(mem.affected_companies || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-800">
              {mem.affected_companies.slice(0, 10).map((sym: string) => (
                <Link key={sym} to={`/company/${sym}`}
                  className="text-xs font-mono bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-2 py-0.5 transition border border-gray-700">
                  {sym}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, icon, count, children, cls = 'text-brand-400' }:
  { title: string; icon: React.ReactNode; count: number; children: React.ReactNode; cls?: string }) {
  if (count === 0) return null
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <span className={cls}>{icon}</span>
        <h2 className="text-white font-bold text-base">{title}</h2>
        <span className="text-gray-600 text-xs bg-gray-800 rounded-full px-2 py-0.5">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResearchMemory() {
  const { t, isHe }           = useLanguage()
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    getMemory()
      .then(d  => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const isEmpty = data && data.stats?.total === 0

  return (
    <div className="min-h-screen bg-gray-950" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white transition flex-shrink-0">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <Brain className="w-4 h-4 text-purple-400" />
            <span className="text-white font-bold text-sm">{t.memory_title}</span>
            <span className="text-gray-600 text-sm">—</span>
            <span className="text-gray-400 text-sm">{t.memory_subtitle}</span>
          </div>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            <h1 className="text-2xl font-black text-white">{t.memory_title}</h1>
          </div>
          <p className="text-gray-500 text-sm max-w-2xl leading-relaxed italic">
            "{t.memory_tagline}"
          </p>
          {data && !isEmpty && (
            <div className="flex flex-wrap gap-5 pt-2 text-xs text-gray-500">
              <span><strong className="text-gray-300">{data.stats?.total ?? 0}</strong> {t.memory_statTotal}</span>
              <span className="text-emerald-400"><strong>{data.stats?.confirmed ?? 0}</strong> {t.memory_statConfirmed}</span>
              <span className="text-amber-400"><strong>{data.stats?.emerging ?? 0}</strong> {t.memory_statEmerging}</span>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-3 py-20 justify-center">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">טוען זיכרון מחקר...</span>
          </div>
        )}

        {error && !loading && (
          <div className="py-20 text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        )}

        {isEmpty && !loading && (
          <div className="py-24 text-center space-y-4">
            <Brain className="w-12 h-12 text-gray-700 mx-auto" />
            <h2 className="text-white font-bold text-xl">{t.memory_noData}</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">{t.memory_noDataSub}</p>
            <Link to="/scanner" className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition mt-4">
              פתח סריקה
            </Link>
          </div>
        )}

        {data && !isEmpty && !loading && (
          <div className="space-y-12">
            <Section title={t.memory_activeSection} icon={<AlertCircle className="w-4 h-4" />}
              count={(data.emerging_memories || []).length} cls="text-amber-400">
              {(data.emerging_memories || []).map((m: any) => <MemoryCard key={m.signature} mem={m} t={t} />)}
            </Section>
            <Section title={t.memory_confirmedSection} icon={<CheckCircle2 className="w-4 h-4" />}
              count={(data.confirmed_memories || []).length} cls="text-emerald-400">
              {(data.confirmed_memories || []).map((m: any) => <MemoryCard key={m.signature} mem={m} t={t} />)}
            </Section>
            <Section title={t.memory_historicalSection} icon={<Archive className="w-4 h-4" />}
              count={(data.historical_memories || []).length} cls="text-gray-500">
              <div className="opacity-60">
                {(data.historical_memories || []).map((m: any) => <MemoryCard key={m.signature} mem={m} t={t} />)}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}
