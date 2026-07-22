import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/index'
import SimulatorShell, { SimPanel, SERIF } from '../../simulator/SimulatorShell'
import NoPortfolio from './NoPortfolio'
import SimulatorErrorState from '../../simulator/ErrorState'
import { getActivity, SimulatorApiError } from '../../api/simulatorClient'
import type { AuditEvent } from '../../types/simulator'

export default function ActivityPage() {
  const { t, isHe } = useLanguage()
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    getActivity(150).then(e => { setEvents(e); setError(null) }).catch(e => {
      if (e instanceof SimulatorApiError && e.status === 404) setNotFound(true)
      else setError(e)
    })
  }, [])

  if (notFound) return <SimulatorShell><NoPortfolio /></SimulatorShell>
  if (error) return <SimulatorShell><SimulatorErrorState error={error} /></SimulatorShell>

  return (
    <SimulatorShell>
      <h2 className="text-xl text-stone-100 font-light mb-6" style={{ fontFamily: SERIF }}>{t.sim_activityTitle}</h2>
      {events && events.length === 0 && <p className="text-stone-600 text-sm">{t.sim_noActivity}</p>}
      <div className="space-y-3">
        {events?.map(e => (
          <SimPanel key={e.id} className="!p-5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-stone-200 text-sm">{e.explanation}</span>
              <span className="text-stone-600 text-xs shrink-0" dir="ltr">
                {new Date(e.eventTimestamp).toLocaleString(isHe ? 'he-IL' : 'en-US')}
              </span>
            </div>
            <div className="mt-1.5 text-[10px] uppercase tracking-wide text-stone-700">{e.eventType}</div>
          </SimPanel>
        ))}
      </div>
    </SimulatorShell>
  )
}
