// Research Room — luxury study matching the reference image:
// arched window, flanking bookshelves, game UI panels, amber lighting.

import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { User } from '@supabase/supabase-js'

// ─── CSS ─────────────────────────────────────────────────────────────────────
const ROOM_CSS = `
@keyframes rr-fire{0%,100%{opacity:1}7%{opacity:.72}19%{opacity:.91}33%{opacity:.68}50%{opacity:.85}67%{opacity:.73}83%{opacity:.90}}
@keyframes rr-fire2{0%,100%{opacity:.60}14%{opacity:.82}38%{opacity:.55}62%{opacity:.78}88%{opacity:.60}}
@keyframes rr-lamp{0%,100%{opacity:.82}50%{opacity:1}}
@keyframes rr-qi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes rr-qo{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-5px)}}
@keyframes rr-lightning{0%,100%{opacity:0}5%{opacity:.95}10%{opacity:.25}16%{opacity:.85}24%{opacity:0}}
@keyframes rr-xp{from{width:0}to{width:69%}}
@keyframes rr-shelf-glow{0%,100%{opacity:.55}50%{opacity:.85}}
`

// ─── Quotes ──────────────────────────────────────────────────────────────────
const QUOTES = [
  { t: 'The stock market is a device for transferring money from the impatient to the patient.', a: 'Warren Buffett' },
  { t: 'Price is what you pay. Value is what you get.', a: 'Warren Buffett' },
  { t: 'In the short run, the market is a voting machine. In the long run, it is a weighing machine.', a: 'Benjamin Graham' },
  { t: 'Risk comes from not knowing what you are doing.', a: 'Warren Buffett' },
  { t: 'An investment in knowledge pays the best interest.', a: 'Benjamin Franklin' },
  { t: 'The four most dangerous words in investing: this time it is different.', a: 'Sir John Templeton' },
]

// ─── Market data (static display) ───────────────────────────────────────────
const MARKET = [
  { label: 'S&P 500',   val: '+0.45%', pos: true  },
  { label: 'NASDAQ',    val: '+0.71%', pos: true  },
  { label: 'DOW JONES', val: '−0.23%', pos: false },
  { label: 'BITCOIN',   val: '+1.32%', pos: true  },
]

const STATS = [
  { icon: '≡', label: 'Indexes',    val: '7'   },
  { icon: '▦', label: 'Companies',  val: '156' },
  { icon: '✦', label: 'Insights',   val: '21'  },
  { icon: '★', label: 'Bookmarks',  val: '14'  },
  { icon: '✎', label: 'Researches', val: '9'   },
]

// ─── Room geometry ────────────────────────────────────────────────────────────
// ViewBox: 1440×900. Back wall: x1=240,y1=105 → x2=1200,y2=680
// Arch: centred at x=720, springs from y=390, radius=270 → peak y≈120
const ARCH_X1 = 455, ARCH_X2 = 985, ARCH_SPR = 388, ARCH_R = 268

// ─── Helpers ─────────────────────────────────────────────────────────────────
function firstName(u: User | null): string {
  if (!u) return ''
  const m = (u.user_metadata ?? {}) as Record<string, string>
  const f = m.full_name || m.name || ''
  return f ? f.split(/\s+/)[0] : u.email?.split('@')[0] ?? ''
}
function getInitial(u: User | null): string { return firstName(u)?.[0]?.toUpperCase() ?? '?' }

// Left-wall perspective: y at x=240 given y at x=0
function lwY(yLeft: number): number { return yLeft + (340 - yLeft) * (240 / 720) }

// ─── Rain canvas hook ─────────────────────────────────────────────────────────
function useRain(ref: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const rs = () => { c.width = window.innerWidth; c.height = window.innerHeight }
    rs(); window.addEventListener('resize', rs)
    type D = { x: number; y: number; s: number; l: number; a: number }
    const mk = (): D => ({ x: Math.random()*c.width, y: Math.random()*c.height,
      s: 2.5+Math.random()*4, l: 10+Math.random()*22, a: 0.06+Math.random()*0.18 })
    const drops: D[] = Array.from({ length: 120 }, mk)
    let raf: number
    const tick = () => {
      ctx.clearRect(0,0,c.width,c.height)
      for (const d of drops) {
        ctx.beginPath(); ctx.strokeStyle=`rgba(160,195,255,${d.a})`; ctx.lineWidth=.5
        ctx.moveTo(d.x,d.y); ctx.lineTo(d.x-1.8,d.y+d.l); ctx.stroke()
        d.y+=d.s; d.x-=.7
        if (d.y>c.height+d.l) Object.assign(d,mk(),{y:-d.l})
      }
      raf=requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize',rs) }
  },[ref])
}

// ─── Clock ───────────────────────────────────────────────────────────────────
function useClock() {
  const [t,setT]=useState(new Date())
  useEffect(() => { const id=setInterval(()=>setT(new Date()),30000); return ()=>clearInterval(id) },[])
  return t
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CapitalLab() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const name = firstName(user)
  const ini  = getInitial(user)
  const rainRef = useRef<HTMLCanvasElement>(null)
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 })
  const [hov, setHov] = useState<string | null>(null)
  const [lightning, setLightning] = useState(false)
  const [qIdx, setQIdx] = useState(0)
  const [qPhase, setQPhase] = useState<'in'|'out'>('in')
  const now = useClock()

  useRain(rainRef)

  useEffect(() => {
    const id='rr-css'
    if (!document.getElementById(id)) {
      const el=document.createElement('style'); el.id=id; el.textContent=ROOM_CSS
      document.head.appendChild(el)
    }
    return () => document.getElementById('rr-css')?.remove()
  },[])

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const flash = () => {
      setLightning(true); setTimeout(()=>setLightning(false),80+Math.random()*120)
      t=setTimeout(flash,8000+Math.random()*22000)
    }
    t=setTimeout(flash,6000+Math.random()*8000)
    return ()=>clearTimeout(t)
  },[])

  useEffect(() => {
    const id=setInterval(()=>{
      setQPhase('out')
      setTimeout(()=>{ setQIdx(i=>(i+1)%QUOTES.length); setQPhase('in') },800)
    },16000)
    return ()=>clearInterval(id)
  },[])

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r=e.currentTarget.getBoundingClientRect()
    setMouse({ x:e.clientX/r.width, y:e.clientY/r.height })
  },[])

  const p = (dx: number, dy: number) =>
    `translate(${(mouse.x-.5)*dx}px,${(mouse.y-.5)*dy}px)`

  const q = QUOTES[qIdx]
  const timeStr = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})
  const dateStr = now.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}).toUpperCase()

  const glass: React.CSSProperties = {
    background: 'rgba(5,3,1,0.84)',
    border: '1px solid rgba(212,168,71,0.16)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  }

  return (
    <div
      style={{ position:'fixed', inset:0, overflow:'hidden', background:'#040201', cursor:'default' }}
      onMouseMove={onMove}
    >
      {/* Rain canvas */}
      <canvas ref={rainRef} style={{
        position:'absolute', inset:0, zIndex:9,
        opacity:.50, mixBlendMode:'screen', pointerEvents:'none',
      }} />

      {/* ═══ SVG ROOM ═══════════════════════════════════════════════════════ */}
      <svg viewBox="0 0 1440 900" width="100%" height="100%"
        style={{ position:'absolute', inset:0, display:'block' }}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <clipPath id="cl-lw"><polygon points="0,0 240,105 240,680 0,900" /></clipPath>
          <clipPath id="cl-rw"><polygon points="1200,105 1440,0 1440,900 1200,680" /></clipPath>
          <clipPath id="cl-fl"><polygon points="240,680 1200,680 1440,900 0,900" /></clipPath>
          <clipPath id="cl-bwl">
            <rect x="240" y="105" width={ARCH_X1-240} height="575" />
          </clipPath>
          <clipPath id="cl-bwr">
            <rect x={ARCH_X2} y="105" width={1200-ARCH_X2} height="575" />
          </clipPath>
          <clipPath id="cl-arch">
            <path d={`M${ARCH_X1},682 L${ARCH_X1},${ARCH_SPR} A${ARCH_R},${ARCH_R} 0 0,1 ${ARCH_X2},${ARCH_SPR} L${ARCH_X2},682 Z`} />
          </clipPath>

          {/* Gradients */}
          <radialGradient id="gf" cx="11%" cy="97%" r="50%">
            <stop offset="0%" stopColor="rgba(208,78,8,0.34)" /><stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="gf2" cx="15%" cy="100%" r="30%">
            <stop offset="0%" stopColor="rgba(238,112,14,0.24)" /><stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="glamp" cx="50%" cy="0%" r="80%">
            <stop offset="0%" stopColor="rgba(208,148,48,0.30)" /><stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="gwg" cx="50%" cy="42%" r="50%">
            <stop offset="0%" stopColor="rgba(20,40,108,0.22)" /><stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="gvig" cx="50%" cy="42%" r="66%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" /><stop offset="100%" stopColor="rgba(0,0,0,0.88)" />
          </radialGradient>
          <linearGradient id="gsky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#010305" />
            <stop offset="55%" stopColor="#030810" />
            <stop offset="100%" stopColor="#08121e" />
          </linearGradient>
          <linearGradient id="gfl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#130f06" /><stop offset="100%" stopColor="#060402" />
          </linearGradient>
          <linearGradient id="gceil" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#100d07" /><stop offset="100%" stopColor="#030201" />
          </linearGradient>
          <linearGradient id="gdesk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#251c09" /><stop offset="100%" stopColor="#160f04" />
          </linearGradient>
          <linearGradient id="gdf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#140f04" /><stop offset="100%" stopColor="#060402" />
          </linearGradient>
          <radialGradient id="gshl" cx="100%" cy="50%" r="90%">
            <stop offset="0%" stopColor="rgba(178,108,18,0.24)" /><stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="gshr" cx="0%" cy="50%" r="90%">
            <stop offset="0%" stopColor="rgba(178,108,18,0.24)" /><stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <linearGradient id="gcl" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(28,18,5,0)" /><stop offset="100%" stopColor="rgba(12,8,2,0.92)" />
          </linearGradient>
          <linearGradient id="gcr" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(28,18,5,0)" /><stop offset="100%" stopColor="rgba(12,8,2,0.92)" />
          </linearGradient>
          <filter id="fb2"><feGaussianBlur stdDeviation="2" /></filter>
          <filter id="fb5"><feGaussianBlur stdDeviation="5" /></filter>
          <filter id="fb10"><feGaussianBlur stdDeviation="10" /></filter>
          <filter id="fb18"><feGaussianBlur stdDeviation="18" /></filter>
        </defs>

        {/* Fireplace ambient */}
        <rect width="1440" height="900" fill="url(#gf)"
          style={{ animation:'rr-fire 4.5s ease-in-out infinite' }} />
        <rect width="1440" height="900" fill="url(#gf2)"
          style={{ animation:'rr-fire2 3s ease-in-out infinite 0.6s' }} />

        {/* ── CEILING ── */}
        <g style={{ transform: p(-2,-4) }}>
          <polygon points="0,0 1440,0 1200,105 240,105" fill="url(#gceil)" />
          {[.2,.4,.6,.8].map((t,i) => (
            <line key={i} x1={240+(1200-240)*t} y1={105} x2={720} y2={0}
              stroke="rgba(212,168,71,0.03)" strokeWidth="0.5" />
          ))}
          {/* Chandelier */}
          <line x1="720" y1="0" x2="720" y2="50" stroke="rgba(90,68,22,0.9)" strokeWidth="3.5" />
          <ellipse cx="720" cy="56" rx="38" ry="14" fill="#1a1207" stroke="rgba(212,168,71,0.32)" strokeWidth="1.2" />
          <path d="M682,56 Q720,108 758,56" fill="rgba(212,148,40,0.12)"
            style={{ animation:'rr-lamp 3.8s ease-in-out infinite' }} />
          <ellipse cx="720" cy="62" rx="280" ry="195" fill="url(#glamp)"
            style={{ animation:'rr-lamp 3.8s ease-in-out infinite' }} />
        </g>

        {/* ── BACK WALL base ── */}
        <rect x="240" y="105" width="960" height="575" fill="#0e0b06" />
        {Array.from({length:20},(_,i) => (
          <line key={i} x1={248+i*46} y1={105} x2={248+i*46} y2={680}
            stroke="rgba(212,168,71,0.022)" strokeWidth="0.5" />
        ))}

        {/* ── BACK WALL bookshelves left of arch ── */}
        <g style={{ transform: p(-3,-2) }} clipPath="url(#cl-bwl)">
          <BackWallShelf x1={240} x2={ARCH_X1} />
        </g>

        {/* ── ARCHED WINDOW ── */}
        <g style={{ transform: p(0,0) }}>
          {/* Outer walnut arch surround */}
          <path
            d={`M${ARCH_X1-22},682 L${ARCH_X1-22},${ARCH_SPR} A${ARCH_R+22},${ARCH_R+22} 0 0,1 ${ARCH_X2+22},${ARCH_SPR} L${ARCH_X2+22},682 Z`}
            fill="#1f1608" stroke="rgba(212,168,71,0.24)" strokeWidth="1.5"
          />
          {/* Sky */}
          <path
            d={`M${ARCH_X1},680 L${ARCH_X1},${ARCH_SPR} A${ARCH_R},${ARCH_R} 0 0,1 ${ARCH_X2},${ARCH_SPR} L${ARCH_X2},680 Z`}
            fill="url(#gsky)"
          />
          {/* City clipped to arch */}
          <g clipPath="url(#cl-arch)">
            <CityNight lightning={lightning} />
            {/* Curtains inside arch edges */}
            <rect x={ARCH_X1} y={ARCH_SPR} width="60" height={680-ARCH_SPR} fill="url(#gcl)" />
            <rect x={ARCH_X2-60} y={ARCH_SPR} width="60" height={680-ARCH_SPR} fill="url(#gcr)" />
          </g>
          {/* Mullion bars */}
          <path d={`M717,${ARCH_SPR-14} L717,682`} stroke="#1f1608" strokeWidth="14" />
          <path d={`M717,${ARCH_SPR-14} L717,682`} stroke="rgba(212,168,71,0.09)" strokeWidth="0.7" />
          <line x1={ARCH_X1-22} y1="518" x2={ARCH_X2+22} y2="518" stroke="#1f1608" strokeWidth="12" />
          <line x1={ARCH_X1-22} y1="518" x2={ARCH_X2+22} y2="518" stroke="rgba(212,168,71,0.09)" strokeWidth="0.7" />
          {/* Glass reflection */}
          <path d={`M${ARCH_X1},${ARCH_SPR} L${ARCH_X1},${ARCH_SPR+180}`}
            stroke="rgba(255,255,255,0.016)" strokeWidth="22" filter="url(#fb5)" />
          {/* Room ambient from window */}
          <ellipse cx="720" cy="650" rx="220" ry="44"
            fill="rgba(22,46,118,0.12)" filter="url(#fb18)" />
          {/* Window glow rect */}
          <rect width="1440" height="900" fill="url(#gwg)" />
        </g>

        {/* ── BACK WALL bookshelves right of arch ── */}
        <g style={{ transform: p(3,-2) }} clipPath="url(#cl-bwr)">
          <BackWallShelf x1={ARCH_X2} x2={1200} />
        </g>

        {/* Shelf amber glow overlay */}
        <rect x="240" y="105" width={ARCH_X1-240} height="575" fill="url(#gshl)"
          style={{ animation:'rr-shelf-glow 5s ease-in-out infinite' }} />
        <rect x={ARCH_X2} y="105" width={1200-ARCH_X2} height="575" fill="url(#gshr)"
          style={{ animation:'rr-shelf-glow 5s ease-in-out infinite 1.2s' }} />

        {/* ── LEFT WALL ── */}
        <g style={{ transform: p(-12,-5) }}>
          <polygon points="0,0 240,105 240,680 0,900" fill="#0c0a03" />
          <g clipPath="url(#cl-lw)"><SideShelf side="left" /></g>
          <Fireplace />
        </g>

        {/* ── RIGHT WALL ── */}
        <g style={{ transform: p(12,-5) }}>
          <polygon points="1200,105 1440,0 1440,900 1200,680" fill="#0a0802" />
          <g clipPath="url(#cl-rw)"><SideShelf side="right" /></g>
        </g>

        {/* ── FLOOR ── */}
        <g style={{ transform: p(-1,4) }}>
          <polygon points="240,680 1200,680 1440,900 0,900" fill="url(#gfl)" />
          <g clipPath="url(#cl-fl)"><FloorLines /></g>
          <ellipse cx="720" cy="738" rx="310" ry="48"
            fill="rgba(26,48,112,0.10)" filter="url(#fb18)" />
        </g>

        {/* ── CHAIR (silhouette behind desk) ── */}
        <g style={{ transform: p(0,-1) }}><Chair /></g>

        {/* ── DESK SHADOW ── */}
        <ellipse cx="720" cy="846" rx="430" ry="28"
          fill="rgba(0,0,0,0.58)" filter="url(#fb18)" />

        {/* ── DESK ── */}
        <g style={{ transform: p(0,1) }}>
          {/* Side faces */}
          <polygon points="360,800 520,694 520,742 360,862" fill="#0d0a04" />
          <polygon points="1080,800 920,694 920,742 1080,862" fill="#130e05" />
          {/* Front face */}
          <polygon points="360,800 1080,800 1080,862 360,862" fill="url(#gdf)" />
          <line x1="368" y1="831" x2="1072" y2="831" stroke="rgba(212,168,71,0.05)" strokeWidth="0.8" />
          {/* Brass top trim */}
          <line x1="364" y1="800" x2="1076" y2="800" stroke="rgba(212,168,71,0.28)" strokeWidth="1.4" />
          {/* Top surface */}
          <polygon points="520,694 920,694 1080,800 360,800" fill="url(#gdesk)" />
          {/* Wood grain */}
          {Array.from({length:18},(_,i) => {
            const f=i/18
            return <line key={i} x1={520+(920-520)*f} y1={694} x2={360+(1080-360)*f} y2={800}
              stroke="rgba(212,168,71,0.016)" strokeWidth="0.6" />
          })}
          <line x1="364" y1="800" x2="1076" y2="800" stroke="rgba(212,168,71,0.18)" strokeWidth="0.6" />

          <DeskLamp />
          <DeskObjects hov={hov} setHov={setHov} />
        </g>

        {/* ── VIGNETTE ── */}
        <rect width="1440" height="900" fill="url(#gvig)" />
        <rect width="180" height="900" fill="rgba(0,0,0,0.55)" />
        <rect x="1260" width="180" height="900" fill="rgba(0,0,0,0.55)" />
        <rect width="1440" height="72" fill="rgba(0,0,0,0.38)" />
        <rect y="828" width="1440" height="72" fill="rgba(0,0,0,0.42)" />
      </svg>

      {/* ═══ GAME UI ════════════════════════════════════════════════════════ */}
      <div style={{ position:'absolute', inset:0, zIndex:20, pointerEvents:'none',
        fontFamily:'Georgia,"Times New Roman",serif' }}>

        {/* ── TOP HEADER ── */}
        <div style={{
          position:'absolute', top:0, left:0, right:0, height:'72px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 20px',
          background:'linear-gradient(to bottom,rgba(3,2,0,0.88),rgba(3,2,0,0))',
          pointerEvents:'auto',
        }}>
          {/* Left crest */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{
              width:'46px', height:'46px',
              border:'1.5px solid rgba(212,168,71,0.45)', borderRadius:'6px',
              display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center',
              background:'rgba(5,3,1,0.82)',
            }}>
              <span style={{ fontSize:'18px', color:'rgba(212,168,71,0.88)',
                fontFamily:'Georgia,serif', lineHeight:1 }}>R</span>
            </div>
            <div>
              <div style={{ fontSize:'8px', letterSpacing:'0.22em',
                color:'rgba(212,168,71,0.45)', textTransform:'uppercase' }}>Private Access</div>
              <div style={{ fontSize:'10px', letterSpacing:'0.15em',
                color:'rgba(212,168,71,0.75)', textTransform:'uppercase',
                fontWeight:'bold', marginTop:'1px' }}>Capital Lab</div>
            </div>
          </div>

          {/* Centre title */}
          <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)',
            textAlign:'center' }}>
            <div style={{ fontSize:'23px', letterSpacing:'0.32em',
              color:'rgba(212,168,71,0.86)', textTransform:'uppercase' }}>
              Research Room
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
              gap:'8px', marginTop:'3px' }}>
              <div style={{ width:'44px', height:'0.5px', background:'rgba(212,168,71,0.35)' }} />
              <div style={{ width:'5px', height:'5px',
                border:'1px solid rgba(212,168,71,0.45)', transform:'rotate(45deg)' }} />
              <div style={{ width:'44px', height:'0.5px', background:'rgba(212,168,71,0.35)' }} />
            </div>
          </div>

          {/* Right profile */}
          {user ? (
            <div style={{ display:'flex', alignItems:'center', gap:'11px' }}>
              <div style={{
                width:'40px', height:'40px', borderRadius:'50%',
                background:'rgba(38,28,8,0.92)',
                border:'1.5px solid rgba(212,168,71,0.42)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'16px', color:'rgba(212,168,71,0.85)', fontFamily:'Georgia,serif',
              }}>{ini}</div>
              <div>
                <div style={{ fontSize:'13px', color:'rgba(238,222,188,0.90)',
                  letterSpacing:'0.04em' }}>{name}</div>
                <div style={{ fontSize:'9px', color:'rgba(178,143,68,0.62)',
                  letterSpacing:'0.08em', marginTop:'1px' }}>
                  Vision. &nbsp;Patience. &nbsp;Discipline.
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'4px' }}>
                  <span style={{ fontSize:'8px', color:'rgba(212,168,71,0.55)',
                    letterSpacing:'0.10em' }}>LV.12</span>
                  <div style={{ width:'82px', height:'3px',
                    background:'rgba(28,20,5,0.92)',
                    border:'1px solid rgba(212,168,71,0.18)', borderRadius:'2px',
                    overflow:'hidden' }}>
                    <div style={{ width:'69%', height:'100%',
                      background:'linear-gradient(to right,rgba(178,118,18,0.75),rgba(212,168,71,0.95))',
                      animation:'rr-xp 2s ease-out forwards' }} />
                  </div>
                  <span style={{ fontSize:'8px', color:'rgba(212,168,71,0.38)' }}>3,450 / 5,000 XP</span>
                </div>
              </div>
            </div>
          ) : (
            <Link to="/login" style={{ color:'rgba(212,168,71,0.55)', fontSize:'11px',
              letterSpacing:'0.10em', textDecoration:'none', pointerEvents:'auto' }}>
              התחבר
            </Link>
          )}
        </div>

        {/* ── LEFT PANEL — menu ── */}
        <div style={{
          position:'absolute', left:'16px', top:'80px',
          width:'232px', ...glass, borderRadius:'8px',
          overflow:'hidden', pointerEvents:'auto',
        }}>
          {LEFT_MENU.map((item,i) => <LeftMenuItem key={i} item={item} />)}
        </div>

        {/* ── RIGHT PANEL — stats ── */}
        <div style={{
          position:'absolute', right:'16px', top:'80px',
          width:'220px', ...glass, borderRadius:'8px',
          overflow:'hidden', pointerEvents:'auto',
        }}>
          {/* Capital Status */}
          <div style={{ padding:'14px 16px 10px', borderBottom:'1px solid rgba(212,168,71,0.10)' }}>
            <div style={{ fontSize:'8px', letterSpacing:'0.22em',
              color:'rgba(212,168,71,0.48)', textTransform:'uppercase',
              marginBottom:'10px' }}>Capital Status</div>
            {STATS.map((s,i) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'5px 0',
                borderBottom: i<STATS.length-1 ? '1px solid rgba(212,168,71,0.05)' : 'none',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontSize:'11px', color:'rgba(212,168,71,0.48)', width:'14px' }}>{s.icon}</span>
                  <span style={{ fontSize:'11px', color:'rgba(198,182,150,0.74)' }}>{s.label}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                  <span style={{ fontSize:'12px', color:'rgba(212,168,71,0.85)', fontWeight:'bold' }}>{s.val}</span>
                  <span style={{ fontSize:'9px', color:'rgba(212,168,71,0.32)' }}>›</span>
                </div>
              </div>
            ))}
          </div>

          {/* Market Overview */}
          <div style={{ padding:'12px 16px 10px', borderBottom:'1px solid rgba(212,168,71,0.10)' }}>
            <div style={{ fontSize:'8px', letterSpacing:'0.22em',
              color:'rgba(212,168,71,0.48)', textTransform:'uppercase',
              marginBottom:'10px' }}>Market Overview</div>
            {MARKET.map((m,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}>
                <span style={{ fontSize:'10px', color:'rgba(178,162,130,0.74)' }}>{m.label}</span>
                <span style={{ fontSize:'10px', fontWeight:'bold',
                  color: m.pos ? 'rgba(72,195,92,0.90)' : 'rgba(205,72,65,0.90)' }}>
                  {m.val}
                </span>
              </div>
            ))}
            <svg viewBox="0 0 180 28" width="100%" height="22" style={{ marginTop:'8px', opacity:.55 }}>
              <polyline points="0,24 20,20 40,22 60,14 80,17 100,9 120,12 140,6 160,10 180,7"
                fill="none" stroke="rgba(72,195,92,0.65)" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Quote */}
          <div style={{
            padding:'12px 16px 14px',
            animation:`${qPhase==='in'?'rr-qi':'rr-qo'} 0.9s ease-out forwards`,
          }}>
            <div style={{ fontSize:'28px', color:'rgba(212,168,71,0.22)', lineHeight:.6,
              fontFamily:'Georgia,serif', marginBottom:'4px' }}>"</div>
            <p style={{ margin:'0 0 6px', fontSize:'10px', fontStyle:'italic',
              lineHeight:1.7, color:'rgba(218,202,170,0.70)' }}>{q.t}</p>
            <p style={{ margin:0, fontSize:'9px', color:'rgba(212,168,71,0.52)',
              letterSpacing:'0.06em' }}>– {q.a}</p>
            <div style={{ fontSize:'28px', color:'rgba(212,168,71,0.22)', lineHeight:.6,
              textAlign:'right', fontFamily:'Georgia,serif', marginTop:'4px' }}>"</div>
          </div>
        </div>

        {/* ── BOTTOM STATUS BAR ── */}
        <div style={{
          position:'absolute', bottom:0, left:0, right:0, height:'46px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 22px',
          background:'linear-gradient(to top,rgba(3,2,0,0.90),rgba(3,2,0,0))',
          pointerEvents:'auto',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'22px' }}>
            <button style={{ all:'unset', cursor:'pointer', display:'flex', alignItems:'center',
              gap:'6px', color:'rgba(178,152,92,0.58)', fontSize:'10px', letterSpacing:'0.14em' }}>
              <span>⚙</span> SETTINGS
            </button>
            <button onClick={async()=>{ await signOut(); navigate('/') }}
              style={{ all:'unset', cursor:'pointer', display:'flex', alignItems:'center',
                gap:'6px', color:'rgba(178,152,92,0.58)', fontSize:'10px', letterSpacing:'0.14em' }}>
              <span>↩</span> LOG OUT
            </button>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'7px',
            color:'rgba(175,150,88,0.42)', fontSize:'9px', letterSpacing:'0.18em' }}>
            <span style={{ fontSize:'12px' }}>⛨</span> ENCRYPTED CONNECTION
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'14px',
            color:'rgba(175,150,88,0.55)', fontSize:'10px', letterSpacing:'0.10em' }}>
            <span style={{ fontSize:'14px', color:'rgba(212,168,71,0.82)' }}>{timeStr}</span>
            <span>{dateStr}</span>
          </div>
        </div>

        {/* Hover label above desk */}
        {hov && (
          <div style={{ position:'absolute', bottom:'168px', left:'50%',
            transform:'translateX(-50%)', textAlign:'center', pointerEvents:'none',
            animation:'rr-qi 0.3s ease-out forwards' }}>
            <div style={{
              display:'inline-block', padding:'5px 18px',
              background:'rgba(6,4,1,0.92)', border:'1px solid rgba(212,168,71,0.28)',
              borderRadius:'4px', color:'rgba(238,222,182,0.92)',
              fontSize:'11px', letterSpacing:'0.06em',
            }}>{OBJ_LABELS[hov]}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Left Menu ────────────────────────────────────────────────────────────────
const LEFT_MENU = [
  { icon: '⊕', title: 'Create Index',     desc: 'Build your custom index',              href: '/' },
  { icon: '⊞', title: 'Advanced Search',  desc: 'Find companies. Uncover opportunities.', href: '/' },
  { icon: '⬡', title: 'The Library',      desc: 'Your knowledge collection',             href: '/' },
  { icon: '⚗', title: 'AI Research Lab',  desc: 'AI-powered insights and analysis',      href: '/' },
]

function LeftMenuItem({ item }: { item: typeof LEFT_MENU[0] }) {
  const [h, setH] = useState(false)
  return (
    <div
      style={{
        display:'flex', alignItems:'center', gap:'14px',
        padding:'13px 16px',
        borderBottom:'1px solid rgba(212,168,71,0.07)',
        background: h ? 'rgba(212,168,71,0.07)' : 'transparent',
        cursor:'pointer', transition:'background .25s',
      }}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    >
      <div style={{
        width:'36px', height:'36px', flexShrink:0,
        border:`1px solid ${h?'rgba(212,168,71,0.55)':'rgba(212,168,71,0.24)'}`,
        borderRadius:'4px', display:'flex', alignItems:'center', justifyContent:'center',
        background:'rgba(12,8,2,0.82)', color:'rgba(212,168,71,0.72)',
        fontSize:'16px', transition:'border-color .25s',
      }}>{item.icon}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:'11px', letterSpacing:'0.10em', textTransform:'uppercase',
          fontWeight:'bold', transition:'color .25s',
          color: h ? 'rgba(238,218,168,0.96)' : 'rgba(210,168,70,0.80)' }}>
          {item.title}
        </div>
        <div style={{ fontSize:'9px', color:'rgba(158,142,108,0.64)', marginTop:'2px', lineHeight:1.4 }}>
          {item.desc}
        </div>
      </div>
      <span style={{ fontSize:'13px', color:'rgba(212,168,71,0.32)' }}>›</span>
    </div>
  )
}

// ─── Desk object label map ────────────────────────────────────────────────────
const OBJ_LABELS: Record<string,string> = {
  sphere:   'Create Index',
  folder:   'Advanced Search',
  notebook: 'Search',
  book:     'Library',
  lab:      'AI Lab',
}

// ─── Desk Objects ─────────────────────────────────────────────────────────────
type ObjP = { hov:string|null; setHov:(v:string|null)=>void }

function DeskObjects({ hov, setHov }: ObjP) {
  const rise = (k: string): React.CSSProperties => ({
    transition:'transform .42s cubic-bezier(.23,1,.32,1)',
    transform: hov===k ? 'translateY(-7px)' : 'translateY(0)',
    cursor:'pointer',
  })
  const lbl = (txt: string, x: number) => (
    <g transform={`translate(${x},822)`}>
      <rect x="-52" y="-9" width="104" height="18" rx="1"
        fill="rgba(6,4,1,0.90)" stroke="rgba(212,168,71,0.20)" strokeWidth="0.5" />
      <text textAnchor="middle" y="5" fontSize="7" letterSpacing="1.8"
        fill="rgba(212,168,71,0.58)" fontFamily="Georgia,serif">{txt}</text>
    </g>
  )

  return (
    <g>
      {/* Armillary sphere */}
      <g transform="translate(548,753)" style={rise('sphere')}
        onMouseEnter={()=>setHov('sphere')} onMouseLeave={()=>setHov(null)}>
        <ArmillarySphere />
        <ellipse cx="0" cy="32" rx="30" ry="7" fill="rgba(0,0,0,0.38)" filter="url(#fb2)" />
      </g>
      {lbl('CREATE INDEX',548)}

      {/* Compass folder */}
      <g transform="translate(652,757)" style={rise('folder')}
        onMouseEnter={()=>setHov('folder')} onMouseLeave={()=>setHov(null)}>
        <CompassFolder />
        <ellipse cx="0" cy="32" rx="36" ry="7" fill="rgba(0,0,0,0.35)" filter="url(#fb2)" />
      </g>
      {lbl('SEARCH',660)}

      {/* Leather notebook */}
      <g transform="translate(778,753)" style={rise('notebook')}
        onMouseEnter={()=>setHov('notebook')} onMouseLeave={()=>setHov(null)}>
        <LeatherNotebook />
        <ellipse cx="0" cy="34" rx="30" ry="7" fill="rgba(0,0,0,0.33)" filter="url(#fb2)" />
      </g>
      {lbl('LIBRARY',778)}

      {/* Embossed book */}
      <g transform="translate(900,755)" style={rise('book')}
        onMouseEnter={()=>setHov('book')} onMouseLeave={()=>setHov(null)}>
        <EmbossedBook />
        <ellipse cx="0" cy="33" rx="28" ry="6" fill="rgba(0,0,0,0.32)" filter="url(#fb2)" />
      </g>
      {lbl('LIBRARY',900)}

      {/* Brass lab instrument */}
      <g transform="translate(1000,748)" style={rise('lab')}
        onMouseEnter={()=>setHov('lab')} onMouseLeave={()=>setHov(null)}>
        <BrassInstrument />
        <ellipse cx="0" cy="36" rx="22" ry="6" fill="rgba(0,0,0,0.30)" filter="url(#fb2)" />
      </g>
      {lbl('AI LAB',1000)}
    </g>
  )
}

// ─── Armillary sphere ─────────────────────────────────────────────────────────
function ArmillarySphere() {
  return (
    <g>
      <defs>
        <radialGradient id="gasph">
          <stop offset="0%" stopColor="#28180a"/><stop offset="100%" stopColor="#150c02"/>
        </radialGradient>
      </defs>
      <ellipse cx="0" cy="28" rx="18" ry="5" fill="rgba(212,168,71,0.18)"/>
      <rect x="-4" y="22" width="8" height="8" fill="rgba(212,168,71,0.38)"/>
      <ellipse cx="0" cy="0" rx="22" ry="22" fill="none" stroke="rgba(212,168,71,0.58)" strokeWidth="1.8"/>
      <ellipse cx="0" cy="0" rx="22" ry="8" fill="none" stroke="rgba(212,168,71,0.36)" strokeWidth="1.2"/>
      <ellipse cx="0" cy="0" rx="8" ry="22" fill="none" stroke="rgba(212,168,71,0.36)" strokeWidth="1.2"/>
      <circle r="12" fill="url(#gasph)"/>
      <circle cx="-4" cy="-5" r="3.5" fill="rgba(255,255,255,0.05)"/>
    </g>
  )
}

// ─── Compass folder ───────────────────────────────────────────────────────────
function CompassFolder() {
  return (
    <g>
      <defs>
        <linearGradient id="gcf" x1="0" y1="-30" x2="0" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3c2610"/><stop offset="100%" stopColor="#221408"/>
        </linearGradient>
      </defs>
      <rect x="-32" y="-28" width="64" height="56" rx="2"
        fill="url(#gcf)" stroke="rgba(212,168,71,0.22)" strokeWidth="1"/>
      <rect x="-32" y="-28" width="6" height="56" rx="1" fill="rgba(8,5,1,0.92)"/>
      <circle r="14" fill="none" stroke="rgba(212,168,71,0.28)" strokeWidth="0.7"/>
      <circle r="10" fill="none" stroke="rgba(212,168,71,0.18)" strokeWidth="0.5"/>
      {[0,1,2,3].map(i => {
        const a=i*90; const x=Math.sin(a*Math.PI/180)*12; const y=-Math.cos(a*Math.PI/180)*12
        return <line key={i} x1={0} y1={0} x2={x} y2={y}
          stroke="rgba(212,168,71,0.45)" strokeWidth={i%2===0?'1.5':'0.8'}/>
      })}
      <circle r="2.5" fill="rgba(212,168,71,0.52)"/>
    </g>
  )
}

// ─── Leather notebook ─────────────────────────────────────────────────────────
function LeatherNotebook() {
  return (
    <g>
      <defs>
        <linearGradient id="gnb" x1="0" y1="-32" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1c1408"/><stop offset="100%" stopColor="#110c03"/>
        </linearGradient>
      </defs>
      <rect x="-26" y="-30" width="52" height="60" rx="2"
        fill="url(#gnb)" stroke="rgba(212,168,71,0.18)" strokeWidth="0.8"/>
      <rect x="-26" y="-30" width="5" height="60" rx="1" fill="rgba(6,4,1,0.95)"/>
      <rect x="22" y="-28" width="3" height="56" fill="rgba(195,180,145,0.06)"/>
      <text textAnchor="middle" y="6" fontSize="16" fontFamily="Georgia,serif"
        fill="rgba(212,168,71,0.30)" fontStyle="italic">R</text>
      {[[-24,-28],[20,-28],[20,28],[-24,28]].map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r="2.5" fill="rgba(212,168,71,0.28)"/>
      ))}
      <rect x="8" y="-30" width="2.5" height="18" rx="0.5" fill="rgba(175,38,28,0.55)"/>
    </g>
  )
}

// ─── Embossed book ────────────────────────────────────────────────────────────
function EmbossedBook() {
  return (
    <g>
      <defs>
        <linearGradient id="geb" x1="-22" y1="0" x2="22" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#583615"/><stop offset="100%" stopColor="#381e0e"/>
        </linearGradient>
      </defs>
      <rect x="-22" y="-28" width="44" height="56" rx="2"
        fill="url(#geb)" stroke="rgba(212,168,71,0.26)" strokeWidth="1"/>
      <rect x="-22" y="-28" width="5" height="56" rx="1" fill="rgba(7,4,1,0.90)"/>
      <rect x="-15" y="-22" width="30" height="44" rx="1"
        fill="none" stroke="rgba(212,168,71,0.28)" strokeWidth="0.6"/>
      <text textAnchor="middle" y="6" fontSize="18" fontFamily="Georgia,serif"
        fill="rgba(212,168,71,0.42)" fontStyle="italic">R</text>
      <line x1="-12" y1="-16" x2="12" y2="-16" stroke="rgba(212,168,71,0.22)" strokeWidth="0.5"/>
      <line x1="-12" y1="18" x2="12" y2="18" stroke="rgba(212,168,71,0.22)" strokeWidth="0.5"/>
    </g>
  )
}

// ─── Brass instrument ─────────────────────────────────────────────────────────
function BrassInstrument() {
  return (
    <g>
      <rect x="-5" y="-30" width="10" height="52" rx="3"
        fill="rgba(175,128,28,0.55)" stroke="rgba(212,168,71,0.45)" strokeWidth="0.8"/>
      <rect x="-7" y="-32" width="14" height="8" rx="3" fill="rgba(212,168,71,0.45)"/>
      <ellipse cx="0" cy="22" rx="9" ry="4"
        fill="rgba(175,128,28,0.50)" stroke="rgba(212,168,71,0.40)" strokeWidth="0.7"/>
      {[-10,0,10].map(y => (
        <rect key={y} x="-6" y={y} width="12" height="3" rx="1" fill="rgba(212,168,71,0.35)"/>
      ))}
      <line x1="0" y1="22" x2="-14" y2="36" stroke="rgba(175,128,28,0.60)" strokeWidth="1.5"/>
      <line x1="0" y1="22" x2="14" y2="36" stroke="rgba(175,128,28,0.60)" strokeWidth="1.5"/>
      <line x1="0" y1="22" x2="0" y2="36" stroke="rgba(175,128,28,0.55)" strokeWidth="1.5"/>
      {[-14,0,14].map(x=>(
        <ellipse key={x} cx={x} cy={36} rx="4" ry="1.5" fill="rgba(212,168,71,0.22)"/>
      ))}
    </g>
  )
}

// ─── Desk lamp ───────────────────────────────────────────────────────────────
function DeskLamp() {
  return (
    <g transform="translate(1044,728)">
      <path d="M0,40 L0,-8 Q4,-28 18,-33" fill="none"
        stroke="rgba(178,128,24,0.55)" strokeWidth="2.5"/>
      <path d="M8,-33 L28,-33 L22,-19 L14,-19 Z"
        fill="rgba(178,128,24,0.45)" stroke="rgba(212,168,71,0.35)" strokeWidth="0.7"/>
      <ellipse cx="18" cy="-19" rx="24" ry="15"
        fill="rgba(198,146,38,0.14)" filter="url(#fb10)"
        style={{ animation:'rr-lamp 4s ease-in-out infinite' }}/>
      <ellipse cx="0" cy="40" rx="10" ry="3" fill="rgba(178,128,24,0.40)"/>
    </g>
  )
}

// ─── Chair ───────────────────────────────────────────────────────────────────
function Chair() {
  return (
    <g transform="translate(720,682)">
      <path d="M-58,0 Q-60,-82 0,-90 Q60,-82 58,0 Q36,8 0,8 Q-36,8 -58,0 Z"
        fill="#0e0b06" stroke="rgba(212,168,71,0.07)" strokeWidth="0.8"/>
      {[-30,-10,10,30].map(x=>(
        <line key={x} x1={x} y1={-88+Math.abs(x)*.8} x2={x} y2={0}
          stroke="rgba(212,168,71,0.035)" strokeWidth="0.5"/>
      ))}
      {[-50,-22,5,30,55].map(y=>(
        <path key={y} d={`M${-55+Math.abs(y)*.08},${y} Q0,${y-5} ${55-Math.abs(y)*.08},${y}`}
          fill="none" stroke="rgba(212,168,71,0.035)" strokeWidth="0.5"/>
      ))}
      <path d="M-58,0 Q-60,-5 -52,-8 Q0,-12 52,-8 Q60,-5 58,0"
        fill="#180e05" stroke="rgba(212,168,71,0.12)" strokeWidth="0.8"/>
    </g>
  )
}

// ─── Back wall shelf section ──────────────────────────────────────────────────
const BW_COLORS = [
  '#5a2c0a','#3c1c08','#4a2210','#692e12','#2a1404','#783e16',
  '#3a1a08','#5c2e10','#2e1c0c','#602c0e','#462210','#884c1e',
]

function BackWallShelf({ x1, x2 }: { x1: number; x2: number }) {
  const w = x2-x1
  const shelves = [120,220,320,420,520,620]
  return (
    <>
      <rect x={x1} y={105} width={w} height={575} fill="#0e0a05"/>
      {/* Shelf-light strips */}
      {shelves.slice(0,-1).map((sy,i)=>(
        <rect key={i} x={x1+2} y={105+sy-4} width={w-4} height={4}
          fill="rgba(196,138,28,0.20)"
          style={{ animation:`rr-shelf-glow ${3+i*.4}s ease-in-out infinite ${i*.28}s` }}/>
      ))}
      {/* Books */}
      {shelves.slice(0,-1).map((sy,si)=>{
        const ny=shelves[si+1], rh=ny-sy-10, n=4+si%3
        return Array.from({length:n},(_,bi)=>{
          const bx=x1+(bi/n)*w+2, bw=(w/n)-3
          const c=BW_COLORS[(si*n+bi)%BW_COLORS.length]
          return <rect key={bi} x={bx} y={105+sy+8} width={bw} height={rh}
            fill={c} stroke="rgba(0,0,0,0.28)" strokeWidth="0.4"/>
        })
      })}
      {/* Shelf planks */}
      {shelves.map((sy,i)=>(
        <rect key={i} x={x1} y={105+sy} width={w} height={8} fill="#1c1208"/>
      ))}
    </>
  )
}

// ─── Side wall shelf ─────────────────────────────────────────────────────────
const LW_SHY = [820,680,545,415,285,165,68]
const SIDE_COLORS = [
  '#6a2c08','#3a1a06','#582e0e','#261204','#763c16','#402010',
  '#5a2a0c','#361806','#5e1a06','#462010','#2c1a0a','#7c481a',
]

function SideShelf({ side }: { side:'left'|'right' }) {
  const isL = side==='left'
  const shelves = LW_SHY.map(y=>({ yL:y, yR:lwY(y) }))

  return (
    <g transform={isL ? undefined : 'scale(-1,1) translate(-1440,0)'}>
      <rect width="240" height="900" fill="#0c0904"/>
      {[55,110,165].map(x=>(
        <line key={x} x1={x} y1={0} x2={x} y2={900}
          stroke="rgba(212,168,71,0.022)" strokeWidth="0.5"/>
      ))}
      {/* Shelf amber strip lights */}
      {shelves.slice(0,-1).map((s,i)=>(
        <line key={i} x1={0} y1={s.yL-3} x2={240} y2={s.yR-3}
          stroke="rgba(188,128,20,0.32)" strokeWidth="2"
          style={{ animation:`rr-shelf-glow ${3.5+i*.3}s ease-in-out infinite ${i*.22}s` }}/>
      ))}
      {/* Books */}
      {shelves.slice(0,-1).map((bot,si)=>{
        const top=shelves[si+1]; const n=6+si%3
        return Array.from({length:n},(_,bi)=>{
          const f1=bi/n, f2=(bi+1)/n
          const x1=240*f1, x2=240*f2
          const y1L=bot.yL+(top.yL-bot.yL)*.05
          const y1R=bot.yR+(top.yR-bot.yR)*.05
          const y2L=bot.yL+(top.yL-bot.yL)*.95
          const y2R=bot.yR+(top.yR-bot.yR)*.95
          const gL=y1L+(y1R-y1L)*f1, gR=y1L+(y1R-y1L)*f2
          const hL=y2L+(y2R-y2L)*f1, hR=y2L+(y2R-y2L)*f2
          const c=SIDE_COLORS[(si*n+bi)%SIDE_COLORS.length]
          return (
            <polygon key={bi}
              points={`${x1},${gL} ${x2},${gR} ${x2},${hR} ${x1},${hL}`}
              fill={(si*n+bi)%9===0?'#8a5620':c}
              stroke="rgba(0,0,0,0.26)" strokeWidth="0.4"/>
          )
        })
      })}
      {/* Shelf planks */}
      {shelves.map((s,i)=>(
        <g key={i}>
          <line x1={0} y1={s.yL} x2={240} y2={s.yR} stroke="#1c1308" strokeWidth="9"/>
          <line x1={0} y1={s.yL-2} x2={240} y2={s.yR-2} stroke="rgba(212,168,71,0.13)" strokeWidth="0.8"/>
        </g>
      ))}
      {/* Globe on left wall lower shelf */}
      {isL && (
        <g transform="translate(62,808)">
          <circle r="20" fill="#182240" stroke="rgba(212,168,71,0.30)" strokeWidth="1"/>
          {[-10,0,10].map((dy,i)=>(
            <ellipse key={i} cx="0" cy={dy} rx="20" ry="4.5"
              fill="none" stroke="rgba(212,168,71,0.14)" strokeWidth="0.5"/>
          ))}
          <ellipse cx="0" cy="0" rx="8" ry="20" fill="none"
            stroke="rgba(212,168,71,0.11)" strokeWidth="0.5"/>
          <circle cx="-6" cy="-6" r="4.5" fill="rgba(255,255,255,0.04)"/>
          <line x1="0" y1="20" x2="0" y2="30" stroke="rgba(212,168,71,0.40)" strokeWidth="1.8"/>
          <ellipse cx="0" cy="31" rx="10" ry="3" fill="rgba(212,168,71,0.16)"/>
        </g>
      )}
    </g>
  )
}

// ─── Fireplace ───────────────────────────────────────────────────────────────
function Fireplace() {
  return (
    <g transform="translate(42,754)">
      <path d="M0,118 L0,48 Q0,0 48,0 Q96,0 96,48 L96,118 Z"
        fill="#1a1510" stroke="rgba(212,168,71,0.17)" strokeWidth="1"/>
      {[22,44,66,88].map(y=>(
        <line key={y} x1={0} y1={y} x2={96} y2={y}
          stroke="rgba(212,168,71,0.05)" strokeWidth="0.5"/>
      ))}
      <path d="M10,118 L10,52 Q10,12 48,12 Q86,12 86,52 L86,118 Z" fill="#070503"/>
      <ellipse cx="30" cy="106" rx="12" ry="22"
        fill="rgba(212,88,10,0.75)" style={{ animation:'rr-fire 2.8s ease-in-out infinite .1s' }}/>
      <ellipse cx="48" cy="100" rx="18" ry="30"
        fill="rgba(238,122,16,0.70)" style={{ animation:'rr-fire2 2.1s ease-in-out infinite' }}/>
      <ellipse cx="66" cy="108" rx="10" ry="20"
        fill="rgba(208,82,6,0.70)" style={{ animation:'rr-fire 3s ease-in-out infinite .4s' }}/>
      <ellipse cx="48" cy="112" rx="9" ry="14"
        fill="rgba(252,182,32,0.60)" style={{ animation:'rr-fire2 1.7s ease-in-out infinite .2s' }}/>
      <ellipse cx="48" cy="120" rx="38" ry="9"
        fill="rgba(192,62,4,0.28)" filter="url(#fb5)"
        style={{ animation:'rr-fire 3.5s ease-in-out infinite' }}/>
      <rect x="-12" y="-8" width="120" height="10" rx="1"
        fill="#201608" stroke="rgba(212,168,71,0.20)" strokeWidth="0.8"/>
    </g>
  )
}

// ─── City night skyline ───────────────────────────────────────────────────────
function CityNight({ lightning }: { lightning: boolean }) {
  const ax1=ARCH_X1, ax2=ARCH_X2, aW=ax2-ax1
  const baseY=680, topY=ARCH_SPR-ARCH_R+28

  const BLDGS = [
    [.00,.030,.38],[.02,.016,.60],[.04,.036,.26],[.07,.013,.68],[.08,.042,.46],[.12,.013,.70],
    [.13,.038,.36],[.16,.016,.82],[.18,.046,.30],[.22,.016,.52],[.24,.040,.65],[.28,.013,.58],
    [.29,.050,.40],[.33,.016,.88],[.35,.040,.28],[.39,.016,.62],[.40,.038,.50],[.44,.014,.40],
    // Empire State center cluster
    [.44,.058,.86],[.46,.028,.92],
    [.49,.060,.84],[.51,.028,.90],[.53,.055,.82],
    [.57,.014,.42],[.58,.044,.33],[.62,.016,.70],[.64,.042,.48],[.68,.014,.60],
    [.69,.040,.28],[.73,.013,.76],[.74,.050,.44],[.78,.018,.68],[.80,.042,.31],[.84,.014,.52],
    [.85,.038,.38],[.89,.016,.64],[.91,.044,.36],[.95,.016,.55],[.97,.038,.42],[.99,.011,.50],
  ]

  const LIGHTS: [number,number,number,number][] = []
  BLDGS.forEach(([rx,rw,rh],bi)=>{
    const bx=ax1+rx*aW, bw=rw*aW
    const bTop=baseY-rh*(baseY-topY)
    const rows=Math.max(1,Math.floor((baseY-bTop)/13))
    const cols=Math.max(1,Math.floor(bw/8))
    for (let r=0;r<rows;r++) {
      for (let c=0;c<cols;c++) {
        const seed=bi*1000+r*100+c
        if (seed%3!==0 || seed%5===0) continue
        LIGHTS.push([bx+c*8+1.5,bTop+r*13+4,3,2])
      }
    }
  })

  return (
    <>
      {Array.from({length:50},(_,i)=>(
        <circle key={i}
          cx={ax1+(i*139%(aW))}
          cy={ARCH_SPR-ARCH_R+8+((i*83)%190)}
          r={.3+(i%4)*.32}
          fill={`rgba(255,255,255,${.22+(i%6)*.08})`}/>
      ))}
      {BLDGS.map(([rx,rw,rh],i)=>{
        const x=ax1+rx*aW, w=rw*aW, h=rh*(baseY-topY)
        const s=5+(i%5)*4
        return <rect key={i} x={x} y={baseY-h} width={w} height={h}
          fill={`rgb(${s},${s+2},${s+11})`}/>
      })}
      {/* Empire State Building spire */}
      <rect x="713" y={ARCH_SPR-ARCH_R+22} width="14" height="48" fill="rgb(11,13,21)"/>
      <rect x="717" y={ARCH_SPR-ARCH_R+12} width="6" height="18" fill="rgb(9,11,19)"/>
      <rect x="719" y={ARCH_SPR-ARCH_R+5} width="2" height="10" fill="rgb(7,9,17)"/>
      <rect x="719" y={ARCH_SPR-ARCH_R+2} width="2" height="4" fill="rgba(198,178,96,0.72)"/>
      <ellipse cx="720" cy={ARCH_SPR-ARCH_R+4} rx="6" ry="3"
        fill="rgba(198,178,80,0.16)" filter="url(#fb5)"/>
      {LIGHTS.map(([x,y,w,h],i)=>(
        <rect key={i} x={x} y={y} width={w} height={h}
          fill={`rgba(255,${208+(i%8)*4},${75+(i%10)*12},${.20+(i%6)*.06})`}/>
      ))}
      <rect x={ax1} y={490} width={aW} height={100}
        fill="rgba(20,42,108,0.16)" filter="url(#fb18)"/>
      {lightning && (
        <rect x={ax1} y={ARCH_SPR-ARCH_R} width={aW} height={680-(ARCH_SPR-ARCH_R)}
          fill="rgba(208,222,255,0.07)"
          style={{ animation:'rr-lightning .28s ease-out forwards' }}/>
      )}
    </>
  )
}

// ─── Floor lines ─────────────────────────────────────────────────────────────
function FloorLines() {
  return (
    <>
      {Array.from({length:22},(_,i)=>(
        <line key={i} x1={240+(1200-240)*(i/22)} y1={680} x2={0+1440*(i/22)} y2={900}
          stroke="rgba(212,168,71,0.014)" strokeWidth="0.5"/>
      ))}
      {[.14,.30,.48,.65,.82].map((t,i)=>(
        <line key={i} x1={0} y1={680+(900-680)*t} x2={1440} y2={680+(900-680)*t}
          stroke="rgba(212,168,71,0.022)" strokeWidth="0.5"/>
      ))}
    </>
  )
}
