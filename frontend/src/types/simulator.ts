// Bukra Portfolio Simulator — Phase 1. Virtual money only. Mirrors
// backend/services/simulator/models.py. No real broker, trade, deposit or
// withdrawal type exists anywhere in this file, by design.

export type RiskProfile = 'conservative' | 'balanced' | 'growth' | 'aggressive'
export type Currency = 'USD' | 'ILS'

export type RecommendationType =
  | 'ADD_POSITION' | 'INCREASE_POSITION' | 'REDUCE_POSITION' | 'EXIT_POSITION'
  | 'HOLD_POSITION' | 'REVIEW_POSITION' | 'ADD_CASH' | 'REBALANCE'

export type RecommendationStatus =
  | 'PENDING' | 'VIEWED' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'SIMULATED_EXECUTED' | 'CANCELLED'

export type TransactionType =
  | 'SIMULATED_DEPOSIT' | 'SIMULATED_WITHDRAWAL' | 'SIMULATED_BUY' | 'SIMULATED_SELL'
  | 'SIMULATED_DIVIDEND' | 'SIMULATED_FEE' | 'SIMULATED_FX_CONVERSION'

export type PortfolioHealthStatus =
  | 'Strong' | 'Balanced' | 'Needs Attention' | 'High Concentration' | 'High Valuation Risk' | 'Limited Data Confidence'

export interface Portfolio {
  id: string; userId: string; name: string; baseCurrency: Currency
  benchmarkSymbol: string; riskProfile: RiskProfile
  initialCapital: number; currentCash: number; totalDeposits: number; totalWithdrawals: number
  realizedGainLoss: number; unrealizedGainLoss: number; dividendIncome: number; totalFees: number
  currentValue: number; createdAt: string; updatedAt: string; status: string
  isSimulation: true; methodologyVersion: string
}

export interface Holding {
  id: string; portfolioId: string; companyId: string; ticker: string
  quantity: number; averageCost: number; totalCostBasis: number
  currentPrice: number | null; currentMarketValue: number | null
  unrealizedGainLoss: number | null; unrealizedGainLossPercent: number | null
  realizedGainLoss: number; portfolioWeight: number | null; tradingCurrency: string
  sector?: string; openedAt: string; updatedAt: string
  reasonForHolding: string; closedAt: string | null; status: 'open' | 'closed'
}

export interface Transaction {
  id: string; portfolioId: string; holdingId: string | null; recommendationId: string | null
  transactionType: TransactionType; ticker: string | null; quantity: number | null
  requestedPrice: number | null; executedPrice: number | null; grossAmount: number
  simulatedFee: number; simulatedFxCost: number; netAmount: number
  transactionCurrency: string; portfolioCurrency: string; fxRate: number
  status: string; createdAt: string; approvedByUser: boolean; approvedAt: string | null
  simulatedExecutedAt: string | null; metadata: Record<string, any>
}

export interface RecommendationImpact {
  currentWeight: number; proposedWeight: number
  currentSectorWeight: number; proposedSectorWeight: number
  currentCash: number; cashAfterExecution: number
  currentHoldingsCount: number; holdingsCountAfter: number
}

export interface Recommendation {
  id: string; portfolioId: string; companyId: string; ticker: string
  recommendationType: RecommendationType; recommendationStatus: RecommendationStatus
  currentWeight: number; targetWeight: number
  proposedAmount: number | null; proposedQuantity: number | null
  reasonSummary: string; supportingFactors: string[]; riskFactors: string[]
  expectedPortfolioImpact: RecommendationImpact
  bukraScoreSnapshot: number | null; valuationScoreSnapshot: number | null
  bubbleRiskSnapshot: number | null; confidenceSnapshot: string | null
  currentPriceSnapshot: number | null
  fairValueSnapshot: { bearPerShare: number | null; basePerShare: number | null; bullPerShare: number | null } | null
  methodologyVersion: string; createdAt: string; viewedAt: string | null
  approvedAt: string | null; rejectedAt: string | null; expiredAt: string | null
  userDecisionNote: string | null; metadata: Record<string, any>
}

export interface AuditEvent {
  id: string; portfolioId: string; eventType: string; actorType: 'user' | 'system'
  actorId: string; eventTimestamp: string; explanation: string; methodologyVersion: string
  recommendationId: string | null; transactionId: string | null
  beforeState: Record<string, any>; afterState: Record<string, any>
  sourceDataTimestamp: string | null; metadata: Record<string, any>
}

export interface DashboardData {
  portfolio: Portfolio
  return: {
    grossReturn: number; netReturn: number; netReturnPct: number | null; netInvested: number
    timeWeightedReturnPct: number | null; moneyWeightedReturnPct: number | null
  }
  holdings: Holding[]
  allocation: { bySector: { label: string; value: number; weight: number }[]; cashWeight: number }
  summary: {
    numberOfHoldings: number; largestPosition: string | null; largestSector: string | null
    cashPercentage: number; bestPerformer: string | null; worstPerformer: string | null
    totalDividends: number; totalFees: number
  }
  pendingRecommendations: number
  isSimulation: true
  generatedAt: string
}

export interface PerformanceData {
  portfolioSeries: { date: string; portfolioIndex: number }[]
  benchmark: {
    available: boolean; benchmarkSymbol: string
    series: { date: string; benchmarkIndex: number }[]
    benchmarkReturn: number | null; calculatedAt: string
  }
  period: string; isSimulation: true; calculatedAt: string
}

export interface PortfolioHealth {
  status: PortfolioHealthStatus
  cashAllocation: number; numberOfHoldings: number
  largestPositionWeight: number; largestSectorWeight: number
  currencyConcentration: Record<string, number>
  averageBukraScore: number | null; averageValuationScore: number | null
  weightedBubbleRisk: number | null; weightedValuationConfidence: number | null
  pctAboveFairValue: number | null; pctLowConfidence: number | null; pctLimitedDataQuality: number | null
  drivers: { key: string; value: number }[]
  isSimulation: true; calculatedAt: string
}

export interface SimulatorConfig {
  riskProfiles: RiskProfile[]; supportedCurrencies: Currency[]
  defaultBenchmark: Record<string, string>; minTradeAmount: number; isSimulation: true
}
