import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUserData } from '../contexts/UserDataContext'
import type { Collection, CollectionEntry, ActivityItem } from '../contexts/UserDataContext'
import { useLanguage } from '../i18n/index'
import LanguageToggle from '../components/LanguageToggle'
import UserMenu from '../components/UserMenu'
import SearchBar from '../components/SearchBar'
import SaveModal from '../components/SaveModal'
import type { SaveTarget } from '../components/SaveModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFirstName(user: { email?: string | null; user_metadata?: Record<string, string> }): string {
  const meta = user.user_metadata ?? {}
  const full: string = meta.full_name || meta.name || ''
  if (full) return full.split(/\s+/)[0]
  return user.email?.split('@')[0] ?? ''
}

function timeAgo(iso: string, isHe: boolean): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return isHe ? 'זה עתה' : 'just now'
  if (min < 60) return isHe ? `${min} דק'` : `${min}m`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return isHe ? `${hrs} ש'` : `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return isHe ? `${days} ימים` : `${days}d`
  return new Date(iso).toLocaleDateString()
}

function scoreColor(s: number | null) {
  if (s === null) return 'text-gray-500 border-gray-700'
  if (s >= 80) return 'text-emerald-400 border-emerald-600'
  if (s >= 60) return 'text-blue-400 border-blue-600'
  if (s >= 40) return 'text-amber-400 border-amber-600'
  return 'text-red-400 border-red-600'
}

const COLL_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-500'    },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-500'   },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-400',    dot: 'bg-rose-500'    },
  gray:    { bg: 'bg-gray-500/10',    text: 'text-gray-400',    dot: 'bg-gray-500'    },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-400',  dot: 'bg-violet-500'  },
  teal:    { bg: 'bg-teal-500/10',    text: 'text-teal-400',    dot: 'bg-teal-500'    },
  orange:  { bg: 'bg-orange-500/10',  text: 'text-orange-400',  dot: 'bg-orange-500'  },
}

// ── Cinematic background ──────────────────────────────────────────────────────

function DeskHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="relative h-64 md:h-80 overflow-hidden select-none">
      {/* SVG scene */}
      <svg
        viewBox="0 0 1400 420"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="dh-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#04060E"/>
            <stop offset="55%"  stopColor="#0B1225"/>
            <stop offset="100%" stopColor="#130F08"/>
          </linearGradient>
          <radialGradient id="dh-glow" cx="50%" cy="95%" r="65%">
            <stop offset="0%"   stopColor="#C8762A" stopOpacity="0.28"/>
            <stop offset="60%"  stopColor="#A85A10" stopOpacity="0.10"/>
            <stop offset="100%" stopColor="#C8762A" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="dh-monL" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#1E3A6A" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#0A1830" stopOpacity="1"/>
          </radialGradient>
          <radialGradient id="dh-monC" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#1A3560" stopOpacity="0.95"/>
            <stop offset="100%" stopColor="#080E20" stopOpacity="1"/>
          </radialGradient>
          <filter id="dh-blur4"><feGaussianBlur stdDeviation="4"/></filter>
          <filter id="dh-blur10"><feGaussianBlur stdDeviation="10"/></filter>
          <filter id="dh-blur20"><feGaussianBlur stdDeviation="20"/></filter>
          <linearGradient id="dh-vignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#030609" stopOpacity="0.3"/>
            <stop offset="70%"  stopColor="#030609" stopOpacity="0"/>
            <stop offset="100%" stopColor="#030609" stopOpacity="1"/>
          </linearGradient>
          <linearGradient id="dh-bottom" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#030609" stopOpacity="0"/>
            <stop offset="100%" stopColor="#030609" stopOpacity="1"/>
          </linearGradient>
        </defs>

        {/* Sky */}
        <rect width="1400" height="420" fill="url(#dh-sky)"/>

        {/* Stars */}
        {[
          [80,28],[155,15],[240,42],[350,18],[460,35],[520,12],[620,28],[710,8],[800,22],
          [880,40],[970,14],[1060,30],[1140,18],[1230,35],[1310,12],[1370,25],
          [110,70],[280,65],[420,80],[590,55],[760,72],[940,60],[1100,68],[1280,58],
          [200,100],[540,95],[900,105],[1200,90],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 1.2 : 0.7} fill="white" opacity={0.3 + (i % 4) * 0.12}/>
        ))}

        {/* City horizon warm glow */}
        <rect width="1400" height="420" fill="url(#dh-glow)"/>

        {/* City skyline silhouette */}
        <polygon fill="#070910" points="
          0,420 0,360 40,360 40,320 60,320 60,295 80,295 80,280 110,280 110,300 140,300
          140,270 165,270 165,255 185,255 185,280 210,280 210,300 240,300 240,270
          270,270 270,255 290,255 290,270 315,270 315,248 340,248 340,235 360,235
          360,250 385,250 385,240 410,240 410,225 435,225 435,210 455,210 455,225
          480,225 480,238 505,238 505,255 525,255 525,240 550,240 550,220 570,220
          570,208 590,208 590,195 610,195 610,185 630,185 630,195 650,195 650,215
          670,215 670,200 695,200 695,185 715,185 715,178 735,178 735,188 755,188
          755,200 775,200 775,215 800,215 800,230 820,230 820,218 840,218 840,205
          860,205 860,218 885,218 885,235 910,235 910,250 930,250 930,238 950,238
          950,252 970,252 970,268 995,268 995,255 1015,255 1015,268 1040,268 1040,285
          1065,285 1065,270 1090,270 1090,285 1110,285 1110,298 1140,298 1140,315
          1170,315 1170,328 1200,328 1200,345 1240,345 1240,360 1280,360 1280,375
          1330,375 1330,390 1400,390 1400,420
        "/>

        {/* Building windows — warm amber light */}
        {[
          [92,290],[98,290],[145,260],[151,260],[158,260],[170,244],[178,244],
          [295,265],[301,265],[320,259],[350,246],[357,246],[440,220],[447,220],[461,218],
          [530,250],[538,250],[556,232],[575,218],[595,205],[615,193],[637,196],
          [652,205],[672,210],[698,196],[718,193],[738,186],[758,198],
          [802,222],[828,225],[845,216],[865,215],[892,226],
          [916,247],[935,245],[955,244],[972,258],[998,264],
          [1018,258],[1043,272],[1068,278],[1093,278],[1113,292],[1145,308],
          [1175,322],[1205,338],[1248,352],
        ].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width={4} height={5} rx={0.5} fill="#F5B040" opacity={0.25 + (i % 4) * 0.12}/>
        ))}

        {/* Window frame — room pillars */}
        <rect x="0"    y="0" width="75"   height="420" fill="#060810" opacity="0.95"/>
        <rect x="1325" y="0" width="75"   height="420" fill="#060810" opacity="0.95"/>
        <rect x="0"    y="0" width="1400" height="18"  fill="#060810" opacity="0.95"/>

        {/* Window mullion */}
        <rect x="697" y="18" width="6" height="350" fill="#060810" opacity="0.6"/>

        {/* Pillar edge highlights */}
        <rect x="73"   y="18" width="1.5" height="402" fill="#1A1F2E" opacity="0.6"/>
        <rect x="1325" y="18" width="1.5" height="402" fill="#1A1F2E" opacity="0.6"/>

        {/* Horizontal window bar */}
        <rect x="75" y="240" width="1250" height="3" fill="#0D1020" opacity="0.5"/>

        {/* Desk surface */}
        <polygon fill="#070810" points="150,420 230,375 1170,375 1250,420"/>

        {/* Monitor glow — ambient light behind screens */}
        <ellipse cx="480" cy="345" rx="110" ry="35" fill="#1A3A7A" opacity="0.12" filter="url(#dh-blur10)"/>
        <ellipse cx="700" cy="335" rx="150" ry="45" fill="#1A3A7A" opacity="0.18" filter="url(#dh-blur10)"/>
        <ellipse cx="920" cy="345" rx="110" ry="35" fill="#1A3A7A" opacity="0.12" filter="url(#dh-blur10)"/>

        {/* Monitor — left */}
        <rect x="390" y="278" width="178" height="112" rx="4" fill="url(#dh-monL)"/>
        <rect x="396" y="284" width="166" height="100" rx="2" fill="#08122A" opacity="0.9"/>
        {/* Chart bars on left monitor */}
        {[[400,354,22],[426,344,32],[452,350,26],[478,338,38],[504,332,44],[530,342,30],[556,336,36]].map(([x,y,h], i) => (
          <rect key={i} x={x} y={y} width={18} height={h} fill="#1A4A8A" opacity={0.5 + i*0.04}/>
        ))}
        <rect x="400" y="290" width="80" height="3" rx="1" fill="#2A5A9A" opacity="0.4"/>
        <rect x="400" y="297" width="140" height="2" rx="1" fill="#1A3A7A" opacity="0.3"/>

        {/* Monitor — center (main, larger) */}
        <rect x="568" y="258" width="264" height="128" rx="4" fill="url(#dh-monC)"/>
        <rect x="574" y="264" width="252" height="116" rx="2" fill="#060E1E" opacity="0.95"/>
        {/* UI on center screen */}
        <rect x="580" y="272" width="120" height="4" rx="2" fill="#2A5A9A" opacity="0.5"/>
        <rect x="580" y="281" width="200" height="2" rx="1" fill="#1A3A6A" opacity="0.3"/>
        {/* Score badge */}
        <rect x="580" y="290" width="52" height="30" rx="4" fill="#0E1E3A" opacity="0.9"/>
        <text x="586" y="310" fontSize="14" fill="#4A9ADA" opacity="0.8" fontFamily="monospace" fontWeight="bold">89</text>
        {/* Line chart */}
        <polyline
          points="580,355 612,340 644,348 676,330 708,338 740,318 772,325 800,312 820,318"
          fill="none" stroke="#2A7ABA" strokeWidth="2" opacity="0.6" strokeLinejoin="round"
        />
        <polyline
          points="580,355 612,340 644,348 676,330 708,338 740,318 772,325 800,312 820,318 820,370 580,370"
          fill="#1A5A9A" opacity="0.06"
        />

        {/* Monitor — right */}
        <rect x="832" y="278" width="178" height="112" rx="4" fill="url(#dh-monL)"/>
        <rect x="838" y="284" width="166" height="100" rx="2" fill="#08122A" opacity="0.9"/>
        <polyline
          points="842,360 868,345 894,355 920,335 946,348 972,330 998,342 1000,370"
          fill="none" stroke="#1A6A9A" strokeWidth="1.5" opacity="0.5"
        />
        <rect x="842" y="290" width="90" height="3" rx="1" fill="#2A5A9A" opacity="0.4"/>

        {/* Monitor stands */}
        <rect x="469" y="390" width="20" height="12" rx="2" fill="#050710"/>
        <rect x="456" y="400" width="46" height="5"  rx="2" fill="#050710"/>
        <rect x="689" y="386" width="22" height="16" rx="2" fill="#050710"/>
        <rect x="678" y="400" width="44" height="5"  rx="2" fill="#050710"/>
        <rect x="911" y="390" width="20" height="12" rx="2" fill="#050710"/>
        <rect x="898" y="400" width="46" height="5"  rx="2" fill="#050710"/>

        {/* Person silhouette — back facing viewer */}
        {/* Chair back */}
        <rect x="648" y="340" width="104" height="70" rx="10" fill="#050709" opacity="0.98"/>
        {/* Upper body / back */}
        <path d="M 634,410 Q 700,356 766,410" fill="#060809"/>
        {/* Neck */}
        <rect x="692" y="316" width="16" height="28" fill="#060809"/>
        {/* Head */}
        <circle cx="700" cy="294" r="30" fill="#060809"/>
        {/* Shoulders wider */}
        <ellipse cx="700" cy="390" rx="80" ry="25" fill="#060809"/>

        {/* Keyboard glow on desk */}
        <rect x="610" y="403" width="180" height="7" rx="3" fill="#1A2A4A" opacity="0.2"/>

        {/* Desk lamp warm glow (subtle, top right area) */}
        <ellipse cx="1080" cy="320" rx="60" ry="80" fill="#C8762A" opacity="0.05" filter="url(#dh-blur20)"/>

        {/* Bottom fade — UI sits cleanly below */}
        <rect width="1400" height="420" fill="url(#dh-bottom)"/>
        {/* Top fade */}
        <rect width="1400" height="420" fill="url(#dh-vignette)"/>
      </svg>

      {/* Overlay text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10">
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-lg">
          {title}
        </h1>
        <p className="text-gray-400 text-sm md:text-base mt-2 max-w-sm drop-shadow">
          {subtitle}
        </p>
      </div>
    </div>
  )
}

// ── Left Sidebar ──────────────────────────────────────────────────────────────

function LeftSidebar({
  collections, activeId, onSelect, totalSaved, recentCount, t, isHe,
}: {
  collections: Collection[]
  activeId: string | null
  onSelect: (id: string | null) => void
  totalSaved: number
  recentCount: number
  t: Record<string, string>
  isHe: boolean
}) {
  const defaults = collections.filter(c => c.isDefault)
  const custom   = collections.filter(c => !c.isDefault)

  function NavItem({ id, icon, label, count, color }: {
    id: string | null; icon: string; label: string; count: number; color?: string
  }) {
    const active = activeId === id
    const cc = color ? COLL_COLOR[color] : null
    return (
      <button
        onClick={() => onSelect(id === activeId ? null : id)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
          active
            ? `${cc?.bg ?? 'bg-gray-800'} ${cc?.text ?? 'text-white'} font-semibold`
            : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
        }`}
      >
        <span className="text-base flex-shrink-0">{icon}</span>
        <span className="flex-1 text-start truncate">{label}</span>
        {count > 0 && (
          <span className={`text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center ${active ? 'bg-gray-700' : 'bg-gray-800 text-gray-500'}`}>
            {count}
          </span>
        )}
      </button>
    )
  }

  return (
    <aside className="hidden lg:flex flex-col gap-1 pt-2">
      {/* Overview */}
      <p className="text-gray-600 text-xs font-semibold uppercase tracking-widest px-3 mb-1">
        {isHe ? 'סקירה' : 'Overview'}
      </p>
      <NavItem id={null} icon="🏠" label={isHe ? 'חדר המחקר' : 'Research Desk'} count={0} />
      <NavItem id="recent" icon="🕐" label={isHe ? 'צפייה אחרונה' : 'Recently Viewed'} count={recentCount} />

      {/* Default collections */}
      <p className="text-gray-600 text-xs font-semibold uppercase tracking-widest px-3 mb-1 mt-4">
        {t.coll_header}
      </p>
      {defaults.map(c => (
        <NavItem
          key={c.id}
          id={c.id}
          icon={c.icon}
          label={isHe ? c.nameHe : c.name}
          count={c.companies.length}
          color={c.color}
        />
      ))}

      {/* Custom collections */}
      {custom.length > 0 && (
        <>
          <p className="text-gray-600 text-xs font-semibold uppercase tracking-widest px-3 mb-1 mt-4">
            {t.coll_my_collections}
          </p>
          {custom.map(c => (
            <NavItem key={c.id} id={c.id} icon={c.icon} label={c.name} count={c.companies.length} color={c.color}/>
          ))}
        </>
      )}
    </aside>
  )
}

// ── Company card ──────────────────────────────────────────────────────────────

function CompanyCard({ entry, onSave, t, isHe }: {
  entry: CollectionEntry
  onSave: (target: SaveTarget) => void
  t: Record<string, string>
  isHe: boolean
}) {
  const sc = scoreColor(entry.score)
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4 hover:border-gray-700 transition group">
      <div className={`w-12 h-12 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${sc}`}>
        <span className={`text-base font-black ${sc.split(' ')[0]}`}>{entry.score ?? '—'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-bold truncate">{entry.name}</p>
        <p className="text-gray-500 text-xs font-mono">{entry.symbol}{entry.sector ? ` · ${entry.sector}` : ''}</p>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={() => onSave({ symbol: entry.symbol, name: entry.name, score: entry.score, sector: entry.sector })}
          className="text-gray-500 hover:text-brand-400 text-xs transition"
          title={t.qa_save}
        >
          ☆
        </button>
        <Link
          to={`/company/${entry.symbol}`}
          className="text-gray-400 hover:text-white text-xs font-semibold transition px-2 py-1 rounded-lg hover:bg-gray-800"
        >
          {isHe ? 'פתח' : 'Open'}
        </Link>
      </div>
    </div>
  )
}

// ── Right panel ───────────────────────────────────────────────────────────────

function RightPanel({ activity, t, isHe }: {
  activity: ActivityItem[]
  t: Record<string, string>
  isHe: boolean
}) {
  const activityLabel = {
    researched: t.desk_activity_researched,
    saved:      t.desk_activity_saved,
    removed:    t.desk_activity_removed,
    noted:      isHe ? 'הוספת הערה על' : 'Added note for',
  } as Record<string, string>

  const activityDot = {
    researched: 'bg-blue-500',
    saved:      'bg-emerald-500',
    removed:    'bg-gray-600',
    noted:      'bg-violet-500',
  } as Record<string, string>

  return (
    <aside className="hidden xl:flex flex-col gap-6 pt-2">
      {/* Activity */}
      <div>
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">
          {t.desk_activity_title}
        </p>
        {activity.length === 0 ? (
          <p className="text-gray-600 text-xs">{t.desk_activity_empty}</p>
        ) : (
          <div className="space-y-2">
            {activity.slice(0, 12).map(item => (
              <div key={item.id} className="flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${activityDot[item.type] ?? 'bg-gray-600'}`}/>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-400 text-xs leading-snug">
                    {activityLabel[item.type]} {item.companyName ?? item.symbol ?? ''}
                  </p>
                  <p className="text-gray-700 text-xs">{timeAgo(item.timestamp, isHe)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coming soon */}
      <div>
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">
          {t.desk_coming_title}
        </p>
        <div className="space-y-2">
          {[
            { icon: '📊', key: 'desk_coming_portfolio' },
            { icon: '🔔', key: 'desk_coming_alerts' },
            { icon: '🎯', key: 'desk_coming_score_alerts' },
            { icon: '📋', key: 'desk_coming_report' },
            { icon: '🤖', key: 'desk_coming_ai' },
          ].map(({ icon, key }) => (
            <div
              key={key}
              className="flex items-center gap-3 bg-gray-900/50 border border-gray-800/50 rounded-xl px-3 py-2.5"
            >
              <span className="text-sm">{icon}</span>
              <span className="text-gray-500 text-xs flex-1">{t[key]}</span>
              <span className="text-gray-700 text-xs border border-gray-800 rounded-full px-2 py-0.5">
                {t.desk_coming_badge}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

// ── Main workspace ────────────────────────────────────────────────────────────

function MainWorkspace({
  collections, activeId, recentCompanies, totalSaved, onSave, t, isHe,
}: {
  collections: Collection[]
  activeId: string | null
  recentCompanies: { symbol: string; name: string; score: number | null; sector: string | null; lastViewed: string }[]
  totalSaved: number
  onSave: (target: SaveTarget) => void
  t: Record<string, string>
  isHe: boolean
}) {
  if (activeId === 'recent') {
    return (
      <div>
        <h2 className="text-white font-bold text-base mb-4">{isHe ? 'צפייה אחרונה' : 'Recently Viewed'}</h2>
        {recentCompanies.length === 0 ? (
          <EmptyState icon="🔍" text={t.desk_recent_empty} sub={t.desk_recent_empty_sub}
            cta={<Link to="/" className="inline-block bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition">{isHe ? 'חפש חברה' : 'Search a Company'}</Link>}
          />
        ) : (
          <div className="space-y-2">
            {recentCompanies.map(c => (
              <CompanyCard key={c.symbol} entry={{ ...c, addedAt: c.lastViewed }} onSave={onSave} t={t} isHe={isHe}/>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (activeId) {
    const coll = collections.find(c => c.id === activeId)
    if (!coll) return null
    const cc = COLL_COLOR[coll.color] ?? COLL_COLOR.gray
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{coll.icon}</span>
          <div>
            <h2 className="text-white font-bold text-base">{isHe ? coll.nameHe : coll.name}</h2>
            <p className="text-gray-500 text-xs">{coll.companies.length} {isHe ? 'חברות' : 'companies'}</p>
          </div>
        </div>
        {coll.companies.length === 0 ? (
          <EmptyState icon={coll.icon} text={t.coll_empty} cta={
            <Link to="/" className={`inline-block text-sm font-bold px-5 py-2.5 rounded-xl transition border ${cc.bg} ${cc.text} border-current/20`}>
              {isHe ? 'גלה חברות' : 'Discover Companies'}
            </Link>
          }/>
        ) : (
          <div className="space-y-2">
            {coll.companies.map(entry => (
              <CompanyCard key={entry.symbol} entry={entry} onSave={onSave} t={t} isHe={isHe}/>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Default overview
  const allSaved = new Map<string, CollectionEntry>()
  collections.forEach(c => c.companies.forEach(co => { if (!allSaved.has(co.symbol)) allSaved.set(co.symbol, co) }))
  const uniqueCompanies = [...allSaved.values()].sort((a, b) =>
    new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  )

  return (
    <div className="space-y-8">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t.desk_stats_companies,  value: recentCompanies.length, icon: '🔍' },
          { label: t.desk_stats_saved,      value: totalSaved,             icon: '⭐' },
          { label: t.desk_stats_watchlist,  value: collections.find(c => c.id === 'watchlist')?.companies.length ?? 0, icon: '📋' },
          { label: t.desk_coming_portfolio, value: 0,                      icon: '📊', soon: true },
        ].map(({ label, value, icon, soon }) => (
          <div key={label} className={`bg-gray-900 border border-gray-800 rounded-2xl p-4 ${soon ? 'opacity-40' : ''}`}>
            <div className="text-xl mb-2">{icon}</div>
            <div className="text-2xl font-black text-white">{value}</div>
            <div className="text-gray-500 text-xs mt-0.5 leading-snug">{label}</div>
          </div>
        ))}
      </div>

      {/* Recent research */}
      {recentCompanies.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-sm">{t.desk_recent_title}</h2>
            <Link to="/" className="text-brand-400 text-xs hover:underline">{isHe ? 'חפש עוד' : 'Search more'}</Link>
          </div>
          <div className="space-y-2">
            {recentCompanies.slice(0, 5).map(c => (
              <CompanyCard key={c.symbol} entry={{ ...c, addedAt: c.lastViewed }} onSave={onSave} t={t} isHe={isHe}/>
            ))}
          </div>
        </section>
      )}

      {/* All saved */}
      {uniqueCompanies.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-sm">{t.desk_all_companies}</h2>
            <span className="text-gray-600 text-xs">{uniqueCompanies.length}</span>
          </div>
          <div className="space-y-2">
            {uniqueCompanies.slice(0, 8).map(entry => (
              <CompanyCard key={entry.symbol} entry={entry} onSave={onSave} t={t} isHe={isHe}/>
            ))}
          </div>
        </section>
      )}

      {/* Empty state for new users */}
      {recentCompanies.length === 0 && uniqueCompanies.length === 0 && (
        <EmptyState
          icon="🔭"
          text={isHe ? 'ברוך הבא לחדר המחקר שלך.' : 'Welcome to your Research Desk.'}
          sub={isHe ? 'חפש חברה כדי להתחיל.' : 'Search for a company to get started.'}
          cta={
            <Link to="/" className="inline-block bg-brand-600 hover:bg-brand-500 text-white font-bold px-6 py-3 rounded-2xl transition text-sm">
              {isHe ? 'חפש חברה' : 'Search a Company'}
            </Link>
          }
        />
      )}
    </div>
  )
}

function EmptyState({ icon, text, sub, cta }: { icon: string; text: string; sub?: string; cta?: React.ReactNode }) {
  return (
    <div className="bg-gray-900/40 border border-gray-800/50 rounded-2xl px-6 py-12 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-gray-400 text-sm font-medium">{text}</p>
      {sub && <p className="text-gray-600 text-xs mt-1">{sub}</p>}
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Desk() {
  const { user } = useAuth()
  const { collections, recentCompanies, activity, totalSaved } = useUserData()
  const { t, isHe } = useLanguage()

  const [activeId, setActiveId]     = useState<string | null>(null)
  const [saveModal, setSaveModal]   = useState<SaveTarget | null>(null)

  const firstName = user ? getFirstName(user as any) : ''
  const title    = isHe ? `${t.desk_greeting_prefix} ${firstName}` : t.desk_title
  const subtitle = t.desk_subtitle

  return (
    <div className="min-h-screen bg-[#030609]" dir={isHe ? 'rtl' : 'ltr'}>

      {/* ── Sticky top nav ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-[#030609]/95 backdrop-blur border-b border-gray-900">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex-1 max-w-sm">
            <SearchBar />
          </div>
          <div className="flex items-center gap-2 ms-auto">
            <LanguageToggle />
            <UserMenu />
          </div>
        </div>
      </div>

      {/* ── Cinematic hero ─────────────────────────────────────────────────── */}
      <DeskHero title={title} subtitle={subtitle} />

      {/* ── Main 3-column layout ───────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-4 py-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] xl:grid-cols-[200px_1fr_260px] gap-6">

          <LeftSidebar
            collections={collections}
            activeId={activeId}
            onSelect={setActiveId}
            totalSaved={totalSaved}
            recentCount={recentCompanies.length}
            t={t as any}
            isHe={isHe}
          />

          <MainWorkspace
            collections={collections}
            activeId={activeId}
            recentCompanies={recentCompanies}
            totalSaved={totalSaved}
            onSave={target => setSaveModal(target)}
            t={t as any}
            isHe={isHe}
          />

          <RightPanel
            activity={activity}
            t={t as any}
            isHe={isHe}
          />
        </div>
      </div>

      {/* Save modal */}
      {saveModal && (
        <SaveModal
          isOpen={!!saveModal}
          onClose={() => setSaveModal(null)}
          company={saveModal}
        />
      )}
    </div>
  )
}
