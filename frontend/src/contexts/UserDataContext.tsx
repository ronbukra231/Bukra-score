/**
 * UserDataContext — per-user research workspace data.
 *
 * Storage: localStorage keyed by userId.
 * Architecture: swap load()/save() helpers for Supabase calls when ready.
 * All types are stable — the rest of the app won't need changes on migration.
 */

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from './AuthContext'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CollectionEntry {
  symbol: string
  name: string
  score: number | null
  sector: string | null
  addedAt: string
}

export interface Collection {
  id: string
  name: string
  nameHe: string
  description: string
  icon: string
  color: string          // tailwind color token, e.g. 'blue' | 'emerald' | 'amber'
  companies: CollectionEntry[]
  createdAt: string
  isDefault: boolean
  order: number
}

export interface ResearchNote {
  symbol: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface RecentCompany {
  symbol: string
  name: string
  score: number | null
  sector: string | null
  lastViewed: string
}

export interface ActivityItem {
  id: string
  type: 'researched' | 'saved' | 'removed' | 'noted'
  symbol?: string
  companyName?: string
  collectionName?: string
  timestamp: string
}

// ── Default collections ───────────────────────────────────────────────────────

const DEFAULT_COLLECTIONS: Omit<Collection, 'companies' | 'createdAt'>[] = [
  { id: 'research',   name: 'Companies Under Research', nameHe: 'חברות במחקר',    icon: '🔬', color: 'blue',    isDefault: true, order: 0, description: '' },
  { id: 'watchlist',  name: 'Watchlist',                nameHe: 'רשימת מעקב',     icon: '⭐', color: 'amber',   isDefault: true, order: 1, description: '' },
  { id: 'buy',        name: 'Buy Candidates',           nameHe: 'מועמדים לקנייה', icon: '💰', color: 'emerald', isDefault: true, order: 2, description: '' },
  { id: 'conviction', name: 'High Conviction',          nameHe: 'אמונה גבוהה',    icon: '❤️', color: 'rose',    isDefault: true, order: 3, description: '' },
  { id: 'rejected',   name: 'Rejected',                 nameHe: 'נדחו',           icon: '🚫', color: 'gray',    isDefault: true, order: 4, description: '' },
]

function makeDefaults(): Collection[] {
  return DEFAULT_COLLECTIONS.map(d => ({ ...d, companies: [], createdAt: new Date().toISOString() }))
}

// ── Context value ─────────────────────────────────────────────────────────────

interface UserDataContextValue {
  // Collections
  collections: Collection[]
  saveToCollection: (collectionId: string, entry: Omit<CollectionEntry, 'addedAt'>) => void
  removeFromCollection: (collectionId: string, symbol: string) => void
  isInCollection: (collectionId: string, symbol: string) => boolean
  getCompanyCollections: (symbol: string) => Collection[]
  createCollection: (data: Pick<Collection, 'name' | 'nameHe' | 'icon' | 'color' | 'description'>) => string
  deleteCollection: (id: string) => void
  totalSaved: number

  // Notes
  notes: ResearchNote[]
  getNote: (symbol: string) => string
  setNote: (symbol: string, content: string) => void
  deleteNote: (symbol: string) => void

  // Recent
  recentCompanies: RecentCompany[]
  trackCompanyView: (c: Omit<RecentCompany, 'lastViewed'>) => void

  // Activity
  activity: ActivityItem[]

  clearAll: () => void
}

const UserDataContext = createContext<UserDataContextValue | null>(null)

// ── Storage helpers ───────────────────────────────────────────────────────────

const MAX_RECENT   = 12
const MAX_ACTIVITY = 50

function skey(uid: string, type: string) { return `bukra_${type}_${uid}` }

function ls<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) as T : fallback }
  catch { return fallback }
}
function lss<T>(key: string, val: T) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* quota */ }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const uid = user?.id ?? null

  const [collections, setCollections] = useState<Collection[]>(makeDefaults())
  const [notes,       setNotes]       = useState<ResearchNote[]>([])
  const [recent,      setRecent]      = useState<RecentCompany[]>([])
  const [activity,    setActivity]    = useState<ActivityItem[]>([])

  useEffect(() => {
    if (!uid) {
      setCollections(makeDefaults())
      setNotes([])
      setRecent([])
      setActivity([])
      return
    }
    // Merge stored collections with defaults (so new default collections appear for existing users)
    const stored: Collection[] = ls(skey(uid, 'collections'), [])
    const storedIds = new Set(stored.map(c => c.id))
    const merged = [
      ...stored,
      ...makeDefaults().filter(d => !storedIds.has(d.id)),
    ].sort((a, b) => a.order - b.order)
    setCollections(merged)
    setNotes(  ls(skey(uid, 'notes'),    []))
    setRecent( ls(skey(uid, 'recent'),   []))
    setActivity(ls(skey(uid, 'activity'),[]))
  }, [uid])

  // ── Activity helper ──
  const pushActivity = useCallback((item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    if (!uid) return
    setActivity(prev => {
      const next = [{ ...item, id: crypto.randomUUID(), timestamp: new Date().toISOString() }, ...prev].slice(0, MAX_ACTIVITY)
      lss(skey(uid, 'activity'), next)
      return next
    })
  }, [uid])

  // ── Collections ──
  const saveToCollection = useCallback((collectionId: string, entry: Omit<CollectionEntry, 'addedAt'>) => {
    if (!uid) return
    setCollections(prev => {
      const next = prev.map(c => {
        if (c.id !== collectionId) return c
        if (c.companies.some(co => co.symbol === entry.symbol)) return c
        return { ...c, companies: [{ ...entry, addedAt: new Date().toISOString() }, ...c.companies] }
      })
      lss(skey(uid, 'collections'), next)
      return next
    })
    const coll = collections.find(c => c.id === collectionId)
    pushActivity({ type: 'saved', symbol: entry.symbol, companyName: entry.name, collectionName: coll?.name })
  }, [uid, collections, pushActivity])

  const removeFromCollection = useCallback((collectionId: string, symbol: string) => {
    if (!uid) return
    setCollections(prev => {
      const next = prev.map(c => c.id !== collectionId ? c : { ...c, companies: c.companies.filter(co => co.symbol !== symbol) })
      lss(skey(uid, 'collections'), next)
      return next
    })
    pushActivity({ type: 'removed', symbol })
  }, [uid, pushActivity])

  const isInCollection = useCallback((collectionId: string, symbol: string) =>
    collections.find(c => c.id === collectionId)?.companies.some(co => co.symbol === symbol) ?? false,
  [collections])

  const getCompanyCollections = useCallback((symbol: string) =>
    collections.filter(c => c.companies.some(co => co.symbol === symbol)),
  [collections])

  const createCollection = useCallback((data: Pick<Collection, 'name' | 'nameHe' | 'icon' | 'color' | 'description'>): string => {
    if (!uid) return ''
    const id = crypto.randomUUID()
    setCollections(prev => {
      const next = [...prev, { ...data, id, companies: [], createdAt: new Date().toISOString(), isDefault: false, order: prev.length }]
      lss(skey(uid, 'collections'), next)
      return next
    })
    return id
  }, [uid])

  const deleteCollection = useCallback((id: string) => {
    if (!uid) return
    setCollections(prev => {
      const next = prev.filter(c => c.id !== id || c.isDefault)
      lss(skey(uid, 'collections'), next)
      return next
    })
  }, [uid])

  const totalSaved = useMemo(() =>
    new Set(collections.flatMap(c => c.companies.map(co => co.symbol))).size,
  [collections])

  // ── Notes ──
  const getNote = useCallback((symbol: string) =>
    notes.find(n => n.symbol === symbol)?.content ?? '',
  [notes])

  const setNote = useCallback((symbol: string, content: string) => {
    if (!uid) return
    setNotes(prev => {
      const now = new Date().toISOString()
      const idx = prev.findIndex(n => n.symbol === symbol)
      let next: ResearchNote[]
      if (idx >= 0) {
        next = prev.map((n, i) => i === idx ? { ...n, content, updatedAt: now } : n)
      } else {
        next = [{ symbol, content, createdAt: now, updatedAt: now }, ...prev]
      }
      lss(skey(uid, 'notes'), next)
      return next
    })
    pushActivity({ type: 'noted', symbol })
  }, [uid, pushActivity])

  const deleteNote = useCallback((symbol: string) => {
    if (!uid) return
    setNotes(prev => { const next = prev.filter(n => n.symbol !== symbol); lss(skey(uid, 'notes'), next); return next })
  }, [uid])

  // ── Recent ──
  const trackCompanyView = useCallback((c: Omit<RecentCompany, 'lastViewed'>) => {
    if (!uid) return
    setRecent(prev => {
      const next = [{ ...c, lastViewed: new Date().toISOString() }, ...prev.filter(r => r.symbol !== c.symbol)].slice(0, MAX_RECENT)
      lss(skey(uid, 'recent'), next)
      return next
    })
    pushActivity({ type: 'researched', symbol: c.symbol, companyName: c.name })
  }, [uid, pushActivity])

  // ── Clear all ──
  const clearAll = useCallback(() => {
    if (!uid) return
    ;['collections', 'notes', 'recent', 'activity'].forEach(k => localStorage.removeItem(skey(uid, k)))
    setCollections(makeDefaults())
    setNotes([])
    setRecent([])
    setActivity([])
  }, [uid])

  return (
    <UserDataContext.Provider value={{
      collections, saveToCollection, removeFromCollection, isInCollection,
      getCompanyCollections, createCollection, deleteCollection, totalSaved,
      notes, getNote, setNote, deleteNote,
      recentCompanies: recent, trackCompanyView,
      activity, clearAll,
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
