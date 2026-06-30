import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Network } from 'lucide-react'
import { useLanguage } from '../i18n/index'
import LanguageToggle from '../components/LanguageToggle'
import { trackKnowledgeGraphOpen } from '../lib/analytics'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

async function getGraph() {
  const res = await fetch(`${BASE}/memory/graph`)
  if (!res.ok) throw new Error('שגיאה בטעינת גרף הידע')
  return res.json()
}

// ── Force-directed layout ─────────────────────────────────────────────────────

interface GraphNode {
  id: string; type: string; label: string; color: string; size: number
  status: string; category: string; confidence: number
  x: number; y: number; vx: number; vy: number
}
interface GraphEdge { source: string; target: string; type: string; weight: number }

function layoutNodes(
  rawNodes: Omit<GraphNode,'x'|'y'|'vx'|'vy'>[],
  edges: GraphEdge[],
  W: number, H: number,
): GraphNode[] {
  const nodes: GraphNode[] = rawNodes.map((n, i) => ({
    ...n,
    x:  W * 0.1 + Math.random() * W * 0.8,
    y:  H * 0.1 + Math.random() * H * 0.8,
    vx: 0, vy: 0,
  }))

  const nodeById = new Map(nodes.map(n => [n.id, n]))
  const k = Math.sqrt((W * H) / Math.max(nodes.length, 1))

  for (let iter = 0; iter < 300; iter++) {
    // Repulsion
    for (let a = 0; a < nodes.length; a++) {
      nodes[a].vx = 0
      nodes[a].vy = 0
      for (let b = 0; b < nodes.length; b++) {
        if (a === b) continue
        const dx = nodes[a].x - nodes[b].x
        const dy = nodes[a].y - nodes[b].y
        const dist = Math.sqrt(dx*dx + dy*dy) || 0.1
        const f = (k * k) / (dist * dist) * 0.8
        nodes[a].vx += (dx / dist) * f
        nodes[a].vy += (dy / dist) * f
      }
    }

    // Attraction
    for (const edge of edges) {
      const src = nodeById.get(edge.source)
      const tgt = nodeById.get(edge.target)
      if (!src || !tgt) continue
      const dx = tgt.x - src.x
      const dy = tgt.y - src.y
      const dist = Math.sqrt(dx*dx + dy*dy) || 0.1
      const f = (dist / k) * edge.weight * 0.2
      src.vx += (dx / dist) * f
      src.vy += (dy / dist) * f
      tgt.vx -= (dx / dist) * f
      tgt.vy -= (dy / dist) * f
    }

    // Centering
    for (const n of nodes) {
      n.vx += (W / 2 - n.x) * 0.002
      n.vy += (H / 2 - n.y) * 0.002
    }

    // Apply + damp + clamp
    const damp = 1 - iter / 400
    for (const n of nodes) {
      n.x = Math.max(n.size + 10, Math.min(W - n.size - 10, n.x + n.vx * damp))
      n.y = Math.max(n.size + 10, Math.min(H - n.size - 10, n.y + n.vy * damp))
    }
  }

  return nodes
}

// ── Legend ────────────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  SectorPattern:    '#60a5fa',
  MarketPattern:    '#c084fc',
  MacroPattern:     '#f87171',
  QualityPattern:   '#fbbf24',
  ValuationPattern: '#34d399',
  DataPattern:      '#9ca3af',
  Sector:           '#4b5563',
}

// ── Graph canvas ──────────────────────────────────────────────────────────────

function GraphCanvas({ nodes, edges, t }: { nodes: GraphNode[]; edges: GraphEdge[]; t: any }) {
  const W = 700, H = 420
  const laid = layoutNodes(nodes, edges, W, H)
  const nodeMap = new Map(laid.map(n => [n.id, n]))
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto bg-gray-900 border border-gray-800 rounded-2xl"
        style={{ minWidth: 400 }}
      >
        {/* Edges */}
        {edges.map((e, i) => {
          const src = nodeMap.get(e.source)
          const tgt = nodeMap.get(e.target)
          if (!src || !tgt) return null
          const isRelated = e.type === 'related'
          return (
            <line key={i}
              x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
              stroke={isRelated ? '#374151' : '#1f2937'}
              strokeWidth={isRelated ? 1 : 1.5}
              strokeDasharray={isRelated ? '4 3' : undefined}
              opacity={0.7}
            />
          )
        })}

        {/* Nodes */}
        {laid.map(n => {
          const isHov = hovered === n.id
          const isSector = n.type === 'sector'
          const opacity = hovered ? (isHov || edges.some(e =>
            (e.source === hovered && e.target === n.id) ||
            (e.target === hovered && e.source === n.id)
          ) ? 1 : 0.25) : 1

          return (
            <g key={n.id} style={{ cursor: 'pointer', opacity }}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {isSector ? (
                <rect
                  x={n.x - n.size} y={n.y - n.size * 0.6}
                  width={n.size * 2} height={n.size * 1.2}
                  rx={4} fill={n.color} opacity={0.8}
                />
              ) : (
                <circle cx={n.x} cy={n.y} r={n.size}
                  fill={n.color}
                  opacity={n.status === 'emerging' ? 0.65 : 0.9}
                  stroke={isHov ? '#fff' : 'transparent'}
                  strokeWidth={isHov ? 2 : 0}
                />
              )}
              <text
                x={n.x} y={isSector ? n.y + n.size * 0.35 : n.y + n.size + 12}
                textAnchor="middle"
                fontSize={isSector ? 9 : 10}
                fill={isSector ? '#fff' : '#d1d5db'}
                fontWeight={isSector ? '600' : '400'}
              >
                {n.label.slice(0, 22)}
              </text>
              {/* Confidence ring for discoveries */}
              {!isSector && n.confidence > 0 && (
                <circle cx={n.x} cy={n.y} r={n.size + 4}
                  fill="none"
                  stroke={n.color}
                  strokeWidth={1}
                  strokeDasharray={`${Math.round(n.confidence * 2 * Math.PI * (n.size + 4))} 999`}
                  opacity={0.4}
                  transform={`rotate(-90 ${n.x} ${n.y})`}
                />
              )}
            </g>
          )
        })}

        {/* Hover tooltip */}
        {hovered && (() => {
          const n = nodeMap.get(hovered)
          if (!n) return null
          const lines = [
            n.label,
            n.status && n.status !== 'sector' ? `מעמד: ${n.status}` : '',
            n.confidence ? `ביטחון: ${Math.round(n.confidence * 100)}%` : '',
          ].filter(Boolean)
          const tw = Math.max(...lines.map(l => l.length)) * 6 + 20
          const th = lines.length * 16 + 12
          const tx = Math.min(n.x + 14, W - tw - 4)
          const ty = Math.max(n.y - th / 2, 4)
          return (
            <g>
              <rect x={tx} y={ty} width={tw} height={th} rx={6}
                fill="#111827" stroke="#374151" strokeWidth={1} />
              {lines.map((line, i) => (
                <text key={i} x={tx + 10} y={ty + 14 + i * 16}
                  fontSize={10} fill="#e5e7eb">{line}</text>
              ))}
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ t }: { t: any }) {
  const items = [
    { color: CAT_COLORS.SectorPattern,    label: t.graph_catSector },
    { color: CAT_COLORS.MarketPattern,    label: t.graph_catMarket },
    { color: CAT_COLORS.MacroPattern,     label: t.graph_catMacro },
    { color: CAT_COLORS.QualityPattern,   label: t.graph_catQuality },
    { color: CAT_COLORS.ValuationPattern, label: t.graph_catValuation },
    { color: CAT_COLORS.DataPattern,      label: t.graph_catData },
    { color: CAT_COLORS.Sector,           label: t.graph_sectorNode },
  ]
  return (
    <div className="flex flex-wrap gap-3">
      {items.map(it => (
        <div key={it.label} className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ background: it.color }} />
          {it.label}
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KnowledgeGraph() {
  const { t, isHe }           = useLanguage()
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    getGraph()
      .then(d  => {
        setData(d)
        setLoading(false)
        trackKnowledgeGraphOpen(d?.nodes?.length, d?.edges?.length)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const isEmpty = data && (data.nodes || []).length === 0

  return (
    <div className="min-h-screen bg-gray-950" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-900">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white transition flex-shrink-0">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <Network className="w-4 h-4 text-indigo-400" />
            <span className="text-white font-bold text-sm">{t.graph_title}</span>
            <span className="text-gray-600 text-sm">—</span>
            <span className="text-gray-400 text-sm">{t.graph_subtitle}</span>
          </div>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-black text-white">{t.graph_title}</h1>
          </div>
          <p className="text-gray-500 text-sm max-w-2xl leading-relaxed italic">
            "{t.graph_tagline}"
          </p>
          {data && !isEmpty && (
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span><strong className="text-gray-300">{data.stats?.discovery_nodes ?? 0}</strong> {t.graph_discoveryNode}</span>
              <span><strong className="text-gray-300">{data.stats?.sector_nodes ?? 0}</strong> {t.graph_sectorNode}</span>
              <span><strong className="text-gray-300">{data.stats?.total_edges ?? 0}</strong> קשרים</span>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-3 py-20 justify-center">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">בונה גרף ידע...</span>
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
            <Network className="w-12 h-12 text-gray-700 mx-auto" />
            <h2 className="text-white font-bold text-xl">{t.graph_noData}</h2>
            <Link to="/scanner" className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition mt-4">
              פתח סריקה
            </Link>
          </div>
        )}

        {data && !isEmpty && !loading && (
          <div className="space-y-4">
            <GraphCanvas nodes={data.nodes} edges={data.edges} t={t} />
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wider">{t.graph_legend}</div>
              <Legend t={t} />
              <div className="mt-3 pt-3 border-t border-gray-800 flex gap-4 text-xs text-gray-600">
                <span>— — — קשר עקיף (סקטור משותף)</span>
                <span>——— קשר ישיר (דפוס → סקטור)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
