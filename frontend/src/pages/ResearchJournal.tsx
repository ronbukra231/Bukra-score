import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, FlaskConical, TrendingUp, TrendingDown,
  Layers, Globe, Shield, Database, DollarSign,
  ChevronDown, ChevronUp, Clock, CheckCircle2, AlertCircle,
  BookOpen, Activity,
} from 'lucide-react'
import { useLanguage } from '../i18n/index'
import LanguageToggle from '../components/LanguageToggle'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

async function getDiscoveries() {
  const res = await fetch(`${BASE}/discoveries`)
  if (!res.ok) throw new Error('שגיאה בטעינת נתוני המחקר')
  return res.json()
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function fmtDatetime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('he-IL', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; cls: string; bgCls: string }> = {
  SectorPattern:   { icon: <TrendingUp className="w-3.5 h-3.5" />,  cls: 'text-blue-400',   bgCls: 'bg-blue-500/10 border-blue-500/20' },
  MarketPattern:   { icon: <Layers className="w-3.5 h-3.5" />,      cls: 'text-purple-400', bgCls: 'bg-purple-500/10 border-purple-500/20' },
  MacroPattern:    { icon: <Globe className="w-3.5 h-3.5" />,       cls: 'text-red-400',    bgCls: 'bg-red-500/10 border-red-500/20' },
  QualityPattern:  { icon: <Shield className="w-3.5 h-3.5" />,      cls: 'text-amber-400',  bgCls: 'bg-amber-500/10 border-amber-500/20' },
  ValuationPattern:{ icon: <DollarSign className="w-3.5 h-3.5" />,  cls: 'text-emerald-400',bgCls: 'bg-emerald-500/10 border-emerald-500/20' },
  DataPattern:     { icon: <Database className="w-3.5 h-3.5" />,    cls: 'text-gray-400',   bgCls: 'bg-gray-700/40 border-gray-600/30' },
}

const CATEGORY_LABEL_MAP: Record<string, string> = {
  SectorPattern:    'journal_catSector',
  MarketPattern:    'journal_catMarket',
  MacroPattern:     'journal_catMacro',
  QualityPattern:   'journal_catQuality',
  ValuationPattern: 'journal_catValuation',
  DataPattern:      'journal_catData',
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, t }: { status: string; t: any }) {
  const configs: Record<string, string> = {
    emerging:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
    confirmed:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    historical: 'bg-gray-700/40 text-gray-500 border-gray-600/30',
    rejected:   'bg-red-500/15 text-red-400 border-red-500/30',
  }
  const labels: Record<string, string> = {
    emerging:   t.journal_statusEmerging,
    confirmed:  t.journal_statusConfirmed,
    historical: t.journal_statusHistorical,
    rejected:   t.journal_statusRejected,
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${configs[status] ?? configs.emerging}`}>
      {labels[status] ?? status}
    </span>
  )
}

// ── Importance dot ────────────────────────────────────────────────────────────

function ImportanceDot({ importance }: { importance: string }) {
  const cls = importance === 'High' ? 'bg-red-400' : importance === 'Medium' ? 'bg-amber-400' : 'bg-gray-500'
  return <span className={`inline-block w-2 h-2 rounded-full ${cls} flex-shrink-0 mt-1.5`} />
}

// ── Confidence bar ────────────────────────────────────────────────────────────

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const cls = pct >= 75 ? 'bg-emerald-500' : pct >= 55 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 font-mono w-8 text-right">{pct}%</span>
    </div>
  )
}

// ── Category chip ─────────────────────────────────────────────────────────────

function CategoryChip({ category, t }: { category: string; t: any }) {
  const cfg   = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.DataPattern
  const label = t[CATEGORY_LABEL_MAP[category]] ?? category
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bgCls} ${cfg.cls}`}>
      {cfg.icon}
      {label}
    </span>
  )
}

// ── Discovery card ────────────────────────────────────────────────────────────

function DiscoveryCard({ disc, t }: { disc: any; t: any }) {
  const [expanded, setExpanded] = useState(false)
  const conf = CATEGORY_CONFIG[disc.category] ?? CATEGORY_CONFIG.DataPattern

  return (
    <div className={`bg-gray-900 border rounded-2xl overflow-hidden transition-all ${
      disc.status === 'confirmed' ? 'border-emerald-500/20' : 'border-gray-800'
    }`}>
      {/* Header */}
      <button
        className="w-full text-right p-5 flex items-start gap-3 hover:bg-gray-800/40 transition"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <StatusBadge status={disc.status} t={t} />
            <CategoryChip category={disc.category} t={t} />
            {disc.requires_validation && (
              <span className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                {t.journal_requiresValidation}
              </span>
            )}
          </div>
          <div className="flex items-start gap-2">
            <ImportanceDot importance={disc.importance} />
            <h3 className="text-white font-bold text-sm leading-tight text-right">
              {disc.title}
            </h3>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed mt-2 text-right line-clamp-2">
            {disc.summary}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-600">
            <span>{t.journal_occurrences}: <strong className="text-gray-400">{disc.occurrences}</strong></span>
            <span>{t.journal_affectedCompanies}: <strong className="text-gray-400">{(disc.affected_companies || []).length}</strong></span>
            {(disc.affected_sectors || []).filter(Boolean).length > 0 && (
              <span>{t.journal_affectedSectors}: <strong className="text-gray-400">{disc.affected_sectors.filter(Boolean).slice(0, 3).join(', ')}</strong></span>
            )}
            <span>{t.journal_firstDetected}: <strong className="text-gray-400">{fmtDate(disc.first_detected)}</strong></span>
          </div>
        </div>
        <div className="text-gray-600 flex-shrink-0 mt-1">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-4">
          {/* Confidence */}
          <div>
            <div className="text-xs text-gray-500 mb-1.5">{t.journal_confidence}</div>
            <ConfidenceBar confidence={disc.confidence || 0} />
          </div>

          {/* Evidence */}
          {(disc.evidence || []).length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2">{t.journal_evidence}</div>
              <ul className="space-y-1">
                {disc.evidence.map((ev: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                    <span className={`mt-0.5 flex-shrink-0 ${conf.cls}`}>›</span>
                    <span className="text-right">{ev}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Affected companies chips */}
          {(disc.affected_companies || []).length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2">{t.journal_affectedCompanies}</div>
              <div className="flex flex-wrap gap-1.5">
                {disc.affected_companies.slice(0, 12).map((sym: string) => (
                  <Link
                    key={sym}
                    to={`/company/${sym}`}
                    className="text-xs font-mono bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg px-2 py-0.5 transition border border-gray-700"
                  >
                    {sym}
                  </Link>
                ))}
                {disc.affected_companies.length > 12 && (
                  <span className="text-xs text-gray-600">+{disc.affected_companies.length - 12}</span>
                )}
              </div>
            </div>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-600 pt-1 border-t border-gray-800">
            <span>False positive: <strong className="text-gray-400">{Math.round((disc.false_positive_probability || 0) * 100)}%</strong></span>
            <span>{t.journal_lastConfirmed}: <strong className="text-gray-400">{fmtDate(disc.last_confirmed)}</strong></span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Research note card ────────────────────────────────────────────────────────

function ResearchNote({ note, isLatest, t }: { note: any; isLatest: boolean; t: any }) {
  return (
    <div className={`rounded-xl p-4 border text-right ${
      isLatest ? 'bg-brand-600/5 border-brand-500/20' : 'bg-gray-900 border-gray-800'
    }`}>
      <div className="flex items-center gap-2 mb-3 justify-between">
        <span className="text-xs text-gray-600">{fmtDatetime(note.scan_date)}</span>
        <div className="flex items-center gap-2">
          {isLatest && (
            <span className="text-xs text-brand-400 font-semibold">{t.journal_latestNote}</span>
          )}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Activity className="w-3 h-3" />
            <span>{note.companies_analyzed} {t.journal_companiesAnalyzed}</span>
          </div>
        </div>
      </div>

      {/* Stats chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {note.new_discoveries > 0 && (
          <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-0.5">
            {note.new_discoveries} {t.journal_newDiscoveries}
          </span>
        )}
        {note.confirmed_discoveries > 0 && (
          <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
            {note.confirmed_discoveries} {t.journal_confirmedDiscoveries}
          </span>
        )}
      </div>

      {/* Note lines */}
      <ul className="space-y-1.5">
        {(note.notes || []).map((line: string, i: number) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
            <span className="text-brand-500 mt-0.5 flex-shrink-0">›</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title, icon, count, children, accentCls = 'text-brand-400',
}: {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
  accentCls?: string
}) {
  if (count === 0) return null
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <span className={accentCls}>{icon}</span>
        <h2 className="text-white font-bold text-base">{title}</h2>
        <span className="text-gray-600 text-xs bg-gray-800 rounded-full px-2 py-0.5">{count}</span>
      </div>
      {children}
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResearchJournal() {
  const { t, isHe }              = useLanguage()
  const [data, setData]          = useState<any>(null)
  const [loading, setLoading]    = useState(true)
  const [error, setError]        = useState('')
  const [showNotes, setShowNotes]= useState(false)

  useEffect(() => {
    getDiscoveries()
      .then(d  => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const isEmpty = data && data.stats?.total === 0 && (data.research_notes || []).length === 0

  return (
    <div className="min-h-screen bg-gray-950" dir={isHe ? 'rtl' : 'ltr'}>
      {/* Sticky nav */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" aria-label="חזרה לדף הבית" className="text-gray-400 hover:text-white transition flex-shrink-0">
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <FlaskConical className="w-4 h-4 text-brand-400" />
            <span className="text-white font-bold text-sm">{t.journal_title}</span>
            <span className="text-gray-600 text-sm">—</span>
            <span className="text-gray-400 text-sm">{t.journal_subtitle}</span>
          </div>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">

        {/* Page header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-brand-400" />
            <h1 className="text-2xl font-black text-white">{t.journal_title}</h1>
          </div>
          <p className="text-gray-500 text-sm max-w-2xl leading-relaxed italic">
            "{t.journal_tagline}"
          </p>

          {/* Stats bar */}
          {data && !isEmpty && (
            <div className="flex flex-wrap gap-5 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <BookOpen className="w-3.5 h-3.5 text-brand-400" />
                <strong className="text-gray-300">{data.stats?.total ?? 0}</strong>
                <span>{t.journal_statTotal}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <strong className="text-gray-300">{data.stats?.confirmed ?? 0}</strong>
                <span>{t.journal_statConfirmed}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Activity className="w-3.5 h-3.5" />
                <strong className="text-gray-300">{data.stats?.scans_analyzed ?? 0}</strong>
                <span>{t.journal_statScans}</span>
              </div>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 py-20 justify-center">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">טוען נתוני מחקר...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="py-20 text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && !loading && (
          <div className="py-24 text-center space-y-4">
            <FlaskConical className="w-12 h-12 text-gray-700 mx-auto" />
            <h2 className="text-white font-bold text-xl">{t.journal_noData}</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">
              {t.journal_noDataSub}
            </p>
            <Link
              to="/scanner"
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition mt-4"
            >
              {t.journal_goToScanner}
            </Link>
          </div>
        )}

        {/* Main content */}
        {data && !isEmpty && !loading && (
          <div className="space-y-12">

            {/* Latest research note */}
            {(data.research_notes || []).length > 0 && (
              <section>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <h2 className="text-white font-bold text-base">{t.journal_researchNotes}</h2>
                    <span className="text-gray-600 text-xs bg-gray-800 rounded-full px-2 py-0.5">
                      {data.research_notes.length}
                    </span>
                  </div>
                  {data.research_notes.length > 1 && (
                    <button
                      onClick={() => setShowNotes(n => !n)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition flex items-center gap-1"
                    >
                      {showNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showNotes ? 'הסתר' : 'הצג הכל'}
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {(showNotes ? data.research_notes : data.research_notes.slice(0, 1)).map(
                    (note: any, i: number) => (
                      <ResearchNote key={i} note={note} isLatest={i === 0} t={t} />
                    )
                  )}
                </div>
              </section>
            )}

            {/* Active discoveries (emerging) */}
            <Section
              title={t.journal_activeSection}
              icon={<AlertCircle className="w-4 h-4" />}
              count={(data.emerging_discoveries || []).length}
              accentCls="text-amber-400"
            >
              <div className="space-y-3">
                {(data.emerging_discoveries || []).map((d: any) => (
                  <DiscoveryCard key={d.id || d.signature} disc={d} t={t} />
                ))}
              </div>
            </Section>

            {/* Confirmed discoveries */}
            <Section
              title={t.journal_confirmedSection}
              icon={<CheckCircle2 className="w-4 h-4" />}
              count={(data.confirmed_discoveries || []).length}
              accentCls="text-emerald-400"
            >
              <div className="space-y-3">
                {(data.confirmed_discoveries || []).map((d: any) => (
                  <DiscoveryCard key={d.id || d.signature} disc={d} t={t} />
                ))}
              </div>
            </Section>

            {/* Historical discoveries */}
            <Section
              title={t.journal_historicalSection}
              icon={<BookOpen className="w-4 h-4" />}
              count={(data.historical_discoveries || []).length}
              accentCls="text-gray-500"
            >
              <div className="space-y-3 opacity-70">
                {(data.historical_discoveries || []).map((d: any) => (
                  <DiscoveryCard key={d.id || d.signature} disc={d} t={t} />
                ))}
              </div>
            </Section>

          </div>
        )}
      </div>
    </div>
  )
}
