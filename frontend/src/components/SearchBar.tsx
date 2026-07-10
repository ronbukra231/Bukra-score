import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { searchCompanies } from '../api/client'
import { useLanguage } from '../i18n/index'
import { trackCompanySearch } from '../lib/analytics'

interface Result {
  symbol: string
  name: string
  sector: string
  type: string
}

const SEARCH_CACHE_KEY = 'bukra_search_cache'
const SEARCH_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCachedSearch(q: string): Result[] | null {
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    const entry = cache[q.toLowerCase()]
    if (!entry) return null
    if (Date.now() - entry.ts > SEARCH_CACHE_TTL) return null
    return entry.data
  } catch { return null }
}

function setCachedSearch(q: string, data: Result[]) {
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : {}
    cache[q.toLowerCase()] = { ts: Date.now(), data }
    // Keep cache small: prune entries beyond 50
    const keys = Object.keys(cache)
    if (keys.length > 50) delete cache[keys[0]]
    localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cache))
  } catch { /* localStorage unavailable */ }
}

export default function SearchBar({ large = false, variant = 'default' }: {
  large?: boolean
  /** 'estate' renders the Research Estate styling — hairlines, warm dark, serif register */
  variant?: 'default' | 'estate'
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { t, lang } = useLanguage()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (timer.current) clearTimeout(timer.current)
    if (!val.trim() || val.trim().length < 2) { setResults([]); setOpen(false); return }

    // Serve from localStorage cache instantly if available
    const cached = getCachedSearch(val)
    if (cached) {
      setResults(cached)
      setOpen(true)
      return
    }

    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchCompanies(val)
        setCachedSearch(val, data)
        setResults(data)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
  }

  function handleSelect(symbol: string) {
    setOpen(false)
    setQuery('')
    trackCompanySearch(symbol)
    navigate(`/company/${symbol}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && query.trim()) {
      handleSelect(query.trim().toUpperCase())
    }
  }

  const inputClass = variant === 'estate'
    ? 'w-full bg-stone-950/50 border border-stone-800 rounded-2xl py-4 px-6 pr-14 text-lg font-light text-stone-100 placeholder-stone-600 focus:outline-none focus:border-[#c9a962]/50 transition-colors duration-500'
    : large
    ? 'w-full bg-gray-800 border border-gray-700 rounded-2xl py-4 px-5 pr-14 text-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition'
    : 'w-full bg-gray-800 border border-gray-700 rounded-xl py-2.5 px-4 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition'

  const inputDir = lang === 'he' ? 'rtl' : 'ltr'

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t.search_placeholder}
          className={inputClass}
          dir={inputDir}
        />
        <Search
          className={`absolute top-1/2 -translate-y-1/2 left-4 ${variant === 'estate' ? 'text-stone-600' : 'text-gray-400'} ${large ? 'w-6 h-6' : 'w-4 h-4'}`}
        />
      </div>

      {open && results.length > 0 && (
        <div className={`absolute z-50 w-full mt-2 rounded-xl shadow-2xl overflow-hidden border
          ${variant === 'estate' ? 'bg-[#12100e] border-stone-800' : 'bg-gray-800 border-gray-700'}`}>
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => handleSelect(r.symbol)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition text-right
                ${variant === 'estate' ? 'hover:bg-stone-900' : 'hover:bg-gray-700'}`}
            >
              <div className={`text-xs font-bold rounded-lg px-2 py-1 min-w-[56px] text-center
                ${variant === 'estate' ? 'border border-[#c9a962]/40 text-[#c9a962]' : 'bg-brand-600 text-white'}`}>
                {r.symbol}
              </div>
              <div>
                <div className="text-white text-sm font-medium">{r.name}</div>
                {r.sector && <div className="text-gray-400 text-xs">{r.sector}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-700 rounded-xl p-4 text-center text-gray-400 text-sm">
          {t.search_loading}
        </div>
      )}
    </div>
  )
}
