/**
 * RouteTracker — mounts inside BrowserRouter and fires page_view + route_load_time
 * on every React Router navigation, including the initial load.
 * Renders nothing — pure side-effect component.
 */
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPage, trackRouteLoadTime } from '../lib/analytics'

export default function RouteTracker() {
  const location  = useLocation()
  const startRef  = useRef<number>(performance.now())
  const firstRef  = useRef(true)

  useEffect(() => {
    const path = location.pathname

    // Measure time from navigation start to this effect running
    const durationMs = Math.round(performance.now() - startRef.current)

    trackPage(path)

    // Don't report load time for the initial render — that's Web Vitals territory
    if (!firstRef.current) {
      trackRouteLoadTime(path, durationMs)
    }

    firstRef.current = false
    // Reset timer for the next navigation
    startRef.current = performance.now()
  }, [location.pathname])

  return null
}
