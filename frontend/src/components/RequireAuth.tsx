import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  children: React.ReactNode
}

/**
 * Wrap any route element with <RequireAuth> to require authentication.
 * Unauthenticated users are redirected to /login; after login they are
 * returned to the page they originally requested via location.state.from.
 *
 * Usage in App.tsx:
 *   <Route path="/capital-lab" element={<RequireAuth><CapitalLab /></RequireAuth>} />
 */
export default function RequireAuth({ children }: Props) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  // While AuthContext is resolving the session, render nothing.
  // This prevents a flash-redirect before Supabase confirms the session.
  if (loading) return null

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    )
  }

  return <>{children}</>
}
