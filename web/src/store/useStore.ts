import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'device' | 'light' | 'dark' | 'auto'
export type LangMode = 'en' | 'hi'

export interface UserState {
  role: string
  state?: string
  district?: string
  mpId?: string
  mpName?: string
  sessionToken?: string
  permissions: string[]
}

interface AppStore {
  user: UserState
  theme: ThemeMode
  lang: LangMode
  searchQuery: string
  bannerDismissed: boolean
  setUser: (user: UserState) => void
  setTheme: (theme: ThemeMode) => void
  setLang: (lang: LangMode) => void
  setSearchQuery: (query: string) => void
  setBannerDismissed: (dismissed: boolean) => void
  switchRole: (
    role: string,
    state?: string,
    district?: string,
    mpId?: string,
    mpName?: string
  ) => Promise<void>
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      user: {
        role: 'viewer',
        permissions: ['read:national', 'read:states', 'read:mps', 'read:map'],
        sessionToken: 'default_viewer'
      },
      theme: 'light',
      lang: 'en',
      searchQuery: '',
      bannerDismissed: false,
      setUser: (user) => set({ user }),
      setTheme: (theme) => set({ theme }),
      setLang: (lang) => set({ lang }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setBannerDismissed: (bannerDismissed) => set({ bannerDismissed }),
      switchRole: async (
        role: string,
        state?: string,
        district?: string,
        mpId?: string,
        mpName?: string
      ) => {
        const defaultPermissions = role === 'mospi'
          ? ['read:all', 'write:all', 'audit:execute', 'admin:access']
          : role === 'state_nodal_officer'
          ? ['read:state', 'write:state', 'audit:inspect', 'read:my_state', 'read:entity_risks', 'read:national', 'read:states', 'read:mps', 'read:map']
          : role === 'district_authority'
          ? ['read:district', 'write:district', 'audit:inspect', 'read:district_dashboard', 'read:national', 'read:states', 'read:mps', 'read:map', 'action:sanction_work', 'action:review_mb']
          : role === 'mp'
          ? ['read:mp', 'write:mp', 'read:mp_dashboard', 'read:national', 'read:states', 'read:mps', 'read:map', 'action:do_letter']
          : ['read:national', 'read:states', 'read:mps', 'read:map']

        const newState = state || 'ALL'
        const newDistrict = district || 'ALL'
        const newMpId = mpId || 'ALL'
        const newMpName = mpName || (role === 'mp' ? 'All Members of Parliament' : undefined)

        // 1. Instantaneous local update (0ms UI latency)
        set({
          user: {
            role,
            state: newState,
            district: newDistrict,
            mpId: newMpId,
            mpName: newMpName,
            sessionToken: `demo_session_${role}_${Date.now()}`,
            permissions: defaultPermissions
          }
        })

        // 2. Clear role-specific stale data from session storage
        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            sessionStorage.removeItem('cached_nat_data')
            sessionStorage.removeItem('cached_nat_states')
            sessionStorage.removeItem('cached_nat_analytics')
          } catch {}
        }

        // 3. Asynchronously synchronize with backend in background (never block navigation)
        fetch('/api/switch-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role,
            state: newState,
            district: newDistrict,
            mp_id: newMpId,
            mp_name: newMpName
          }),
        }).then(async (res) => {
          if (res.ok) {
            const json = await res.json()
            if (json?.data) {
              set((prev) => ({
                user: {
                  ...prev.user,
                  role: json.data.role || prev.user.role,
                  sessionToken: json.data.session_token || prev.user.sessionToken,
                  permissions: json.data.permissions || prev.user.permissions
                }
              }))
            }
          }
        }).catch((err) => {
          console.warn('[SATARK-ROLE] Background sync note:', err)
        })
      },
    }),
    {
      name: 'mplads-user-session',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          return {
            ...persistedState,
            theme: persistedState?.theme === 'dark' ? 'dark' : 'light'
          }
        }
        return persistedState
      }
    }
  )
)

