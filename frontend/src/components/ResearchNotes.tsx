import { useState, useEffect, useRef, useCallback } from 'react'
import { useUserData } from '../contexts/UserDataContext'
import { useLanguage } from '../i18n/index'

interface Props {
  isOpen: boolean
  onClose: () => void
  symbol: string
  companyName: string
}

function timeAgo(iso: string, isHe: boolean): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return isHe ? 'זה עתה' : 'just now'
  if (min < 60) return isHe ? `לפני ${min} דק'` : `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return isHe ? `לפני ${hrs} ש'` : `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return isHe ? `לפני ${days} ימים` : `${days}d ago`
}

export default function ResearchNotes({ isOpen, onClose, symbol, companyName }: Props) {
  const { getNote, setNote, deleteNote, notes } = useUserData()
  const { t, isHe } = useLanguage()
  const [content, setContent] = useState('')
  const [saved,   setSaved]   = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const note = notes.find(n => n.symbol === symbol)

  // Load on open
  useEffect(() => {
    if (isOpen) {
      setContent(getNote(symbol))
      setSaved(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen, symbol, getNote])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Auto-save with debounce
  const handleChange = useCallback((val: string) => {
    setContent(val)
    setSaved(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (val.trim()) {
        setNote(symbol, val)
        setSaved(true)
      }
    }, 800)
  }, [symbol, setNote])

  function handleDelete() {
    deleteNote(symbol)
    setContent('')
    onClose()
  }

  if (!isOpen) return null

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-4" dir={isHe ? 'rtl' : 'ltr'}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:w-[440px] h-[85vh] sm:h-[580px] bg-gray-900 border border-gray-700 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">{t.notes_title}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{companyName} · {symbol}</p>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-emerald-400 text-xs font-medium">
                {isHe ? '✓ נשמר' : '✓ Saved'}
              </span>
            )}
            <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Textarea */}
        <div className="flex-1 p-5 overflow-hidden flex flex-col gap-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => handleChange(e.target.value)}
            placeholder={t.notes_placeholder}
            className="flex-1 w-full bg-gray-800/50 border border-gray-700/50 rounded-2xl px-4 py-3 text-white text-sm leading-7 resize-none focus:outline-none focus:border-brand-500/50 transition placeholder-gray-600"
            style={{ fontFamily: 'inherit' }}
          />
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex-shrink-0 border-t border-gray-800 pt-3 flex items-center justify-between">
          <div className="text-gray-600 text-xs space-y-0.5">
            <p>{t.notes_private}</p>
            {note && (
              <p>{t.notes_last_edit}: {timeAgo(note.updatedAt, isHe)}</p>
            )}
            {wordCount > 0 && (
              <p>{wordCount} {isHe ? 'מילים' : 'words'}</p>
            )}
          </div>
          {note && content.trim() === '' ? (
            <button
              onClick={handleDelete}
              className="text-red-500 hover:text-red-400 text-xs transition"
            >
              {t.notes_delete}
            </button>
          ) : note ? (
            <button
              onClick={handleDelete}
              className="text-gray-600 hover:text-red-400 text-xs transition"
            >
              {t.notes_delete}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
