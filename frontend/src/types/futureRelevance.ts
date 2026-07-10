// Future Relevance — data model.
// The AI engine is a future plug-in. These types are stable now.

export type FRConfidence = 'High' | 'Medium' | 'Low'
export type FRScenarioType = 'bull' | 'base' | 'bear'

export interface FRDriver {
  key: string           // e.g. "ai_adoption"
  label: string
  score: number         // 0–100
  summary: string
}

export interface FRRisk {
  key: string           // e.g. "tech_disruption"
  label: string
  severity: 'High' | 'Medium' | 'Low'
  summary: string
}

export interface FRTrend {
  key: string           // e.g. "artificial_intelligence"
  label: string
  relevance: 'High' | 'Medium' | 'Low'
}

export interface FRScenario {
  type: FRScenarioType
  title: string
  summary: string
  timeframe: string     // e.g. "2030–2035"
}

export interface FutureRelevanceData {
  score: number           // 0–100
  confidence: FRConfidence
  status: string          // computed from score — see getFRStatus()
  aiSummary: string
  drivers: FRDriver[]
  risks: FRRisk[]
  trends: FRTrend[]
  scenarios: FRScenario[]
  generatedAt: string     // ISO date
  isPlaceholder: boolean  // true until real AI engine is wired
}

// Status label computed from score
export function getFRStatus(score: number): { label: string; labelHe: string; color: string } {
  if (score >= 90) return { label: 'Future Leader',        labelHe: 'מוביל עתידי',         color: 'text-emerald-400' }
  if (score >= 80) return { label: 'Highly Relevant',      labelHe: 'רלוונטי מאוד',         color: 'text-green-400'   }
  if (score >= 65) return { label: 'Stable but Challenged', labelHe: 'יציב אך מאותגר',      color: 'text-amber-400'   }
  if (score >= 50) return { label: 'Future Uncertain',     labelHe: 'עתיד לא ודאי',         color: 'text-orange-400'  }
  return               { label: 'High Disruption Risk',   labelHe: 'סיכון שיבוש גבוה',     color: 'text-red-400'     }
}
