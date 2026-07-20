// Bukra Valuation Engine — API response types (mirrors backend/services/valuation).

export type ValuationBand =
  | 'very_attractive' | 'attractive' | 'reasonable' | 'expensive' | 'very_expensive' | 'extreme'
export type ExpectationsBand = 'conservative' | 'reasonable' | 'high' | 'aggressive' | 'extreme'
export type BubbleBand = 'conservative' | 'reasonable' | 'elevated' | 'speculative' | 'extreme_risk'
export type ConfidenceLabel = 'High' | 'Medium' | 'Low'
export type DataQualityLevel = 'complete' | 'partial' | 'limited' | 'insufficient'

export interface ScoreBreakdown {
  score: number
  componentScores: Record<string, number>
  missingComponents: string[]
  originalWeights: Record<string, number>
  normalizedWeights: Record<string, number>
}

export interface ValuationScenario {
  assumptions: Record<string, string | number | null>
  fairEquityValue: number | null
  fairValuePerShare: number | null
  upsideDownsidePct: number | null
  terminalValuePct: number | null
  available: boolean
}

export interface ReverseDcf {
  impliedFcfGrowth: number
  impliedFcfMargin: number | null
  historicalGrowth: number | null
  historicalFcfMargin: number | null
  requiredRevenueAtHorizon: number | null
  requiredFcfAtHorizon: number | null
  discountRate: number
  terminalGrowth: number
  terminalValuePct: number | null
  forecastYears: number
  solverCapped: boolean
  fcfProxyUsed: boolean
}

export interface ValuationData {
  available: boolean
  symbol: string
  companyType: string
  methodologyVersion: string
  calculatedAt: string
  currency: string

  valuationScore?: number | null
  valuationScoreLabel?: ValuationBand
  scoreBreakdown?: ScoreBreakdown | null
  expectationsGap?: number | null
  expectationsGapLabel?: ExpectationsBand | null
  bubbleRisk?: number | null
  bubbleRiskLabel?: BubbleBand | null
  valuationConfidence: { score: number; label: ConfidenceLabel }
  dataQuality: { level: DataQualityLevel; missingInputs: string[]; estimatedInputs: string[]; yearsOfHistory: number }

  currentPrice: number | null
  currentMarketCap: number | null
  enterpriseValue?: number | null
  fairValueRange?: {
    bearPerShare: number | null; basePerShare: number | null; bullPerShare: number | null
    bearMarketCap: number | null; baseMarketCap: number | null; bullMarketCap: number | null
  }
  marginOfSafety?: number | null
  estimatedUpsideDownside?: number | null

  reverseDcf?: ReverseDcf | null
  scenarios?: Record<'bear' | 'base' | 'bull', ValuationScenario>
  positiveFactors?: string[]
  riskFactors?: string[]
  valuationMethodsUsed?: string[]
  missingInputs?: string[]
  sectorModelNote?: string | null
  assumptions?: { discountRate: number; forecastYears: number }
  conclusion: string
  disclaimer: string
  insufficientReason?: string
}
