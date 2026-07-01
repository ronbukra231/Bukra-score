import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type Role = 'guest' | 'user' | 'premium' | 'admin'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  role: Role
  signIn: (email: string, password: string) => Promise<AuthError | null>
  signUp: (email: string, password: string) => Promise<AuthError | null>
  signInWithGoogle: () => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function deriveRole(user: User | null): Role {
  if (!user) return 'guest'
  // app_metadata is set server-side only — users cannot spoof it
  const role = user.app_metadata?.role as string | undefined
  if (role === 'admin') return 'admin'
  if (role === 'premium') return 'premium'
  return 'user'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // If Supabase is not configured, treat everyone as guest immediately
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    }).catch(() => {
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

  async function signUp(email: string, password: string): Promise<AuthError | null> {
    if (!supabase) return null
    const { error } = await supabase.auth.signUp({ email, password })
    return error
  }

  // Returns null on success (redirect pending), or an error message string on failure
  async function signInWithGoogle(): Promise<string | null> {
    if (!supabase) return 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) {
        console.error('[Bukra] Google OAuth error:', error)
        return error.message
      }
      return null
    } catch (err) {
      console.error('[Bukra] Google OAuth unexpected error:', err)
      return 'An unexpected error occurred. Please try again.'
    }
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      role: deriveRole(user),
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
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
