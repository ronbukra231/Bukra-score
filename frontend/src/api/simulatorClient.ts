// Bukra Portfolio Simulator API client — virtual money only.
import { getAuthHeaders, forceRefreshAuthHeaders } from './client'
import type {
  Portfolio, DashboardData, PerformanceData, PortfolioHealth, Recommendation,
  AuditEvent, Transaction, SimulatorConfig, RiskProfile, Currency,
} from '../types/simulator'

const BASE = (import.meta.env.VITE_API_URL ?? '/api') + '/simulator'

function getLang(): 'he' | 'en' {
  return localStorage.getItem('bukra_lang') === 'en' ? 'en' : 'he'
}

/**
 * What kind of failure this was, so the UI can show a message that matches
 * reality instead of one generic "something went wrong":
 *   - 'expired'      the session is gone even after one refresh attempt —
 *                     the user needs to sign in again
 *   - 'unauthorized' the user is authenticated but doesn't own this resource
 *   - 'config'       the BACKEND's own auth setup is broken (503) — signing
 *                     in again will not help; this is never shown as an
 *                     authentication failure
 *   - 'network'      the request never reached the server
 *   - 'unknown'      any other error status
 */
export type SimulatorErrorKind = 'expired' | 'unauthorized' | 'config' | 'network' | 'unknown'

class SimulatorApiError extends Error {
  status: number
  kind: SimulatorErrorKind
  constructor(status: number, message: string, kind: SimulatorErrorKind) {
    super(message)
    this.status = status
    this.kind = kind
  }
}

function kindForStatus(status: number): SimulatorErrorKind {
  if (status === 401) return 'expired'
  if (status === 403) return 'unauthorized'
  if (status === 503) return 'config'
  return 'unknown'
}

async function parseDetail(res: Response): Promise<string> {
  try { return (await res.json()).detail ?? 'שגיאה בשירות הסימולציה' }
  catch { return 'שגיאה בשירות הסימולציה' }
}

async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${BASE}${path}${sep}lang=${getLang()}`
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json', ...(options.headers as Record<string, string> | undefined || {}),
  }

  let res: Response
  try {
    const headers = { ...(await getAuthHeaders()), ...baseHeaders }
    res = await fetch(url, { ...options, headers })
  } catch {
    // The request never reached the server — distinct from the server
    // actively rejecting it.
    throw new SimulatorApiError(0, 'בעיית חיבור. בדוק את החיבור לאינטרנט ונסה שוב.', 'network')
  }

  // A 401 can mean the token was merely stale (clock drift, a token that
  // expired between getAuthHeaders() and the server receiving it). Try
  // exactly once with a forced refresh before treating the session as
  // truly gone — never more than one retry.
  if (res.status === 401) {
    try {
      const refreshedHeaders = { ...(await forceRefreshAuthHeaders()), ...baseHeaders }
      if (refreshedHeaders.Authorization) {
        res = await fetch(url, { ...options, headers: refreshedHeaders })
      }
    } catch { /* fall through to the original 401 */ }
  }

  if (!res.ok) {
    const detail = await parseDetail(res)
    throw new SimulatorApiError(res.status, detail, kindForStatus(res.status))
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

export type BuilderDoneReason = 'temporary_data_unavailable' | 'no_opportunities'

export const getNextBuilderRecommendation = (excludeTickers: string[]) =>
  call<Recommendation | { done: true; reason?: BuilderDoneReason }>('/builder/next', {
    method: 'POST', body: JSON.stringify({ excludeTickers }),
  })

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
