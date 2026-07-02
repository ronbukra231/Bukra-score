// Research Room — AAA game menu aesthetic, pure CSS/Canvas/React, zero new deps

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { User } from '@supabase/supabase-js'

// ─── Keyframes ───────────────────────────────────────────────────────────────
const ROOM_CSS = `
@keyframes rr-flicker {
  0%,100%{opacity:1}8%{opacity:.88}15%{opacity:.95}22%{opacity:.85}
  35%{opacity:.98}60%{opacity:.91}75%{opacity:.86}
}
@keyframes rr-pulse {
  0%,100%{box-shadow:0 0 30px rgba(212,168,71,.12),0 0 80px rgba(212,168,71,.04)}
  50%{box-shadow:0 0 40px rgba(212,168,71,.2),0 0 100px rgba(212,168,71,.07)}
}
@keyframes rr-fade-quote {
  0%{opacity:0;transform:translateY(4px)}
  15%,85%{opacity:1;transform:translateY(0)}
  100%{opacity:0;transform:translateY(-4px)}
}
`

// ─── Data ────────────────────────────────────────────────────────────────────
const QUOTES = [
  { text: 'The stock market is a device for transferring money from the impatient to the patient.', author: 'Warren Buffett' },
  { text: 'Risk comes from not knowing what you are doing.', author: 'Warren Buffett' },
  { text: 'In the short run, the market is a voting machine. In the long run, it is a weighing machine.', author: 'Benjamin Graham' },
  { text: 'Price is what you pay. Value is what you get.', author: 'Warren Buffett' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
]

const NAV_ITEMS = [
  { icon: '🔍', label: 'חיפוש חברות',      sub: 'חקור את השוק',      to: '/',             active: false },
  { icon: '📡', label: 'סורק',               sub: 'גלה הזדמנויות',    to: '/scanner',      active: false },
  { icon: '⚗️', label: 'Research Room',     sub: 'המשרד הפרטי שלך',  to: '/capital-lab',  active: true  },
  { icon: '🔬', label: 'System Check',      sub: 'בדיקת מערכת',      to: '/system-check', active: false },
]

const OBJECTS = [
  { id: 'index',      Icon: IconFolder,   title: 'צור מדד חדש',       desc: 'בנה אסטרטגיית השקעה חדשה.', locked: false, soon: false },
  { id: 'search',     Icon: IconNotebook, title: 'חיפוש מתקדם',        desc: 'מצא חברות לפי אופן החשיבה שלך.', locked: false, soon: false },
  { id: 'library',    Icon: IconBook,     title: 'הספרייה',            desc: 'נפתח לאחר המחקר הראשון.',   locked: true,  soon: false },
  { id: 'strategies', Icon: IconCompass,  title: 'מעבדת אסטרטגיות',   desc: 'בקרוב.',                    locked: false, soon: true  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function firstName(user: User | null): string {
  if (!user) return ''
  const m = (user.user_metadata ?? {}) as Record<string, string>
  const full = m.full_name || m.name || ''
  if (full) return full.split(/\s+/)[0]
  return user.email?.split('@')[0] ?? ''
}

function hebrewDate(): string {
  return new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function daysActive(user: User | null): number {
  const created = (user as (User & { created_at?: string }) | null)?.created_at
  if (!created) return 1
  return Math.max(1, Math.floor((Date.now() - new Date(created).getTime()) / 86400000))
}

// ─── Rain hook ───────────────────────────────────────────────────────────────
function useRain(ref: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    type Drop = { x: number; y: number; speed: number; len: number; alpha: number }
    const W = canvas.offsetWidth || 520
    const H = canvas.offsetHeight || 320
    canvas.width  = W
    canvas.height = H
    const drops: Drop[] = Array.from({ length: 80 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      speed: 2.5 + Math.random() * 3.5,
      len:   8   + Math.random() * 18,
      alpha: 0.07 + Math.random() * 0.18,
    }))
    let raf: number
    function tick() {
      ctx!.clearRect(0, 0, W, H)
      for (const d of drops) {
        ctx!.beginPath()
        ctx!.strokeStyle = `rgba(160,190,240,${d.alpha})`
        ctx!.lineWidth = 0.6
        ctx!.moveTo(d.x, d.y)
        ctx!.lineTo(d.x - 1.5, d.y + d.len)
        ctx!.stroke()
        d.y += d.speed; d.x -= 0.6
        if (d.y > H + d.len) { d.y = -d.len; d.x = Math.random() * W }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [ref])
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function CapitalLab() {
  const { user } = useAuth()
  const rainRef  = useRef<HTMLCanvasElement>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [qIdx,  setQIdx]  = useState(0)
  const [qKey,  setQKey]  = useState(0)

  useRain(rainRef)

  useEffect(() => {
    const id = 'rr-css'
    if (!document.getElementById(id)) {
      const el = document.createElement('style')
      el.id = id; el.textContent = ROOM_CSS
      document.head.appendChild(el)
    }
    return () => { document.getElementById('rr-css')?.remove() }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setQIdx(i => (i + 1) % QUOTES.length)
      setQKey(k => k + 1)
    }, 12000)
    return () => clearInterval(id)
  }, [])

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    setMouse({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 })
  }

  const px = (f: number) => `${mouse.x * f}px`
  const py = (f: number) => `${mouse.y * f}px`
  const name = firstName(user)
  const q = QUOTES[qIdx]

  return (
    <div
      dir="rtl"
      className="relative overflow-hidden"
      style={{ minHeight: '100vh', background: '#09070500', userSelect: 'none', fontFamily: 'Georgia, "Times New Roman", serif' }}
      onMouseMove={onMove}
    >

      {/* ══ BACKGROUND ══════════════════════════════════════════════════════ */}

      {/* Base room — deep walnut darkness */}
      <div className="absolute inset-0" style={{ zIndex: 0,
        background: 'radial-gradient(ellipse at 50% 0%, #1a1108 0%, #0f0c07 35%, #090705 70%, #060503 100%)' }} />

      {/* Fireplace glow — bottom-left warm pulse */}
      <div className="absolute pointer-events-none" style={{ zIndex: 1,
        bottom: '-8%', left: '-8%', width: '58%', height: '65%',
        background: 'radial-gradient(ellipse at bottom left, rgba(210,90,15,0.22) 0%, rgba(180,70,10,0.1) 40%, transparent 70%)',
        animation: 'rr-flicker 4.2s ease-in-out infinite',
        transform: `translate(${px(-4)}, ${py(-4)})`,
      }} />
      <div className="absolute pointer-events-none" style={{ zIndex: 1,
        bottom: '0', left: '3%', width: '28%', height: '38%',
        background: 'radial-gradient(ellipse at bottom, rgba(240,110,20,0.14) 0%, transparent 65%)',
        animation: 'rr-flicker 2.9s ease-in-out infinite 0.8s',
      }} />

      {/* Ceiling lamp warmth */}
      <div className="absolute pointer-events-none" style={{ zIndex: 1,
        top: '-8%', left: '50%',
        transform: `translateX(-50%) translate(${px(-2)}, ${py(-2)})`,
        width: '50%', height: '40%',
        background: 'radial-gradient(ellipse, rgba(210,150,50,0.07) 0%, transparent 70%)',
      }} />

      {/* LEFT BOOKSHELF */}
      <div className="absolute pointer-events-none" style={{ zIndex: 2,
        top: 0, left: 0, width: '17%', height: '100%',
        transform: `translate(${px(-12)}, ${py(-5)})`,
      }}>
        <BookshelfSVG />
      </div>

      {/* RIGHT BOOKSHELF */}
      <div className="absolute pointer-events-none" style={{ zIndex: 2,
        top: 0, right: 0, width: '17%', height: '100%',
        transform: `translate(${px(12)}, ${py(-5)}) scaleX(-1)`,
      }}>
        <BookshelfSVG />
      </div>

      {/* WINDOW — center background */}
      <div className="absolute pointer-events-none" style={{ zIndex: 2,
        top: '4%', left: '50%',
        transform: `translateX(-50%) translate(${px(-7)}, ${py(-7)})`,
        width: 'min(580px, 52%)', height: '46%',
      }}>
        <WindowPanel rainRef={rainRef} />
      </div>

      {/* Floor */}
      <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{ zIndex: 2,
        height: '24%',
        background: 'linear-gradient(180deg, transparent 0%, rgba(8,6,3,0.96) 100%)',
        backgroundImage: `
          linear-gradient(180deg, transparent 0%, rgba(8,6,3,0.96) 100%),
          repeating-linear-gradient(90deg, transparent, transparent 64px, rgba(212,168,71,0.012) 64px, rgba(212,168,71,0.012) 65px)
        `,
      }} />

      {/* Global vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3,
        background: 'radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(0,0,0,0.72) 100%)',
      }} />

      {/* ══ CONTENT ═════════════════════════════════════════════════════════ */}
      <div className="relative flex flex-col" style={{ zIndex: 10, minHeight: '100vh' }}>

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3" style={{
          borderBottom: '1px solid rgba(212,168,71,0.07)',
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(10px)',
        }}>
          <Link to="/"
            style={{ color: 'rgba(212,168,71,0.38)', fontSize: '11px', letterSpacing: '0.14em', textDecoration: 'none', textTransform: 'uppercase', transition: 'color .3s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(212,168,71,0.8)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(212,168,71,0.38)')}
          >
            ← ציון בוקרא
          </Link>
          <span style={{ color: 'rgba(212,168,71,0.22)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Research Room
          </span>
          <span style={{ color: 'rgba(232,216,184,0.28)', fontSize: '11px' }}>
            {hebrewDate()}
          </span>
        </header>

        {/* 3-column layout */}
        <div className="flex flex-1">
          <LeftPanel />
          <CenterDesk name={name} />
          <RightPanel user={user} days={daysActive(user)} />
        </div>

        {/* Quote */}
        <footer style={{
          borderTop: '1px solid rgba(212,168,71,0.06)',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          padding: '14px 32px',
          textAlign: 'center',
        }}>
          <p key={qKey} style={{
            fontSize: '11px', fontStyle: 'italic',
            color: 'rgba(255,255,255,0.22)', lineHeight: 1.7,
            animation: 'rr-fade-quote 12s ease-in-out forwards',
          }}>
            "{q.text}" — <span style={{ color: 'rgba(212,168,71,0.35)' }}>{q.author}</span>
          </p>
        </footer>
      </div>
    </div>
  )
}

// ─── Bookshelf ───────────────────────────────────────────────────────────────
function BookshelfSVG() {
  const SPINES = [
    '#5a2d0c','#3d1f08','#6b3a14','#2e1507','#7a4520','#432210',
    '#5c3010','#3a1c08','#6a3818','#4a2510','#332010','#5e2e0e',
  ]
  const books = Array.from({ length: 60 }, (_, i) => ({
    h: 52 + (i * 41 % 46),
    w: 9  + (i * 11 % 9),
    c: SPINES[i % SPINES.length],
    shine: `rgba(212,168,71,${0.04 + (i * 7 % 12) / 100})`,
  }))

  return (
    <svg viewBox="0 0 150 700" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <rect width="150" height="700" fill="url(#bsWall)" />
      {[0,1,2,3,4].map(row => {
        const y = 20 + row * 130
        const rowBooks = books.slice(row * 12, row * 12 + 12)
        let x = 4
        return (
          <g key={row}>
            {rowBooks.map((b, i) => {
              const bx = x; x += b.w + 1.5
              return (
                <g key={i}>
                  <rect x={bx} y={y + 120 - b.h} width={b.w} height={b.h} fill={b.c} rx="0.5" />
                  <rect x={bx} y={y + 120 - b.h} width={b.w * 0.4} height={b.h} fill="rgba(0,0,0,0.15)" rx="0.5" />
                  <rect x={bx} y={y + 120 - b.h} width={b.w} height={2.5} fill={b.shine} rx="0.5" />
                </g>
              )
            })}
            {/* Shelf plank */}
            <rect x="2" y={y + 120} width="146" height="9" fill="#1e1008" rx="1" />
            <rect x="2" y={y + 120} width="146" height="2" fill="rgba(212,168,71,0.08)" rx="1" />
          </g>
        )
      })}
      {/* Edge shadow (inner) */}
      <rect width="150" height="700" fill="url(#bsShadow)" />
      <defs>
        <linearGradient id="bsWall" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#130a04" /><stop offset="100%" stopColor="#0c0702" />
        </linearGradient>
        <linearGradient id="bsShadow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
          <stop offset="60%" stopColor="rgba(0,0,0,0.12)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─── Window ──────────────────────────────────────────────────────────────────
function WindowPanel({ rainRef }: { rainRef: React.RefObject<HTMLCanvasElement> }) {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{
      borderRadius: '3px',
      border: '5px solid #1e1208',
      outline: '1px solid rgba(212,168,71,0.1)',
      boxShadow: '0 0 0 1px #0a0704, 0 8px 60px rgba(0,0,0,0.8), inset 0 0 40px rgba(0,0,0,0.6)',
    }}>
      {/* Night sky */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(180deg, #04060e 0%, #07091a 45%, #0b1022 70%, #141828 100%)',
      }} />

      {/* City horizon glow */}
      <div className="absolute inset-x-0" style={{
        bottom: '22%', height: '15%',
        background: 'linear-gradient(180deg, transparent, rgba(30,55,120,0.18), transparent)',
      }} />

      {/* Skyline */}
      <div className="absolute inset-x-0 bottom-0">
        <SkylineSVG />
      </div>

      {/* Rain canvas */}
      <canvas ref={rainRef} className="absolute inset-0 w-full h-full"
        style={{ mixBlendMode: 'screen', opacity: 0.85 }} />

      {/* Window cross frame */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
        <div className="absolute inset-y-0" style={{ left: '50%', width: '8px', marginLeft: '-4px',
          background: 'linear-gradient(90deg, #251a0a, #1c1207, #251a0a)',
          boxShadow: '2px 0 6px rgba(0,0,0,0.7), -2px 0 6px rgba(0,0,0,0.7)',
        }} />
        <div className="absolute inset-x-0" style={{ top: '44%', height: '8px',
          background: 'linear-gradient(180deg, #251a0a, #1c1207, #251a0a)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.7), 0 -2px 6px rgba(0,0,0,0.7)',
        }} />
      </div>

      {/* Glass reflection */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'linear-gradient(120deg, rgba(255,255,255,0.025) 0%, transparent 60%)',
        mixBlendMode: 'overlay',
      }} />
    </div>
  )
}

function SkylineSVG() {
  const buildings = [
    [0,70,38,130],[32,42,22,158],[50,82,44,118],[88,32,24,168],[106,62,52,138],
    [152,48,20,152],[166,78,48,122],[208,22,28,178],[230,55,58,145],[282,38,24,162],
    [300,68,50,132],[344,28,30,172],[368,52,44,148],[406,78,38,122],[438,44,22,156],
    [454,68,54,132],[502,32,26,168],[522,72,40,128],[556,48,24,152],[572,82,56,118],
  ]
  const litWindows = [
    [36,48],[36,58],[91,38],[91,48],[96,38],[108,67],[120,67],[132,67],[210,28],
    [215,40],[233,60],[245,60],[257,60],[346,34],[358,34],[370,58],[382,58],[394,58],
    [440,50],[440,60],[456,73],[468,73],[480,73],[504,38],[504,50],[524,77],[536,77],
    [558,54],[558,66],[574,87],
  ]
  return (
    <svg viewBox="0 0 628 200" width="100%" preserveAspectRatio="xMidYMax meet">
      {buildings.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h}
          fill={`rgba(8,10,${16 + (i%4)*3},1)`} />
      ))}
      {litWindows.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="3.5" height="2.5"
          fill={`rgba(255,225,120,${0.28 + (i % 6) * 0.08})`} />
      ))}
      {/* Ground fog */}
      <rect x="0" y="170" width="628" height="30" fill="url(#skyFog)" />
      <defs>
        <linearGradient id="skyFog" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(7,9,18,0)" />
          <stop offset="100%" stopColor="rgba(7,9,18,1)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─── Left panel ──────────────────────────────────────────────────────────────
function LeftPanel() {
  return (
    <aside style={{
      width: '210px', flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      padding: '28px 12px',
      background: 'linear-gradient(180deg, rgba(8,6,3,0.88) 0%, rgba(10,7,4,0.92) 100%)',
      borderLeft: '1px solid rgba(212,168,71,0.07)',
      backdropFilter: 'blur(14px)',
    }}>
      <p style={{ fontSize: '9px', color: 'rgba(212,168,71,0.3)', letterSpacing: '0.18em',
        textTransform: 'uppercase', marginBottom: '14px', paddingRight: '8px' }}>
        ניווט
      </p>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV_ITEMS.map(n => <NavItem key={n.to} {...n} />)}
      </nav>
      <div style={{ flex: 1 }} />
      <p style={{ fontSize: '9px', color: 'rgba(212,168,71,0.18)', paddingRight: '8px', letterSpacing: '0.06em' }}>
        v0.9.1
      </p>
    </aside>
  )
}

function NavItem({ icon, label, sub, to, active }: { icon: string; label: string; sub: string; to: string; active: boolean }) {
  const [hov, setHov] = useState(false)
  const on = active || hov
  return (
    <Link to={to} style={{ textDecoration: 'none' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 10px',
        borderRadius: '10px',
        background: on ? 'rgba(212,168,71,0.06)' : 'transparent',
        border: on ? '1px solid rgba(212,168,71,0.13)' : '1px solid transparent',
        transition: 'all .25s ease',
      }}>
        <span style={{ fontSize: '15px', opacity: on ? 1 : 0.45 }}>{icon}</span>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, margin: 0, fontFamily: 'Georgia,serif',
            color: on ? 'rgba(240,224,184,.95)' : 'rgba(240,224,184,.38)' }}>{label}</p>
          <p style={{ fontSize: '9.5px', margin: '1px 0 0', color: 'rgba(255,255,255,.2)' }}>{sub}</p>
        </div>
        {active && <div style={{ marginRight: 'auto', width: '3px', height: '16px', borderRadius: '2px',
          background: 'rgba(212,168,71,0.65)' }} />}
      </div>
    </Link>
  )
}

// ─── Center desk ─────────────────────────────────────────────────────────────
function CenterDesk({ name }: { name: string }) {
  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-end', padding: '0 16px 56px' }}>

      {/* Welcome */}
      <div style={{ textAlign: 'center', marginBottom: '44px', maxWidth: '540px' }}>
        <h1 style={{
          margin: 0,
          fontSize: 'clamp(1.75rem, 3.2vw, 2.9rem)',
          fontWeight: 900, fontFamily: 'Georgia,serif',
          letterSpacing: '-0.02em', lineHeight: 1.1,
          background: 'linear-gradient(135deg, #f2e4bc 0%, #d4a847 52%, #9a6820 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          {name ? `ברוך שובך, ${name}.` : 'Research Room'}
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: '13px',
          color: 'rgba(232,216,184,0.32)', letterSpacing: '0.03em', lineHeight: 1.5 }}>
          המקום שבו הרעיונות שלך הופכים לאסטרטגיות השקעה.
        </p>
      </div>

      {/* Desk */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: '680px',
        background: 'linear-gradient(180deg, #1e1509 0%, #150f06 55%, #100b04 100%)',
        borderRadius: '18px',
        border: '1px solid rgba(212,168,71,0.13)',
        boxShadow: '0 -4px 50px rgba(0,0,0,0.65), 0 30px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(212,168,71,0.09)',
        padding: '32px 28px 36px',
        animation: 'rr-pulse 7s ease-in-out infinite',
      }}>
        {/* Wood grain */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '18px', pointerEvents: 'none', opacity: 0.7,
          backgroundImage: `repeating-linear-gradient(88deg, transparent, transparent 5px,
            rgba(212,168,71,0.011) 5px, rgba(212,168,71,0.011) 6px)`,
        }} />
        {/* Top edge */}
        <div style={{
          position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(212,168,71,0.22), transparent)',
        }} />

        {/* Objects */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', position: 'relative' }}>
          {OBJECTS.map(o => <DeskObject key={o.id} {...o} />)}
        </div>

        {/* Desk lower edge */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '14px',
          background: 'linear-gradient(180deg, transparent, #080603)',
          borderTop: '1px solid rgba(212,168,71,0.05)', borderRadius: '0 0 18px 18px',
        }} />
      </div>

      {/* Drop shadow under desk */}
      <div style={{ width: '75%', height: '10px', marginTop: '2px',
        background: 'rgba(0,0,0,0.55)', filter: 'blur(12px)', borderRadius: '50%' }} />
    </main>
  )
}

function DeskObject({ Icon, title, desc, locked, soon }: {
  Icon: React.FC; title: string; desc: string; locked: boolean; soon: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        alignItems: 'center', textAlign: 'center',
        padding: '18px 10px 16px',
        borderRadius: '13px',
        background: hov ? 'rgba(212,168,71,0.065)' : 'rgba(255,255,255,0.022)',
        border: hov ? '1px solid rgba(212,168,71,0.22)' : '1px solid rgba(255,255,255,0.045)',
        boxShadow: hov ? '0 8px 28px rgba(0,0,0,0.55), 0 0 22px rgba(212,168,71,0.07)' : '0 2px 10px rgba(0,0,0,0.35)',
        transform: hov ? 'translateY(-5px)' : 'translateY(0)',
        transition: 'all 0.5s cubic-bezier(0.23,1,0.32,1)',
        cursor: 'default',
        opacity: locked ? 0.52 : 1,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {locked && (
        <div style={{ position: 'absolute', top: '8px', right: '8px', width: '18px', height: '18px',
          borderRadius: '50%', background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(212,168,71,0.28)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="7" height="9" viewBox="0 0 7 9" fill="none">
            <rect x=".5" y="3.5" width="6" height="5" rx=".8" stroke="rgba(212,168,71,0.55)" strokeWidth=".8"/>
            <path d="M1.5 3.5V2.5a2 2 0 0 1 4 0v1" stroke="rgba(212,168,71,0.55)" strokeWidth=".8"/>
          </svg>
        </div>
      )}
      {soon && (
        <div style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 5px',
          borderRadius: '4px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(212,168,71,0.14)' }}>
          <span style={{ fontSize: '8px', color: 'rgba(212,168,71,0.38)', letterSpacing: '0.06em' }}>בקרוב</span>
        </div>
      )}
      <div style={{ marginBottom: '12px', transition: 'transform .5s ease', transform: hov ? 'scale(1.1)' : 'scale(1)' }}>
        <Icon />
      </div>
      <p style={{ margin: '0 0 5px', fontSize: '11px', fontWeight: 700, lineHeight: 1.3, fontFamily: 'Georgia,serif',
        color: hov ? 'rgba(240,224,184,0.95)' : 'rgba(240,224,184,0.58)' }}>
        {title}
      </p>
      <p style={{ margin: 0, fontSize: '9.5px', color: 'rgba(255,255,255,0.2)', lineHeight: 1.55 }}>
        {desc}
      </p>
    </div>
  )
}

// ─── Right panel ─────────────────────────────────────────────────────────────
function RightPanel({ user, days }: { user: User | null; days: number }) {
  const name = firstName(user)
  const initial = name?.[0]?.toUpperCase() ?? '?'

  return (
    <aside style={{
      width: '210px', flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      padding: '28px 12px', gap: '18px',
      background: 'linear-gradient(180deg, rgba(8,6,3,0.88) 0%, rgba(10,7,4,0.92) 100%)',
      borderRight: '1px solid rgba(212,168,71,0.07)',
      backdropFilter: 'blur(14px)',
    }}>

      {/* Profile card */}
      <div style={{ borderRadius: '12px', padding: '14px 12px',
        background: 'rgba(212,168,71,0.04)', border: '1px solid rgba(212,168,71,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #5a3a10, #3a2208)',
            border: '1px solid rgba(212,168,71,0.32)',
            fontSize: '14px', fontWeight: 900, color: '#d4a847', fontFamily: 'Georgia,serif',
          }}>{initial}</div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, fontFamily: 'Georgia,serif',
              color: 'rgba(240,224,184,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name || 'משקיע'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '9.5px', color: 'rgba(212,168,71,0.48)' }}>
              חוקר בכיר
            </p>
          </div>
        </div>
        {/* XP bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ fontSize: '9px', color: 'rgba(212,168,71,0.38)', letterSpacing: '0.08em' }}>רמה 1</span>
            <span style={{ fontSize: '9px', color: 'rgba(212,168,71,0.28)' }}>0 / 100 XP</span>
          </div>
          <div style={{ height: '3px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px' }}>
            <div style={{ height: '100%', width: '2%',
              background: 'linear-gradient(90deg, #6a3808, #d4a847)', borderRadius: '2px' }} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <SideSection label="סטטיסטיקות">
        {[
          { l: 'חברות שנחקרו', v: '0' },
          { l: 'מדדים שנבנו',  v: '0' },
          { l: 'ימים פעיל',    v: String(days) },
        ].map(s => (
          <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '7px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.022)' }}>
            <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.28)' }}>{s.l}</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(212,168,71,0.68)' }}>{s.v}</span>
          </div>
        ))}
      </SideSection>

      {/* Collections */}
      <SideSection label="אוספים">
        <EmptySlot text="אוסף ראשון יתווסף בקרוב" />
      </SideSection>

      {/* Recent activity */}
      <SideSection label="פעילות אחרונה">
        <EmptySlot text="טרם נרשמה פעילות" />
      </SideSection>
    </aside>
  )
}

function SideSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <p style={{ margin: 0, fontSize: '9px', color: 'rgba(212,168,71,0.3)',
        letterSpacing: '0.16em', textTransform: 'uppercase', paddingRight: '4px' }}>
        {label}
      </p>
      {children}
    </div>
  )
}

function EmptySlot({ text }: { text: string }) {
  return (
    <div style={{ padding: '14px 10px', textAlign: 'center', borderRadius: '8px',
      background: 'rgba(255,255,255,0.018)', border: '1px dashed rgba(212,168,71,0.1)' }}>
      <p style={{ margin: 0, fontSize: '9px', color: 'rgba(255,255,255,0.18)' }}>{text}</p>
    </div>
  )
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────
function IconFolder() {
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
      <path d="M6 14C6 12.3 7.3 11 9 11H19L23 15H39C40.7 15 42 16.3 42 18V36C42 37.7 40.7 39 39 39H9C7.3 39 6 37.7 6 36V14Z"
        fill="url(#ig-f1)" stroke="rgba(212,168,71,0.32)" strokeWidth="0.5"/>
      <line x1="6" y1="22" x2="42" y2="22" stroke="rgba(212,168,71,0.1)" strokeWidth="0.5"/>
      <line x1="6" y1="29" x2="42" y2="29" stroke="rgba(212,168,71,0.07)" strokeWidth="0.5"/>
      <rect x="21" y="25" width="6" height="4" rx="1" fill="rgba(212,168,71,0.48)" stroke="rgba(212,168,71,0.65)" strokeWidth="0.5"/>
      <defs><linearGradient id="ig-f1" x1="6" y1="11" x2="42" y2="39" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#5e3d1c"/><stop offset="100%" stopColor="#3a2010"/>
      </linearGradient></defs>
    </svg>
  )
}

function IconNotebook() {
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
      <rect x="10" y="8" width="28" height="34" rx="2" fill="url(#ig-n1)" stroke="rgba(212,168,71,0.25)" strokeWidth="0.5"/>
      <rect x="10" y="8" width="5" height="34" rx="1" fill="rgba(35,20,8,0.85)" stroke="rgba(212,168,71,0.18)" strokeWidth="0.5"/>
      <rect x="35" y="9" width="2" height="32" rx="0.5" fill="rgba(240,218,175,0.09)"/>
      <line x1="19" y1="19" x2="34" y2="19" stroke="rgba(212,168,71,0.16)" strokeWidth="0.7"/>
      <line x1="19" y1="24" x2="34" y2="24" stroke="rgba(212,168,71,0.1)" strokeWidth="0.7"/>
      <line x1="19" y1="29" x2="34" y2="29" stroke="rgba(212,168,71,0.07)" strokeWidth="0.7"/>
      <rect x="28" y="8" width="2" height="11" rx="0.5" fill="rgba(212,168,71,0.42)"/>
      <defs><linearGradient id="ig-n1" x1="10" y1="8" x2="38" y2="42" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#4e3214"/><stop offset="100%" stopColor="#2e1a08"/>
      </linearGradient></defs>
    </svg>
  )
}

function IconBook() {
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
      <path d="M8 10C8 9.4 8.4 9 9 9H22C24 9 24 11 24 11V40C22 39 20 39 9 39C8.4 39 8 38.6 8 38V10Z"
        fill="url(#ig-b1)" stroke="rgba(212,168,71,0.12)" strokeWidth="0.5"/>
      <path d="M40 10C40 9.4 39.6 9 39 9H26C24 9 24 11 24 11V40C26 39 28 39 39 39C39.6 39 40 38.6 40 38V10Z"
        fill="url(#ig-b2)" stroke="rgba(212,168,71,0.12)" strokeWidth="0.5"/>
      <rect x="22.5" y="9" width="3" height="31" fill="rgba(12,7,2,0.92)" stroke="rgba(212,168,71,0.28)" strokeWidth="0.5"/>
      <line x1="11" y1="15" x2="21" y2="15" stroke="rgba(212,168,71,0.2)" strokeWidth="0.6"/>
      <line x1="11" y1="19" x2="21" y2="19" stroke="rgba(212,168,71,0.12)" strokeWidth="0.6"/>
      {/* Padlock */}
      <path d="M19 24.5a5 5 0 0 1 10 0v2H19v-2Z" fill="none" stroke="rgba(212,168,71,0.52)" strokeWidth="1.1"/>
      <rect x="18" y="26" width="12" height="8" rx="1.5" fill="rgba(18,10,3,0.9)" stroke="rgba(212,168,71,0.48)" strokeWidth="0.9"/>
      <circle cx="24" cy="30" r="1.5" fill="rgba(212,168,71,0.55)"/>
      <defs>
        <linearGradient id="ig-b1" x1="8" y1="9" x2="24" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3e2412"/><stop offset="100%" stopColor="#251508"/>
        </linearGradient>
        <linearGradient id="ig-b2" x1="40" y1="9" x2="24" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4e301a"/><stop offset="100%" stopColor="#2e1a0a"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function IconCompass() {
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="17" stroke="url(#ig-cr)" strokeWidth="1.5" fill="rgba(12,8,3,0.82)"/>
      <circle cx="24" cy="24" r="13" stroke="rgba(212,168,71,0.14)" strokeWidth="0.5" fill="none"/>
      <line x1="24" y1="8"  x2="24" y2="12" stroke="rgba(212,168,71,0.62)" strokeWidth="1.2"/>
      <line x1="24" y1="36" x2="24" y2="40" stroke="rgba(212,168,71,0.25)" strokeWidth="0.8"/>
      <line x1="8"  y1="24" x2="12" y2="24" stroke="rgba(212,168,71,0.25)" strokeWidth="0.8"/>
      <line x1="36" y1="24" x2="40" y2="24" stroke="rgba(212,168,71,0.25)" strokeWidth="0.8"/>
      <text x="22.5" y="17" fontSize="4.5" fill="rgba(212,168,71,0.65)" fontFamily="Georgia,serif">N</text>
      <path d="M24 13L26.8 24L24 22L21.2 24Z" fill="url(#ig-cn)"/>
      <path d="M24 35L21.2 24L24 26L26.8 24Z" fill="rgba(75,50,18,0.65)"/>
      <circle cx="24" cy="24" r="2.2" fill="rgba(212,168,71,0.88)" stroke="rgba(255,220,130,0.45)" strokeWidth="0.5"/>
      <defs>
        <linearGradient id="ig-cr" x1="7" y1="7" x2="41" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(212,168,71,0.62)"/>
          <stop offset="50%" stopColor="rgba(212,168,71,0.14)"/>
          <stop offset="100%" stopColor="rgba(212,168,71,0.52)"/>
        </linearGradient>
        <linearGradient id="ig-cn" x1="24" y1="13" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f8e878"/><stop offset="100%" stopColor="#c49018"/>
        </linearGradient>
      </defs>
    </svg>
  )
}
