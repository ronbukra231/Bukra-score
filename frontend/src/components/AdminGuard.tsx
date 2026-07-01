import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY as string | undefined

function isAdminUnlocked(): boolean {
  if (!ADMIN_KEY) return false
  return sessionStorage.getItem('admin_unlocked') === 'true'
}

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const key = params.get('admin')
    if (key && ADMIN_KEY && key === ADMIN_KEY) {
      sessionStorage.setItem('admin_unlocked', 'true')
    }
    if (isAdminUnlocked()) {
      setAllowed(true)
    } else {
      navigate('/', { replace: true })
    }
  }, [navigate])

  if (!allowed) return null
  return <>{children}</>
}
