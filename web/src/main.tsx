import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initApiSync, warmupApiCache } from './lib/api'
import { initGlobalLinkPrefetcher } from './lib/speedPrefetch'

// Initialize 100% synchronized API interceptor, global prefetcher, and pre-warm core caches safely
try {
  initApiSync()
  warmupApiCache()
  initGlobalLinkPrefetcher()
} catch (syncErr) {
  console.log('[SATARK-INIT] Cache warmup warning:', syncErr)
}

// Automatically reload page when a new deployment renders older cached chunk hashes obsolete
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite Preload Error] Reloading page to fetch updated chunks...', event)
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
