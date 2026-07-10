/**
 * The Portfolio Office — the investor's private command center.
 *
 * Read-only cockpit: real holdings, allocation, exposure, cash, conviction —
 * once a broker is connected. Until then the office stands ready: the desk
 * is built, the display is dark, the broker connections wait as plaques.
 *
 * Bukra never places trades. There is no order UI here and never will be.
 */
import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/index'
import { getEstatePortfolio } from '../api/client'
import { EstateShell, EstatePanel, EstateHeading, GOLD } from '../estate/EstateShell'

interface Broker { id: string; name: string; region: string; status: string }
interface PortfolioView {
  connected: boolean
  brokers: Broker[]
  totalValue: number | null
  cash: number | null
  holdings: any[]
  allocation: { bySector: any[]; byCountry: any[] }
  alerts: string[]
}

export default function PortfolioOffice() {
  const { isHe } = useLanguage()
  const [view, setView] = useState<PortfolioView | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    getEstatePortfolio().then(setView).catch(() => setError(true))
  }, [])

  return (
    <EstateShell
      room="The Portfolio Office" roomHe="משרד התיק הפרטי"
      subtitle="Your holdings, read with Bukra’s judgement. Read-only — execution always happens at your broker."
      subtitleHe="האחזקות שלך, נקראות בשיקול הדעת של בוקרא. לקריאה בלבד — הביצוע תמיד אצל הברוקר.">

      {error && (
        <p className="text-stone-500 text-sm">{isHe ? 'המשרד אינו זמין כרגע.' : 'The office is unavailable right now.'}</p>
      )}

      {view && !view.connected && (
        <>
          {/* The dark display — the cockpit exists, awaiting its data */}
          <EstatePanel className="mb-10 text-center py-16">
            <div className="text-4xl mb-6 text-stone-700" aria-hidden>▤</div>
            <h2 className="font-serif text-2xl text-stone-200">
              {isHe ? 'המשרד מוכן.' : 'The office is ready.'}
            </h2>
            <p className="mt-4 text-stone-500 text-sm max-w-md mx-auto leading-relaxed">
              {isHe
                ? 'חיבור לברוקר יאיר את הקוקפיט: אחזקות, הקצאה, חשיפה, מזומן — עם הציונים והקונביקציה של בוקרא לצד כל פוזיציה.'
                : 'Connecting a broker will light the cockpit: holdings, allocation, exposure, cash — with Bukra’s scores and conviction beside every position.'}
            </p>
            <p className="mt-6 text-xs tracking-widest uppercase" style={{ color: `${GOLD}99` }}>
              {isHe ? 'לקריאה בלבד · בוקרא לעולם אינה מבצעת עסקאות' : 'Read-only · Bukra never places trades'}
            </p>
          </EstatePanel>

          {/* Broker plaques — future connections, honestly marked */}
          <EstateHeading en="Broker connections" he="חיבורי ברוקר" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {view.brokers.map(b => (
              <div key={b.id}
                className="rounded-xl border border-stone-800/70 bg-stone-950/40 px-4 py-5 text-center">
                <div className="text-stone-300 text-sm font-medium">{b.name}</div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-stone-600">
                  {b.status === 'available'
                    ? (isHe ? 'זמין' : 'Available')
                    : (isHe ? 'בקרוב' : 'Planned')}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {view?.connected && (
        <>
          {/* The lit cockpit — renders real data once the first adapter ships */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <EstatePanel>
              <EstateHeading en="Total value" he="שווי כולל" />
              <div className="font-serif text-3xl text-stone-100">
                {view.totalValue?.toLocaleString()}
              </div>
            </EstatePanel>
            <EstatePanel>
              <EstateHeading en="Cash" he="מזומן" />
              <div className="font-serif text-3xl text-stone-100">
                {view.cash?.toLocaleString()}
              </div>
            </EstatePanel>
            <EstatePanel>
              <EstateHeading en="Positions" he="פוזיציות" />
              <div className="font-serif text-3xl text-stone-100">{view.holdings.length}</div>
            </EstatePanel>
          </div>
          <EstatePanel>
            <EstateHeading en="Sector exposure" he="חשיפה סקטוריאלית" />
            <div className="space-y-3">
              {view.allocation.bySector.map(s => (
                <div key={s.label} className="flex items-center gap-4">
                  <span className="w-40 text-sm text-stone-400">{s.label}</span>
                  <div className="flex-1 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.weight * 100}%`, background: GOLD }} />
                  </div>
                  <span className="text-xs text-stone-500 w-12 text-right">{(s.weight * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </EstatePanel>
        </>
      )}
    </EstateShell>
  )
}
