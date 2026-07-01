import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../i18n/index'

function getFirstName(user: { email?: string | null; user_metadata?: Record<string, string> }): string {
  const meta = user.user_metadata ?? {}
  const fullName: string = meta.full_name || meta.name || ''
  if (fullName) return fullName.split(/\s+/)[0]
  return user.email?.split('@')[0] ?? ''
}

export default function UserMenu() {
  const { user, role, signOut } = useAuth()
  const { t, isHe } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          to="/login"
          className="text-gray-300 hover:text-white text-xs font-semibold transition px-3 py-1.5 rounded-lg hover:bg-gray-800"
        >
          {t.auth_login}
        </Link>
        <Link
          to="/login"
          className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
        >
          {t.auth_signup}
        </Link>
      </div>
    )
  }

  const firstName = getFirstName(user as any)
  const initial = firstName?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? '?'
  const dropdownAlign = isHe ? 'left-0' : 'right-0'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 rounded-xl px-2.5 py-1.5 transition"
      >
        <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-black">
          {initial}
        </div>
        {firstName && (
          <span className="text-gray-300 text-xs hidden md:block max-w-[100px] truncate">
            {firstName}
          </span>
        )}
        <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={`absolute top-full mt-2 w-56 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden ${dropdownAlign}`}>
          {/* User info */}
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/80">
            <p className="text-white text-xs font-bold truncate">{user.email}</p>
            <p className="text-gray-500 text-xs capitalize mt-0.5">{role}</p>
          </div>

          {/* Nav items */}
          <div className="py-1">
            <Link
              to="/desk"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-gray-800 hover:text-white text-sm transition"
            >
              <span className="text-base">🏠</span>
              <span>{t.desk_nav}</span>
            </Link>
            <Link
              to="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-gray-400 hover:bg-gray-800 hover:text-white text-sm transition"
            >
              <span className="text-base">🔍</span>
              <span>{isHe ? 'חיפוש חברות' : 'Company Search'}</span>
            </Link>
            <Link
              to="/scanner"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-gray-400 hover:bg-gray-800 hover:text-white text-sm transition"
            >
              <span className="text-base">📡</span>
              <span>{isHe ? 'סורק חברות' : 'Scanner'}</span>
            </Link>
          </div>

          {/* Logout */}
          <div className="py-1 border-t border-gray-800">
            <button
              onClick={async () => { setOpen(false); await signOut() }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-gray-800 text-sm transition"
            >
              <span className="text-base">↩</span>
              <span>{t.auth_logout}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
