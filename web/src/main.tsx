import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initApiSync, warmupApiCache } from './lib/api'

// Initialize 100% synchronized API interceptor and pre-warm core caches safely
try {
  initApiSync()
  warmupApiCache()
} catch (syncErr) {
  console.warn('[SATARK-INIT] Cache warmup warning:', syncErr)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
