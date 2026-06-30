import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initAnalytics, trackWebVital } from './lib/analytics'

// Initialise GA4 once before first render — lazy-loads gtag.js, no blocking.
initAnalytics()

// Report Web Vitals to GA4 after the page has settled.
// onCLS/onFCP/onLCP are observer-based — they fire when the browser has data.
import('web-vitals').then(({ onCLS, onFCP, onLCP, onINP, onTTFB }) => {
  onCLS( m => trackWebVital('CLS',  m.value, m.rating))
  onFCP( m => trackWebVital('FCP',  m.value, m.rating))
  onLCP( m => trackWebVital('LCP',  m.value, m.rating))
  onINP( m => trackWebVital('INP',  m.value, m.rating))
  onTTFB(m => trackWebVital('TTFB', m.value, m.rating))
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
