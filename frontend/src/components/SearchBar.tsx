import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { searchCompanies } from '../api/client'
import { useLanguage } from '../i18n/index'

interface Result {
  symbol: string
  name: string
  sector: string
  type: string
}

export default function SearchBar({ large = false }: { large?: boolean }) {
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
    if (!val.trim()) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchCompanies(val)
        setResults(data)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  function handleSelect(symbol: string) {
    setOpen(false)
    setQuery('')
    navigate(`/company/${symbol}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && query.trim()) {
      handleSelect(query.trim().toUpperCase())
    }
  }

  const inputClass = large
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
          className={`absolute top-1/2 -translate-y-1/2 left-4 text-gray-400 ${large ? 'w-6 h-6' : 'w-4 h-4'}`}
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => handleSelect(r.symbol)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition text-right"
            >
              <div className="bg-brand-600 text-white text-xs font-bold rounded-lg px-2 py-1 min-w-[56px] text-center">
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
