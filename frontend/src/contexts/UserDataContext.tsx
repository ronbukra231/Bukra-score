/**
 * UserDataContext — manages per-user research data (watchlist, recent companies, activity).
 *
 * Currently backed by localStorage keyed by user ID.
 * Architecture is ready for Supabase tables: swap the storage functions below
 * and the rest of the app is unaffected.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecentCompany {
  symbol: string
  name: string
  score: number | null
  sector: string | null
  lastViewed: string
}

export interface WatchlistCompany {
  symbol: string
  name: string
  score: number | null
  sector: string | null
  addedAt: string
}

export interface ActivityItem {
  id: string
  type: 'researched' | 'searched' | 'saved' | 'removed'
  symbol?: string
  companyName?: string
  query?: string
  timestamp: string
}

interface UserDataContextValue {
  recentCompanies: RecentCompany[]
  watchlist: WatchlistCompany[]
  activity: ActivityItem[]
  trackCompanyView: (c: Omit<RecentCompany, 'lastViewed'>) => void
  addToWatchlist: (c: Omit<WatchlistCompany, 'addedAt'>) => void
  removeFromWatchlist: (symbol: string) => void
  isInWatchlist: (symbol: string) => boolean
  clearAll: () => void
}

const UserDataContext = createContext<UserDataContextValue | null>(null)

// ── Storage helpers (swap these for Supabase calls later) ─────────────────────

const MAX_RECENT = 10
const MAX_ACTIVITY = 50

function storageKey(userId: string, type: string) {
  return `bukra_${type}_${userId}`
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* quota exceeded — silently skip */ }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const uid = user?.id ?? null

  const [recentCompanies, setRecent]   = useState<RecentCompany[]>([])
  const [watchlist,        setWatchlist] = useState<WatchlistCompany[]>([])
  const [activity,         setActivity] = useState<ActivityItem[]>([])

  // Load from localStorage when user changes
  useEffect(() => {
    if (!uid) {
      setRecent([])
      setWatchlist([])
      setActivity([])
      return
    }
    setRecent(   load(storageKey(uid, 'recent'),    []))
    setWatchlist(load(storageKey(uid, 'watchlist'), []))
    setActivity( load(storageKey(uid, 'activity'),  []))
  }, [uid])

  const pushActivity = useCallback((item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    if (!uid) return
    setActivity(prev => {
      const next = [
        { ...item, id: crypto.randomUUID(), timestamp: new Date().toISOString() },
        ...prev,
      ].slice(0, MAX_ACTIVITY)
      save(storageKey(uid, 'activity'), next)
      return next
    })
  }, [uid])

  const trackCompanyView = useCallback((c: Omit<RecentCompany, 'lastViewed'>) => {
    if (!uid) return
    setRecent(prev => {
      const filtered = prev.filter(r => r.symbol !== c.symbol)
      const next = [{ ...c, lastViewed: new Date().toISOString() }, ...filtered].slice(0, MAX_RECENT)
      save(storageKey(uid, 'recent'), next)
      return next
    })
    pushActivity({ type: 'researched', symbol: c.symbol, companyName: c.name })
  }, [uid, pushActivity])

  const addToWatchlist = useCallback((c: Omit<WatchlistCompany, 'addedAt'>) => {
    if (!uid) return
    setWatchlist(prev => {
      if (prev.some(w => w.symbol === c.symbol)) return prev
      const next = [{ ...c, addedAt: new Date().toISOString() }, ...prev]
      save(storageKey(uid, 'watchlist'), next)
      return next
    })
    pushActivity({ type: 'saved', symbol: c.symbol, companyName: c.name })
  }, [uid, pushActivity])

  const removeFromWatchlist = useCallback((symbol: string) => {
    if (!uid) return
    setWatchlist(prev => {
      const next = prev.filter(w => w.symbol !== symbol)
      save(storageKey(uid, 'watchlist'), next)
      return next
    })
    pushActivity({ type: 'removed', symbol })
  }, [uid, pushActivity])

  const isInWatchlist = useCallback((symbol: string) =>
    watchlist.some(w => w.symbol === symbol), [watchlist])

  const clearAll = useCallback(() => {
    if (!uid) return
    localStorage.removeItem(storageKey(uid, 'recent'))
    localStorage.removeItem(storageKey(uid, 'watchlist'))
    localStorage.removeItem(storageKey(uid, 'activity'))
    setRecent([])
    setWatchlist([])
    setActivity([])
  }, [uid])

  return (
    <UserDataContext.Provider value={{
      recentCompanies, watchlist, activity,
      trackCompanyView, addToWatchlist, removeFromWatchlist, isInWatchlist, clearAll,
    }}>
      {children}
    </UserDataContext.Provider>
  )
}

export function useUserData(): UserDataContextValue {
  const ctx = useContext(UserDataContext)
  if (!ctx) throw new Error('useUserData must be inside UserDataProvider')
  return ctx
}
