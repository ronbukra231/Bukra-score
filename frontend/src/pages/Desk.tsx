import { useState, useEffect, useRef } from 'react'
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

function getFirstName(u: { email?: string | null; user_metadata?: Record<string, string> }): string {
  const meta = u.user_metadata ?? {}
  const full: string = meta.full_name || meta.name || ''
  if (full) return full.split(/\s+/)[0]
  return u.email?.split('@')[0] ?? ''
}

function timeAgo(iso: string, isHe: boolean): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return isHe ? 'זה עתה' : 'just now'
  if (min < 60) return isHe ? `${min} דק'` : `${min}m`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return isHe ? `${hrs} ש'` : `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return isHe ? `${days} ימים` : `${days}d`
  return new Date(iso).toLocaleDateString()
}

function scoreColor(s: number | null) {
  if (s === null) return 'text-gray-500 border-gray-700'
  if (s >= 80) return 'text-emerald-400 border-emerald-600/60'
  if (s >= 60) return 'text-blue-400 border-blue-600/60'
  if (s >= 40) return 'text-amber-400 border-amber-600/60'
  return 'text-red-400 border-red-600/60'
}
function scoreBg(s: number | null) {
  if (s === null) return 'bg-gray-800/40'
  if (s >= 80) return 'bg-emerald-500/10'
  if (s >= 60) return 'bg-blue-500/10'
  if (s >= 40) return 'bg-amber-500/10'
  return 'bg-red-500/10'
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

// ── Animation keyframes (injected once) ──────────────────────────────────────

const DESK_STYLES = `
@keyframes dk-fog {
  0%   { transform: translateX(-20px) scaleX(1.0); opacity: 0.045; }
  50%  { transform: translateX(20px)  scaleX(1.04); opacity: 0.075; }
  100% { transform: translateX(-20px) scaleX(1.0); opacity: 0.045; }
}
@keyframes dk-fog2 {
  0%   { transform: translateX(30px)  scaleX(1.0); opacity: 0.035; }
  50%  { transform: translateX(-15px) scaleX(1.03); opacity: 0.060; }
  100% { transform: translateX(30px)  scaleX(1.0); opacity: 0.035; }
}
@keyframes dk-glow-pulse {
  0%,100% { opacity: 0.22; }
  50%      { opacity: 0.34; }
}
@keyframes dk-glow-pulse2 {
  0%,100% { opacity: 0.14; }
  50%      { opacity: 0.22; }
}
@keyframes dk-twinkle {
  0%,100% { opacity: 0.9; }
  40%      { opacity: 0.4; }
  70%      { opacity: 0.7; }
}
@keyframes dk-chart-draw {
  from { stroke-dashoffset: 800; }
  to   { stroke-dashoffset: 0; }
}
@keyframes dk-float-up {
  0%,100% { transform: translateY(0px); opacity: 1; }
  50%      { transform: translateY(-4px); opacity: 0.85; }
}
@keyframes dk-ticker-fade {
  0%,100% { opacity: 0.55; }
  50%      { opacity: 0.85; }
}
@keyframes dk-candle-flicker {
  0%,100% { opacity: 0.5; }
  33%      { opacity: 0.7; }
  66%      { opacity: 0.4; }
}
.dk-fog        { animation: dk-fog        18s ease-in-out infinite; }
.dk-fog2       { animation: dk-fog2       24s ease-in-out infinite; }
.dk-glow       { animation: dk-glow-pulse  4s ease-in-out infinite; }
.dk-glow2      { animation: dk-glow-pulse2 6s ease-in-out infinite; }
.dk-tw1        { animation: dk-twinkle  3.2s ease-in-out infinite; }
.dk-tw2        { animation: dk-twinkle  5.1s ease-in-out infinite 1s; }
.dk-tw3        { animation: dk-twinkle  4.4s ease-in-out infinite 2.2s; }
.dk-chart      { stroke-dasharray: 800; animation: dk-chart-draw 3s ease-out forwards; }
.dk-chart2     { stroke-dasharray: 600; animation: dk-chart-draw 3.5s ease-out forwards 0.4s; stroke-dashoffset: 600; }
.dk-float      { animation: dk-float-up   6s ease-in-out infinite; }
.dk-float2     { animation: dk-float-up   8s ease-in-out infinite 1s; }
.dk-ticker     { animation: dk-ticker-fade 3s ease-in-out infinite; }
.dk-ticker2    { animation: dk-ticker-fade 4s ease-in-out infinite 1.5s; }
.dk-candle     { animation: dk-candle-flicker 2.5s ease-in-out infinite; }
`

// ── Cinematic Hero ────────────────────────────────────────────────────────────

function DeskHero({ firstName, isHe }: { firstName: string; isHe: boolean }) {
  const stylesInjected = useRef(false)
  useEffect(() => {
    if (stylesInjected.current) return
    stylesInjected.current = true
    const el = document.createElement('style')
    el.textContent = DESK_STYLES
    document.head.appendChild(el)
    return () => { document.head.removeChild(el) }
  }, [])

  return (
    <div className="relative overflow-hidden select-none" style={{ height: 'min(82vh, 660px)', minHeight: 460 }}>

      {/* ── Layer 1: Deep atmosphere ─────────────────────────────────────── */}
      <svg viewBox="0 0 1440 660" xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          {/* Sky */}
          <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#000308"/>
            <stop offset="30%"  stopColor="#010718"/>
            <stop offset="65%"  stopColor="#020C24"/>
            <stop offset="100%" stopColor="#030F2A"/>
          </linearGradient>
          {/* City horizon glow — the soul of the scene */}
          <radialGradient id="g-city-glow" cx="50%" cy="100%" r="75%">
            <stop offset="0%"   stopColor="#0E3A8C" stopOpacity="0.5"/>
            <stop offset="35%"  stopColor="#0A2A6A" stopOpacity="0.25"/>
            <stop offset="70%"  stopColor="#061844" stopOpacity="0.10"/>
            <stop offset="100%" stopColor="#0E3A8C" stopOpacity="0"/>
          </radialGradient>
          {/* Monitor bloom — center light source */}
          <radialGradient id="g-mon-bloom" cx="50%" cy="78%" r="40%">
            <stop offset="0%"   stopColor="#1A5FD4" stopOpacity="0.30"/>
            <stop offset="50%"  stopColor="#0E3A8C" stopOpacity="0.12"/>
            <stop offset="100%" stopColor="#0E3A8C" stopOpacity="0"/>
          </radialGradient>
          {/* Left monitor light */}
          <radialGradient id="g-mon-L" cx="33%" cy="72%" r="25%">
            <stop offset="0%"   stopColor="#1248A8" stopOpacity="0.20"/>
            <stop offset="100%" stopColor="#1248A8" stopOpacity="0"/>
          </radialGradient>
          {/* Right monitor light */}
          <radialGradient id="g-mon-R" cx="67%" cy="72%" r="25%">
            <stop offset="0%"   stopColor="#1248A8" stopOpacity="0.20"/>
            <stop offset="100%" stopColor="#1248A8" stopOpacity="0"/>
          </radialGradient>
          {/* Monitor screen fill */}
          <linearGradient id="g-screen-c" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#081A40"/>
            <stop offset="100%" stopColor="#030A1C"/>
          </linearGradient>
          <linearGradient id="g-screen-s" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#060F2A"/>
            <stop offset="100%" stopColor="#020610"/>
          </linearGradient>
          {/* Chart gradients */}
          <linearGradient id="g-chart-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#1A5FD4" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#60A5FA" stopOpacity="1"/>
          </linearGradient>
          <linearGradient id="g-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2563EB" stopOpacity="0.20"/>
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="g-chart2-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#0EA5E9" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.9"/>
          </linearGradient>
          {/* Bottom page fade */}
          <linearGradient id="g-bottom" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#000308" stopOpacity="0"/>
            <stop offset="80%"  stopColor="#000308" stopOpacity="0"/>
            <stop offset="100%" stopColor="#000308" stopOpacity="1"/>
          </linearGradient>
          {/* Top vignette */}
          <linearGradient id="g-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#000308" stopOpacity="0.7"/>
            <stop offset="40%"  stopColor="#000308" stopOpacity="0"/>
          </linearGradient>
          {/* Side vignettes */}
          <linearGradient id="g-side-l" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#000308" stopOpacity="1"/>
            <stop offset="30%"  stopColor="#000308" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="g-side-r" x1="0" y1="0" x2="1" y2="0">
            <stop offset="70%"  stopColor="#000308" stopOpacity="0"/>
            <stop offset="100%" stopColor="#000308" stopOpacity="1"/>
          </linearGradient>
          {/* Floating overlay chart fill */}
          <linearGradient id="g-float-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3B82F6" stopOpacity="0.12"/>
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0"/>
          </linearGradient>
          {/* Desk surface */}
          <linearGradient id="g-desk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#0D1830"/>
            <stop offset="100%" stopColor="#050B18"/>
          </linearGradient>
          {/* Filters */}
          <filter id="f-blur3"  x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
          <filter id="f-blur6"  x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
          <filter id="f-blur14" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
          <filter id="f-blur28" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="28"/></filter>
          <filter id="f-glow-blue">
            <feGaussianBlur stdDeviation="8" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>

        {/* Sky base */}
        <rect width="1440" height="660" fill="url(#g-sky)"/>

        {/* City horizon atmosphere */}
        <rect width="1440" height="660" fill="url(#g-city-glow)"/>

        {/* Monitor bloom — key light source illuminating from center */}
        <rect width="1440" height="660" fill="url(#g-mon-bloom)" className="dk-glow"/>
        <rect width="1440" height="660" fill="url(#g-mon-L)"/>
        <rect width="1440" height="660" fill="url(#g-mon-R)"/>

        {/* ── Stars ─────────────────────────────────────────────────────── */}
        {/* Far, dim */}
        {[55,100,165,215,270,335,410,475,530,595,650,715,775,840,900,965,1020,1085,1145,1210,1270,1340,1395].map((x, i) => (
          <circle key={`sf${i}`} cx={x} cy={12 + (i * 7) % 28} r={0.5} fill="white" opacity={0.25 + (i % 4) * 0.08}/>
        ))}
        {/* Mid */}
        {[
          [80,38,0.7,'dk-tw1'],[152,22,0.9,'dk-tw2'],[234,45,0.6,'dk-tw1'],[318,18,0.8,'dk-tw3'],
          [404,40,0.7,'dk-tw2'],[488,26,0.9,'dk-tw1'],[564,52,0.6,'dk-tw3'],[648,16,0.8,'dk-tw2'],
          [732,42,0.7,'dk-tw1'],[816,28,0.6,'dk-tw3'],[900,48,0.8,'dk-tw2'],[984,20,0.7,'dk-tw1'],
          [1068,38,0.9,'dk-tw3'],[1148,26,0.6,'dk-tw2'],[1232,44,0.8,'dk-tw1'],[1364,30,0.7,'dk-tw3'],
        ].map(([cx, cy, op, cls], i) => (
          <circle key={`sm${i}`} cx={cx as number} cy={cy as number} r={i % 3 === 0 ? 1.2 : 0.8}
            fill="white" opacity={op as number} className={cls as string}/>
        ))}
        {/* Bright accent stars */}
        {[[270,58,1.6,0.9,'dk-tw2'],[720,32,1.4,0.8,'dk-tw1'],[1180,48,1.5,0.9,'dk-tw3']].map(([cx,cy,r,op,cls], i) => (
          <circle key={`sb${i}`} cx={cx as number} cy={cy as number} r={r as number}
            fill="white" opacity={op as number} className={cls as string}/>
        ))}

        {/* ── Grid overlay — financial chart feel ───────────────────────── */}
        <g opacity="0.06">
          {[100,200,300,400,500].map(y => <line key={`gy${y}`} x1="0" y1={y} x2="1440" y2={y} stroke="#4A90D9" strokeWidth="0.5"/>)}
          {[180,360,540,720,900,1080,1260].map(x => <line key={`gx${x}`} x1={x} y1="0" x2={x} y2="660" stroke="#4A90D9" strokeWidth="0.5"/>)}
        </g>

        {/* ── Fog layers ────────────────────────────────────────────────── */}
        <ellipse cx="720" cy="420" rx="820" ry="90" fill="#0A2860" opacity="0" className="dk-fog"/>
        <ellipse cx="720" cy="380" rx="680" ry="60" fill="#0A2060" opacity="0" className="dk-fog2"/>

        {/* ── Skyline Layer A — deep distance (blurred, faint) ─────────── */}
        <g filter="url(#f-blur6)" opacity="0.28">
          <polygon fill="#0A1830" points="
            0,660 0,400 60,400 60,370 100,370 100,345 140,345 140,360 180,360
            180,335 210,335 210,310 240,310 240,325 270,325 270,305 310,305
            310,285 340,285 340,270 370,270 370,285 400,285 400,300 430,300
            430,280 460,280 460,260 490,260 490,245 510,245 510,230 540,230
            540,245 570,245 570,260 600,260 600,280 630,280 630,260 660,260
            660,245 690,245 690,230 720,230 720,215 750,215 750,230 780,230
            780,245 810,245 810,265 840,265 840,280 870,280 870,260 900,260
            900,245 930,245 930,230 960,230 960,215 990,215 990,230 1020,230
            1020,250 1050,250 1050,268 1080,268 1080,285 1110,285 1110,305
            1140,305 1140,325 1170,325 1170,345 1200,345 1200,365 1230,365
            1260,365 1260,385 1300,385 1300,405 1340,405 1340,425 1440,425 1440,660
          "/>
        </g>

        {/* ── Skyline Layer B — mid distance ───────────────────────────── */}
        <g filter="url(#f-blur3)" opacity="0.55">
          <polygon fill="#060E20" points="
            0,660 0,430 45,430 45,400 75,400 75,372 105,372 105,350 132,350
            132,332 155,332 155,312 175,312 175,295 198,295 198,312 220,312
            220,332 245,332 245,310 268,310 268,290 292,290 292,270 315,270
            315,252 335,252 335,238 355,238 355,222 375,222 375,205 395,205
            395,188 415,188 415,172 432,172 432,158 450,158 450,145 468,145
            468,158 485,158 485,175 502,175 502,195 520,195 520,215 538,215
            538,230 555,230 555,215 572,215 572,198 590,198 590,182 608,182
            608,165 625,165 625,150 642,150 642,135 658,135 658,150 675,150
            675,165 692,165 692,182 710,182 710,198 728,198 728,215 745,215
            745,200 762,200 762,182 780,182 780,165 798,165 798,150 815,150
            815,135 832,135 832,150 850,150 850,165 867,165 867,182 884,182
            884,198 902,198 902,215 920,215 920,232 938,232 938,218 956,218
            956,200 973,200 973,185 990,185 990,170 1008,170 1008,185 1025,185
            1025,202 1042,202 1042,220 1060,220 1060,235 1078,235 1078,255
            1095,255 1095,272 1112,272 1112,290 1130,290 1130,308 1148,308
            1148,325 1165,325 1165,345 1183,345 1183,362 1200,362 1200,380
            1220,380 1220,398 1242,398 1242,415 1265,415 1265,432 1295,432
            1320,432 1320,450 1360,450 1360,465 1440,465 1440,660
          "/>
        </g>

        {/* ── Skyline Layer C — foreground silhouette ───────────────────── */}
        <polygon fill="#040A18" points="
          0,660 0,455 35,455 35,420 60,420 60,392 88,392 88,368 112,368
          112,348 135,348 135,328 155,328 155,308 175,308 175,288 194,288
          194,268 212,268 212,250 230,250 230,232 248,232 248,215 265,215
          265,198 282,198 282,182 298,182 298,165 312,165 312,148 328,148
          328,135 345,135 345,120 362,120 362,108 378,108 378,95 395,95
          395,82 410,82 410,68 425,68 425,55 440,55 440,68 456,68 456,82
          470,82 470,95 484,95 484,110 498,110 498,125 512,125 512,140
          526,140 526,155 540,155 540,140 554,140 554,125 568,125 568,108
          582,108 582,92 596,92 596,76 610,76 610,60 625,60 625,45 640,45
          640,30 654,30 654,45 668,45 668,60 682,60 682,78 696,78 696,95
          710,95 710,112 724,112 724,128 738,128 738,112 752,112 752,95
          766,95 766,78 780,78 780,60 794,60 794,45 808,45 808,30 822,30
          822,45 836,45 836,60 850,60 850,76 864,76 864,92 878,92 878,108
          892,108 892,125 906,125 906,140 920,140 920,155 934,155 934,140
          948,140 948,125 962,125 962,108 976,108 976,92 990,92 990,76
          1004,76 1004,60 1018,60 1018,45 1032,45 1032,60 1046,60 1046,78
          1060,78 1060,95 1074,95 1074,112 1088,112 1088,128 1102,128
          1102,144 1116,144 1116,160 1130,160 1130,175 1145,175 1145,192
          1160,192 1160,210 1175,210 1175,228 1190,228 1190,248 1205,248
          1205,268 1220,268 1220,288 1235,288 1235,308 1250,308 1250,328
          1265,328 1265,348 1282,348 1282,368 1300,368 1300,390 1320,390
          1320,412 1345,412 1345,435 1370,435 1370,458 1440,458 1440,660
        "/>

        {/* ── Building windows — blue-white, high density ───────────────── */}
        {/* Generate windows systematically across skyline */}
        {[
          // Left third
          [100,160],[108,160],[100,172],[108,172],[100,184],[108,184],
          [135,140],[143,140],[135,152],[143,152],[135,164],[143,164],
          [158,120],[166,120],[158,132],[166,132],[158,144],[166,144],
          [180,102],[188,102],[180,114],[188,114],[180,126],[188,126],
          [200,92],[208,92],[200,104],[208,104],[200,116],[208,116],
          [218,76],[226,76],[218,88],[226,88],[218,100],[226,100],
          [238,72],[246,72],[238,84],[246,84],[238,96],[246,96],
          [255,60],[263,60],[255,72],[263,72],[255,84],[263,84],
          [272,50],[280,50],[272,62],[280,62],[272,74],[280,74],
          [290,42],[298,42],[290,54],[298,54],[290,66],[298,66],
          [310,82],[318,82],[310,94],[318,94],[310,106],[318,106],
          [328,72],[336,72],[328,84],[336,84],[328,96],[336,96],
          [345,58],[353,58],[345,70],[353,70],[345,82],[353,82],
          [362,48],[370,48],[362,60],[370,60],[362,72],[370,72],
          [380,36],[388,36],[380,48],[388,48],[380,60],[388,60],
          [396,28],[404,28],[396,40],[404,40],[396,52],[404,52],
          [412,18],[420,18],[412,30],[420,30],[412,42],[420,42],
          // Center — dense financial district
          [428,25],[436,25],[428,37],[436,37],[428,49],[436,49],
          [444,16],[452,16],[444,28],[452,28],[444,40],[452,40],
          [460,8],[468,8],[460,20],[468,20],[460,32],[468,32],
          [476,18],[484,18],[476,30],[484,30],[476,42],[484,42],
          [492,30],[500,30],[492,42],[500,42],[492,54],[500,54],
          [508,20],[516,20],[508,32],[516,32],[508,44],[516,44],
          [524,14],[532,14],[524,26],[532,26],[524,38],[532,38],
          [540,26],[548,26],[540,38],[548,38],[540,50],[548,50],
          [556,12],[564,12],[556,24],[564,24],[556,36],[564,36],
          [572,22],[580,22],[572,34],[580,34],[572,46],[580,46],
          [588,8],[596,8],[588,20],[596,20],[588,32],[596,32],
          [604,18],[612,18],[604,30],[612,30],[604,42],[612,42],
          [620,28],[628,28],[620,40],[628,40],[620,52],[628,52],
          [636,14],[644,14],[636,26],[644,26],[636,38],[644,38],
          [652,8],[660,8],[652,20],[660,20],[652,32],[660,32],
          [668,20],[676,20],[668,32],[676,32],[668,44],[676,44],
          [684,8],[692,8],[684,20],[692,20],[684,32],[692,32],
          [700,28],[708,28],[700,40],[708,40],[700,52],[708,52],
          [716,14],[724,14],[716,26],[724,26],[716,38],[724,38],
          [732,8],[740,8],[732,20],[740,20],[732,32],[740,32],
          [748,18],[756,18],[748,30],[756,30],[748,42],[756,42],
          [764,8],[772,8],[764,20],[772,20],[764,32],[772,32],
          [780,22],[788,22],[780,34],[788,34],[780,46],[788,46],
          [796,12],[804,12],[796,24],[804,24],[796,36],[804,36],
          [812,8],[820,8],[812,20],[820,20],[812,32],[820,32],
          [828,18],[836,18],[828,30],[836,30],[828,42],[836,42],
          // Right third
          [920,22],[928,22],[920,34],[928,34],[920,46],[928,46],
          [936,12],[944,12],[936,24],[944,24],[936,36],[944,36],
          [952,26],[960,26],[952,38],[960,38],[952,50],[960,50],
          [968,14],[976,14],[968,26],[976,26],[968,38],[976,38],
          [984,30],[992,30],[984,42],[992,42],[984,54],[992,54],
          [1000,20],[1008,20],[1000,32],[1008,32],[1000,44],[1008,44],
          [1016,12],[1024,12],[1016,24],[1024,24],[1016,36],[1024,36],
          [1032,28],[1040,28],[1032,40],[1040,40],[1032,52],[1040,52],
          [1048,18],[1056,18],[1048,30],[1056,30],[1048,42],[1056,42],
          [1064,32],[1072,32],[1064,44],[1072,44],[1064,56],[1072,56],
          [1088,45],[1096,45],[1088,57],[1096,57],[1088,69],[1096,69],
          [1110,58],[1118,58],[1110,70],[1118,70],[1110,82],[1118,82],
          [1132,72],[1140,72],[1132,84],[1140,84],[1132,96],[1140,96],
          [1155,88],[1163,88],[1155,100],[1163,100],[1155,112],[1163,112],
          [1178,104],[1186,104],[1178,116],[1186,116],[1178,128],[1186,128],
          [1200,120],[1208,120],[1200,132],[1208,132],[1200,144],[1208,144],
          [1222,138],[1230,138],[1222,150],[1230,150],[1222,162],[1230,162],
          [1245,158],[1253,158],[1245,170],[1253,170],[1245,182],[1253,182],
          [1268,178],[1276,178],[1268,190],[1276,190],[1268,202],[1276,202],
          [1292,198],[1300,198],[1292,210],[1300,210],[1292,222],[1300,222],
          [1315,218],[1323,218],[1315,230],[1323,230],[1315,242],[1323,242],
        ].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width={5} height={6} rx={0.8}
            fill={i % 7 === 0 ? '#A0C4FF' : i % 5 === 0 ? '#7AB2FF' : '#4A86E8'}
            opacity={0.10 + (i % 6) * 0.07}
          />
        ))}

        {/* Bright landmark windows */}
        {[
          [460,8],[660,8],[720,20],[780,8],[820,8],[460,20],[540,14],[640,14],
          [840,18],[980,12],[1032,28],[1064,32],
        ].map(([x,y], i) => (
          <rect key={i} x={x} y={y} width={6} height={7} rx={1}
            fill="#C0D8FF" opacity={0.55}/>
        ))}

        {/* ── Desk platform ─────────────────────────────────────────────── */}
        <polygon fill="url(#g-desk)" points="50,660 200,545 1240,545 1390,660"/>
        {/* Desk edge highlight */}
        <line x1="200" y1="545" x2="1240" y2="545" stroke="#1A3060" strokeWidth="1" opacity="0.6"/>

        {/* ── Monitor ambient illumination blooms ───────────────────────── */}
        <ellipse cx="430"  cy="490" rx="130" ry="50" fill="#1248A8" opacity="0" className="dk-glow2" filter="url(#f-blur14)"/>
        <ellipse cx="720"  cy="475" rx="190" ry="70" fill="#1A5FD4" opacity="0" className="dk-glow"  filter="url(#f-blur14)"/>
        <ellipse cx="1010" cy="490" rx="130" ry="50" fill="#1248A8" opacity="0" className="dk-glow2" filter="url(#f-blur14)"/>
        {/* Floor glow from monitors */}
        <ellipse cx="720" cy="560" rx="400" ry="60" fill="#0D2E6E" opacity="0.18" filter="url(#f-blur28)"/>

        {/* ── Monitor left ──────────────────────────────────────────────── */}
        <rect x="330" y="388" width="195" height="130" rx="6" fill="#030814"/>
        <rect x="334" y="392" width="187" height="122" rx="4" fill="url(#g-screen-s)"/>
        {/* Chart bars */}
        {[[340,498,24],[360,482,40],[380,490,32],[400,470,52],[420,462,60],[440,476,46],[460,468,54],[480,452,70],[500,460,62]].map(([x,y,h],i)=>(
          <rect key={i} x={x} y={y} width={14} height={h} rx={1.5}
            fill="#1A52A8" opacity={0.3 + i*0.045}/>
        ))}
        <rect x="340" y="402" width="90"  height="3" rx="1.5" fill="#3A7CD8" opacity="0.5"/>
        <rect x="340" y="409" width="170" height="2" rx="1"   fill="#1A4A90" opacity="0.35"/>
        <rect x="340" y="414" width="130" height="2" rx="1"   fill="#1A4A90" opacity="0.25"/>
        {/* Monitor stand */}
        <rect x="417" y="518" width="22" height="14" rx="2" fill="#030610"/>
        <rect x="403" y="530" width="50" height="5"  rx="2" fill="#030610"/>

        {/* ── Monitor center — main, larger ─────────────────────────────── */}
        <rect x="558" y="362" width="304" height="148" rx="6" fill="#030814"/>
        <rect x="562" y="366" width="296" height="140" rx="4" fill="url(#g-screen-c)"/>
        {/* Header chrome */}
        <rect x="570" y="374" width="140" height="4"   rx="2" fill="#3A82D8" opacity="0.65"/>
        <rect x="570" y="382" width="245" height="2.5" rx="1" fill="#1A4A90" opacity="0.40"/>
        <rect x="570" y="388" width="195" height="2"   rx="1" fill="#1A4A90" opacity="0.28"/>
        {/* Score widget */}
        <rect x="570" y="396" width="68" height="42" rx="6" fill="#061428" opacity="0.95"/>
        <rect x="570" y="396" width="68" height="2"  rx="1" fill="#2A6AD8" opacity="0.6"/>
        <text x="578" y="427" fontSize="22" fill="#60A5FA" fontFamily="monospace" fontWeight="bold" opacity="0.92">89</text>
        {/* Main line chart */}
        <polyline className="dk-chart"
          points="570,490 600,472 632,481 664,458 696,466 728,444 760,452 792,428 820,436 848,418 852,420"
          fill="none" stroke="url(#g-chart-line)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
        <polygon
          points="570,490 600,472 632,481 664,458 696,466 728,444 760,452 792,428 820,436 848,418 852,420 852,505 570,505"
          fill="url(#g-chart-fill)"/>
        {/* Secondary line */}
        <polyline className="dk-chart2"
          points="570,500 600,492 632,497 664,486 696,491 728,478 760,484 792,472 820,477 852,468"
          fill="none" stroke="#1E4A90" strokeWidth="1.2" strokeLinejoin="round" opacity="0.4"/>
        {/* Stat chips */}
        {[[642,396,'+12.4%','#22C55E'],[726,396,'+8.1%','#22C55E'],[812,396,'-2.3%','#EF4444']].map(([x,y,v,c])=>(
          <g key={String(x)}>
            <rect x={Number(x)} y={Number(y)} width={56} height={18} rx={4} fill="#081828" opacity="0.95"/>
            <text x={Number(x)+6} y={Number(y)+13} fontSize="9" fill={String(c)} fontFamily="monospace" fontWeight="bold" opacity="0.9">{String(v)}</text>
          </g>
        ))}
        {/* Monitor stand */}
        <rect x="700" y="510" width="40" height="18" rx="3" fill="#030610"/>
        <rect x="685" y="526" width="70" height="6"  rx="3" fill="#030610"/>

        {/* ── Monitor right ─────────────────────────────────────────────── */}
        <rect x="915" y="388" width="195" height="130" rx="6" fill="#030814"/>
        <rect x="919" y="392" width="187" height="122" rx="4" fill="url(#g-screen-s)"/>
        {/* Candlestick chart on right monitor */}
        {[[928,0],[944,0],[960,0],[976,0],[992,0],[1008,0],[1024,0],[1040,0],[1056,0],[1072,0],[1088,0]].map(([x],i)=>{
          const isUp = i%3!==1
          const h = 16 + (i * 8) % 32
          const y = 440 + (i * 5) % 30
          return (
            <g key={i} className="dk-candle">
              <rect x={x+2} y={y} width={8} height={h} rx={1} fill={isUp?'#1E6AD8':'#4A4A6A'} opacity={0.6}/>
              <line x1={x+6} y1={y-4} x2={x+6} y2={y} stroke={isUp?'#3A8AF8':'#6A6A8A'} strokeWidth={1} opacity={0.5}/>
              <line x1={x+6} y1={y+h} x2={x+6} y2={y+h+4} stroke={isUp?'#3A8AF8':'#6A6A8A'} strokeWidth={1} opacity={0.5}/>
            </g>
          )
        })}
        <rect x="924" y="402" width="100" height="3" rx="1.5" fill="#3A7CD8" opacity="0.5"/>
        <rect x="924" y="408" width="165" height="2" rx="1"   fill="#1A4A90" opacity="0.35"/>
        {/* Stand */}
        <rect x="1002" y="518" width="22" height="14" rx="2" fill="#030610"/>
        <rect x="988"  y="530" width="50" height="5"  rx="2" fill="#030610"/>

        {/* ── Person silhouette ─────────────────────────────────────────── */}
        {/* Chair back */}
        <rect x="655" y="462" width="110" height="80" rx="14" fill="#020508" opacity="0.99"/>
        {/* Seat */}
        <ellipse cx="720" cy="550" rx="70" ry="18" fill="#020508"/>
        {/* Torso / back */}
        <path d="M 638,550 Q 680,500 720,490 Q 760,500 802,550" fill="#020508"/>
        {/* Neck */}
        <rect x="712" y="440" width="16" height="30" rx="4" fill="#020508"/>
        {/* Head */}
        <circle cx="720" cy="420" r="30" fill="#020508"/>
        {/* Arms */}
        <path d="M 638,540 Q 618,530 600,520 Q 582,515 570,520" fill="none" stroke="#020508" strokeWidth="22" strokeLinecap="round"/>
        <path d="M 802,540 Q 822,530 840,520 Q 858,515 870,520" fill="none" stroke="#020508" strokeWidth="22" strokeLinecap="round"/>
        {/* Keyboard glow */}
        <rect x="640" y="548" width="160" height="8" rx="4" fill="#0E2850" opacity="0.25"/>

        {/* ── Floating financial data overlays ──────────────────────────── */}
        {/* Left floating chart */}
        <g className="dk-float" transform="translate(28, 180)" opacity="0.7">
          <rect x="0" y="0" width="180" height="110" rx="8" fill="#030C22" opacity="0.75"/>
          <rect x="0" y="0" width="180" height="2"   rx="1" fill="#1A52A8" opacity="0.8"/>
          <text x="10" y="20" fontSize="10" fill="#4A8AE8" fontFamily="monospace" opacity="0.7">▲ 12.5%</text>
          <polyline
            points="10,90 30,72 50,80 70,58 90,66 110,44 130,52 150,30 165,38 175,35"
            fill="none" stroke="#2A72D8" strokeWidth="1.8" strokeLinejoin="round" opacity="0.8"/>
          <polygon
            points="10,90 30,72 50,80 70,58 90,66 110,44 130,52 150,30 165,38 175,35 175,95 10,95"
            fill="url(#g-float-fill)"/>
          {/* Mini bars */}
          {[[10,82],[26,68],[42,75],[58,56],[74,63]].map(([x,y],i)=>(
            <rect key={i} x={x} y={y} width={8} height={95-y} rx={1} fill="#1A52A8" opacity={0.25+i*0.04}/>
          ))}
        </g>

        {/* Right floating chart — candlestick panel */}
        <g className="dk-float2" transform="translate(1228, 100)" opacity="0.65">
          <rect x="0" y="0" width="165" height="130" rx="8" fill="#030C22" opacity="0.75"/>
          <rect x="0" y="0" width="165" height="2"   rx="1" fill="#1A52A8" opacity="0.8"/>
          <text x="10" y="20" fontSize="10" fill="#60A5FA" fontFamily="monospace" opacity="0.7">AAPL · D</text>
          {[0,1,2,3,4,5,6,7,8,9].map(i => {
            const isUp = [0,2,3,5,6,8,9].includes(i)
            const h = 18 + (i * 11) % 34
            const y2 = 55 + (i * 7) % 28
            const x2 = 12 + i * 15
            return (
              <g key={i} className="dk-candle">
                <rect x={x2} y={y2} width={9} height={h} rx={1}
                  fill={isUp?'#1D6AD4':'#44446A'} opacity={0.65}/>
                <line x1={x2+4.5} y1={y2-5} x2={x2+4.5} y2={y2}
                  stroke={isUp?'#3A8AF8':'#66668A'} strokeWidth={1} opacity={0.5}/>
                <line x1={x2+4.5} y1={y2+h} x2={x2+4.5} y2={y2+h+5}
                  stroke={isUp?'#3A8AF8':'#66668A'} strokeWidth={1} opacity={0.5}/>
              </g>
            )
          })}
        </g>

        {/* Market tickers — top right area */}
        <g className="dk-ticker" transform="translate(1100, 70)" opacity="0.6">
          <text fontSize="11" fill="#22C55E" fontFamily="monospace">+4.35%</text>
        </g>
        <g className="dk-ticker2" transform="translate(1130, 92)" opacity="0.5">
          <text fontSize="10" fill="#60A5FA" fontFamily="monospace">+2.24%</text>
        </g>
        <g className="dk-ticker" transform="translate(1115, 112)" opacity="0.4">
          <text fontSize="9"  fill="#F59E0B" fontFamily="monospace">−1.08%</text>
        </g>

        {/* Room pillars — window frame */}
        <rect x="0"    y="0" width="28"   height="660" fill="#000308" opacity="0.96"/>
        <rect x="1412" y="0" width="28"   height="660" fill="#000308" opacity="0.96"/>
        <rect x="0"    y="0" width="1440" height="12"  fill="#000308" opacity="0.96"/>
        {/* Pillar edge trim */}
        <rect x="27"   y="12" width="1.5" height="648" fill="#0E2040" opacity="0.6"/>
        <rect x="1412" y="12" width="1.5" height="648" fill="#0E2040" opacity="0.6"/>

        {/* Side vignettes */}
        <rect x="0"    y="0" width="240"  height="660" fill="url(#g-side-l)"/>
        <rect x="1200" y="0" width="240"  height="660" fill="url(#g-side-r)"/>

        {/* Bottom & top fades */}
        <rect width="1440" height="660" fill="url(#g-bottom)"/>
        <rect width="1440" height="660" fill="url(#g-top)"/>
      </svg>

      {/* ── Hero text overlay ────────────────────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10 pb-8 px-6"
        style={{ paddingTop: 'min(12vh, 80px)' }}>

        {/* Eyebrow label */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-px bg-blue-500/40"/>
          <span className="text-blue-400/50 text-[11px] font-bold uppercase tracking-[0.25em]">
            {isHe ? 'חדר המחקר שלך' : 'Your Research Desk'}
          </span>
          <div className="w-8 h-px bg-blue-500/40"/>
        </div>

        {/* Main title */}
        <h1 className="font-black text-white tracking-tight leading-none mb-4"
          style={{ fontSize: 'clamp(2.2rem, 6vw, 4.5rem)', textShadow: '0 2px 40px rgba(0,0,0,0.8)' }}
          dir={isHe ? 'rtl' : 'ltr'}>
          {isHe ? (
            <>
              חדר המחקר של{' '}
              <span style={{
                color: '#60A5FA',
                textShadow: '0 0 60px rgba(96,165,250,0.5), 0 0 120px rgba(59,130,246,0.25)',
              }}>
                {firstName}
              </span>
            </>
          ) : (
            <>
              <span style={{
                color: '#60A5FA',
                textShadow: '0 0 60px rgba(96,165,250,0.5), 0 0 120px rgba(59,130,246,0.25)',
              }}>
                {firstName}
              </span>
              {'\'s Research Desk'}
            </>
          )}
        </h1>

        {/* Subtitle */}
        <p className="text-gray-400/70 text-base md:text-lg max-w-lg leading-relaxed"
          style={{ textShadow: '0 1px 12px rgba(0,0,0,0.9)' }}>
          {isHe
            ? 'כל החברות, המחקרים והתובנות שלך — במקום אחד.'
            : 'All your companies, research and insights — in one place.'}
        </p>

        {/* Decorative micro-chart accent */}
        <div className="mt-6 flex items-end gap-[3px] opacity-35">
          {[2,4,3,6,5,7,6,8,7,9,8,10,9,11,10,12].map((h, i) => (
            <div key={i} className="w-[3px] rounded-full"
              style={{ height: `${h * 2.5}px`, background: i > 10 ? '#60A5FA' : '#1D4ED8', opacity: 0.5 + i * 0.03 }}/>
          ))}
        </div>
      </div>

      {/* Scroll-down hint */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 opacity-25">
        <div className="w-px h-8 bg-gradient-to-b from-transparent to-blue-400"/>
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400"/>
      </div>
    </div>
  )
}

// ── Left Sidebar ──────────────────────────────────────────────────────────────

function LeftSidebar({ collections, activeId, onSelect, recentCount, t, isHe }: {
  collections: Collection[]; activeId: string | null; onSelect: (id: string | null) => void
  recentCount: number; t: Record<string,string>; isHe: boolean
}) {
  const defaults = collections.filter(c => c.isDefault)
  const custom   = collections.filter(c => !c.isDefault)

  function NavItem({ id, icon, label, count, color }: {
    id: string | null; icon: string; label: string; count: number; color?: string
  }) {
    const active = activeId === id
    const cc = color ? COLL_COLOR[color] : null
    return (
      <button onClick={() => onSelect(id === activeId ? null : id)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
          active
            ? `${cc?.bg ?? 'bg-blue-500/10'} ${cc?.text ?? 'text-blue-300'} font-semibold`
            : 'text-gray-600 hover:bg-white/[0.04] hover:text-gray-300'
        }`}
      >
        <span className="text-sm flex-shrink-0">{icon}</span>
        <span className="flex-1 text-start truncate">{label}</span>
        {count > 0 && (
          <span className={`text-[10px] font-mono rounded-full px-1.5 py-0.5 min-w-[1.2rem] text-center ${
            active ? 'bg-white/10' : 'bg-white/[0.05] text-gray-700'
          }`}>{count}</span>
        )}
      </button>
    )
  }

  return (
    <aside className="hidden lg:flex flex-col gap-0.5 pt-2">
      <p className="text-gray-700 text-[9px] font-bold uppercase tracking-[0.18em] px-3 mb-2">
        {isHe ? 'סקירה' : 'Overview'}
      </p>
      <NavItem id={null}    icon="🏠" label={isHe ? 'חדר המחקר' : 'Research Desk'} count={0}/>
      <NavItem id="recent"  icon="🕐" label={isHe ? 'צפייה אחרונה' : 'Recently Viewed'} count={recentCount}/>

      <p className="text-gray-700 text-[9px] font-bold uppercase tracking-[0.18em] px-3 mb-2 mt-5">
        {t.coll_header}
      </p>
      {defaults.map(c => (
        <NavItem key={c.id} id={c.id} icon={c.icon}
          label={isHe ? c.nameHe : c.name} count={c.companies.length} color={c.color}/>
      ))}

      {custom.length > 0 && (<>
        <p className="text-gray-700 text-[9px] font-bold uppercase tracking-[0.18em] px-3 mb-2 mt-5">
          {t.coll_my_collections}
        </p>
        {custom.map(c => (
          <NavItem key={c.id} id={c.id} icon={c.icon} label={c.name} count={c.companies.length} color={c.color}/>
        ))}
      </>)}
    </aside>
  )
}

// ── Company card ──────────────────────────────────────────────────────────────

function CompanyCard({ entry, onSave, t, isHe }: {
  entry: CollectionEntry; onSave: (t: SaveTarget) => void; t: Record<string,string>; isHe: boolean
}) {
  const sc = scoreColor(entry.score); const sb = scoreBg(entry.score)
  return (
    <div className="group flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.025]
      hover:border-blue-500/20 hover:bg-white/[0.045] hover:shadow-[0_0_24px_rgba(59,130,246,0.07)]
      backdrop-blur-sm transition-all cursor-default">
      <div className={`w-11 h-11 rounded-xl border flex-shrink-0 flex items-center justify-center ${sc} ${sb}`}>
        <span className={`text-sm font-black ${sc.split(' ')[0]}`}>{entry.score ?? '—'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-gray-200 text-sm font-semibold truncate">{entry.name}</p>
        <p className="text-gray-700 text-xs font-mono">{entry.symbol}{entry.sector ? ` · ${entry.sector}` : ''}</p>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onSave({ symbol: entry.symbol, name: entry.name, score: entry.score, sector: entry.sector })}
          className="text-gray-700 hover:text-blue-400 text-sm transition p-1" title={t.qa_save}>☆</button>
        <Link to={`/company/${entry.symbol}`}
          className="text-gray-600 hover:text-white text-xs font-semibold transition px-2.5 py-1.5 rounded-lg
            bg-white/[0.05] hover:bg-blue-500/20 border border-white/[0.08] hover:border-blue-500/30">
          {isHe ? 'פתח' : 'Open'}
        </Link>
      </div>
    </div>
  )
}

// ── Mission onboarding ────────────────────────────────────────────────────────

function MissionCards({ isHe, onWatchlist }: { isHe: boolean; onWatchlist: () => void }) {
  const missions = isHe ? [
    { icon: '🔭', title: 'הוסף חברה למעקב', sub: 'שמור חברות מעניינות למעקב עתידי', cta: 'התחל עכשיו', accent: 'blue', action: onWatchlist },
    { icon: '🔬', title: 'התחל ניתוח חברה', sub: 'בצע ניתוח מעמיק של חברה', cta: 'חפש חברה', accent: 'teal', href: '/' },
    { icon: '📊', title: 'צור מעקב תיק השקעות', sub: 'הוסף את החברות שלך למעקב וביצועים', cta: 'בנה תיק', accent: 'violet', href: '/' },
  ] : [
    { icon: '🔭', title: 'Add a Company to Watch', sub: 'Save interesting companies for future tracking', cta: 'Get Started', accent: 'blue', action: onWatchlist },
    { icon: '🔬', title: 'Analyze a Company', sub: 'Run a deep analysis on any company', cta: 'Search', accent: 'teal', href: '/' },
    { icon: '📊', title: 'Build a Portfolio Tracker', sub: 'Track your holdings and performance', cta: 'Build', accent: 'violet', href: '/' },
  ]
  const A: Record<string, string> = {
    blue:   'hover:border-blue-500/30   hover:shadow-[0_0_32px_rgba(59,130,246,0.10)]',
    teal:   'hover:border-teal-500/30   hover:shadow-[0_0_32px_rgba(20,184,166,0.10)]',
    violet: 'hover:border-violet-500/30 hover:shadow-[0_0_32px_rgba(139,92,246,0.10)]',
  }
  const AC: Record<string, string> = {
    blue:   'text-blue-400   bg-blue-500/10   border-blue-500/25   hover:bg-blue-500/20',
    teal:   'text-teal-400   bg-teal-500/10   border-teal-500/25   hover:bg-teal-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/20',
  }
  const IC: Record<string, string> = { blue:'text-blue-400', teal:'text-teal-300', violet:'text-violet-400' }

  return (
    <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-6 md:p-8">
      <p className="text-blue-400/50 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
        {isHe ? 'בחר את המשימה הראשונה שלך' : 'Choose Your First Mission'}
      </p>
      <h2 className="text-gray-200 text-base font-bold mb-6">
        {isHe ? 'ברוך הבא לחדר המחקר שלך.' : 'Welcome to your Research Desk.'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {missions.map((m, i) => {
          const card = (
            <div className={`flex flex-col gap-4 p-5 rounded-2xl border border-white/[0.07] bg-white/[0.02]
              ${A[m.accent]} backdrop-blur-sm transition-all cursor-pointer h-full`}>
              <span className={`text-2xl ${IC[m.accent]}`}>{m.icon}</span>
              <div className="flex-1">
                <p className="text-gray-100 text-sm font-bold mb-1">{m.title}</p>
                <p className="text-gray-600 text-xs leading-relaxed">{m.sub}</p>
              </div>
              <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border w-fit transition-colors ${AC[m.accent]}`}>
                {m.cta}
              </span>
            </div>
          )
          return m.href
            ? <Link key={i} to={m.href} className="h-full">{card}</Link>
            : <button key={i} onClick={m.action} className="h-full text-start">{card}</button>
        })}
      </div>
    </div>
  )
}

// ── Stat cards ────────────────────────────────────────────────────────────────

function StatCards({ recentCount, totalSaved, watchlistCount, t }: {
  recentCount: number; totalSaved: number; watchlistCount: number; t: Record<string,string>
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: t.desk_stats_companies,  value: recentCount,    icon: '🔍', color: 'text-blue-400'    },
        { label: t.desk_stats_saved,      value: totalSaved,     icon: '⭐', color: 'text-amber-400'   },
        { label: t.desk_stats_watchlist,  value: watchlistCount, icon: '📋', color: 'text-emerald-400' },
        { label: t.desk_coming_portfolio, value: 0,              icon: '📊', color: 'text-violet-400', soon: true },
      ].map(({ label, value, icon, color, soon }) => (
        <div key={label} className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4
          hover:border-white/[0.12] hover:bg-white/[0.04] backdrop-blur-sm transition-all
          ${soon ? 'opacity-30' : ''}`}>
          <div className="text-lg mb-2">{icon}</div>
          <div className={`text-2xl font-black ${color}`}>{value}</div>
          <div className="text-gray-700 text-xs mt-1 leading-snug">{label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Right panel ───────────────────────────────────────────────────────────────

function RightPanel({ activity, t, isHe }: { activity: ActivityItem[]; t: Record<string,string>; isHe: boolean }) {
  const dot: Record<string,string> = { researched:'bg-blue-500', saved:'bg-emerald-500', removed:'bg-gray-600', noted:'bg-violet-500' }
  const lbl: Record<string,string> = {
    researched: t.desk_activity_researched, saved: t.desk_activity_saved,
    removed: t.desk_activity_removed, noted: isHe ? 'הוספת הערה על' : 'Added note for',
  }
  return (
    <aside className="hidden xl:flex flex-col gap-6 pt-2">
      <div>
        <p className="text-gray-700 text-[9px] font-bold uppercase tracking-[0.18em] mb-3">{t.desk_activity_title}</p>
        {activity.length === 0
          ? <p className="text-gray-800 text-xs">{t.desk_activity_empty}</p>
          : <div className="space-y-2.5">
              {activity.slice(0, 12).map(item => (
                <div key={item.id} className="flex items-start gap-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${dot[item.type] ?? 'bg-gray-600'}`}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-500 text-[11px] leading-snug">{lbl[item.type]} {item.companyName ?? item.symbol ?? ''}</p>
                    <p className="text-gray-800 text-[10px] mt-0.5">{timeAgo(item.timestamp, isHe)}</p>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
      <div>
        <p className="text-gray-700 text-[9px] font-bold uppercase tracking-[0.18em] mb-3">{t.desk_coming_title}</p>
        <div className="space-y-2">
          {[
            { icon:'📊', key:'desk_coming_portfolio' },
            { icon:'🔔', key:'desk_coming_alerts' },
            { icon:'🎯', key:'desk_coming_score_alerts' },
            { icon:'📋', key:'desk_coming_report' },
            { icon:'🤖', key:'desk_coming_ai' },
          ].map(({ icon, key }) => (
            <div key={key} className="flex items-center gap-3 rounded-xl px-3 py-2.5 border border-white/[0.04] bg-white/[0.015]
              hover:border-white/[0.07] hover:bg-white/[0.03] transition-colors">
              <span className="text-sm">{icon}</span>
              <span className="text-gray-700 text-[11px] flex-1">{t[key]}</span>
              <span className="text-gray-800 text-[9px] border border-gray-800 rounded-full px-2 py-0.5 flex-shrink-0">{t.desk_coming_badge}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

// ── Main workspace ────────────────────────────────────────────────────────────

function MainWorkspace({ collections, activeId, recentCompanies, totalSaved, onSave, onSelectWatchlist, t, isHe }: {
  collections: Collection[]; activeId: string | null
  recentCompanies: { symbol: string; name: string; score: number | null; sector: string | null; lastViewed: string }[]
  totalSaved: number; onSave: (t: SaveTarget) => void; onSelectWatchlist: () => void
  t: Record<string,string>; isHe: boolean
}) {
  if (activeId === 'recent') return (
    <div>
      <h2 className="text-gray-300 font-bold text-sm mb-4">{isHe ? 'צפייה אחרונה' : 'Recently Viewed'}</h2>
      {recentCompanies.length === 0
        ? <EmptyState icon="🔍" text={t.desk_recent_empty} sub={t.desk_recent_empty_sub}
            cta={<Link to="/" className="inline-block bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 text-blue-300 text-sm font-semibold px-5 py-2.5 rounded-xl transition">{isHe ? 'חפש חברה' : 'Search a Company'}</Link>}/>
        : <div className="space-y-2">{recentCompanies.map(c => <CompanyCard key={c.symbol} entry={{...c,addedAt:c.lastViewed}} onSave={onSave} t={t} isHe={isHe}/>)}</div>
      }
    </div>
  )

  if (activeId) {
    const coll = collections.find(c => c.id === activeId)
    if (!coll) return null
    const cc = COLL_COLOR[coll.color] ?? COLL_COLOR.gray
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{coll.icon}</span>
          <div>
            <h2 className="text-gray-100 font-bold text-base">{isHe ? coll.nameHe : coll.name}</h2>
            <p className="text-gray-700 text-xs">{coll.companies.length} {isHe ? 'חברות' : 'companies'}</p>
          </div>
        </div>
        {coll.companies.length === 0
          ? <EmptyState icon={coll.icon} text={t.coll_empty}
              cta={<Link to="/" className={`inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition border ${cc.bg} ${cc.text} border-current/20 hover:opacity-80`}>{isHe ? 'גלה חברות' : 'Discover Companies'}</Link>}/>
          : <div className="space-y-2">{coll.companies.map(entry => <CompanyCard key={entry.symbol} entry={entry} onSave={onSave} t={t} isHe={isHe}/>)}</div>
        }
      </div>
    )
  }

  const allSaved = new Map<string, CollectionEntry>()
  collections.forEach(c => c.companies.forEach(co => { if (!allSaved.has(co.symbol)) allSaved.set(co.symbol, co) }))
  const uniqueCompanies = [...allSaved.values()].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())

  return (
    <div className="space-y-8">
      <StatCards recentCount={recentCompanies.length} totalSaved={totalSaved}
        watchlistCount={collections.find(c=>c.id==='watchlist')?.companies.length ?? 0} t={t}/>

      {recentCompanies.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-gray-400 font-bold text-xs uppercase tracking-widest">{t.desk_recent_title}</h2>
            <Link to="/" className="text-blue-500/60 hover:text-blue-300 text-xs transition">{isHe ? 'חפש עוד' : 'Search more'}</Link>
          </div>
          <div className="space-y-2">{recentCompanies.slice(0,5).map(c => <CompanyCard key={c.symbol} entry={{...c,addedAt:c.lastViewed}} onSave={onSave} t={t} isHe={isHe}/>)}</div>
        </section>
      )}

      {uniqueCompanies.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-gray-400 font-bold text-xs uppercase tracking-widest">{t.desk_all_companies}</h2>
            <span className="text-gray-700 text-xs">{uniqueCompanies.length}</span>
          </div>
          <div className="space-y-2">{uniqueCompanies.slice(0,8).map(entry => <CompanyCard key={entry.symbol} entry={entry} onSave={onSave} t={t} isHe={isHe}/>)}</div>
        </section>
      )}

      {recentCompanies.length === 0 && uniqueCompanies.length === 0 && (
        <MissionCards isHe={isHe} onWatchlist={onSelectWatchlist}/>
      )}
    </div>
  )
}

function EmptyState({ icon, text, sub, cta }: { icon: string; text: string; sub?: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] px-6 py-12 text-center">
      <div className="text-4xl mb-3 opacity-40">{icon}</div>
      <p className="text-gray-500 text-sm font-medium">{text}</p>
      {sub && <p className="text-gray-700 text-xs mt-1">{sub}</p>}
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Desk() {
  const { user } = useAuth()
  const { collections, recentCompanies, activity, totalSaved } = useUserData()
  const { t, isHe } = useLanguage()
  const [activeId, setActiveId]   = useState<string | null>(null)
  const [saveModal, setSaveModal] = useState<SaveTarget | null>(null)
  const firstName = user ? getFirstName(user as any) : ''

  return (
    <div className="min-h-screen" style={{ background: '#000308' }} dir={isHe ? 'rtl' : 'ltr'}>

      {/* Sticky nav */}
      <div className="sticky top-0 z-40 border-b border-white/[0.05]"
        style={{ background: 'rgba(0,3,8,0.88)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex-1 max-w-sm"><SearchBar /></div>
          <div className="flex items-center gap-2 ms-auto">
            <LanguageToggle />
            <UserMenu />
          </div>
        </div>
      </div>

      {/* Cinematic hero */}
      <DeskHero firstName={firstName} isHe={isHe}/>

      {/* Content */}
      <div className="max-w-screen-2xl mx-auto px-4 py-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] xl:grid-cols-[200px_1fr_260px] gap-6">
          <LeftSidebar
            collections={collections} activeId={activeId} onSelect={setActiveId}
            recentCount={recentCompanies.length} t={t as any} isHe={isHe}/>
          <MainWorkspace
            collections={collections} activeId={activeId} recentCompanies={recentCompanies}
            totalSaved={totalSaved} onSave={t => setSaveModal(t)}
            onSelectWatchlist={() => setActiveId('watchlist')} t={t as any} isHe={isHe}/>
          <RightPanel activity={activity} t={t as any} isHe={isHe}/>
        </div>
      </div>

      {saveModal && <SaveModal isOpen onClose={() => setSaveModal(null)} company={saveModal}/>}
    </div>
  )
}
