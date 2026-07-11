/**
 * The Portfolio Office — the investor's home. Where capital is managed.
 *
 * The office is fully furnished from day one: the desk shows capital,
 * cash and positions; the wall shows exposure; the ledger shows Bukra's
 * standing counsel. Figures awaiting a broker connection appear as quiet
 * em-dashes in their final places — a furnished room, never a promise.
 *
 * Read-only by construction. Bukra never places trades; there is no order
 * UI here and never will be.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/index'
import { getEstatePortfolio, getEstateLibrary } from '../api/client'
import { EstateShell, EstatePanel, EstateHeading, EstateFigure, GOLD, SERIF } from '../estate/EstateShell'

interface Broker { id: string; name: string; region: string; status: string }
interface View {
  connected: boolean
  brokers: Broker[]
  totalValue: number | null
  cash: number | null
  holdings: any[]
  allocation: { bySector: { label: string; weight: number }[]; byCountry: any[] }
}

export default function PortfolioOffice() {
  const { isHe } = useLanguage()
  const [view, setView] = useState<View | null>(null)
  const [studied, setStudied] = useState<{ symbol: string; score: number | null; status: string | null }[]>([])
  const [showBrokers, setShowBrokers] = useState(false)

  useEffect(() => {
    getEstatePortfolio().then(setView).catch(() => setView(null))
    getEstateLibrary().then(d => setStudied((d.companies ?? []).slice(0, 4))).catch(() => {})
  }, [])

  const connected = view?.connected === true

  return (
    <EstateShell wide
      room="The Portfolio Office" roomHe="משרד התיק הפרטי"
      subtitle="Your capital, read alongside the Index."
      subtitleHe="ההון שלך, נקרא לצד הערכות המדד.">

      {/* ── The desk — capital at a glance ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <EstatePanel>
          <EstateFigure
            value={connected ? view!.totalValue?.toLocaleString() ?? null : null}
            label="Capital" labelHe="הון" />
        </EstatePanel>
        <EstatePanel>
          <EstateFigure
            value={connected ? view!.cash?.toLocaleString() ?? null : null}
            label="Cash" labelHe="מזומן" />
        </EstatePanel>
        <EstatePanel>
          <EstateFigure
            value={connected ? view!.holdings.length : null}
            label="Positions" labelHe="פוזיציות" />
        </EstatePanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* ── The wall — exposure ──────────────────────────────────────── */}
        <EstatePanel className="lg:col-span-3">
          <EstateHeading en="Exposure" he="חשיפה" />
          {connected && view!.allocation.bySector.length > 0 ? (
            <div className="space-y-4">
              {view!.allocation.bySector.map(s => (
                <div key={s.label} className="flex items-center gap-5">
                  <span className="w-40 text-sm text-stone-400 font-light">{s.label}</span>
                  <div className="flex-1 h-px bg-stone-800 relative">
                    <div className="absolute inset-y-0 left-0 h-px"
                      style={{ width: `${s.weight * 100}%`, background: GOLD }} />
                  </div>
                  <span className="text-xs text-stone-500 w-12 text-right">{(s.weight * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {[
                isHe ? 'סקטורים' : 'Sectors',
                isHe ? 'מדינות' : 'Countries',
                isHe ? 'מטבעות' : 'Currencies',
              ].map(row => (
                <div key={row} className="flex items-center gap-5">
                  <span className="w-40 text-sm text-stone-600 font-light">{row}</span>
                  <div className="flex-1 h-px bg-stone-800/70" />
                  <span className="text-xs text-stone-700 w-12 text-right">—</span>
                </div>
              ))}
              <p className="pt-3 text-xs text-stone-600 leading-relaxed font-light">
                {isHe
                  ? 'החשיפה תיקרא ישירות מהברוקר שלך, לקריאה בלבד.'
                  : 'Exposure reads directly from your broker, read-only.'}
              </p>
            </div>
          )}
        </EstatePanel>

        {/* ── The ledger — Bukra's standing counsel ────────────────────── */}
        <EstatePanel className="lg:col-span-2">
          <EstateHeading en="Standing counsel" he="עמדה מתמשכת" />
          {studied.length > 0 ? (
            <div className="space-y-5">
              {studied.map(s => (
                <Link key={s.symbol} to={`/company/${s.symbol}`}
                  className="flex items-baseline justify-between group">
                  <span className="text-stone-300 group-hover:text-stone-100 transition-colors duration-500 font-light"
                    style={{ fontFamily: SERIF }}>
                    {s.symbol}
                  </span>
                  <span className="flex items-baseline gap-4">
                    <span className="text-[11px] text-stone-600">{s.status ?? ''}</span>
                    {s.score != null && (
                      <span className="text-sm" style={{ color: s.score >= 80 ? GOLD : '#a8a29e' }}>{s.score}</span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-600 leading-relaxed font-light">
              {isHe
                ? 'הערכות המדד לגבי החברות שנחקרו יופיעו כאן — ציון, תזה, וקונביקציה.'
                : 'The Index’s standing assessments of studied companies will rest here — score, thesis, conviction.'}
            </p>
          )}
          <div className="mt-8 pt-6 border-t border-stone-800/50">
            <Link to="/estate/research"
              className="text-[11px] uppercase tracking-[0.25em] text-stone-500 hover:text-[#c9a962] transition-colors duration-500">
              {isHe ? 'אל חדר המחקר ←' : 'To the Research Room →'}
            </Link>
          </div>
        </EstatePanel>
      </div>

      {/* ── Private connections — quiet, discoverable, never a banner ──── */}
      <div className="text-center">
        <button onClick={() => setShowBrokers(v => !v)}
          className="text-[11px] uppercase tracking-[0.25em] text-stone-600 hover:text-stone-400 transition-colors duration-500">
          {isHe ? 'חיבורים פרטיים' : 'Private connections'}
        </button>
        {showBrokers && view && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-3 text-left">
            {view.brokers.map(b => (
              <div key={b.id}
                className="rounded-xl border border-stone-800/50 bg-stone-950/30 px-4 py-4 text-center">
                <div className="text-stone-400 text-[13px] font-light">{b.name}</div>
                <div className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-stone-700">
                  {b.status === 'available' ? (isHe ? 'זמין' : 'Available') : (isHe ? 'בהכנה' : 'In preparation')}
                </div>
              </div>
            ))}
            <p className="col-span-full mt-3 text-center text-[11px] text-stone-700 tracking-wide">
              {isHe ? 'לקריאה בלבד. בוקרה לעולם אינה מבצעת עסקאות.' : 'Read-only. Bukra never places trades.'}
            </p>
          </div>
        )}
      </div>
    </EstateShell>
  )
}
