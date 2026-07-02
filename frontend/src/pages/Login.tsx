import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function hebrewError(msg: string): string {
  if (/invalid.*credentials|invalid login/i.test(msg)) return 'אימייל או סיסמה שגויים'
  if (/email.*not.*confirmed/i.test(msg))              return 'יש לאמת את כתובת האימייל לפני הכניסה'
  if (/too many requests/i.test(msg))                  return 'יותר מדי ניסיונות — אנא המתן ונסה שוב'
  if (/network/i.test(msg))                            return 'בעיית רשת — בדוק את החיבור לאינטרנט'
  return 'שגיאה בהתחברות — אנא נסה שוב'
}

export default function Login() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim())    { setError('יש להזין כתובת אימייל');  return }
    if (!password)        { setError('יש להזין סיסמה');          return }

    setLoading(true)
    const authError = await signIn(email.trim(), password)
    setLoading(false)

    if (authError) {
      setError(hebrewError(authError.message))
      return
    }

    // onAuthStateChange in AuthContext updates session automatically
    navigate('/')
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gray-950 flex items-center justify-center px-4"
    >
      <div className="w-full max-w-md">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">ציון בוקרא</h1>
          <p className="text-gray-400 text-sm">התחבר לחשבון שלך</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-5"
        >
          {/* Error banner */}
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm text-gray-300 mb-1.5" htmlFor="email">
              אימייל
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm text-gray-300 mb-1.5" htmlFor="password">
              סיסמה
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition"
            />
          </div>

          {/* Login button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition"
          >
            {loading ? 'מתחבר...' : 'התחברות'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-gray-500 text-xs">או</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          {/* Google — disabled placeholder */}
          <button
            type="button"
            disabled
            title="Google login coming soon"
            className="w-full flex items-center justify-center gap-3 bg-gray-800 border border-gray-700 text-gray-400 font-medium py-2.5 rounded-lg cursor-not-allowed opacity-60"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            כניסה עם Google — בקרוב
          </button>
        </form>

        {/* Back to homepage */}
        <p className="text-center mt-6 text-sm text-gray-500">
          <Link to="/" className="text-blue-400 hover:text-blue-300 transition">
            ← חזרה לדף הבית
          </Link>
        </p>
      </div>
    </div>
  )
}
