// Bukra Portfolio Simulator API client — virtual money only.
import { getAuthHeaders } from './client'
import type {
  Portfolio, DashboardData, PerformanceData, PortfolioHealth, Recommendation,
  AuditEvent, Transaction, SimulatorConfig, RiskProfile, Currency,
} from '../types/simulator'

const BASE = (import.meta.env.VITE_API_URL ?? '/api') + '/simulator'

function getLang(): 'he' | 'en' {
  return localStorage.getItem('bukra_lang') === 'en' ? 'en' : 'he'
}

class SimulatorApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json', ...(options.headers || {}) }
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE}${path}${sep}lang=${getLang()}`, { ...options, headers })
  if (!res.ok) {
    let detail = 'שגיאה בשירות הסימולציה'
    try { detail = (await res.json()).detail ?? detail } catch { /* ignore */ }
    throw new SimulatorApiError(res.status, detail)
  }
  return res.json()
}

export { SimulatorApiError }

export const getSimulatorConfig = () => call<SimulatorConfig>('/config')

export const createPortfolio = (body: {
  name: string; baseCurrency: Currency; initialCapital: number
  riskProfile: RiskProfile; benchmarkSymbol?: string | null
}) => call<Portfolio>('/portfolio', { method: 'POST', body: JSON.stringify(body) })

export const getDashboard = () => call<DashboardData>('/dashboard')

export const addVirtualFunds = (amount: number) =>
  call<Portfolio>('/deposit', { method: 'POST', body: JSON.stringify({ amount }) })

export const setRiskProfile = (riskProfile: RiskProfile) =>
  call<Portfolio>('/risk-profile', { method: 'PUT', body: JSON.stringify({ riskProfile }) })

export const getPerformance = (period: string) => call<PerformanceData>(`/performance?period=${period}`)

export const getHealth = () => call<PortfolioHealth>('/health')

export const generateRecommendations = () =>
  call<Recommendation[]>('/recommendations/generate', { method: 'POST', body: '{}' })

export const getRecommendations = (status?: string) =>
  call<Recommendation[]>(`/recommendations${status ? `?status=${status}` : ''}`)

export const viewRecommendation = (id: string) =>
  call<Recommendation>(`/recommendations/${id}/view`, { method: 'POST', body: '{}' })

export const approveRecommendation = (id: string, confirmed: boolean) =>
  call<{ recommendation: Recommendation; transaction: Transaction | null; alreadyExecuted: boolean }>(
    `/recommendations/${id}/approve`, { method: 'POST', body: JSON.stringify({ confirmed }) })

export const rejectRecommendation = (id: string, note?: string) =>
  call<Recommendation>(`/recommendations/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) })

export const getActivity = (limit = 100) => call<AuditEvent[]>(`/activity?limit=${limit}`)

export const getAuditTrail = () => call<AuditEvent[]>('/audit')

export const getDecisionHistory = (filters?: { status?: string; ticker?: string; recommendationType?: string }) => {
  const q = new URLSearchParams()
  if (filters?.status) q.set('status', filters.status)
  if (filters?.ticker) q.set('ticker', filters.ticker)
  if (filters?.recommendationType) q.set('recommendationType', filters.recommendationType)
  const qs = q.toString()
  return call<Recommendation[]>(`/decisions${qs ? `?${qs}` : ''}`)
}

export const getTransactions = () => call<Transaction[]>('/transactions')
