/**
 * Shared error rendering for the simulator pages — maps a caught error to
 * the message that matches what actually happened. A 503 (backend auth
 * configuration problem) is never shown as "authentication failed": that
 * phrasing tells the user to do something they cannot fix.
 */
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/index'
import { SimulatorApiError, type SimulatorErrorKind } from '../api/simulatorClient'
import type { Translations } from '../i18n/types'

export function classifyError(e: unknown): SimulatorErrorKind {
  if (e instanceof SimulatorApiError) return e.kind
  return 'unknown'
}

/** Shared by full-page error states and inline action-error banners (e.g.
 * the approval modal) so the same error always reads the same way. */
export function resolveErrorMessage(e: unknown, t: Translations): string {
  const kind = classifyError(e)
  if (kind === 'expired')      return t.sim_errorExpired
  if (kind === 'unauthorized') return t.sim_errorUnauthorized
  if (kind === 'config')       return t.sim_errorConfig
  if (kind === 'network')      return t.sim_errorNetwork
  // 'unknown' covers ordinary business-rule failures (400/409) — the
  // backend's own message is the most accurate thing to show here.
  return (e instanceof Error && e.message) || t.sim_errorGeneric
}

export default function SimulatorErrorState({ error }: { error: unknown }) {
  const { t } = useLanguage()
  const kind = classifyError(error)
  const message = resolveErrorMessage(error, t)

  return (
    <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-5 py-4">
      <p className="text-red-300 text-sm leading-relaxed">{message}</p>
      {kind === 'expired' && (
        <Link to="/login"
          className="inline-block mt-3 text-xs uppercase tracking-[0.2em] text-[#c9a962] hover:text-[#e0c589] transition-colors">
          {t.sim_retrySignIn} →
        </Link>
      )}
    </div>
  )
}
