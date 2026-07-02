// Research Room — Full perspective environment, no panels, no cards.
// The SVG IS the room. The room IS the UI.

import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { User } from '@supabase/supabase-js'

// ─── CSS ─────────────────────────────────────────────────────────────────────
const ROOM_CSS = `
@keyframes rr-fire{
  0%,100%{opacity:1}6%{opacity:.76}17%{opacity:.93}27%{opacity:.70}
  41%{opacity:.88}55%{opacity:.74}69%{opacity:.91}83%{opacity:.78}
}
@keyframes rr-fire2{
  0%,100%{opacity:.65}13%{opacity:.50}32%{opacity:.82}58%{opacity:.55}78%{opacity:.78}
}
@keyframes rr-lamp{0%,100%{opacity:.80}50%{opacity:1}}
@keyframes rr-qi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes rr-qo{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-6px)}}
@keyframes rr-lightning{
  0%,100%{opacity:0}4%{opacity:.9}8%{opacity:.2}12%{opacity:.8}20%{opacity:0}
}
`

// ─── Data ─────────────────────────────────────────────────────────────────────
const QUOTES = [
  { t: 'The stock market is a device for transferring money from the impatient to the patient.', a: 'Warren Buffett' },
  { t: 'Risk comes from not knowing what you are doing.', a: 'Warren Buffett' },
  { t: 'In the short run, the market is a voting machine. In the long run, it is a weighing machine.', a: 'Benjamin Graham' },
  { t: 'Price is what you pay. Value is what you get.', a: 'Warren Buffett' },
  { t: 'An investment in knowledge pays the best interest.', a: 'Benjamin Franklin' },
]

// Room geometry — everything converges to VP (720, 340)
const VP = { x: 720, y: 340 }

// The back wall rectangle (what the camera sees straight ahead)
const BW = { x1: 240, y1: 105, x2: 1200, y2: 680 }

// Window inside back wall (massive, near floor-to-ceiling)
const WIN = { x1: 258, y1: 112, x2: 1182, y2: 673 }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getFirstName(u: User | null): string {
  if (!u) return ''
  const m = (u.user_metadata ?? {}) as Record<string, string>
  const f = m.full_name || m.name || ''
  return f ? f.split(/\s+/)[0] : u.email?.split('@')[0] ?? ''
}

// Point on a perspective line at x=240 (back-wall/left-wall junction)
// Lines on left wall converge toward VP
function lwY(yLeft: number): number {
  return yLeft + (VP.y - yLeft) * (240 / 720)
}

// ─── Rain canvas hook ─────────────────────────────────────────────────────────
function useRain(ref: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    type Drop = { x: number; y: number; s: number; l: number; a: number }
    const mk = (): Drop => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      s: 2.5 + Math.random() * 4, l: 9 + Math.random() * 24,
      a: 0.05 + Math.random() * 0.17,
    })
    const drops: Drop[] = Array.from({ length: 110 }, mk)
    let raf: number
    const tick = () => {
      ctx.clearRect(0, 0, c.width, c.height)
      for (const d of drops) {
        ctx.beginPath()
        ctx.strokeStyle = `rgba(155,190,245,${d.a})`
        ctx.lineWidth = 0.55
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x - 1.8, d.y + d.l)
        ctx.stroke()
        d.y += d.s; d.x -= 0.7
        if (d.y > c.height + d.l) Object.assign(d, mk(), { y: -d.l })
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [ref])
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CapitalLab() {
  const { user } = useAuth()
  const name = getFirstName(user)
  const rainRef = useRef<HTMLCanvasElement>(null)
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 })
  const [hov, setHov] = useState<string | null>(null)
  const [lightning, setLightning] = useState(false)
  const [qIdx, setQIdx] = useState(0)
  const [qPhase, setQPhase] = useState<'in' | 'out'>('in')

  useRain(rainRef)

  useEffect(() => {
    const id = 'rr-css'
    if (!document.getElementById(id)) {
      const el = document.createElement('style')
      el.id = id; el.textContent = ROOM_CSS
      document.head.appendChild(el)
    }
    return () => document.getElementById('rr-css')?.remove()
  }, [])

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const flash = () => {
      setLightning(true)
      setTimeout(() => setLightning(false), 90 + Math.random() * 100)
      t = setTimeout(flash, 9000 + Math.random() * 24000)
    }
    t = setTimeout(flash, 7000 + Math.random() * 7000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setQPhase('out')
      setTimeout(() => { setQIdx(i => (i + 1) % QUOTES.length); setQPhase('in') }, 900)
    }, 14000)
    return () => clearInterval(id)
  }, [])

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setMouse({ x: e.clientX / r.width, y: e.clientY / r.height })
  }, [])

  // Parallax: different room layers move at different speeds
  const p = (dx: number, dy: number) =>
    `translate(${(mouse.x - 0.5) * dx}px, ${(mouse.y - 0.5) * dy}px)`

  const q = QUOTES[qIdx]

  return (
    <div
      style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#060402', cursor: 'default' }}
      onMouseMove={onMove}
    >
      {/* Rain — full screen, subtle */}
      <canvas ref={rainRef} style={{
        position: 'absolute', inset: 0, zIndex: 8,
        opacity: 0.48, mixBlendMode: 'screen', pointerEvents: 'none',
      }} />

      {/* ═══ THE ROOM ═══════════════════════════════════════════════════════ */}
      <svg
        viewBox="0 0 1440 900"
        width="100%" height="100%"
        style={{ position: 'absolute', inset: 0, display: 'block' }}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Clip paths */}
          <clipPath id="cl-left"><polygon points="0,0 240,105 240,680 0,900" /></clipPath>
          <clipPath id="cl-right"><polygon points="1200,105 1440,0 1440,900 1200,680" /></clipPath>
          <clipPath id="cl-win"><rect x={WIN.x1} y={WIN.y1} width={WIN.x2 - WIN.x1} height={WIN.y2 - WIN.y1} /></clipPath>
          <clipPath id="cl-floor"><polygon points="240,680 1200,680 1440,900 0,900" /></clipPath>
          <clipPath id="cl-ceil"><polygon points="0,0 1440,0 1200,105 240,105" /></clipPath>
          <clipPath id="cl-desk"><polygon points="360,800 1080,800 1080,862 360,862" /></clipPath>

          {/* Gradients */}
          <radialGradient id="grd-fire" cx="15%" cy="95%" r="55%">
            <stop offset="0%" stopColor="rgba(215,88,15,0.28)" />
            <stop offset="45%" stopColor="rgba(180,65,8,0.10)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="grd-fire2" cx="18%" cy="100%" r="35%">
            <stop offset="0%" stopColor="rgba(240,120,20,0.18)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="grd-lamp" cx="50%" cy="0%" r="75%">
            <stop offset="0%" stopColor="rgba(205,148,52,0.20)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="grd-win-glow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="rgba(30,55,130,0.22)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="grd-vignette" cx="50%" cy="43%" r="62%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.80)" />
          </radialGradient>
          <linearGradient id="grd-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#110e07" /><stop offset="100%" stopColor="#070503" />
          </linearGradient>
          <linearGradient id="grd-ceil" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#100d07" /><stop offset="100%" stopColor="#06040200" />
          </linearGradient>
          <linearGradient id="grd-desk-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#221a09" /><stop offset="100%" stopColor="#160f05" />
          </linearGradient>
          <linearGradient id="grd-desk-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#120e05" /><stop offset="100%" stopColor="#07050200" />
          </linearGradient>
          <linearGradient id="grd-night-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#030509" />
            <stop offset="55%" stopColor="#060a18" />
            <stop offset="100%" stopColor="#0c1428" />
          </linearGradient>
          <filter id="flt-blur2"><feGaussianBlur stdDeviation="2" /></filter>
          <filter id="flt-blur5"><feGaussianBlur stdDeviation="5" /></filter>
          <filter id="flt-blur12"><feGaussianBlur stdDeviation="12" /></filter>
          <filter id="flt-glow">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── 0. Base darkness ── */}
        <rect width="1440" height="900" fill="#07050300" />

        {/* ── 1. Fireplace ambient glow (bottom-left) ── */}
        <rect width="1440" height="900" fill="url(#grd-fire)"
          style={{ animation: 'rr-fire 4.8s ease-in-out infinite' }} />
        <rect width="1440" height="900" fill="url(#grd-fire2)"
          style={{ animation: 'rr-fire2 3.1s ease-in-out infinite 0.7s' }} />

        {/* ── 2. CEILING ── */}
        <g style={{ transform: p(-2, -4) }}>
          <polygon points="0,0 1440,0 1200,105 240,105" fill="url(#grd-ceil)" />
          {/* Coffered ceiling molding lines */}
          {[0.25, 0.5, 0.75].map((t, i) => (
            <line key={i}
              x1={240 + (1200 - 240) * t} y1={105}
              x2={720} y2={0}
              stroke="rgba(212,168,71,0.05)" strokeWidth="0.5" />
          ))}
          {/* Ceiling pendant lamp cord + fixture */}
          <line x1="720" y1="0" x2="720" y2="56" stroke="rgba(80,60,20,0.8)" strokeWidth="2" />
          <ellipse cx="720" cy="60" rx="34" ry="13" fill="#1a1308" stroke="rgba(212,168,71,0.35)" strokeWidth="1.2" />
          <path d="M686,60 Q720,108 754,60" fill="rgba(210,148,44,0.10)"
            style={{ animation: 'rr-lamp 3.8s ease-in-out infinite' }} />
          <ellipse cx="720" cy="62" rx="220" ry="160" fill="url(#grd-lamp)"
            style={{ animation: 'rr-lamp 3.8s ease-in-out infinite' }} />
        </g>

        {/* ── 3. BACK WALL ── */}
        <g style={{ transform: p(-1, -1) }}>
          <rect x={BW.x1} y={BW.y1} width={BW.x2 - BW.x1} height={BW.y2 - BW.y1} fill="#0c0908" />
          {/* Walnut vertical panels */}
          {Array.from({ length: 18 }, (_, i) => {
            const x = BW.x1 + 12 + i * 54
            return <line key={i} x1={x} y1={BW.y1} x2={x} y2={BW.y2}
              stroke="rgba(212,168,71,0.035)" strokeWidth="0.5" />
          })}
          {/* Crown / baseboard molding */}
          <rect x={BW.x1} y={BW.y1} width={BW.x2 - BW.x1} height={8} fill="#17120700" />
          <line x1={BW.x1} y1={BW.y1 + 8} x2={BW.x2} y2={BW.y1 + 8} stroke="rgba(212,168,71,0.07)" strokeWidth="0.7" />
          <rect x={BW.x1} y={BW.y2 - 8} width={BW.x2 - BW.x1} height={8} fill="#100d0600" />
          <line x1={BW.x1} y1={BW.y2 - 8} x2={BW.x2} y2={BW.y2 - 8} stroke="rgba(212,168,71,0.07)" strokeWidth="0.7" />
        </g>

        {/* ── 4. MASSIVE WINDOW ── */}
        <g style={{ transform: p(0, 0) }}>
          {/* Window outer walnut frame */}
          <rect x={WIN.x1 - 16} y={WIN.y1 - 8} width={WIN.x2 - WIN.x1 + 32} height={WIN.y2 - WIN.y1 + 16}
            fill="#1a1208" stroke="rgba(212,168,71,0.18)" strokeWidth="1.5" rx="1" />

          {/* Night sky */}
          <rect x={WIN.x1} y={WIN.y1} width={WIN.x2 - WIN.x1} height={WIN.y2 - WIN.y1}
            fill="url(#grd-night-sky)" clipPath="url(#cl-win)" />

          {/* City skyline + lights */}
          <g clipPath="url(#cl-win)">
            <CityBuildings />
            {/* Distant city horizon glow */}
            <rect x={WIN.x1} y={490} width={WIN.x2 - WIN.x1} height={80}
              fill="rgba(25,48,110,0.14)" filter="url(#flt-blur12)" />
            {/* Lightning flash */}
            {lightning && (
              <rect x={WIN.x1} y={WIN.y1} width={WIN.x2 - WIN.x1} height={WIN.y2 - WIN.y1}
                fill="rgba(210,225,255,0.07)" style={{ animation: 'rr-lightning 0.3s ease-out forwards' }} />
            )}
          </g>

          {/* Window cross frame bars */}
          <rect x={716} y={WIN.y1 - 8} width={12} height={WIN.y2 - WIN.y1 + 16}
            fill="#1e1508" stroke="rgba(212,168,71,0.10)" strokeWidth="0.5" />
          <rect x={WIN.x1 - 16} y={390} width={WIN.x2 - WIN.x1 + 32} height={12}
            fill="#1e1508" stroke="rgba(212,168,71,0.10)" strokeWidth="0.5" />

          {/* Glass reflections */}
          <rect x={WIN.x1} y={WIN.y1} width={WIN.x2 - WIN.x1} height={WIN.y2 - WIN.y1}
            fill="none" stroke="rgba(255,255,255,0.012)" strokeWidth="1" />
          <line x1={WIN.x1 + 20} y1={WIN.y1 + 15} x2={WIN.x1 + 180} y2={WIN.y2 - 30}
            stroke="rgba(255,255,255,0.022)" strokeWidth="12" filter="url(#flt-blur5)" />

          {/* Window glow into room */}
          <rect width="1440" height="900" fill="url(#grd-win-glow)" />
        </g>

        {/* ── 5. LEFT WALL — built-in bookshelf ── */}
        <g style={{ transform: p(-10, -5) }}>
          <polygon points="0,0 240,105 240,680 0,900" fill="#0d0a06" />
          <g clipPath="url(#cl-left)">
            <LeftWallBookshelf />
          </g>
        </g>

        {/* ── 6. RIGHT WALL — cabinet & certificates ── */}
        <g style={{ transform: p(10, -5) }}>
          <polygon points="1200,105 1440,0 1440,900 1200,680" fill="#0b0804" />
          <g clipPath="url(#cl-right)">
            <RightWallDetails />
          </g>
        </g>

        {/* ── 7. FLOOR — dark parquet ── */}
        <g style={{ transform: p(-1, 3) }}>
          <polygon points="240,680 1200,680 1440,900 0,900" fill="url(#grd-floor)" />
          <g clipPath="url(#cl-floor)">
            <FloorParquet />
          </g>
          {/* Window light patch on floor */}
          <ellipse cx="720" cy="730" rx="340" ry="55" fill="rgba(30,52,120,0.09)"
            filter="url(#flt-blur12)" />
        </g>

        {/* ── 8. FIREPLACE — lower-left corner ── */}
        <g style={{ transform: p(-8, 4) }}>
          <Fireplace />
        </g>

        {/* ── 9. DESK SHADOW ── */}
        <ellipse cx="720" cy="836" rx="400" ry="26"
          fill="rgba(0,0,0,0.50)" filter="url(#flt-blur12)" />

        {/* ── 10. EXECUTIVE DESK ── */}
        <g style={{ transform: p(0, 1) }}>
          {/* Left desk side */}
          <polygon points="360,800 520,692 520,736 360,862" fill="#0e0b05" />
          {/* Right desk side */}
          <polygon points="1080,800 920,692 920,736 1080,862" fill="#130f06" />
          {/* Desk front face */}
          <polygon points="360,800 1080,800 1080,862 360,862" fill="url(#grd-desk-front)" />
          {/* Horizontal groove on front face */}
          <line x1="366" y1="831" x2="1074" y2="831"
            stroke="rgba(212,168,71,0.055)" strokeWidth="0.8" />
          {/* Desk front brass trim strip */}
          <line x1="362" y1="800" x2="1078" y2="800"
            stroke="rgba(212,168,71,0.20)" strokeWidth="1.2" />
          {/* Desk top surface */}
          <polygon points="520,692 920,692 1080,800 360,800" fill="url(#grd-desk-top)" />
          {/* Wood grain lines on top */}
          {Array.from({ length: 14 }, (_, i) => {
            const f = i / 14
            return (
              <line key={i}
                x1={520 + (920 - 520) * f} y1={692}
                x2={360 + (1080 - 360) * f} y2={800}
                stroke="rgba(212,168,71,0.022)" strokeWidth="0.6" />
            )
          })}
          {/* Desk top edge + side highlights */}
          <polygon points="520,692 920,692 1080,800 360,800" fill="none"
            stroke="rgba(212,168,71,0.10)" strokeWidth="0.8" />
          {/* Near edge gold highlight */}
          <line x1="362" y1="800" x2="1078" y2="800"
            stroke="rgba(212,168,71,0.22)" strokeWidth="0.6" />
          {/* Desk legs */}
          <rect x="388" y="855" width="24" height="42" fill="#09070300" />
          <rect x="1028" y="855" width="24" height="42" fill="#09070300" />

          {/* Desk objects */}
          <DeskObjects hov={hov} setHov={setHov} />

          {/* Brass nameplate on desk surface */}
          {name && (
            <g transform="translate(698, 760)">
              <rect x="-52" y="-11" width="104" height="22" rx="2"
                fill="#1c1508" stroke="rgba(212,168,71,0.25)" strokeWidth="0.7" />
              <text textAnchor="middle" y="4" fontSize="9" letterSpacing="2"
                fill="rgba(212,168,71,0.55)" fontFamily="Georgia,serif"
                textDecoration="none">
                {name.toUpperCase()}
              </text>
            </g>
          )}
        </g>

        {/* ── 11. ROOM ATMOSPHERE ── */}
        {/* Fireplace extra ambient */}
        <rect width="1440" height="900" fill="url(#grd-fire)"
          opacity="0.55" style={{ animation: 'rr-fire2 2.8s ease-in-out infinite 1.1s' }} />

        {/* Vignette — the room falls into darkness at edges */}
        <rect width="1440" height="900" fill="url(#grd-vignette)" />
      </svg>

      {/* ═══ GAME HUD ════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none',
        fontFamily: 'Georgia,"Times New Roman",serif',
      }}>
        {/* Game location name — top center, like "Assassin's Creed" area label */}
        <div style={{
          position: 'absolute', top: '18px', left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(212,168,71,0.22)', fontSize: '10px',
          letterSpacing: '0.28em', textTransform: 'uppercase',
        }}>
          ◆ &nbsp; Research Room &nbsp; ◆
        </div>

        {/* Back link — subtle, top-right */}
        <Link to="/" style={{
          position: 'absolute', top: '18px', right: '24px',
          color: 'rgba(212,168,71,0.30)', fontSize: '11px',
          letterSpacing: '0.1em', textDecoration: 'none',
          pointerEvents: 'all', transition: 'color .3s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(212,168,71,0.8)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(212,168,71,0.30)')}
        >
          ← ציון בוקרא
        </Link>

        {/* User greeting — subtle, top-left */}
        {name && (
          <div style={{
            position: 'absolute', top: '18px', left: '24px',
            color: 'rgba(232,216,184,0.25)', fontSize: '11px',
          }}>
            {`ברוך שובך, ${name}.`}
          </div>
        )}

        {/* Hovered object label — floats above desk */}
        {hov && (
          <div style={{
            position: 'absolute',
            bottom: '155px', left: '50%', transform: 'translateX(-50%)',
            textAlign: 'center', pointerEvents: 'none',
            animation: 'rr-qi 0.35s ease-out forwards',
          }}>
            <div style={{
              display: 'inline-block',
              padding: '6px 18px',
              background: 'rgba(8,6,3,0.85)',
              border: '1px solid rgba(212,168,71,0.25)',
              borderRadius: '6px',
              color: 'rgba(240,224,184,0.9)',
              fontSize: '12px',
              letterSpacing: '0.04em',
            }}>
              {OBJ_LABELS[hov]}
            </div>
          </div>
        )}

        {/* Quote — bottom center */}
        <div style={{
          position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          textAlign: 'center', maxWidth: '580px', width: '90%',
          animation: `${qPhase === 'in' ? 'rr-qi' : 'rr-qo'} 0.9s ease-out forwards`,
        }}>
          <p style={{ margin: 0, fontSize: '11px', fontStyle: 'italic',
            color: 'rgba(255,255,255,0.17)', lineHeight: 1.7 }}>
            "{q.t}"
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '10px',
            color: 'rgba(212,168,71,0.24)', letterSpacing: '0.08em' }}>
            — {q.a}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Object label map ─────────────────────────────────────────────────────────
const OBJ_LABELS: Record<string, string> = {
  compass:  'מעבדת אסטרטגיות',
  folder:   'צור מדד חדש',
  notebook: 'חיפוש מתקדם',
  book:     'הספרייה',
}

// ─── Desk Objects ─────────────────────────────────────────────────────────────
// The 4 physical objects on the desk surface.
// Each reacts differently on hover.

type ObjProps = { hov: string | null; setHov: (v: string | null) => void }

function DeskObjects({ hov, setHov }: ObjProps) {
  return (
    <g>
      {/* BRASS COMPASS — left side of desk */}
      <g
        style={{
          transform: hov === 'compass' ? 'translate(565px,730px) scale(1.12)' : 'translate(565px,730px) scale(1)',
          transformOrigin: '0 0',
          transition: 'transform 0.45s cubic-bezier(0.23,1,0.32,1)',
          cursor: 'pointer',
        }}
        onMouseEnter={() => setHov('compass')}
        onMouseLeave={() => setHov(null)}
      >
        <CompassIcon hovered={hov === 'compass'} />
        {/* Drop shadow */}
        <ellipse cx="0" cy="30" rx="28" ry="7" fill="rgba(0,0,0,0.35)" filter="url(#flt-blur2)" />
      </g>

      {/* LEATHER FOLDER — center-left */}
      <g
        style={{
          transform: hov === 'folder'
            ? 'translate(678px,745px) scale(1.08) translateY(-4px)'
            : 'translate(678px,745px) scale(1)',
          transformOrigin: '0 0',
          transition: 'transform 0.45s cubic-bezier(0.23,1,0.32,1)',
          cursor: 'pointer',
        }}
        onMouseEnter={() => setHov('folder')}
        onMouseLeave={() => setHov(null)}
      >
        <FolderIcon hovered={hov === 'folder'} />
        <ellipse cx="0" cy="28" rx="32" ry="6" fill="rgba(0,0,0,0.32)" filter="url(#flt-blur2)" />
      </g>

      {/* LEATHER NOTEBOOK — center-right */}
      <g
        style={{
          transform: hov === 'notebook'
            ? 'translate(800px,742px) scale(1.09) translateY(-3px)'
            : 'translate(800px,742px) scale(1)',
          transformOrigin: '0 0',
          transition: 'transform 0.45s cubic-bezier(0.23,1,0.32,1)',
          cursor: 'pointer',
        }}
        onMouseEnter={() => setHov('notebook')}
        onMouseLeave={() => setHov(null)}
      >
        <NotebookIcon hovered={hov === 'notebook'} />
        <ellipse cx="0" cy="30" rx="26" ry="6" fill="rgba(0,0,0,0.30)" filter="url(#flt-blur2)" />
      </g>

      {/* LOCKED ANCIENT BOOK — right side */}
      <g
        style={{
          transform: hov === 'book'
            ? 'translate(920px,732px) scale(1.07)'
            : 'translate(920px,732px) scale(1)',
          transformOrigin: '0 0',
          transition: 'transform 0.45s cubic-bezier(0.23,1,0.32,1)',
          cursor: 'pointer', opacity: 0.62,
        }}
        onMouseEnter={() => setHov('book')}
        onMouseLeave={() => setHov(null)}
      >
        <LockedBookIcon hovered={hov === 'book'} />
        <ellipse cx="0" cy="30" rx="22" ry="5" fill="rgba(0,0,0,0.28)" filter="url(#flt-blur2)" />
      </g>
    </g>
  )
}

// ─── Left Wall — Bookshelf ────────────────────────────────────────────────────
const LW_SHELVES_Y = [840, 700, 560, 420, 290, 170, 68] // y at left edge (x=0)

const BOOK_COLORS = [
  '#5c2d0c', '#3e1e08', '#6b3a14', '#2c1406', '#7a4218', '#4a2210',
  '#5e3010', '#3a1c08', '#6a3618', '#482510', '#301e0e', '#5a2c0e',
  '#8a4e20', '#3c2010', '#622e10', '#4e2814', '#2a1808', '#742e0a',
]

function LeftWallBookshelf() {
  const shelves = LW_SHELVES_Y.map(y => ({ yL: y, yR: lwY(y) }))

  return (
    <>
      {/* Dark walnut wall base */}
      <rect width="240" height="900" fill="#0d0904" />
      {/* Vertical panel lines */}
      {[60, 120, 180].map(x => (
        <line key={x} x1={x} y1={0} x2={x} y2={900}
          stroke="rgba(212,168,71,0.03)" strokeWidth="0.5" />
      ))}

      {/* Books between each pair of shelves */}
      {shelves.slice(0, -1).map((bot, si) => {
        const top = shelves[si + 1]
        const numBooks = 8 + (si % 3)
        return Array.from({ length: numBooks }, (_, bi) => {
          const f1 = bi / numBooks
          const f2 = (bi + 1) / numBooks
          const x1 = 240 * f1, x2 = 240 * f2
          const yBotL = bot.yL + (top.yL - bot.yL) * 0.04
          const yBotR = bot.yR + (top.yR - bot.yR) * 0.04
          const yTopL = bot.yL + (top.yL - bot.yL) * 0.96
          const yTopR = bot.yR + (top.yR - bot.yR) * 0.96
          const y1L = yBotL + (yBotR - yBotL) * f1
          const y1R = yBotL + (yBotR - yBotL) * f2
          const y2L = yTopL + (yTopR - yTopL) * f1
          const y2R = yTopL + (yTopR - yTopL) * f2
          const c = BOOK_COLORS[(si * numBooks + bi) % BOOK_COLORS.length]
          const bright = (si * numBooks + bi) % 7 === 0
          return (
            <polygon key={bi}
              points={`${x1},${y1L} ${x2},${y1R} ${x2},${y2R} ${x1},${y2L}`}
              fill={bright ? '#8a5820' : c}
              stroke="rgba(0,0,0,0.3)" strokeWidth="0.4"
            />
          )
        })
      })}

      {/* Shelf planks */}
      {shelves.map((s, i) => (
        <g key={i}>
          <line x1={0} y1={s.yL} x2={240} y2={s.yR}
            stroke="#1c1208" strokeWidth="8" />
          <line x1={0} y1={s.yL - 2} x2={240} y2={s.yR - 2}
            stroke="rgba(212,168,71,0.10)" strokeWidth="1" />
        </g>
      ))}

      {/* Globe — lower portion of wall */}
      <g transform="translate(60, 800)">
        <circle r="22" fill="#1a2840" stroke="rgba(212,168,71,0.3)" strokeWidth="1" />
        {/* Latitude lines */}
        {[-12, 0, 12].map((dy, i) => (
          <ellipse key={i} cx="0" cy={dy} rx="22" ry="5"
            fill="none" stroke="rgba(212,168,71,0.15)" strokeWidth="0.5" />
        ))}
        {/* Meridian */}
        <ellipse cx="0" cy="0" rx="10" ry="22"
          fill="none" stroke="rgba(212,168,71,0.12)" strokeWidth="0.5" />
        {/* Stand */}
        <line x1="0" y1="22" x2="0" y2="34" stroke="rgba(212,168,71,0.4)" strokeWidth="2" />
        <ellipse cx="0" cy="35" rx="10" ry="3" fill="rgba(212,168,71,0.2)" />
        {/* Globe highlight */}
        <circle cx="-7" cy="-8" r="5" fill="rgba(255,255,255,0.06)" />
      </g>

      {/* Whiskey bottle + glass — upper shelf */}
      <g transform="translate(185, 430)">
        {/* Bottle */}
        <rect x="-6" y="-38" width="12" height="48" rx="3" fill="#2a4820" stroke="rgba(212,168,71,0.2)" strokeWidth="0.5" />
        <rect x="-3" y="-45" width="6" height="10" rx="1" fill="#243a1c" />
        {/* Amber liquid */}
        <rect x="-5" y="-10" width="10" height="18" rx="2" fill="rgba(160,80,10,0.35)" />
        {/* Label */}
        <rect x="-4" y="-22" width="8" height="14" rx="1" fill="rgba(240,220,170,0.12)" />
        {/* Glass */}
        <path d="M6,-8 L9,8 L3,8 Z" fill="rgba(200,160,80,0.15)" stroke="rgba(212,168,71,0.25)" strokeWidth="0.5" />
      </g>

      {/* Left wall edge shadow (merges with back wall) */}
      <rect x="200" width="40" height="900" fill="url(#grd-lw-shadow)" />
      <defs>
        <linearGradient id="grd-lw-shadow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
        </linearGradient>
      </defs>
    </>
  )
}

// ─── Right Wall ───────────────────────────────────────────────────────────────
function RightWallDetails() {
  return (
    <>
      {/* Dark walnut panels */}
      <polygon points="1200,105 1440,0 1440,900 1200,680" fill="#0a0703" />
      {/* Vertical panel lines */}
      {[1230, 1290, 1350, 1410].map(x => (
        <line key={x} x1={x} y1={0} x2={x} y2={900}
          stroke="rgba(212,168,71,0.035)" strokeWidth="0.5" />
      ))}

      {/* Built-in cabinet face */}
      <polygon points="1202,106 1440,2 1440,600 1202,540"
        fill="#0e0b06" stroke="rgba(212,168,71,0.06)" strokeWidth="0.5" />

      {/* Cabinet doors */}
      {[140, 280, 420].map((y, i) => (
        <g key={i}>
          <polygon
            points={`${1210 + i * 4},${y + 2} 1438,${y - i * 2} 1438,${y + 115 - i * 2} ${1210 + i * 4},${y + 118}`}
            fill="#100e07" stroke="rgba(212,168,71,0.10)" strokeWidth="0.6" rx="1" />
          {/* Door knob */}
          <circle cx={1310 + i * 20} cy={y + 58} r="4"
            fill="rgba(212,168,71,0.35)" stroke="rgba(212,168,71,0.5)" strokeWidth="0.5" />
        </g>
      ))}

      {/* Framed certificate 1 */}
      <g transform="translate(1240, 130)">
        <rect width="80" height="60" rx="2" fill="#1a1208" stroke="rgba(212,168,71,0.22)" strokeWidth="1" />
        <rect x="6" y="6" width="68" height="48" rx="1" fill="rgba(240,230,200,0.07)" />
        <line x1="12" y1="20" x2="68" y2="20" stroke="rgba(212,168,71,0.15)" strokeWidth="0.5" />
        <line x1="12" y1="28" x2="68" y2="28" stroke="rgba(212,168,71,0.10)" strokeWidth="0.5" />
        <line x1="12" y1="36" x2="55" y2="36" stroke="rgba(212,168,71,0.08)" strokeWidth="0.5" />
        <circle cx="40" cy="46" r="6" fill="none" stroke="rgba(212,168,71,0.18)" strokeWidth="0.5" />
      </g>

      {/* Old map */}
      <g transform="translate(1220, 480)">
        <rect width="120" height="90" rx="1" fill="#1e1808" stroke="rgba(212,168,71,0.15)" strokeWidth="0.8" />
        <rect x="4" y="4" width="112" height="82" fill="rgba(180,150,80,0.06)" />
        {/* Map lines suggesting continents */}
        <path d="M15,30 Q40,20 55,35 Q65,45 80,38 Q95,30 105,42"
          fill="none" stroke="rgba(180,140,60,0.20)" strokeWidth="0.7" />
        <path d="M20,55 Q35,48 50,60 Q60,68 75,58"
          fill="none" stroke="rgba(180,140,60,0.15)" strokeWidth="0.7" />
        {/* Compass rose on map */}
        <circle cx="96" cy="22" r="10" fill="none" stroke="rgba(212,168,71,0.18)" strokeWidth="0.5" />
        <line x1="96" y1="13" x2="96" y2="31" stroke="rgba(212,168,71,0.22)" strokeWidth="0.5" />
        <line x1="87" y1="22" x2="105" y2="22" stroke="rgba(212,168,71,0.18)" strokeWidth="0.5" />
      </g>

      {/* Floor lamp / side table area (bottom of right wall) */}
      <g transform="translate(1250, 700)">
        {/* Table */}
        <rect x="-20" y="30" width="55" height="5" rx="1" fill="#1a1208" stroke="rgba(212,168,71,0.15)" strokeWidth="0.5" />
        <rect x="5" y="35" width="6" height="30" fill="#130f05" />
        {/* Lamp */}
        <line x1="8" y1="-30" x2="8" y2="30" stroke="rgba(212,168,71,0.35)" strokeWidth="1.8" />
        <path d="M-10,-30 L26,-30 L18,-8 L0,-8 Z" fill="#1e1608" stroke="rgba(212,168,71,0.2)" strokeWidth="0.5" />
        {/* Lamp glow */}
        <path d="M-10,-30 L26,-30 L18,-8 L0,-8 Z"
          fill="rgba(200,148,40,0.08)"
          style={{ animation: 'rr-lamp 4.2s ease-in-out infinite' }} />
        <ellipse cx="8" cy="30" rx="40" ry="20" fill="rgba(190,140,40,0.06)"
          style={{ animation: 'rr-lamp 4.2s ease-in-out infinite' }} />
        {/* Newspaper on table */}
        <rect x="-18" y="28" width="48" height="3" rx="0.5"
          fill="rgba(220,210,185,0.06)" stroke="rgba(212,168,71,0.08)" strokeWidth="0.4" />
      </g>

      {/* Right wall edge shadow */}
      <rect x="1200" width="40" height="900" fill="url(#grd-rw-shadow)" />
      <defs>
        <linearGradient id="grd-rw-shadow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
    </>
  )
}

// ─── Floor parquet ────────────────────────────────────────────────────────────
function FloorParquet() {
  // Perspective-correct horizontal lines on the floor
  // Lines converge from screen bottom edges toward VP
  const lines = [0.12, 0.25, 0.40, 0.58, 0.76, 0.90].map(t => {
    const yL = 680 + (900 - 680) * t
    const yR = 680 + (900 - 680) * t
    return (
      <line key={t}
        x1={0} y1={yL * 1.0}
        x2={1440} y2={yR * 1.0}
        stroke="rgba(212,168,71,0.032)" strokeWidth="0.7" />
    )
  })
  // Vertical planks (narrower at back, wider at front)
  const planks = Array.from({ length: 20 }, (_, i) => {
    const f = i / 20
    const xBack = 240 + (1200 - 240) * f
    const xFront = 0 + 1440 * f
    return (
      <line key={i} x1={xBack} y1={680} x2={xFront} y2={900}
        stroke="rgba(212,168,71,0.018)" strokeWidth="0.5" />
    )
  })
  return <>{lines}{planks}</>
}

// ─── City buildings ───────────────────────────────────────────────────────────
function CityBuildings() {
  const W = WIN
  const bx = W.x1, by = W.y2  // base x, base y of window bottom

  // [relX, relW, relH] where rel is 0-1 of window width
  const BLDGS = [
    [0.00, 0.038, 0.38],[0.03, 0.022, 0.57],[0.05, 0.040, 0.28],[0.08, 0.018, 0.68],
    [0.09, 0.048, 0.44],[0.14, 0.016, 0.72],[0.15, 0.042, 0.52],[0.19, 0.024, 0.85],
    [0.21, 0.052, 0.38],[0.26, 0.020, 0.58],[0.28, 0.045, 0.32],[0.32, 0.016, 0.62],
    [0.33, 0.055, 0.48],[0.38, 0.022, 0.90],[0.40, 0.048, 0.34],[0.44, 0.020, 0.70],
    [0.46, 0.042, 0.55],[0.50, 0.018, 0.42],[0.52, 0.065, 0.65],[0.58, 0.016, 0.50],
    [0.59, 0.045, 0.38],[0.63, 0.022, 0.75],[0.65, 0.048, 0.44],[0.70, 0.018, 0.62],
    [0.71, 0.042, 0.32],[0.75, 0.016, 0.80],[0.76, 0.055, 0.48],[0.81, 0.022, 0.72],
    [0.83, 0.045, 0.35],[0.87, 0.018, 0.58],[0.89, 0.040, 0.42],[0.93, 0.022, 0.70],
    [0.95, 0.050, 0.38],[0.99, 0.010, 0.55],
  ]

  const winW = W.x2 - W.x1
  const winH = W.y2 - W.y1

  // Lit windows on buildings
  const WIN_LIGHTS: [number, number, number, number][] = []
  BLDGS.forEach(([rx, rw, rh], bi) => {
    const bldgX = bx + rx * winW
    const bldgW = rw * winW
    const bldgTop = by - rh * winH
    const rows = Math.floor(rh * winH / 14)
    const cols = Math.floor(bldgW / 8)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((bi * rows * cols + r * cols + c) % 4 !== 0) continue
        if (Math.random() > 0.55) continue
        WIN_LIGHTS.push([
          bldgX + c * 8 + 2,
          bldgTop + r * 14 + 4,
          3.5, 2.5,
        ])
      }
    }
  })

  return (
    <>
      {/* Stars */}
      {Array.from({ length: 35 }, (_, i) => (
        <circle key={i}
          cx={W.x1 + (i * 137 % (W.x2 - W.x1))}
          cy={W.y1 + ((i * 83) % 200)}
          r={0.5 + (i % 3) * 0.4}
          fill={`rgba(255,255,255,${0.3 + (i % 5) * 0.1})`} />
      ))}

      {/* Buildings */}
      {BLDGS.map(([rx, rw, rh], i) => {
        const x = bx + rx * winW
        const w = rw * winW
        const h = rh * winH
        const shade = 8 + (i % 5) * 3
        return (
          <rect key={i} x={x} y={by - h} width={w} height={h}
            fill={`rgba(${shade},${shade + 2},${shade + 10},1)`} />
        )
      })}

      {/* Lit windows */}
      {WIN_LIGHTS.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h}
          fill={`rgba(255,${215 + (i % 6) * 5},${90 + (i % 8) * 10},${0.25 + (i % 5) * 0.07})`} />
      ))}
    </>
  )
}

// ─── Fireplace ────────────────────────────────────────────────────────────────
function Fireplace() {
  return (
    <g transform="translate(38, 748)">
      {/* Stone arch */}
      <path d="M0,120 L0,50 Q0,0 50,0 Q100,0 100,50 L100,120 Z"
        fill="#1a1510" stroke="rgba(212,168,71,0.18)" strokeWidth="1" />
      {/* Stone texture */}
      {[15, 40, 65, 90].map(y => (
        <line key={y} x1={0} y1={y} x2={100} y2={y}
          stroke="rgba(212,168,71,0.06)" strokeWidth="0.5" />
      ))}
      {/* Inner firebox */}
      <path d="M10,120 L10,55 Q10,12 50,12 Q90,12 90,55 L90,120 Z"
        fill="#080503" />
      {/* Fire glow on back of firebox */}
      <path d="M10,120 L10,55 Q10,12 50,12 Q90,12 90,55 L90,120 Z"
        fill="rgba(200,80,10,0.15)"
        style={{ animation: 'rr-fire 3.5s ease-in-out infinite' }} />
      {/* Fire flames */}
      <ellipse cx="35" cy="105" rx="12" ry="22"
        fill="rgba(220,100,15,0.7)"
        style={{ animation: 'rr-fire 2.8s ease-in-out infinite 0.2s' }} />
      <ellipse cx="50" cy="100" rx="16" ry="28"
        fill="rgba(240,130,20,0.65)"
        style={{ animation: 'rr-fire2 2.2s ease-in-out infinite' }} />
      <ellipse cx="65" cy="106" rx="11" ry="20"
        fill="rgba(215,90,10,0.65)"
        style={{ animation: 'rr-fire 3.1s ease-in-out infinite 0.5s' }} />
      {/* Yellow core */}
      <ellipse cx="50" cy="110" rx="8" ry="14"
        fill="rgba(255,190,40,0.55)"
        style={{ animation: 'rr-fire2 1.8s ease-in-out infinite 0.3s' }} />
      {/* Ember glow on floor in front */}
      <ellipse cx="50" cy="122" rx="35" ry="8"
        fill="rgba(200,70,5,0.25)" filter="url(#flt-blur5)"
        style={{ animation: 'rr-fire 3.8s ease-in-out infinite' }} />
      {/* Mantel */}
      <rect x="-12" y="-8" width="124" height="10" rx="1"
        fill="#1e1508" stroke="rgba(212,168,71,0.2)" strokeWidth="0.8" />
    </g>
  )
}

// ─── Desk Object Icons ────────────────────────────────────────────────────────

function CompassIcon({ hovered }: { hovered: boolean }) {
  return (
    <g>
      {/* Outer brass ring */}
      <circle r="28" fill="url(#grd-comp-body)" stroke="rgba(212,168,71,0.55)" strokeWidth="1.8" />
      <circle r="24" fill="#0f0c07" stroke="rgba(212,168,71,0.20)" strokeWidth="0.5" />
      {/* Cardinal tick marks */}
      <line x1="0" y1="-24" x2="0" y2="-20" stroke="rgba(212,168,71,0.7)" strokeWidth="1.5" />
      <line x1="0" y1="20" x2="0" y2="24" stroke="rgba(212,168,71,0.3)" strokeWidth="0.8" />
      <line x1="-24" y1="0" x2="-20" y2="0" stroke="rgba(212,168,71,0.3)" strokeWidth="0.8" />
      <line x1="20" y1="0" x2="24" y2="0" stroke="rgba(212,168,71,0.3)" strokeWidth="0.8" />
      <text textAnchor="middle" y="-15" fontSize="5" fill="rgba(212,168,71,0.65)" fontFamily="Georgia,serif">N</text>
      {/* Needle */}
      <g style={{
        transformOrigin: '0px 5px',
        transition: 'transform 2s cubic-bezier(0.25,0.46,0.45,0.94)',
        transform: hovered ? 'rotate(180deg)' : 'rotate(-8deg)',
      }}>
        <polygon points="0,-18 3,5 0,2 -3,5" fill="url(#grd-needle-gold)" />
        <polygon points="0,18 3,5 0,8 -3,5" fill="rgba(60,40,15,0.7)" />
      </g>
      {/* Center jewel */}
      <circle r="2.5" fill="rgba(212,168,71,0.9)" stroke="rgba(255,220,120,0.5)" strokeWidth="0.5" />
      <defs>
        <radialGradient id="grd-comp-body">
          <stop offset="0%" stopColor="#2a1e08" /><stop offset="100%" stopColor="#1a1205" />
        </radialGradient>
        <linearGradient id="grd-needle-gold" x1="0" y1="-18" x2="0" y2="5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f8e870" /><stop offset="100%" stopColor="#c89018" />
        </linearGradient>
      </defs>
    </g>
  )
}

function FolderIcon({ hovered }: { hovered: boolean }) {
  return (
    <g style={{
      transform: hovered ? 'translateX(3px)' : 'translateX(0)',
      transition: 'transform 0.4s ease',
    }}>
      <path d="M-32,-18 L-32,22 Q-32,26 -28,26 L28,26 Q32,26 32,22 L32,-12 Q32,-16 28,-16 L-2,-16 L-8,-22 Q-10,-24 -14,-24 L-28,-24 Q-32,-24 -32,-18 Z"
        fill="url(#grd-folder)" stroke="rgba(212,168,71,0.28)" strokeWidth="0.6" />
      {/* Leather texture lines */}
      <line x1="-28" y1="0" x2="28" y2="0" stroke="rgba(212,168,71,0.08)" strokeWidth="0.5" />
      <line x1="-28" y1="10" x2="28" y2="10" stroke="rgba(212,168,71,0.06)" strokeWidth="0.5" />
      {/* Brass clasp */}
      <rect x="-5" y="10" width="10" height="7" rx="1.5"
        fill="rgba(212,168,71,0.45)" stroke="rgba(212,168,71,0.65)" strokeWidth="0.5" />
      <defs>
        <linearGradient id="grd-folder" x1="0" y1="-24" x2="0" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5e3d1c" /><stop offset="100%" stopColor="#3a2010" />
        </linearGradient>
      </defs>
    </g>
  )
}

function NotebookIcon({ hovered }: { hovered: boolean }) {
  return (
    <g>
      {/* Back cover */}
      <rect x="-20" y="-28" width="40" height="56" rx="2"
        fill="#3a2210" stroke="rgba(212,168,71,0.15)" strokeWidth="0.5" />
      {/* Front cover — slightly open on hover */}
      <g style={{
        transformOrigin: '-20px 0px',
        transform: hovered ? 'rotateY(-18deg)' : 'rotateY(0deg)',
        transition: 'transform 0.5s ease',
      }}>
        <rect x="-20" y="-28" width="40" height="56" rx="2"
          fill="url(#grd-notebook)" stroke="rgba(212,168,71,0.25)" strokeWidth="0.7" />
        {/* Spine */}
        <rect x="-20" y="-28" width="5" height="56" rx="1"
          fill="rgba(30,18,6,0.9)" stroke="rgba(212,168,71,0.15)" strokeWidth="0.4" />
        {/* Page lines */}
        <line x1="-11" y1="-10" x2="17" y2="-10" stroke="rgba(212,168,71,0.14)" strokeWidth="0.6" />
        <line x1="-11" y1="-2" x2="17" y2="-2" stroke="rgba(212,168,71,0.10)" strokeWidth="0.6" />
        <line x1="-11" y1="6" x2="17" y2="6" stroke="rgba(212,168,71,0.08)" strokeWidth="0.6" />
        <line x1="-11" y1="14" x2="12" y2="14" stroke="rgba(212,168,71,0.06)" strokeWidth="0.6" />
        {/* Ribbon bookmark */}
        <rect x="10" y="-28" width="2.5" height="16" rx="0.5" fill="rgba(212,168,71,0.45)" />
      </g>
      <defs>
        <linearGradient id="grd-notebook" x1="0" y1="-28" x2="0" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4e3214" /><stop offset="100%" stopColor="#2c1a08" />
        </linearGradient>
      </defs>
    </g>
  )
}

function LockedBookIcon({ hovered }: { hovered: boolean }) {
  return (
    <g>
      {/* Left cover */}
      <path d="M-22,27 L-22,-27 Q-20,-29 -18,-29 L-2,-29 Q0,-29 0,-27 L0,27 Q-2,29 -4,29 Z"
        fill="url(#grd-book-l)" stroke="rgba(212,168,71,0.10)" strokeWidth="0.5" />
      {/* Right cover */}
      <path d="M22,27 L22,-27 Q20,-29 18,-29 L2,-29 Q0,-29 0,-27 L0,27 Q2,29 4,29 Z"
        fill="url(#grd-book-r)" stroke="rgba(212,168,71,0.10)" strokeWidth="0.5" />
      {/* Spine */}
      <rect x="-2" y="-29" width="4" height="58" fill="#0c0704" stroke="rgba(212,168,71,0.22)" strokeWidth="0.5" />
      {/* Old text lines */}
      <line x1="-18" y1="-14" x2="-4" y2="-14" stroke="rgba(212,168,71,0.18)" strokeWidth="0.5" />
      <line x1="-18" y1="-8" x2="-4" y2="-8" stroke="rgba(212,168,71,0.12)" strokeWidth="0.5" />
      {/* Padlock */}
      <g style={{
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 0.4s ease',
      }}>
        <path d="M-6,-2 Q-6,-12 0,-12 Q6,-12 6,-2"
          fill="none" stroke="rgba(212,168,71,0.55)" strokeWidth="1.3" />
        <rect x="-8" y="-2" width="16" height="12" rx="2"
          fill="rgba(15,10,4,0.95)" stroke="rgba(212,168,71,0.50)" strokeWidth="0.9" />
        <circle cx="0" cy="4" r="2" fill="rgba(212,168,71,0.55)" />
      </g>
      <defs>
        <linearGradient id="grd-book-l" x1="-22" y1="0" x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3e2410" /><stop offset="100%" stopColor="#261508" />
        </linearGradient>
        <linearGradient id="grd-book-r" x1="22" y1="0" x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4e2e18" /><stop offset="100%" stopColor="#2e1a0a" />
        </linearGradient>
      </defs>
    </g>
  )
}
