import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { role, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && role !== 'admin') {
      navigate('/admin/login', { replace: true })
    }
  }, [role, loading, navigate])

  if (loading || role !== 'admin') return null
  return <>{children}</>
}
