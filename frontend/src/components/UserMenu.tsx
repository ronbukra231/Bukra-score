import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../i18n/index'

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
          state={{ mode: 'signup' }}
          className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
        >
          {t.auth_signup}
        </Link>
      </div>
    )
  }

  const initial = user.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 rounded-xl px-3 py-1.5 transition"
      >
        <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
          {initial}
        </div>
        <span className="text-gray-300 text-xs hidden md:block max-w-[120px] truncate">
          {user.email}
        </span>
        <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={`absolute top-full mt-2 w-52 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl z-50 py-2 ${isHe ? 'left-0' : 'right-0'}`}>
          <div className="px-4 py-2 border-b border-gray-800">
            <p className="text-white text-xs font-semibold truncate">{user.email}</p>
            <p className="text-gray-500 text-xs capitalize mt-0.5">{role}</p>
          </div>
          <button
            onClick={async () => { setOpen(false); await signOut() }}
            className="w-full text-left px-4 py-2.5 text-red-400 hover:bg-gray-800 text-xs transition"
          >
            {t.auth_logout}
          </button>
        </div>
      )}
    </div>
  )
}
