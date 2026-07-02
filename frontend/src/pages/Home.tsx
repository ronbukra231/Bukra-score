import { useRef } from 'react'
import { Link } from 'react-router-dom'
import SearchBar from '../components/SearchBar'
import LanguageToggle from '../components/LanguageToggle'
import UserMenu from '../components/UserMenu'
import PredictionAccuracyCard from '../components/PredictionAccuracyCard'
import { useLanguage } from '../i18n/index'

const POPULAR = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'BRK-B', 'JPM']

const PRINCIPLES = [
  'home_explainP1',
  'home_explainP2',
  'home_explainP3',
  'home_explainP4',
  'home_explainP5',
] as const

export default function Home() {
  const { t, isHe } = useLanguage()
  const searchRef = useRef<HTMLDivElement>(null)

  function focusSearch() {
    searchRef.current?.querySelector('input')?.focus()
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col" dir={isHe ? 'rtl' : 'ltr'}>

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 pt-4">
        <UserMenu />
        <LanguageToggle />
      </div>

      {/* ── Hero ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-10 pb-8 text-center">

        {/* Badge */}
        <div className="inline-block bg-brand-600/10 border border-brand-600/30 text-brand-400 text-xs font-semibold rounded-full px-4 py-1.5 mb-8 tracking-wider">
          {t.home_badge}
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-5 leading-tight tracking-tight">
          {t.home_h1_line1}
          <br />
          <span className="text-brand-400">{t.home_h1_line2}</span>
        </h1>

        {/* Slogan — brand line */}
        <div className="mb-6">
          <p className="text-2xl md:text-3xl font-black text-white tracking-tight leading-snug">
            {t.home_slogan}
          </p>
          <p className="text-gray-500 text-sm md:text-base mt-2 leading-relaxed max-w-lg mx-auto">
            {t.home_slogan_sub}
          </p>
        </div>

        {/* Subheadline */}
        <p className="text-gray-400 text-sm md:text-base max-w-xl mb-10 leading-relaxed">
          {t.home_subheadline}
        </p>

        {/* Search */}
        <div className="w-full max-w-xl mb-6" ref={searchRef}>
          <SearchBar large />
        </div>

        {/* Popular chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {POPULAR.map((sym) => (
            <a
              key={sym}
              href={`/company/${sym}`}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-mono rounded-lg px-3 py-1.5 transition"
            >
              {sym}
            </a>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={focusSearch}
            className="bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-2xl px-7 py-3.5 text-base transition shadow-lg shadow-brand-600/20"
          >
            {t.home_ctaPrimary}
          </button>
          <Link
            to="/scanner"
            className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold rounded-2xl px-7 py-3.5 text-base transition border border-gray-700"
          >
            {t.home_scanBtn}
          </Link>
          <Link
            to="/radar"
            className="bg-gray-800 hover:bg-gray-700 text-brand-400 font-bold rounded-2xl px-7 py-3.5 text-base transition border border-brand-500/30 hover:border-brand-500/60"
          >
            {t.radar_navLabel} ⬡
          </Link>
        </div>
      </div>

      {/* ── Explanation card ── */}
      <div className="w-full max-w-2xl mx-auto px-4 pb-10">
        <div className="bg-gray-900/70 border border-gray-800 rounded-3xl p-8 md:p-10">

          {/* Card title */}
          <h2 className="text-white text-xl font-bold mb-3">{t.home_explainTitle}</h2>

          {/* Card body */}
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            {t.home_explainBody}
          </p>

          {/* 5 principles */}
          <div className="mb-7">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-3 font-semibold">
              {isHe ? 'הציון מבוסס על 5 עקרונות' : 'Scored on 5 principles'}
            </p>
            <ul className="space-y-2">
              {PRINCIPLES.map((key, i) => (
                <li key={key} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-600/15 border border-brand-600/30 text-brand-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-gray-300 text-sm">{t[key]}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer quote */}
          <div className="border-t border-gray-800 pt-6">
            <p className="text-gray-500 text-sm leading-relaxed mb-1">
              {t.home_explainFooter1}
            </p>
            <p className="text-brand-400 text-sm font-semibold italic">
              {t.home_explainFooter2}
            </p>
          </div>
        </div>
      </div>

      {/* Accuracy card */}
      <div className="w-full max-w-2xl mx-auto px-4 pb-10">
        <PredictionAccuracyCard compact />
      </div>

      {/* Footer */}
      <footer className="text-center text-gray-600 text-xs py-6 border-t border-gray-900 space-y-2">
        <p>{t.home_footer}</p>
        <p className="text-gray-700">{t.footer_dataNote}</p>
        <p>
          <Link to="/legal" className="text-gray-600 hover:text-gray-400 transition underline underline-offset-2">
            {t.footer_legal}
          </Link>
        </p>
      </footer>
    </div>
  )
}
