import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, HelpCircle, Search, CheckCircle2, XCircle, Moon, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { useLanguage } from '../i18n/index'
import LanguageToggle from '../components/LanguageToggle'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

async function getQuestions() {
  const res = await fetch(`${BASE}/memory/questions`)
  if (!res.ok) throw new Error('שגיאה בטעינת שאלות המחקר')
  return res.json()
}

// ── Priority badge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority, t }: { priority: string; t: any }) {
  const cfgs: Record<string, string> = {
    High:   'bg-red-500/15 text-red-400 border-red-500/25',
    Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    Low:    'bg-gray-700/40 text-gray-500 border-gray-600/30',
  }
  const labels: Record<string, string> = {
    High:   t.questions_priorityHigh,
    Medium: t.questions_priorityMedium,
    Low:    t.questions_priorityLow,
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfgs[priority] ?? cfgs.Low}`}>
      {labels[priority] ?? priority}
    </span>
  )
}

// ── Question card ─────────────────────────────────────────────────────────────

function QuestionCard({ q, t }: { q: any; t: any }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <button
        className="w-full text-right p-4 flex items-start gap-3 hover:bg-gray-800/40 transition"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <PriorityBadge priority={q.priority} t={t} />
            {q.sector && q.sector !== 'All' && (
              <span className="text-xs text-gray-500 bg-gray-800 rounded-full px-2 py-0.5">{q.sector}</span>
            )}
            {(q.tags || []).slice(0, 3).map((tag: string) => (
              <span key={tag} className="text-xs text-brand-400/70 font-mono">#{tag}</span>
            ))}
          </div>
          <p className="text-white text-sm font-semibold leading-tight text-right">{q.question}</p>
        </div>
        <div className="text-gray-600 flex-shrink-0 mt-1">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
          {q.hypothesis && (
            <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/50 text-right">
              <div className="text-xs text-gray-500 font-semibold mb-1">{t.questions_hypothesis}</div>
              <div className="text-gray-300 text-xs leading-relaxed">{q.hypothesis}</div>
            </div>
          )}
          {(q.related_discoveries || []).length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1.5">{t.questions_relatedDisc}</div>
              <div className="flex flex-wrap gap-1.5">
                {q.related_discoveries.map((sig: string) => (
                  <span key={sig} className="text-xs font-mono text-brand-400 bg-brand-500/10 rounded-lg px-2 py-0.5 border border-brand-500/20">
                    {sig.split(':').slice(-1)[0] || sig}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-600 pt-1 border-t border-gray-800">
            <span>{t.questions_generatedBy}: <strong className="text-gray-500">{q.generated_by}</strong></span>
            <span>{new Date(q.created_at).toLocaleDateString('he-IL', { day:'numeric', month:'short', year:'numeric' })}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Status section ────────────────────────────────────────────────────────────

type StatusConfig = { key: string; label: string; icon: React.ReactNode; cls: string }

function StatusSection({ config, questions, t }: { config: StatusConfig; questions: any[]; t: any }) {
  if (questions.length === 0) return null
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <span className={config.cls}>{config.icon}</span>
        <h2 className="text-white font-bold text-base">{config.label}</h2>
        <span className="text-gray-600 text-xs bg-gray-800 rounded-full px-2 py-0.5">{questions.length}</span>
      </div>
      <div className="space-y-3">
        {questions.map(q => <QuestionCard key={q.id} q={q} t={t} />)}
      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResearchQuestions() {
  const { t, isHe }           = useLanguage()
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    getQuestions()
      .then(d  => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const statusConfigs: StatusConfig[] = [
    { key: 'open',          label: t.questions_open,          icon: <HelpCircle className="w-4 h-4" />, cls: 'text-gray-400' },
    { key: 'investigating', label: t.questions_investigating,  icon: <Search className="w-4 h-4" />,    cls: 'text-brand-400' },
    { key: 'validated',     label: t.questions_validated,      icon: <CheckCircle2 className="w-4 h-4" />, cls: 'text-emerald-400' },
    { key: 'rejected',      label: t.questions_rejected,       icon: <XCircle className="w-4 h-4" />,   cls: 'text-red-400' },
    { key: 'dormant',       label: t.questions_dormant,        icon: <Moon className="w-4 h-4" />,      cls: 'text-gray-600' },
    { key: 'reactivated',   label: t.questions_reactivated,    icon: <Zap className="w-4 h-4" />,       cls: 'text-amber-400' },
  ]

  const isEmpty = data && data.stats?.total === 0

  return (
    <div className="min-h-screen bg-gray-950" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white transition flex-shrink-0">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span className="text-white font-bold text-sm">{t.questions_title}</span>
          </div>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-400" />
            <h1 className="text-2xl font-black text-white">{t.questions_title}</h1>
          </div>
          <p className="text-gray-500 text-sm max-w-2xl leading-relaxed italic">
            "{t.questions_tagline}"
          </p>
          {data && (
            <div className="flex flex-wrap gap-4 pt-2 text-xs text-gray-500">
              <span><strong className="text-gray-300">{data.stats?.total ?? 0}</strong> {t.questions_statTotal}</span>
              <span className="text-brand-400"><strong>{data.stats?.investigating ?? 0}</strong> {t.questions_investigating}</span>
              <span className="text-emerald-400"><strong>{data.stats?.validated ?? 0}</strong> {t.questions_validated}</span>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-3 py-20 justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">טוען שאלות מחקר...</span>
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
            <HelpCircle className="w-12 h-12 text-gray-700 mx-auto" />
            <h2 className="text-white font-bold text-xl">{t.questions_noData}</h2>
            <Link to="/scanner" className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition mt-4">
              פתח סריקה
            </Link>
          </div>
        )}

        {data && !isEmpty && !loading && (
          <div className="space-y-12">
            {statusConfigs.map(cfg => (
              <StatusSection
                key={cfg.key}
                config={cfg}
                questions={data[cfg.key] || []}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
