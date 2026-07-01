import { useState, FormEvent, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../i18n/index'
import LanguageToggle from '../components/LanguageToggle'

export default function Login() {
  const { signIn, signUp, signInWithGoogle, loading, user } = useAuth()
  const { t, isHe } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from ?? '/desk'

  // Handle OAuth redirect back — user becomes non-null after Google OAuth
  useEffect(() => {
    if (user) {
      const dest = !from || from === '/' || from === '/login' ? '/desk' : from
      navigate(dest, { replace: true })
    }
  }, [user, from, navigate])

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [signupDone, setSignupDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    if (mode === 'login') {
      const err = await signIn(email, password)
      if (err) {
        setError(isHe ? 'פרטי הכניסה שגויים. נסה שוב.' : 'Incorrect credentials. Please try again.')
      } else {
        const dest = !from || from === '/' || from === '/login' ? '/desk' : from
        navigate(dest, { replace: true })
      }
    } else {
      const err = await signUp(email, password)
      if (err) {
        setError(err.message)
      } else {
        setSignupDone(true)
      }
    }
    setSubmitting(false)
  }

  async function handleGoogle() {
    await signInWithGoogle()
    // redirect handled by Supabase OAuth flow
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4" dir={isHe ? 'rtl' : 'ltr'}>

      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="text-brand-400 text-2xl font-black tracking-tight">
            בוקרה קפיטל
          </Link>
          <p className="text-gray-500 text-sm mt-2">
            {isHe ? 'לא משקיעים לפני שבודקים.' : 'Check before you invest.'}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8">

          {signupDone ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-4">✉️</div>
              <h2 className="text-white text-xl font-bold mb-2">
                {isHe ? 'בדוק את האימייל שלך' : 'Check your email'}
              </h2>
              <p className="text-gray-400 text-sm">
                {isHe
                  ? 'שלחנו לך קישור לאימות. לאחר האימות תוכל להתחבר.'
                  : 'We sent you a confirmation link. After confirming, you can sign in.'}
              </p>
              <button
                onClick={() => { setMode('login'); setSignupDone(false) }}
                className="mt-6 text-brand-400 text-sm hover:underline"
              >
                {t.auth_haveAccount}
              </button>
            </div>
          ) : (
            <>
              {/* Mode tabs */}
              <div className="flex rounded-xl bg-gray-800 p-1 mb-6">
                <button
                  onClick={() => { setMode('login'); setError(null) }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'login' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {t.auth_login}
                </button>
                <button
                  onClick={() => { setMode('signup'); setError(null) }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'signup' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {t.auth_signup}
                </button>
              </div>

              {/* Google OAuth */}
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-xl px-4 py-3 transition mb-4"
              >
                <GoogleIcon />
                {t.auth_continueGoogle}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-gray-600 text-xs">{t.auth_or}</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              {/* Email/password form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">{t.auth_email}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-500 transition"
                    placeholder="you@example.com"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">{t.auth_password}</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-500 transition"
                    placeholder="••••••••"
                    dir="ltr"
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
                  {submitting
                    ? (isHe ? 'מתחבר...' : 'Signing in...')
                    : mode === 'login' ? t.auth_login : t.auth_signup}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-gray-600 hover:text-gray-400 text-sm transition">
            ← {t.auth_backHome}
          </Link>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.31z"/>
    </svg>
  )
}
