import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../i18n/index'

const EDGE_PAD = 12       // minimum gap kept from the viewport edge
const GAP = 8             // gap between the avatar trigger and the menu

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, string> }): string {
  const meta = user.user_metadata ?? {}
  const fullName: string = meta.full_name || meta.name || ''
  if (fullName) return fullName.split(/\s+/)[0]
  return user.email?.split('@')[0] ?? ''
}

const ROLE_KEY = {
  guest: 'um_roleGuest', user: 'um_roleUser', premium: 'um_rolePremium', admin: 'um_roleAdmin',
} as const

export default function UserMenu() {
  const { user, role, signOut } = useAuth()
  const { t, isHe } = useLanguage()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' })

  // Position the menu in fixed (viewport-relative) coordinates computed from
  // the trigger's own bounding rect. This deliberately avoids being placed
  // inside the trigger's `relative` wrapper via absolute + left/right: any
  // ancestor with overflow/transform (both exist elsewhere in this app's
  // layouts) can clip or mis-position an absolutely-positioned descendant,
  // and physical `left-0`/`right-0` classes don't track which side of the
  // header the avatar actually renders on in each language. Measuring in
  // fixed coordinates and portaling to <body> sidesteps both problems.
  //
  // Anchor rule: RTL opens toward the trailing edge nearest the avatar
  // (right edge aligned, expands left/inward); LTR mirrors it (left edge
  // aligned, expands right/inward) — matching each language's natural
  // reading direction. A viewport-collision clamp then guarantees the menu
  // never renders outside the visible screen, regardless of where the
  // avatar sits or how narrow the viewport is.
  const reposition = useCallback(() => {
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    const t0 = trigger.getBoundingClientRect()
    // The menu carries its own intrinsic width via CSS (`w-60`, clamped by
    // `max-w-[calc(100vw-24px)]`) — offsetWidth here reflects that real,
    // already-clamped size. It must NOT be derived from any JS-set style,
    // or the two become circular (an unconstrained portaled block element
    // measures as the full body width on its first, unstyled layout pass).
    const width = menu.offsetWidth

    let left = isHe ? t0.right - width : t0.left
    left = Math.min(left, window.innerWidth - EDGE_PAD - width)
    left = Math.max(left, EDGE_PAD)

    let top = t0.bottom + GAP
    const menuHeight = menu.offsetHeight
    if (top + menuHeight > window.innerHeight - EDGE_PAD && t0.top - menuHeight - GAP >= EDGE_PAD) {
      top = t0.top - menuHeight - GAP   // flip above the trigger if there's no room below
    }

    setStyle({ position: 'fixed', top: `${top}px`, left: `${left}px`, visibility: 'visible' })
  }, [isHe])

  useLayoutEffect(() => {
    if (!open) {
      setStyle({ visibility: 'hidden' })
      return
    }
    reposition()
  }, [open, reposition, t])   // `t` changes on language switch — re-measure new label widths

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    function onScroll() { setOpen(false) }
    function onResize() { reposition() }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onOutside)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, reposition])

  // Not logged in — show login link
  if (!user) {
    return (
      <Link
        to="/login"
        className="text-gray-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition"
      >
        {t.um_login}
      </Link>
    )
  }

  const displayName = getDisplayName(user as { email?: string | null; user_metadata?: Record<string, string> })
  const initial     = displayName?.[0]?.toUpperCase() ?? '?'
  const roleLabel   = t[ROLE_KEY[role]] ?? role

  const rowClass = 'flex items-center gap-2.5 px-3 py-2 text-sm transition'

  return (
    <div className="relative">
      {/* Avatar button */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 rounded-xl px-2.5 py-1.5 transition"
        aria-label={t.um_menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-black shrink-0">
          {initial}
        </div>
        {displayName && (
          <span className="text-gray-300 text-xs hidden md:block max-w-[100px] truncate">
            {displayName}
          </span>
        )}
        <svg className="w-3 h-3 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown — portaled to <body> so no ancestor overflow/transform can clip or mis-position it */}
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          dir={isHe ? 'rtl' : 'ltr'}
          style={style}
          className="z-50 w-60 max-w-[calc(100vw-24px)] bg-gray-900 border border-gray-800 rounded-xl shadow-xl overflow-hidden text-start"
        >
          {/* User info — compact */}
          <div className="px-3 py-2.5 border-b border-gray-800">
            <p className="text-white text-xs font-bold truncate" dir="ltr" style={{ textAlign: isHe ? 'right' : 'left' }}>
              {user.email}
            </p>
            <p className="text-gray-500 text-[11px] mt-0.5">{roleLabel}</p>
          </div>

          {/* Nav items */}
          <div className="py-1">
            <Link
              to="/capital-lab"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`${rowClass} text-amber-400 hover:bg-gray-800 hover:text-amber-300 font-semibold`}
            >
              <span aria-hidden>⚗️</span>
              <span>{t.um_capitalLab}</span>
            </Link>
            <Link
              to="/"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`${rowClass} text-gray-400 hover:bg-gray-800 hover:text-white`}
            >
              <span aria-hidden>🔍</span>
              <span>{t.um_companySearch}</span>
            </Link>
            <Link
              to="/scanner"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`${rowClass} text-gray-400 hover:bg-gray-800 hover:text-white`}
            >
              <span aria-hidden>📡</span>
              <span>{t.um_companyScanner}</span>
            </Link>
            {role === 'admin' && (
              <Link
                to="/journal"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`${rowClass} text-gray-400 hover:bg-gray-800 hover:text-white`}
              >
                <span aria-hidden>🛠️</span>
                <span>{t.um_admin}</span>
              </Link>
            )}
          </div>

          {/* Logout */}
          <div className="py-1 border-t border-gray-800">
            <button
              role="menuitem"
              onClick={async () => {
                setOpen(false)
                await signOut()
                navigate('/')
              }}
              className={`w-full ${rowClass} text-red-400 hover:bg-gray-800`}
            >
              <span aria-hidden>↩</span>
              <span>{t.um_logOut}</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
