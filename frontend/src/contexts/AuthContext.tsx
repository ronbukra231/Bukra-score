import { createContext, useContext, useEffect, useState } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type Role = 'guest' | 'user' | 'premium' | 'admin'

interface AuthContextValue {
  user:            User | null
  session:         Session | null
  loading:         boolean
  role:            Role
  isAuthenticated: boolean
  signIn:          (email: string, password: string) => Promise<AuthError | null>
  signOut:         () => Promise<void>
  getAccessToken:  () => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function deriveRole(user: User | null): Role {
  if (!user) return 'guest'
  // app_metadata is set server-side only — users cannot spoof it
  const role = user.app_metadata?.role as string | undefined
  if (role === 'admin')   return 'admin'
  if (role === 'premium') return 'premium'
  return 'user'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // If Supabase is not configured, resolve immediately as guest — app keeps working normally
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session)
        setUser(data.session?.user ?? null)
        setLoading(false)
      })
      .catch(() => {
        // Auth failure must never break the app
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<AuthError | null> {
    if (!supabase) return null
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signOut(): Promise<void> {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  async function getAccessToken(): Promise<string | null> {
    if (!supabase) return null
    try {
      const { data } = await supabase.auth.getSession()
      return data.session?.access_token ?? null
    } catch {
      return null
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      role:            deriveRole(user),
      isAuthenticated: user !== null,
      signIn,
      signOut,
      getAccessToken,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
