import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

const COLL_COLOR: Record<string, { bg: string; text: string; dot: string; glow: string }> = {
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-500',    glow: 'shadow-blue-500/10'    },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-500',   glow: 'shadow-amber-500/10'   },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500', glow: 'shadow-emerald-500/10' },
  rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-400',    dot: 'bg-rose-500',    glow: 'shadow-rose-500/10'    },
  gray:    { bg: 'bg-gray-500/10',    text: 'text-gray-400',    dot: 'bg-gray-500',    glow: 'shadow-gray-500/10'    },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-400',  dot: 'bg-violet-500',  glow: 'shadow-violet-500/10'  },
  teal:    { bg: 'bg-teal-500/10',    text: 'text-teal-400',    dot: 'bg-teal-500',    glow: 'shadow-teal-500/10'    },
  orange:  { bg: 'bg-orange-500/10',  text: 'text-orange-400',  dot: 'bg-orange-500',  glow: 'shadow-orange-500/10'  },
}

// ── Cinematic hero ────────────────────────────────────────────────────────────

function DeskHero({ firstName, subtitle, isHe }: { firstName: string; subtitle: string; isHe: boolean }) {
  return (
    <div className="relative h-72 md:h-96 overflow-hidden select-none">
      {/* SVG cinematic scene */}
      <svg
        viewBox="0 0 1400 480"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          {/* Deep night sky */}
          <linearGradient id="h-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#01020A"/>
            <stop offset="40%"  stopColor="#040B1F"/>
            <stop offset="75%"  stopColor="#071428"/>
            <stop offset="100%" stopColor="#0A0C18"/>
          </linearGradient>
          {/* Blue financial district glow */}
          <radialGradient id="h-blueGlow" cx="50%" cy="85%" r="70%">
            <stop offset="0%"   stopColor="#1A4B9C" stopOpacity="0.35"/>
            <stop offset="50%"  stopColor="#0D2B60" stopOpacity="0.15"/>
            <stop offset="100%" stopColor="#1A4B9C" stopOpacity="0"/>
          </radialGradient>
          {/* Amber horizon warmth */}
          <radialGradient id="h-horizon" cx="50%" cy="100%" r="55%">
            <stop offset="0%"   stopColor="#B86020" stopOpacity="0.20"/>
            <stop offset="100%" stopColor="#B86020" stopOpacity="0"/>
          </radialGradient>
          {/* Monitor glow */}
          <radialGradient id="h-monC" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#0E2550" stopOpacity="1"/>
            <stop offset="100%" stopColor="#040A1C" stopOpacity="1"/>
          </radialGradient>
          <radialGradient id="h-monS" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#091C42" stopOpacity="1"/>
            <stop offset="100%" stopColor="#030810" stopOpacity="1"/>
          </radialGradient>
          {/* Vignette / bottom fade */}
          <linearGradient id="h-vignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#01020A" stopOpacity="0.6"/>
            <stop offset="50%"  stopColor="#01020A" stopOpacity="0"/>
            <stop offset="85%"  stopColor="#01020A" stopOpacity="0"/>
            <stop offset="100%" stopColor="#01020A" stopOpacity="1"/>
          </linearGradient>
          {/* Side vignette */}
          <linearGradient id="h-sideL" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#01020A" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#01020A" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="h-sideR" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#01020A" stopOpacity="0"/>
            <stop offset="100%" stopColor="#01020A" stopOpacity="0.9"/>
          </linearGradient>
          {/* Chart line gradient */}
          <linearGradient id="h-chartLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#1D6AD4" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.8"/>
          </linearGradient>
          <linearGradient id="h-chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1D6AD4" stopOpacity="0.15"/>
            <stop offset="100%" stopColor="#1D6AD4" stopOpacity="0"/>
          </linearGradient>
          <filter id="h-blur4"><feGaussianBlur stdDeviation="4"/></filter>
          <filter id="h-blur8"><feGaussianBlur stdDeviation="8"/></filter>
          <filter id="h-blur16"><feGaussianBlur stdDeviation="16"/></filter>
          <filter id="h-blur24"><feGaussianBlur stdDeviation="24"/></filter>
        </defs>

        {/* Sky base */}
        <rect width="1400" height="480" fill="url(#h-sky)"/>

        {/* Blue financial district atmospheric glow */}
        <rect width="1400" height="480" fill="url(#h-blueGlow)"/>
        <rect width="1400" height="480" fill="url(#h-horizon)"/>

        {/* Subtle grid overlay — financial chart feel */}
        {[80,160,240,320,400,480].map(y => (
          <line key={`gh-${y}`} x1="0" y1={y} x2="1400" y2={y} stroke="#1A3A7A" strokeWidth="0.4" opacity="0.15"/>
        ))}
        {[140,280,420,560,700,840,980,1120,1260].map(x => (
          <line key={`gv-${x}`} x1={x} y1="0" x2={x} y2="480" stroke="#1A3A7A" strokeWidth="0.4" opacity="0.10"/>
        ))}

        {/* Stars — layered depth */}
        {[
          [60,18,0.6],[130,12,0.8],[210,28,0.5],[310,10,0.9],[420,22,0.6],
          [500,8,0.7],[580,30,0.5],[660,6,0.8],[750,18,0.6],[840,28,0.7],
          [920,12,0.8],[1000,22,0.5],[1090,15,0.9],[1170,28,0.6],[1260,10,0.7],[1350,20,0.8],
          [95,55,0.4],[230,48,0.6],[380,62,0.5],[550,44,0.7],[720,58,0.4],[900,46,0.6],[1080,56,0.5],[1260,50,0.7],
          [170,85,0.3],[490,78,0.5],[810,90,0.4],[1150,76,0.5],
          [340,105,0.3],[680,95,0.4],[1020,108,0.3],
        ].map(([cx, cy, op], i) => (
          <circle key={i} cx={cx} cy={cy} r={i % 5 === 0 ? 1.4 : i % 3 === 0 ? 1.0 : 0.6} fill="white" opacity={op}/>
        ))}

        {/* Moon — subtle */}
        <circle cx="1280" cy="40" r="22" fill="#0A1628" opacity="0.95"/>
        <circle cx="1280" cy="40" r="20" fill="#C8D8F8" opacity="0.08"/>
        <circle cx="1287" cy="36" r="14" fill="#01020A" opacity="0.9"/>

        {/* Distant city haze glow */}
        <ellipse cx="700" cy="340" rx="500" ry="120" fill="#1A4B9C" opacity="0.08" filter="url(#h-blur24)"/>
        <ellipse cx="700" cy="380" rx="600" ry="80" fill="#0D2B60" opacity="0.18" filter="url(#h-blur16)"/>

        {/* ── Skyline — dense financial district ── */}
        {/* Back layer buildings (lighter, more distant) */}
        <g opacity="0.4">
          <rect x="0"    y="310" width="30"  height="170" fill="#0D1528"/>
          <rect x="35"   y="280" width="25"  height="200" fill="#0D1528"/>
          <rect x="65"   y="300" width="40"  height="180" fill="#0D1528"/>
          <rect x="110"  y="260" width="35"  height="220" fill="#0D1528"/>
          <rect x="150"  y="240" width="28"  height="240" fill="#0D1528"/>
          <rect x="183"  y="270" width="45"  height="210" fill="#0D1528"/>
          <rect x="233"  y="250" width="32"  height="230" fill="#0D1528"/>
          <rect x="270"  y="230" width="38"  height="250" fill="#0D1528"/>
          <rect x="314"  y="255" width="30"  height="225" fill="#0D1528"/>
          {/* Continue across */}
          <rect x="1060" y="270" width="35"  height="210" fill="#0D1528"/>
          <rect x="1100" y="250" width="42"  height="230" fill="#0D1528"/>
          <rect x="1148" y="265" width="30"  height="215" fill="#0D1528"/>
          <rect x="1183" y="245" width="38"  height="235" fill="#0D1528"/>
          <rect x="1226" y="275" width="28"  height="205" fill="#0D1528"/>
          <rect x="1259" y="290" width="45"  height="190" fill="#0D1528"/>
          <rect x="1310" y="305" width="35"  height="175" fill="#0D1528"/>
          <rect x="1350" y="280" width="50"  height="200" fill="#0D1528"/>
        </g>

        {/* Front skyline — main silhouette */}
        <polygon fill="#070A16" points="
          0,480 0,370 30,370 30,340 50,340 50,318 70,318 70,300 95,300 95,285
          115,285 115,268 130,268 130,252 148,252 148,240 165,240 165,256
          185,256 185,270 200,270 200,252 220,252 220,235 238,235 238,220
          255,220 255,208 270,208 270,196 285,196 285,208 300,208 300,222
          318,222 318,238 335,238 335,250 350,250 350,235 368,235 368,218
          385,218 385,204 400,204 400,190 415,190 415,178 430,178 430,165
          448,165 448,178 463,178 463,195 480,195 480,210 495,210 495,225
          510,225 510,240 525,240 525,226 540,226 540,212 555,212 555,198
          570,198 570,185 585,185 585,172 600,172 600,160 615,160 615,148
          630,148 630,160 645,160 645,175 660,175 660,188 675,188 675,178
          690,178 690,165 705,165 705,155 720,155 720,145 735,145 735,158
          750,158 750,170 765,170 765,183 780,183 780,195 795,195 795,210
          810,210 810,222 825,222 825,210 840,210 840,198 855,198 855,185
          870,185 870,172 885,172 885,160 900,160 900,148 915,148 915,160
          930,160 930,175 945,175 945,190 960,190 960,205 975,205 975,218
          990,218 990,232 1005,232 1005,218 1020,218 1020,205 1035,205
          1035,192 1050,192 1050,180 1065,180 1065,192 1080,192 1080,208
          1095,208 1095,222 1110,222 1110,235 1125,235 1125,248 1140,248
          1140,262 1155,262 1155,275 1170,275 1170,260 1185,260 1185,244
          1200,244 1200,258 1215,258 1215,270 1230,270 1230,285 1248,285
          1248,298 1265,298 1265,312 1280,312 1280,325 1300,325 1300,340
          1325,340 1325,358 1350,358 1350,370 1400,370 1400,480
        "/>

        {/* Building window lights — blue/white and amber mix */}
        {[
          // Left cluster
          [120,260],[121,253],[135,244],[149,248],[155,248],[165,250],[166,244],
          [225,228],[232,228],[242,222],[256,214],[264,208],[271,200],[278,202],
          [290,200],[300,215],[305,224],
          // Center financial district
          [390,195],[398,185],[415,182],[430,170],[438,168],[448,170],[457,168],
          [540,215],[548,202],[558,188],[568,176],[579,164],[590,152],[600,155],
          [615,152],[621,162],[630,152],[638,160],[645,162],[650,168],
          [665,180],[674,178],[682,170],[690,158],[700,148],[710,148],[720,148],
          [730,150],[740,160],[748,162],[756,170],[764,178],[774,185],
          // Right cluster
          [870,175],[878,163],[888,150],[896,150],[904,152],[912,150],[919,162],
          [930,162],[938,177],[946,192],[955,196],[965,208],[974,210],[985,220],
          [1050,182],[1058,170],[1066,182],[1078,194],[1090,208],[1100,220],
          [1155,258],[1168,262],[1180,248],[1195,258],[1208,262],[1220,268],
          [1250,288],[1265,298],[1282,315],
        ].map(([x, y], i) => {
          const isBlue = i % 3 !== 2
          return <rect key={i} x={x} y={y} width={3} height={4} rx={0.5}
            fill={isBlue ? '#7AB3FF' : '#FFB84A'} opacity={0.15 + (i % 5) * 0.10}/>
        })}

        {/* Brighter prominent windows */}
        {[
          [270,196,5,6],[415,178,5,6],[600,160,5,6],[720,145,5,7],[900,148,5,6],
          [1050,180,5,6],[1250,285,5,5],
        ].map(([x,y,w,h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx={1}
            fill={i % 2 === 0 ? '#90C0FF' : '#FFD080'} opacity={0.5}/>
        ))}

        {/* Desk surface */}
        <polygon fill="#060810" points="100,480 200,418 1200,418 1300,480"/>
        <polygon fill="#0A0F1E" opacity="0.6" points="200,418 250,410 1150,410 1200,418"/>

        {/* Monitor ambient glow blobs */}
        <ellipse cx="470"  cy="388" rx="120" ry="40" fill="#1A5BC0" opacity="0.10" filter="url(#h-blur8)"/>
        <ellipse cx="700"  cy="375" rx="170" ry="55" fill="#1D6AD4" opacity="0.14" filter="url(#h-blur8)"/>
        <ellipse cx="930"  cy="388" rx="120" ry="40" fill="#1A5BC0" opacity="0.10" filter="url(#h-blur8)"/>

        {/* ── Monitors ── */}
        {/* Left monitor */}
        <rect x="390" y="302" width="170" height="110" rx="5" fill="#050C20"/>
        <rect x="393" y="305" width="164" height="104" rx="3" fill="#040918"/>
        <rect x="395" y="307" width="160" height="100" rx="2" fill="url(#h-monS)"/>
        {/* Chart on left monitor */}
        {[[398,388,18],[420,374,32],[442,382,24],[464,366,40],[486,358,48],[508,370,28],[530,364,34]].map(([x,y,h], i) => (
          <rect key={i} x={x} y={y} width={16} height={h} rx={1}
            fill="#2060B0" opacity={0.35 + i * 0.06}/>
        ))}
        <rect x="398" y="315" width="75"  height="2.5" rx="1" fill="#3A7AC8" opacity="0.4"/>
        <rect x="398" y="321" width="130" height="1.5" rx="1" fill="#1A4A90" opacity="0.3"/>
        <rect x="398" y="326" width="100" height="1.5" rx="1" fill="#1A4A90" opacity="0.2"/>
        {/* Stand */}
        <rect x="464" y="412" width="22" height="10" rx="2" fill="#040810"/>
        <rect x="452" y="420" width="46" height="4"  rx="2" fill="#040810"/>

        {/* Center monitor — larger, main screen */}
        <rect x="562" y="278" width="276" height="138" rx="5" fill="#050C20"/>
        <rect x="565" y="281" width="270" height="132" rx="3" fill="#030714"/>
        <rect x="567" y="283" width="266" height="128" rx="2" fill="url(#h-monC)"/>
        {/* UI chrome on center monitor */}
        <rect x="573" y="291" width="130" height="3.5" rx="2" fill="#3A82D8" opacity="0.6"/>
        <rect x="573" y="299" width="220" height="2"   rx="1" fill="#1A4A90" opacity="0.35"/>
        <rect x="573" y="304" width="180" height="1.5" rx="1" fill="#1A4A90" opacity="0.25"/>
        {/* Score badge */}
        <rect x="573" y="313" width="58" height="34" rx="5" fill="#0A1C42" opacity="0.95"/>
        <text x="580" y="336" fontSize="16" fill="#5BA3F8" fontFamily="monospace" fontWeight="bold" opacity="0.9">89</text>
        {/* Chart line — main uptrend */}
        <polyline
          points="573,394 605,378 637,386 669,366 701,374 733,350 765,358 797,338 820,344 828,340"
          fill="none" stroke="url(#h-chartLine)" strokeWidth="2.5" strokeLinejoin="round"/>
        <polygon
          points="573,394 605,378 637,386 669,366 701,374 733,350 765,358 797,338 820,344 828,340 828,410 573,410"
          fill="url(#h-chartFill)"/>
        {/* Secondary chart line */}
        <polyline
          points="573,402 605,395 637,400 669,390 701,396 733,382 765,388 797,374 828,380"
          fill="none" stroke="#3A7AC8" strokeWidth="1" strokeLinejoin="round" opacity="0.3"/>
        {/* Stand */}
        <rect x="687" y="416" width="26" height="8"  rx="2" fill="#040810"/>
        <rect x="674" y="422" width="52" height="4"  rx="2" fill="#040810"/>

        {/* Right monitor */}
        <rect x="838" y="302" width="170" height="110" rx="5" fill="#050C20"/>
        <rect x="841" y="305" width="164" height="104" rx="3" fill="#040918"/>
        <rect x="843" y="307" width="160" height="100" rx="2" fill="url(#h-monS)"/>
        <polyline
          points="847,392 870,376 893,386 916,364 939,378 962,356 985,368 1000,358"
          fill="none" stroke="#2A6AB8" strokeWidth="1.8" strokeLinejoin="round" opacity="0.6"/>
        <rect x="847" y="315" width="85"  height="2.5" rx="1" fill="#3A7AC8" opacity="0.4"/>
        <rect x="847" y="321" width="140" height="1.5" rx="1" fill="#1A4A90" opacity="0.3"/>
        {/* Stand */}
        <rect x="912" y="412" width="22" height="10" rx="2" fill="#040810"/>
        <rect x="900" y="420" width="46" height="4"  rx="2" fill="#040810"/>

        {/* Person silhouette — investor at desk */}
        <rect x="648" y="358" width="104" height="65" rx="12" fill="#040710" opacity="0.99"/>
        <path d="M 628,416 Q 700,365 772,416" fill="#050810"/>
        <rect x="692" y="332" width="16" height="30" fill="#050810"/>
        <circle cx="700" cy="308" r="28" fill="#050810"/>
        <ellipse cx="700" cy="408" rx="82" ry="24" fill="#050810"/>

        {/* Keyboard glow */}
        <rect x="618" y="420" width="164" height="6" rx="3" fill="#1A3A7A" opacity="0.18"/>

        {/* Room frame — window pillars */}
        <rect x="0"    y="0" width="80"   height="480" fill="#01020A" opacity="0.92"/>
        <rect x="1320" y="0" width="80"   height="480" fill="#01020A" opacity="0.92"/>
        <rect x="0"    y="0" width="1400" height="16"  fill="#01020A" opacity="0.92"/>
        {/* Pillar trim */}
        <rect x="78"   y="16" width="2" height="464" fill="#10203A" opacity="0.5"/>
        <rect x="1320" y="16" width="2" height="464" fill="#10203A" opacity="0.5"/>
        {/* Center mullion */}
        <rect x="697" y="16" width="6" height="380" fill="#01020A" opacity="0.55"/>
        {/* Horizontal sill */}
        <rect x="80" y="268" width="1240" height="3" fill="#0A1428" opacity="0.5"/>

        {/* Side vignettes */}
        <rect x="0"    y="0" width="200"  height="480" fill="url(#h-sideL)"/>
        <rect x="1200" y="0" width="200"  height="480" fill="url(#h-sideR)"/>

        {/* Final vignette */}
        <rect width="1400" height="480" fill="url(#h-vignette)"/>
      </svg>

      {/* Overlay: hero text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10 pb-6">
        {/* Subtitle / label above */}
        <p className="text-blue-400/60 text-xs font-semibold uppercase tracking-[0.2em] mb-3 drop-shadow">
          {isHe ? 'חדר המחקר שלך' : 'Your Research Desk'}
        </p>

        {/* Main headline */}
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-2xl" dir={isHe ? 'rtl' : 'ltr'}>
          {isHe ? (
            <>
              חדר המחקר של{' '}
              <span className="text-blue-400 drop-shadow-[0_0_24px_rgba(96,165,250,0.6)]">
                {firstName}
              </span>
            </>
          ) : (
            <>
              <span className="text-blue-400 drop-shadow-[0_0_24px_rgba(96,165,250,0.6)]">
                {firstName}
              </span>
              {'\'s Research Desk'}
            </>
          )}
        </h1>

        {/* Subtitle */}
        <p className="text-gray-400/80 text-sm md:text-base mt-3 max-w-md drop-shadow leading-relaxed">
          {subtitle}
        </p>

        {/* Decorative chart line hint */}
        <div className="mt-5 flex items-center gap-1 opacity-40">
          {[3,5,4,7,6,8,7,9,8,10,9,11,10].map((h, i) => (
            <div key={i} className="w-1 bg-blue-400 rounded-full transition-all" style={{ height: `${h * 2}px` }}/>
          ))}
        </div>
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
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
          active
            ? `${cc?.bg ?? 'bg-blue-500/10'} ${cc?.text ?? 'text-blue-300'} font-semibold shadow-sm`
            : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-200'
        }`}
      >
        <span className="text-base flex-shrink-0">{icon}</span>
        <span className="flex-1 text-start truncate">{label}</span>
        {count > 0 && (
          <span className={`text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center font-mono ${
            active ? 'bg-white/10 text-current' : 'bg-gray-800 text-gray-600'
          }`}>
            {count}
          </span>
        )}
      </button>
    )
  }

  return (
    <aside className="hidden lg:flex flex-col gap-0.5 pt-2">
      {/* Overview section */}
      <p className="text-gray-700 text-[10px] font-bold uppercase tracking-[0.15em] px-3 mb-2">
        {isHe ? 'סקירה' : 'Overview'}
      </p>
      <NavItem id={null}     icon="🏠" label={isHe ? 'חדר המחקר' : 'Research Desk'} count={0} />
      <NavItem id="recent"   icon="🕐" label={isHe ? 'צפייה אחרונה' : 'Recently Viewed'} count={recentCount} />

      {/* Default collections */}
      <p className="text-gray-700 text-[10px] font-bold uppercase tracking-[0.15em] px-3 mb-2 mt-5">
        {t.coll_header}
      </p>
      {defaults.map(c => (
        <NavItem key={c.id} id={c.id} icon={c.icon}
          label={isHe ? c.nameHe : c.name}
          count={c.companies.length} color={c.color}
        />
      ))}

      {/* Custom collections */}
      {custom.length > 0 && (
        <>
          <p className="text-gray-700 text-[10px] font-bold uppercase tracking-[0.15em] px-3 mb-2 mt-5">
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
  const sc  = scoreColor(entry.score)
  const sbg = scoreBg(entry.score)
  return (
    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.07] rounded-2xl p-4 flex items-center gap-4
      hover:border-blue-500/20 hover:bg-white/[0.05] hover:shadow-[0_0_20px_rgba(59,130,246,0.06)]
      transition-all group cursor-default">
      <div className={`w-11 h-11 rounded-xl border flex-shrink-0 flex items-center justify-center ${sc} ${sbg}`}>
        <span className={`text-sm font-black ${sc.split(' ')[0]}`}>{entry.score ?? '—'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-gray-100 text-sm font-semibold truncate">{entry.name}</p>
        <p className="text-gray-600 text-xs font-mono">{entry.symbol}{entry.sector ? ` · ${entry.sector}` : ''}</p>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onSave({ symbol: entry.symbol, name: entry.name, score: entry.score, sector: entry.sector })}
          className="text-gray-600 hover:text-blue-400 text-sm transition p-1"
          title={t.qa_save}
        >
          ☆
        </button>
        <Link
          to={`/company/${entry.symbol}`}
          className="text-gray-500 hover:text-white text-xs font-semibold transition px-2.5 py-1.5 rounded-lg
            bg-white/[0.06] hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30"
        >
          {isHe ? 'פתח' : 'Open'}
        </Link>
      </div>
    </div>
  )
}

// ── Mission cards (new-user onboarding) ──────────────────────────────────────

function MissionCards({ isHe, onWatchlist }: { isHe: boolean; onWatchlist: () => void }) {
  const missions = isHe ? [
    {
      icon: '🔭',
      title: 'הוסף חברה למעקב',
      sub: 'שמור חברות מעניינות למעקב עתידי',
      action: () => onWatchlist(),
      cta: 'התחל עכשיו',
      accent: 'blue',
    },
    {
      icon: '🔬',
      title: 'התחל ניתוח חברה',
      sub: 'בצע ניתוח מעמיק של חברה',
      href: '/',
      cta: 'חפש חברה',
      accent: 'emerald',
    },
    {
      icon: '📊',
      title: 'צור מעקב תיק השקעות',
      sub: 'הוסף את החברות שלך למעקב וביצועים',
      href: '/',
      cta: 'בנה תיק',
      accent: 'violet',
    },
  ] : [
    {
      icon: '🔭',
      title: 'Add a Company to Watch',
      sub: 'Save interesting companies for future tracking',
      action: () => onWatchlist(),
      cta: 'Get Started',
      accent: 'blue',
    },
    {
      icon: '🔬',
      title: 'Analyze a Company',
      sub: 'Run a deep analysis on any company',
      href: '/',
      cta: 'Search Company',
      accent: 'emerald',
    },
    {
      icon: '📊',
      title: 'Build a Portfolio Tracker',
      sub: 'Track your holdings and performance',
      href: '/',
      cta: 'Build Portfolio',
      accent: 'violet',
    },
  ]

  const accentMap = {
    blue:    { border: 'hover:border-blue-500/30',    glow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.10)]',   icon: 'text-blue-400',    cta: 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border-blue-500/20' },
    emerald: { border: 'hover:border-emerald-500/30', glow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.10)]',   icon: 'text-emerald-400', cta: 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border-emerald-500/20' },
    violet:  { border: 'hover:border-violet-500/30',  glow: 'hover:shadow-[0_0_30px_rgba(139,92,246,0.10)]',   icon: 'text-violet-400',  cta: 'bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 border-violet-500/20' },
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-3xl p-6 md:p-8">
      <p className="text-blue-400/60 text-xs font-bold uppercase tracking-[0.18em] mb-2">
        {isHe ? 'בחר את המשימה הראשונה שלך' : 'Choose Your First Mission'}
      </p>
      <h2 className="text-white text-lg font-bold mb-6">
        {isHe ? 'ברוך הבא לחדר המחקר שלך.' : 'Welcome to your Research Desk.'}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {missions.map((m, i) => {
          const ac = accentMap[m.accent as keyof typeof accentMap]
          const inner = (
            <div className={`
              bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-5
              ${ac.border} ${ac.glow} transition-all cursor-pointer h-full flex flex-col gap-3
            `}>
              <span className={`text-2xl ${ac.icon}`}>{m.icon}</span>
              <div className="flex-1">
                <p className="text-gray-100 text-sm font-bold leading-snug mb-1">{m.title}</p>
                <p className="text-gray-600 text-xs leading-relaxed">{m.sub}</p>
              </div>
              <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold border w-fit transition-colors ${ac.cta}`}>
                {m.cta}
              </span>
            </div>
          )

          return m.href ? (
            <Link key={i} to={m.href} className="h-full">{inner}</Link>
          ) : (
            <button key={i} onClick={m.action} className="h-full text-start">{inner}</button>
          )
        })}
      </div>
    </div>
  )
}

// ── Stat cards ────────────────────────────────────────────────────────────────

function StatCards({ recentCount, totalSaved, watchlistCount, t }: {
  recentCount: number; totalSaved: number; watchlistCount: number; t: Record<string, string>
}) {
  const stats = [
    { label: t.desk_stats_companies, value: recentCount, icon: '🔍', accent: 'blue'    },
    { label: t.desk_stats_saved,     value: totalSaved,  icon: '⭐', accent: 'amber'   },
    { label: t.desk_stats_watchlist, value: watchlistCount, icon: '📋', accent: 'emerald' },
    { label: t.desk_coming_portfolio, value: 0, icon: '📊', accent: 'violet', soon: true },
  ]
  const colorMap = {
    blue:    'text-blue-400',
    amber:   'text-amber-400',
    emerald: 'text-emerald-400',
    violet:  'text-violet-400',
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ label, value, icon, accent, soon }) => (
        <div key={label} className={`
          bg-white/[0.03] backdrop-blur-sm border border-white/[0.07] rounded-2xl p-4
          hover:border-white/[0.12] hover:bg-white/[0.05] transition-all
          ${soon ? 'opacity-35' : ''}
        `}>
          <div className="text-lg mb-2">{icon}</div>
          <div className={`text-2xl font-black ${colorMap[accent as keyof typeof colorMap]}`}>{value}</div>
          <div className="text-gray-600 text-xs mt-1 leading-snug">{label}</div>
        </div>
      ))}
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
      {/* Activity feed */}
      <div>
        <p className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.15em] mb-3">
          {t.desk_activity_title}
        </p>
        {activity.length === 0 ? (
          <p className="text-gray-700 text-xs px-1">{t.desk_activity_empty}</p>
        ) : (
          <div className="space-y-2.5">
            {activity.slice(0, 12).map(item => (
              <div key={item.id} className="flex items-start gap-2.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${activityDot[item.type] ?? 'bg-gray-600'}`}/>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-400 text-xs leading-snug">
                    {activityLabel[item.type]} {item.companyName ?? item.symbol ?? ''}
                  </p>
                  <p className="text-gray-700 text-xs mt-0.5">{timeAgo(item.timestamp, isHe)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coming soon */}
      <div>
        <p className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.15em] mb-3">
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
            <div key={key}
              className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2.5
                hover:bg-white/[0.04] hover:border-white/[0.08] transition-colors"
            >
              <span className="text-sm">{icon}</span>
              <span className="text-gray-600 text-xs flex-1">{t[key]}</span>
              <span className="text-gray-700 text-[10px] border border-gray-800/80 rounded-full px-2 py-0.5 flex-shrink-0">
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
  collections, activeId, recentCompanies, totalSaved, onSave, onSelectWatchlist, t, isHe,
}: {
  collections: Collection[]
  activeId: string | null
  recentCompanies: { symbol: string; name: string; score: number | null; sector: string | null; lastViewed: string }[]
  totalSaved: number
  onSave: (target: SaveTarget) => void
  onSelectWatchlist: () => void
  t: Record<string, string>
  isHe: boolean
}) {
  if (activeId === 'recent') {
    return (
      <div>
        <h2 className="text-gray-200 font-bold text-sm mb-4">{isHe ? 'צפייה אחרונה' : 'Recently Viewed'}</h2>
        {recentCompanies.length === 0 ? (
          <EmptyState icon="🔍" text={t.desk_recent_empty} sub={t.desk_recent_empty_sub}
            cta={<Link to="/" className="inline-block bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-sm font-semibold px-5 py-2.5 rounded-xl transition">
              {isHe ? 'חפש חברה' : 'Search a Company'}
            </Link>}
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
            <h2 className="text-gray-100 font-bold text-base">{isHe ? coll.nameHe : coll.name}</h2>
            <p className="text-gray-600 text-xs">{coll.companies.length} {isHe ? 'חברות' : 'companies'}</p>
          </div>
        </div>
        {coll.companies.length === 0 ? (
          <EmptyState icon={coll.icon} text={t.coll_empty} cta={
            <Link to="/" className={`inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition border ${cc.bg} ${cc.text} border-current/20 hover:opacity-80`}>
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
      {/* Stat row */}
      <StatCards
        recentCount={recentCompanies.length}
        totalSaved={totalSaved}
        watchlistCount={collections.find(c => c.id === 'watchlist')?.companies.length ?? 0}
        t={t}
      />

      {/* Recent research */}
      {recentCompanies.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-gray-300 font-bold text-sm">{t.desk_recent_title}</h2>
            <Link to="/" className="text-blue-400/70 hover:text-blue-300 text-xs transition">{isHe ? 'חפש עוד' : 'Search more'}</Link>
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
            <h2 className="text-gray-300 font-bold text-sm">{t.desk_all_companies}</h2>
            <span className="text-gray-700 text-xs">{uniqueCompanies.length}</span>
          </div>
          <div className="space-y-2">
            {uniqueCompanies.slice(0, 8).map(entry => (
              <CompanyCard key={entry.symbol} entry={entry} onSave={onSave} t={t} isHe={isHe}/>
            ))}
          </div>
        </section>
      )}

      {/* Mission cards — empty state for new users */}
      {recentCompanies.length === 0 && uniqueCompanies.length === 0 && (
        <MissionCards isHe={isHe} onWatchlist={onSelectWatchlist} />
      )}
    </div>
  )
}

function EmptyState({ icon, text, sub, cta }: { icon: string; text: string; sub?: string; cta?: React.ReactNode }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl px-6 py-12 text-center">
      <div className="text-4xl mb-3 opacity-60">{icon}</div>
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

  const [activeId, setActiveId]   = useState<string | null>(null)
  const [saveModal, setSaveModal] = useState<SaveTarget | null>(null)

  const firstName = user ? getFirstName(user as any) : ''
  const subtitle  = t.desk_subtitle

  return (
    <div className="min-h-screen bg-[#01020A]" dir={isHe ? 'rtl' : 'ltr'}>

      {/* ── Sticky nav ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-[#01020A]/90 backdrop-blur-md border-b border-white/[0.05]">
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
      <DeskHero firstName={firstName} subtitle={subtitle} isHe={isHe} />

      {/* ── 3-column layout ────────────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-4 py-6 pb-20">
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
            onSelectWatchlist={() => setActiveId('watchlist')}
            t={t as any}
            isHe={isHe}
          />

          <RightPanel activity={activity} t={t as any} isHe={isHe}/>
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
