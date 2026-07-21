import type { Translations } from '../i18n/types'

export const REC_TYPE_KEY: Record<string, keyof Translations> = {
  ADD_POSITION: 'sim_recTypeAdd', INCREASE_POSITION: 'sim_recTypeIncrease',
  REDUCE_POSITION: 'sim_recTypeReduce', EXIT_POSITION: 'sim_recTypeExit',
  HOLD_POSITION: 'sim_recTypeHold', REVIEW_POSITION: 'sim_recTypeReview',
  ADD_CASH: 'sim_recTypeAddCash', REBALANCE: 'sim_recTypeRebalance',
}

export const REC_STATUS_KEY: Record<string, keyof Translations> = {
  PENDING: 'sim_statusPending', VIEWED: 'sim_statusViewed', APPROVED: 'sim_statusApproved',
  REJECTED: 'sim_statusRejected', EXPIRED: 'sim_statusExpired',
  SIMULATED_EXECUTED: 'sim_statusExecuted', CANCELLED: 'sim_statusCancelled',
}

export function recLabel(t: Translations, type: string): string {
  const key = REC_TYPE_KEY[type]
  return key ? (t[key] as string) : type
}

export function statusLabel(t: Translations, status: string): string {
  const key = REC_STATUS_KEY[status]
  return key ? (t[key] as string) : status
}
