import { useStore } from '../store/useStore'

// Flag to ensure interceptor is only initialized once
let isInterceptorInitialized = false

/**
 * Universal Fetch Interceptor
 * Automatically injects authentication tokens and role context headers
 * into all requests targeting `/api/*`, and provides transparent auto-healing
 * if the backend session expires or is restarted.
 */
export function initApiSync() {
  if (typeof window === 'undefined' || isInterceptorInitialized) return
  isInterceptorInitialized = true

  const originalFetch = window.fetch

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    // Intercept local API routes
    if (urlStr.startsWith('/api') || urlStr.includes(':8000/api') || urlStr.includes(':5173/api')) {
      const { user, setUser } = useStore.getState()
      const headers = new Headers(init?.headers)

      // Set default JSON Content-Type for write requests
      if (!headers.has('Content-Type') && !(init?.body instanceof FormData) && init?.method && init.method !== 'GET') {
        headers.set('Content-Type', 'application/json')
      }

      // Inject full authorization & persona context
      if (user?.sessionToken) {
        headers.set('X-Session-Token', user.sessionToken)
      }
      if (user?.role) {
        headers.set('X-Role', user.role)
      }
      if (user?.state) {
        headers.set('X-State', user.state)
      }
      if (user?.district) {
        headers.set('X-District', user.district)
      }
      if (user?.mpId) {
        headers.set('X-MP-ID', user.mpId)
      }
      if (user?.mpName) {
        headers.set('X-MP-Name', user.mpName)
      }

      const modifiedInit: RequestInit = {
        ...init,
        headers,
      }

      let response: Response
      try {
        response = await originalFetch(input, modifiedInit)
      } catch (networkErr) {
        console.warn('[SATARK-SYNC] Network error contacting API:', networkErr)
        throw networkErr
      }

      // Transparent Session Auto-Healing
      // If the backend restarted or session expired (HTTP 403 / 401), re-sync with /api/switch-role and retry
      if ((response.status === 403 || response.status === 401) && user?.role && user.role !== 'viewer') {
        console.warn(`[SATARK-SYNC] Session invalid or server restarted. Auto-reconnecting role '${user.role}'...`)
        try {
          const syncRes = await originalFetch('/api/switch-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: user.role,
              state: user.state,
              district: user.district,
              mp_id: user.mpId,
              mp_name: user.mpName,
            }),
          })

          if (syncRes.ok) {
            const syncJson = await syncRes.json()
            const newToken = syncJson.data.session_token
            setUser({
              ...user,
              sessionToken: newToken,
              permissions: syncJson.data.permissions || user.permissions,
            })

            // Retry original request with freshly minted token
            headers.set('X-Session-Token', newToken)
            response = await originalFetch(input, {
              ...init,
              headers,
            })
            console.log('[SATARK-SYNC] Session seamlessly re-synchronized with backend.')
          }
        } catch (reconnectErr) {
          console.error('[SATARK-SYNC] Auto-reconnect failed:', reconnectErr)
        }
      }

      return response
    }

    return originalFetch(input, init)
  }

  console.log('[SATARK-SYNC] Universal API Interceptor Active: 100% synchronized with backend.')
}

/**
 * Standard typed JSON wrapper around fetch
 */
export async function apiFetch<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(endpoint, options)

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorBody || response.statusText}`)
  }

  return response.json()
}

/**
 * Checks live backend connectivity and latency
 */
export async function pingBackend(): Promise<{ online: boolean; latencyMs: number }> {
  const t0 = performance.now()
  try {
    const res = await fetch('/api/national', { method: 'GET' })
    const latencyMs = Math.round(performance.now() - t0)
    return { online: res.ok, latencyMs }
  } catch {
    return { online: false, latencyMs: 0 }
  }
}
