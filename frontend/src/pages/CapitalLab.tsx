import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// ── Quotes ────────────────────────────────────────────────────────────────────
const QUOTES = [
  {
    text: 'The stock market is a device for transferring money from the impatient to the patient.',
    author: 'Warren Buffett',
  },
  {
    text: 'Risk comes from not knowing what you are doing.',
    author: 'Warren Buffett',
  },
  {
    text: 'In the short run, the market is a voting machine. In the long run, it is a weighing machine.',
    author: 'Benjamin Graham',
  },
  {
    text: 'The individual investor should act consistently as an investor and not as a speculator.',
    author: 'Benjamin Graham',
  },
  {
    text: 'It is not the man who has too little who is poor, but the one who hankers after more.',
    author: 'Seneca',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function getFirstName(user: { email?: string | null; user_metadata?: Record<string, string> } | null): string {
  if (!user) return ''
  const meta = user.user_metadata ?? {}
  const full: string = meta.full_name || meta.name || ''
  if (full) return full.split(/\s+/)[0]
  return user.email?.split('@')[0] ?? ''
}

function formatHebrewDate(): string {
  return new Date().toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ── Desk objects ──────────────────────────────────────────────────────────────
const OBJECTS = [
  {
    id: 'index',
    icon: IconFolder,
    title: 'צור מדד חדש',
    desc: 'בנה אסטרטגיית השקעה חדשה.',
    locked: false,
    soon: false,
  },
  {
    id: 'search',
    icon: IconNotebook,
    title: 'חיפוש מתקדם',
    desc: 'מצא חברות לפי הדרך שבה אתה חושב.',
    locked: false,
    soon: false,
  },
  {
    id: 'library',
    icon: IconBook,
    title: 'הספרייה',
    desc: 'ייפתח לאחר שתתחיל לבנות את אוסף החברות שלך.',
    locked: true,
    soon: false,
  },
  {
    id: 'strategies',
    icon: IconCompass,
    title: 'מעבדת אסטרטגיות',
    desc: 'בקרוב.',
    locked: false,
    soon: true,
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CapitalLab() {
  const { user } = useAuth()
  const firstName = getFirstName(user as Parameters<typeof getFirstName>[0])
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * QUOTES.length))

  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIdx(i => (i + 1) % QUOTES.length)
    }, 12000)
    return () => clearInterval(id)
  }, [])

  const quote = QUOTES[quoteIdx]

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 20% 10%, #0f1623 0%, #090c12 55%, #07090f 100%)' }}
    >
      {/* ── Top nav ────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid rgba(212,168,71,0.08)' }}>
        <Link
          to="/"
          className="text-xs tracking-widest uppercase transition"
          style={{ color: 'rgba(212,168,71,0.45)', letterSpacing: '0.12em' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(212,168,71,0.85)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(212,168,71,0.45)')}
        >
          ← ציון בוקרא
        </Link>
        <span className="text-xs tracking-widest uppercase" style={{ color: 'rgba(212,168,71,0.25)', letterSpacing: '0.18em' }}>
          Capital Lab
        </span>
      </nav>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 gap-20">

        {/* ── Welcome ──────────────────────────────────────────────────────── */}
        <div className="text-center space-y-4 max-w-xl">
          <h1
            className="font-black tracking-tight leading-none"
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.25rem)',
              background: 'linear-gradient(135deg, #f0e0b8 0%, #d4a847 55%, #9a6f2a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {firstName ? `ברוך שובך, ${firstName}.` : 'Capital Lab'}
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
            המקום שבו הרעיונות שלך הופכים לאסטרטגיות השקעה.
          </p>
          <p className="text-xs tracking-widest" style={{ color: 'rgba(212,168,71,0.3)', letterSpacing: '0.14em' }}>
            {formatHebrewDate()}
          </p>
        </div>

        {/* ── Desk ─────────────────────────────────────────────────────────── */}
        <div className="w-full max-w-4xl">
          {/* Desk surface */}
          <div
            className="relative rounded-3xl px-8 py-10"
            style={{
              background: 'linear-gradient(175deg, rgba(28,20,10,0.95) 0%, rgba(18,12,6,0.98) 100%)',
              border: '1px solid rgba(212,168,71,0.12)',
              boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 2px 0 rgba(212,168,71,0.08) inset, 0 -1px 0 rgba(0,0,0,0.8) inset',
            }}
          >
            {/* Wood grain overlay */}
            <div
              className="absolute inset-0 rounded-3xl pointer-events-none opacity-[0.04]"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  88deg,
                  transparent,
                  transparent 3px,
                  rgba(212,168,71,0.6) 3px,
                  rgba(212,168,71,0.6) 4px
                )`,
              }}
            />

            {/* Objects grid */}
            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-5">
              {OBJECTS.map(obj => (
                <DeskObject key={obj.id} {...obj} />
              ))}
            </div>

            {/* Desk edge highlight */}
            <div
              className="absolute bottom-0 left-8 right-8 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(212,168,71,0.15), transparent)' }}
            />
          </div>

          {/* Desk legs shadow */}
          <div
            className="mx-auto mt-1 rounded-b-xl"
            style={{
              width: '70%',
              height: '6px',
              background: 'rgba(0,0,0,0.5)',
              filter: 'blur(8px)',
            }}
          />
        </div>

        {/* ── Quote ────────────────────────────────────────────────────────── */}
        <div
          className="text-center max-w-lg space-y-2 transition-opacity duration-1000"
          style={{ opacity: 0.5 }}
        >
          <p
            className="text-sm italic leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}
          >
            "{quote.text}"
          </p>
          <p className="text-xs tracking-widest" style={{ color: 'rgba(212,168,71,0.35)', letterSpacing: '0.12em' }}>
            — {quote.author}
          </p>
        </div>

      </main>
    </div>
  )
}

// ── Desk Object card ──────────────────────────────────────────────────────────
function DeskObject({
  icon: Icon,
  title,
  desc,
  locked,
  soon,
}: {
  icon: React.FC
  title: string
  desc: string
  locked: boolean
  soon: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="relative flex flex-col items-center text-center p-5 rounded-2xl cursor-default select-none transition-all duration-700"
      style={{
        background: hovered
          ? 'linear-gradient(145deg, rgba(212,168,71,0.07) 0%, rgba(212,168,71,0.02) 100%)'
          : 'linear-gradient(145deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)',
        border: hovered
          ? '1px solid rgba(212,168,71,0.22)'
          : '1px solid rgba(255,255,255,0.05)',
        boxShadow: hovered
          ? '0 8px 32px rgba(0,0,0,0.4), 0 0 24px rgba(212,168,71,0.06)'
          : '0 2px 12px rgba(0,0,0,0.3)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Lock badge */}
      {locked && (
        <div
          className="absolute top-3 left-3 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(212,168,71,0.2)' }}
        >
          <svg width="8" height="10" viewBox="0 0 8 10" fill="none">
            <rect x="1" y="4" width="6" height="6" rx="1" stroke="rgba(212,168,71,0.5)" strokeWidth="1"/>
            <path d="M2 4V3a2 2 0 0 1 4 0v1" stroke="rgba(212,168,71,0.5)" strokeWidth="1"/>
          </svg>
        </div>
      )}

      {/* Soon badge */}
      {soon && (
        <div
          className="absolute top-3 left-3 px-1.5 py-0.5 rounded text-xs"
          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(212,168,71,0.15)', color: 'rgba(212,168,71,0.4)', fontSize: '9px', letterSpacing: '0.08em' }}
        >
          בקרוב
        </div>
      )}

      {/* Icon */}
      <div
        className="mb-4 transition-transform duration-700"
        style={{ transform: hovered ? 'scale(1.06)' : 'scale(1)', opacity: locked ? 0.45 : 1 }}
      >
        <Icon />
      </div>

      {/* Text */}
      <p
        className="text-xs font-bold mb-1.5 leading-snug transition-colors duration-500"
        style={{ color: hovered ? 'rgba(240,224,184,0.95)' : 'rgba(240,224,184,0.65)' }}
      >
        {title}
      </p>
      <p
        className="text-xs leading-relaxed"
        style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}
      >
        {desc}
      </p>
    </div>
  )
}

// ── Icons (inline SVG, no deps) ───────────────────────────────────────────────

function IconFolder() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Folder back */}
      <path d="M6 14C6 12.3 7.3 11 9 11H19L23 15H39C40.7 15 42 16.3 42 18V36C42 37.7 40.7 39 39 39H9C7.3 39 6 37.7 6 36V14Z"
        fill="url(#folderGrad)"
        stroke="rgba(212,168,71,0.3)"
        strokeWidth="0.5"
      />
      {/* Leather texture highlight */}
      <path d="M6 22H42" stroke="rgba(212,168,71,0.12)" strokeWidth="0.5"/>
      <path d="M6 28H42" stroke="rgba(212,168,71,0.08)" strokeWidth="0.5"/>
      {/* Clasp */}
      <rect x="21" y="25" width="6" height="4" rx="1" fill="rgba(212,168,71,0.5)" stroke="rgba(212,168,71,0.7)" strokeWidth="0.5"/>
      <defs>
        <linearGradient id="folderGrad" x1="6" y1="11" x2="42" y2="39" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5a3a1a"/>
          <stop offset="100%" stopColor="#3a2010"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function IconNotebook() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cover */}
      <rect x="10" y="8" width="28" height="34" rx="2" fill="url(#notebookGrad)" stroke="rgba(212,168,71,0.25)" strokeWidth="0.5"/>
      {/* Spine */}
      <rect x="10" y="8" width="5" height="34" rx="1" fill="rgba(40,25,10,0.8)" stroke="rgba(212,168,71,0.2)" strokeWidth="0.5"/>
      {/* Pages edge */}
      <rect x="35" y="9" width="2" height="32" rx="0.5" fill="rgba(240,220,180,0.12)"/>
      {/* Horizontal lines */}
      <line x1="19" y1="20" x2="34" y2="20" stroke="rgba(212,168,71,0.15)" strokeWidth="0.7"/>
      <line x1="19" y1="25" x2="34" y2="25" stroke="rgba(212,168,71,0.1)" strokeWidth="0.7"/>
      <line x1="19" y1="30" x2="34" y2="30" stroke="rgba(212,168,71,0.08)" strokeWidth="0.7"/>
      {/* Ribbon bookmark */}
      <rect x="28" y="8" width="2" height="10" rx="0.5" fill="rgba(212,168,71,0.4)"/>
      <defs>
        <linearGradient id="notebookGrad" x1="10" y1="8" x2="38" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4a2e12"/>
          <stop offset="100%" stopColor="#2e1a08"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function IconBook() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Book body */}
      <path d="M8 10C8 9.4 8.4 9 9 9H22C22 9 24 9 24 11V40C24 40 22 39 20 39H9C8.4 39 8 38.6 8 38V10Z"
        fill="url(#bookLeft)" stroke="rgba(212,168,71,0.15)" strokeWidth="0.5"/>
      <path d="M40 10C40 9.4 39.6 9 39 9H26C26 9 24 9 24 11V40C24 40 26 39 28 39H39C39.6 39 40 38.6 40 38V10Z"
        fill="url(#bookRight)" stroke="rgba(212,168,71,0.15)" strokeWidth="0.5"/>
      {/* Spine */}
      <rect x="22.5" y="9" width="3" height="31" fill="rgba(20,10,4,0.9)" stroke="rgba(212,168,71,0.3)" strokeWidth="0.5"/>
      {/* Ancient decorative lines */}
      <line x1="11" y1="15" x2="21" y2="15" stroke="rgba(212,168,71,0.2)" strokeWidth="0.6"/>
      <line x1="11" y1="18" x2="21" y2="18" stroke="rgba(212,168,71,0.12)" strokeWidth="0.6"/>
      <line x1="11" y1="21" x2="21" y2="21" stroke="rgba(212,168,71,0.08)" strokeWidth="0.6"/>
      {/* Lock chain */}
      <rect x="18" y="22" width="12" height="7" rx="3.5" fill="none" stroke="rgba(212,168,71,0.55)" strokeWidth="1.2"/>
      <rect x="20" y="27" width="8" height="6" rx="1" fill="rgba(30,20,8,0.9)" stroke="rgba(212,168,71,0.5)" strokeWidth="0.8"/>
      <circle cx="24" cy="30" r="1.2" fill="rgba(212,168,71,0.5)"/>
      <defs>
        <linearGradient id="bookLeft" x1="8" y1="9" x2="24" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3a2210"/>
          <stop offset="100%" stopColor="#251508"/>
        </linearGradient>
        <linearGradient id="bookRight" x1="40" y1="9" x2="24" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4a2e18"/>
          <stop offset="100%" stopColor="#2e1a0a"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function IconCompass() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer ring */}
      <circle cx="24" cy="24" r="17" stroke="url(#compassRing)" strokeWidth="1.5" fill="rgba(20,14,6,0.7)"/>
      {/* Inner ring */}
      <circle cx="24" cy="24" r="13" stroke="rgba(212,168,71,0.2)" strokeWidth="0.5" fill="none"/>
      {/* Cardinal marks */}
      <line x1="24" y1="8" x2="24" y2="12" stroke="rgba(212,168,71,0.6)" strokeWidth="1.2"/>
      <line x1="24" y1="36" x2="24" y2="40" stroke="rgba(212,168,71,0.3)" strokeWidth="0.8"/>
      <line x1="8" y1="24" x2="12" y2="24" stroke="rgba(212,168,71,0.3)" strokeWidth="0.8"/>
      <line x1="36" y1="24" x2="40" y2="24" stroke="rgba(212,168,71,0.3)" strokeWidth="0.8"/>
      {/* N label */}
      <text x="22" y="16" fontSize="5" fill="rgba(212,168,71,0.7)" fontFamily="serif">N</text>
      {/* Needle north (gold) */}
      <path d="M24 13L26.5 24L24 22L21.5 24Z" fill="url(#needleGold)"/>
      {/* Needle south (dark) */}
      <path d="M24 35L21.5 24L24 26L26.5 24Z" fill="rgba(100,70,30,0.6)"/>
      {/* Center jewel */}
      <circle cx="24" cy="24" r="2" fill="rgba(212,168,71,0.8)" stroke="rgba(255,220,120,0.5)" strokeWidth="0.5"/>
      <defs>
        <linearGradient id="compassRing" x1="7" y1="7" x2="41" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(212,168,71,0.6)"/>
          <stop offset="50%" stopColor="rgba(212,168,71,0.2)"/>
          <stop offset="100%" stopColor="rgba(212,168,71,0.5)"/>
        </linearGradient>
        <linearGradient id="needleGold" x1="24" y1="13" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f5e070"/>
          <stop offset="100%" stopColor="#c89020"/>
        </linearGradient>
      </defs>
    </svg>
  )
}
