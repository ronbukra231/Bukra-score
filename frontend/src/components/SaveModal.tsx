import { useState, useEffect, useRef } from 'react'
import { useUserData } from '../contexts/UserDataContext'
import type { Collection } from '../contexts/UserDataContext'
import { useLanguage } from '../i18n/index'

export interface SaveTarget {
  symbol: string
  name: string
  score: number | null
  sector: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  company: SaveTarget
}

const COLLECTION_COLORS: Record<string, string> = {
  blue:    'bg-blue-500/15 border-blue-500/40 text-blue-400',
  amber:   'bg-amber-500/15 border-amber-500/40 text-amber-400',
  emerald: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
  rose:    'bg-rose-500/15 border-rose-500/40 text-rose-400',
  gray:    'bg-gray-500/15 border-gray-500/40 text-gray-400',
  violet:  'bg-violet-500/15 border-violet-500/40 text-violet-400',
  teal:    'bg-teal-500/15 border-teal-500/40 text-teal-400',
  orange:  'bg-orange-500/15 border-orange-500/40 text-orange-400',
}

const PRESET_COLORS = ['blue', 'emerald', 'amber', 'rose', 'violet', 'teal', 'orange', 'gray'] as const
const PRESET_ICONS  = ['📁', '🌍', '💊', '💸', '🔋', '🛡️', '🏭', '🤖', '🏠', '🚀', '📡', '🎯']

export default function SaveModal({ isOpen, onClose, company }: Props) {
  const { collections, saveToCollection, removeFromCollection, isInCollection, createCollection } = useUserData()
  const { t, isHe } = useLanguage()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName]   = useState('')
  const [newIcon, setNewIcon]   = useState('📁')
  const [newColor, setNewColor] = useState('blue')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creating && nameRef.current) nameRef.current.focus()
  }, [creating])

  useEffect(() => {
    if (!isOpen) { setCreating(false); setNewName('') }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  function toggle(c: Collection) {
    if (isInCollection(c.id, company.symbol)) {
      removeFromCollection(c.id, company.symbol)
    } else {
      saveToCollection(c.id, { symbol: company.symbol, name: company.name, score: company.score, sector: company.sector })
    }
  }

  function handleCreate() {
    if (!newName.trim()) return
    const id = createCollection({ name: newName.trim(), nameHe: newName.trim(), icon: newIcon, color: newColor, description: '' })
    if (id) {
      saveToCollection(id, { symbol: company.symbol, name: company.name, score: company.score, sector: company.sector })
    }
    setCreating(false)
    setNewName('')
    setNewIcon('📁')
    setNewColor('blue')
  }

  const savedCount = collections.filter(c => isInCollection(c.id, company.symbol)).length

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl overflow-hidden"
        dir={isHe ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-white font-bold text-lg">{t.save_title}</h2>
              <p className="text-gray-500 text-xs mt-0.5">{company.name} · {company.symbol}</p>
            </div>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition mt-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {savedCount > 0 && (
            <p className="text-brand-400 text-xs mt-2">
              {isHe ? `שמור ב-${savedCount} אוספים` : `Saved in ${savedCount} collection${savedCount > 1 ? 's' : ''}`}
            </p>
          )}
        </div>

        {/* Collection list */}
        <div className="px-4 py-3 space-y-1.5 max-h-72 overflow-y-auto">
          {collections.map(c => {
            const checked = isInCollection(c.id, company.symbol)
            const colorClass = COLLECTION_COLORS[c.color] ?? COLLECTION_COLORS.gray
            return (
              <button
                key={c.id}
                onClick={() => toggle(c)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition text-left ${
                  checked
                    ? colorClass
                    : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/50'
                }`}
              >
                <span className="text-xl flex-shrink-0">{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${checked ? '' : 'text-gray-300'}`}>
                    {isHe ? c.nameHe : c.name}
                  </p>
                  <p className="text-xs text-gray-600">{c.companies.length} {isHe ? 'חברות' : 'companies'}</p>
                </div>
                {checked && (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>

        {/* New collection form */}
        {creating ? (
          <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
            <input
              ref={nameRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              placeholder={t.coll_name_placeholder}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 transition"
            />
            {/* Icon picker */}
            <div className="flex flex-wrap gap-2">
              {PRESET_ICONS.map(icon => (
                <button
                  key={icon}
                  onClick={() => setNewIcon(icon)}
                  className={`text-xl p-1.5 rounded-lg transition ${newIcon === icon ? 'bg-gray-700 ring-1 ring-brand-500' : 'hover:bg-gray-800'}`}
                >
                  {icon}
                </button>
              ))}
            </div>
            {/* Color picker */}
            <div className="flex gap-2">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setNewColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition ${
                    newColor === color ? 'border-white scale-110' : 'border-transparent'
                  } ${color === 'blue' ? 'bg-blue-500' : color === 'emerald' ? 'bg-emerald-500' : color === 'amber' ? 'bg-amber-500' : color === 'rose' ? 'bg-rose-500' : color === 'violet' ? 'bg-violet-500' : color === 'teal' ? 'bg-teal-500' : color === 'orange' ? 'bg-orange-500' : 'bg-gray-500'}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-bold py-2 rounded-xl transition"
              >
                {t.coll_create}
              </button>
              <button
                onClick={() => setCreating(false)}
                className="px-4 text-gray-400 hover:text-white text-sm transition"
              >
                {t.coll_cancel}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 pb-4 border-t border-gray-800 pt-3 flex gap-2">
            <button
              onClick={() => setCreating(true)}
              className="flex-1 text-gray-400 hover:text-white text-sm transition py-2 rounded-xl hover:bg-gray-800 border border-gray-800 hover:border-gray-700"
            >
              {t.save_new_collection}
            </button>
            <button
              onClick={onClose}
              className="px-5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold py-2 rounded-xl transition"
            >
              {t.save_done}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
