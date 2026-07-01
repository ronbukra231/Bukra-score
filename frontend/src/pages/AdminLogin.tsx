import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminLogin() {
  const { signIn, signOut, role, loading, user } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // If already admin, send to journal (or wherever they tried to go)
  if (!loading && role === 'admin') {
    navigate('/journal', { replace: true })
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const err = await signIn(email, password)
    setSubmitting(false)

    if (err) {
      setError('Incorrect credentials.')
      return
    }

    // Role resolves via onAuthStateChange in AuthContext; check after brief delay
    setTimeout(() => {
      // user/role state comes from AuthContext — no direct supabase call needed
      // The redirect happens via the `if (!loading && role === 'admin')` guard above
      // If still not admin after 1s, sign out
    }, 1000)
    // Fallback: if role doesn't flip to admin within 2s, deny access
    setTimeout(async () => {
      if (role !== 'admin') {
        await signOut()
        setError('Access denied. This account does not have admin privileges.')
      }
    }, 2000)
  }

  if (loading) return null

  // If a non-admin user is somehow here, show denial
  if (user && role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center" dir="ltr">
        <div className="bg-gray-900 border border-red-800 rounded-3xl p-10 text-center max-w-sm">
          <div className="text-4xl mb-4">🚫</div>
          <h2 className="text-white font-bold text-xl mb-2">Access Denied</h2>
          <p className="text-gray-400 text-sm mb-6">Your account does not have admin privileges.</p>
          <button onClick={signOut} className="text-red-400 text-sm hover:underline">Sign out</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4" dir="ltr">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl mb-2">🔐</div>
          <h1 className="text-white text-xl font-bold">Admin Login</h1>
          <p className="text-gray-600 text-xs mt-1">Bukra Capital — Internal Access</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-500 transition"
                placeholder="admin@bukra.co"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-500 transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold rounded-xl py-3 transition"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          Not an admin?{' '}
          <a href="/" className="text-gray-500 hover:text-gray-300 transition">Go home</a>
        </p>
      </div>
    </div>
  )
}
