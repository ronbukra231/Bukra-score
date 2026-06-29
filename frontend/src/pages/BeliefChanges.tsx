import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, RefreshCw, TrendingUp, TrendingDown, Star, Archive, Minus } from 'lucide-react'
import { useLanguage } from '../i18n/index'
import LanguageToggle from '../components/LanguageToggle'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

async function getBeliefs() {
  const res = await fetch(`${BASE}/memory/beliefs`)
  if (!res.ok) throw new Error('שגיאה בטעינת שינויי עמדה')
  return res.json()
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

// ── Change type config ────────────────────────────────────────────────────────

type ChangeType = 'strengthened' | 'weakened' | 'promoted' | 'archived' | 'minor'

const CHANGE_CONFIGS: Record<ChangeType, { icon: React.ReactNode; borderCls: string; badgeCls: string; labelKey: string }> = {
  strengthened: {
    icon: <TrendingUp className="w-4 h-4" />,
    borderCls: 'border-emerald-500/20',
    badgeCls:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    labelKey:  'beliefs_typeStrengthened',
  },
  weakened: {
    icon: <TrendingDown className="w-4 h-4" />,
    borderCls: 'border-red-500/20',
    badgeCls:  'bg-red-500/15 text-red-400 border-red-500/25',
    labelKey:  'beliefs_typeWeakened',
  },
  promoted: {
    icon: <Star className="w-4 h-4" />,
    borderCls: 'border-brand-500/20',
    badgeCls:  'bg-brand-500/15 text-brand-400 border-brand-500/25',
    labelKey:  'beliefs_typePromoted',
  },
  archived: {
    icon: <Archive className="w-4 h-4" />,
    borderCls: 'border-gray-700',
    badgeCls:  'bg-gray-700/40 text-gray-500 border-gray-600/30',
    labelKey:  'beliefs_typeArchived',
  },
  minor: {
    icon: <Minus className="w-4 h-4" />,
    borderCls: 'border-gray-800',
    badgeCls:  'bg-gray-800 text-gray-500 border-gray-700',
    labelKey:  'beliefs_typeMinor',
  },
}

// ── Confidence delta ──────────────────────────────────────────────────────────

function ConfDelta({ before, after }: { before: number; after: number }) {
  const delta = Math.round((after - before) * 100)
  const color = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-gray-400'
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-gray-500 font-mono">{Math.round(before * 100)}%</span>
      <span className="text-gray-600">→</span>
      <span className="text-gray-300 font-mono">{Math.round(after * 100)}%</span>
      {delta !== 0 && (
        <span className={`font-bold ${color}`}>{delta > 0 ? `+${delta}` : delta}pp</span>
      )}
    </div>
  )
}

// ── Belief change card ────────────────────────────────────────────────────────

function ChangeCard({ change, t }: { change: any; t: any }) {
  const ctype  = (change.change_type || 'minor') as ChangeType
  const cfg    = CHANGE_CONFIGS[ctype] ?? CHANGE_CONFIGS.minor

  return (
    <div className={`bg-gray-900 border ${cfg.borderCls} rounded-2xl p-5`}>
      {/* Header row */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-1 min-w-0 text-right">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.badgeCls}`}>
              {cfg.icon}
              {(t as any)[cfg.labelKey]}
            </span>
            <span className="text-xs text-gray-600">{fmtDate(change.date)}</span>
          </div>
          <h3 className="text-white font-bold text-sm leading-tight">{change.title}</h3>
        </div>
      </div>

      {/* Confidence delta */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-1.5">{t.beliefs_confidenceBefore} → {t.beliefs_confidenceAfter}</div>
        <ConfDelta before={change.confidence_before ?? 0} after={change.confidence_after ?? 0} />
      </div>

      {/* Old vs new belief */}
      <div className="grid grid-cols-1 gap-3 mb-4">
        <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50 text-right">
          <div className="text-xs text-gray-500 mb-1">{t.beliefs_oldBelief}</div>
          <div className="text-gray-400 text-xs leading-relaxed">{change.old_belief}</div>
        </div>
        <div className="bg-gray-800/80 rounded-xl p-3 border border-gray-600/30 text-right">
          <div className="text-xs text-gray-400 mb-1">{t.beliefs_newBelief}</div>
          <div className="text-gray-300 text-xs leading-relaxed">{change.new_belief}</div>
        </div>
      </div>

      {/* Reason */}
      {change.reason && (
        <div className="border-t border-gray-800 pt-3 text-right">
          <span className="text-xs text-gray-500">{t.beliefs_reason}: </span>
          <span className="text-xs text-gray-400">{change.reason}</span>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BeliefChanges() {
  const { t, isHe }           = useLanguage()
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    getBeliefs()
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
            <RefreshCw className="w-4 h-4 text-orange-400" />
            <span className="text-white font-bold text-sm">{t.beliefs_title}</span>
          </div>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-orange-400" />
            <h1 className="text-2xl font-black text-white">{t.beliefs_title}</h1>
          </div>
          <p className="text-gray-500 text-sm max-w-2xl leading-relaxed italic">
            "{t.beliefs_tagline}"
          </p>
          {data && !isEmpty && (
            <div className="flex flex-wrap gap-4 pt-2 text-xs text-gray-500">
              <span><strong className="text-gray-300">{data.stats?.total ?? 0}</strong> {t.beliefs_statTotal}</span>
              <span className="text-emerald-400"><strong>{data.stats?.strengthened ?? 0}</strong> {t.beliefs_statStrengthened}</span>
              <span className="text-red-400"><strong>{data.stats?.weakened ?? 0}</strong> {t.beliefs_statWeakened}</span>
              <span className="text-gray-500"><strong>{data.stats?.archived ?? 0}</strong> {t.beliefs_statArchived}</span>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-3 py-20 justify-center">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">טוען שינויי עמדה...</span>
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
            <RefreshCw className="w-12 h-12 text-gray-700 mx-auto" />
            <h2 className="text-white font-bold text-xl">{t.beliefs_noData}</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">
              {t.beliefs_noDataSub}
            </p>
          </div>
        )}

        {data && !isEmpty && !loading && (
          <div className="space-y-4">
            {(data.changes || []).map((c: any) => (
              <ChangeCard key={c.id} change={c} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
