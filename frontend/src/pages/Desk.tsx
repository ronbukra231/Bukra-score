import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUserData } from '../contexts/UserDataContext'
import type { RecentCompany, WatchlistCompany, ActivityItem } from '../contexts/UserDataContext'
import { useLanguage } from '../i18n/index'
import LanguageToggle from '../components/LanguageToggle'
import UserMenu from '../components/UserMenu'
import SearchBar from '../components/SearchBar'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFirstName(user: { email?: string | null; user_metadata?: Record<string, string> }): string {
  const meta = user.user_metadata ?? {}
  const fullName: string = meta.full_name || meta.name || ''
  if (fullName) return fullName.split(/\s+/)[0]
  return user.email?.split('@')[0] ?? 'Investor'
}

function timeAgo(iso: string, isHe: boolean): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return isHe ? 'זה עתה' : 'just now'
  if (min < 60) return isHe ? `לפני ${min} דק'` : `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return isHe ? `לפני ${hrs} ש'` : `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return isHe ? 'אתמול' : 'yesterday'
  if (days < 30) return isHe ? `לפני ${days} ימים` : `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function scoreColor(s: number | null): string {
  if (s === null) return 'text-gray-500'
  if (s >= 80) return 'text-emerald-400'
  if (s >= 60) return 'text-brand-400'
  if (s >= 40) return 'text-amber-400'
  return 'text-red-400'
}

function scoreRingColor(s: number | null): string {
  if (s === null) return 'border-gray-700'
  if (s >= 80) return 'border-emerald-500'
  if (s >= 60) return 'border-brand-500'
  if (s >= 40) return 'border-amber-500'
  return 'border-red-500'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ value, label, icon }: { value: number; label: string; icon: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-2 hover:border-gray-700 transition">
      <span className="text-2xl">{icon}</span>
      <div className="text-3xl font-black text-white tracking-tight">{value}</div>
      <div className="text-gray-500 text-xs font-medium leading-snug">{label}</div>
    </div>
  )
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-white text-base font-bold tracking-tight">{title}</h2>
      {action}
    </div>
  )
}

function EmptyState({ icon, text, sub, cta }: { icon: string; text: string; sub?: string; cta?: React.ReactNode }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl px-6 py-10 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-gray-400 text-sm font-medium">{text}</p>
      {sub && <p className="text-gray-600 text-xs mt-1">{sub}</p>}
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  )
}

function RecentCard({ company, btnLabel, isHe }: { company: RecentCompany; btnLabel: string; isHe: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4 hover:border-gray-700 transition group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-gray-800 text-brand-400 text-xs font-black font-mono rounded-lg px-2 py-0.5">
              {company.symbol}
            </span>
            {company.sector && (
              <span className="text-gray-600 text-xs truncate">{company.sector}</span>
            )}
          </div>
          <p className="text-white text-sm font-semibold truncate">{company.name}</p>
        </div>
        {company.score !== null && (
          <div className={`w-11 h-11 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${scoreRingColor(company.score)}`}>
            <span className={`text-sm font-black ${scoreColor(company.score)}`}>{company.score}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-600 text-xs">{timeAgo(company.lastViewed, isHe)}</span>
        <Link
          to={`/company/${company.symbol}`}
          className="bg-gray-800 hover:bg-brand-600 text-gray-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
        >
          {btnLabel}
        </Link>
      </div>
    </div>
  )
}

function WatchlistRow({ company, onRemove, isHe }: { company: WatchlistCompany; onRemove: () => void; isHe: boolean }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-800/60 last:border-0 group">
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${scoreRingColor(company.score)}`}>
          <span className={`text-xs font-black ${scoreColor(company.score)}`}>
            {company.score ?? '—'}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold truncate">{company.name}</p>
          <p className="text-gray-500 text-xs font-mono">{company.symbol}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to={`/company/${company.symbol}`}
          className="text-gray-500 hover:text-brand-400 text-xs transition hidden sm:block"
        >
          {isHe ? 'פתח' : 'Open'}
        </Link>
        <button
          onClick={onRemove}
          className="text-gray-700 hover:text-red-400 text-xs transition opacity-0 group-hover:opacity-100"
        >
          {isHe ? 'הסר' : 'Remove'}
        </button>
      </div>
    </div>
  )
}

function ActivityRow({ item, t, isHe }: { item: ActivityItem; t: Record<string, string>; isHe: boolean }) {
  const dot = {
    researched: 'bg-brand-500',
    searched:   'bg-gray-600',
    saved:      'bg-emerald-500',
    removed:    'bg-red-500',
  }[item.type]

  const label = {
    researched: `${t.desk_activity_researched} ${item.companyName ?? item.symbol ?? ''}`,
    searched:   `${t.desk_activity_searched} "${item.query ?? ''}"`,
    saved:      `${t.desk_activity_saved} ${item.companyName ?? item.symbol ?? ''}`,
    removed:    `${t.desk_activity_removed} ${item.symbol ?? ''}`,
  }[item.type]

  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-gray-300 text-sm">{label}</p>
      </div>
      <span className="text-gray-600 text-xs flex-shrink-0">{timeAgo(item.timestamp, isHe)}</span>
    </div>
  )
}

function ComingSoonCard({ icon, title, badge }: { icon: string; title: string; badge: string }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden">
      <div className="absolute top-3 end-3">
        <span className="bg-gray-800 text-gray-500 text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-700">
          {badge}
        </span>
      </div>
      <span className="text-3xl">{icon}</span>
      <p className="text-gray-400 text-sm font-semibold">{title}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Desk() {
  const { user } = useAuth()
  const { recentCompanies, watchlist, activity, removeFromWatchlist } = useUserData()
  const { t, isHe } = useLanguage()

  const firstName = user ? getFirstName(user as any) : ''

  const title = isHe
    ? `${t.desk_greeting_prefix} ${firstName}`
    : t.desk_title

  const comingSoon = [
    { icon: '📊', key: 'desk_coming_portfolio' },
    { icon: '🔔', key: 'desk_coming_alerts' },
    { icon: '🎯', key: 'desk_coming_score_alerts' },
    { icon: '📋', key: 'desk_coming_report' },
    { icon: '🤖', key: 'desk_coming_ai' },
  ] as const

  return (
    <div className="min-h-screen bg-gray-950" dir={isHe ? 'rtl' : 'ltr'}>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white transition flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={isHe ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
            </svg>
          </Link>
          <div className="flex-1 max-w-sm">
            <SearchBar />
          </div>
          <div className="text-gray-700 text-xs hidden md:block font-medium tracking-wide">
            בוקרה קפיטל
          </div>
          <LanguageToggle />
          <UserMenu />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-10 pb-16 space-y-12">

        {/* ── Hero header ────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
            {title}
          </h1>
          <p className="text-gray-500 text-base">{t.desk_subtitle}</p>
        </div>

        {/* ── Section 1: Stats ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard value={recentCompanies.length} label={t.desk_stats_companies} icon="🔍" />
          <StatCard value={watchlist.length}        label={t.desk_stats_saved}    icon="⭐" />
          <StatCard
            value={activity.filter(a => a.type === 'researched').length}
            label={t.desk_stats_searches}
            icon="📈"
          />
          <StatCard value={watchlist.length} label={t.desk_stats_watchlist} icon="📋" />
        </div>

        {/* ── Section 2: Continue Research ───────────────────────────────── */}
        <section>
          <SectionHeader
            title={t.desk_recent_title}
            action={
              recentCompanies.length > 0 ? (
                <Link to="/scanner" className="text-brand-400 text-xs hover:underline">
                  {isHe ? 'גלה עוד' : 'Discover more'} →
                </Link>
              ) : undefined
            }
          />
          {recentCompanies.length === 0 ? (
            <EmptyState
              icon="🔍"
              text={t.desk_recent_empty}
              sub={t.desk_recent_empty_sub}
              cta={
                <Link
                  to="/"
                  className="inline-block bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition"
                >
                  {isHe ? 'חפש חברה' : 'Search a Company'}
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentCompanies.slice(0, 6).map(c => (
                <RecentCard key={c.symbol} company={c} btnLabel={t.desk_recent_btn} isHe={isHe} />
              ))}
            </div>
          )}
        </section>

        {/* ── Section 3: Watchlist ───────────────────────────────────────── */}
        <section>
          <SectionHeader title={t.desk_watchlist_title} />
          {watchlist.length === 0 ? (
            <EmptyState
              icon="⭐"
              text={t.desk_watchlist_empty}
              sub={t.desk_watchlist_empty_sub}
            />
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-2">
              {watchlist.map(c => (
                <WatchlistRow
                  key={c.symbol}
                  company={c}
                  onRemove={() => removeFromWatchlist(c.symbol)}
                  isHe={isHe}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Section 4: Recent Activity ─────────────────────────────────── */}
        <section>
          <SectionHeader title={t.desk_activity_title} />
          {activity.length === 0 ? (
            <EmptyState icon="⏱" text={t.desk_activity_empty} />
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-2">
              {activity.slice(0, 15).map(item => (
                <ActivityRow key={item.id} item={item} t={t as any} isHe={isHe} />
              ))}
            </div>
          )}
        </section>

        {/* ── Section 5: Coming Soon ─────────────────────────────────────── */}
        <section>
          <SectionHeader title={t.desk_coming_title} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {comingSoon.map(({ icon, key }) => (
              <ComingSoonCard
                key={key}
                icon={icon}
                title={t[key]}
                badge={t.desk_coming_badge}
              />
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
