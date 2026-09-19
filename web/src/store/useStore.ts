import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_STATE,
  DEFAULT_STATE_DISPLAY,
  DEFAULT_DISTRICT,
  DEFAULT_MP_ID,
  DEFAULT_MP_NAME
} from '../lib/constants'
import { clearApiCache } from '../lib/api'

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
  setMpJurisdiction: (mpId: string, mpName?: string, state?: string) => void
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
      setMpJurisdiction: (mpId: string, mpName?: string, state?: string) => {
        set((prev) => ({
          user: {
            ...prev.user,
            mpId,
            ...(mpName ? { mpName } : {}),
            ...(state ? { state } : {})
          }
        }))
        if (typeof window !== 'undefined') {
          clearApiCache()
        }
      },
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

        const newState = state ? state : (
          role === 'viewer' || role === 'mospi' ? 'ALL' : undefined
        )
        const newDistrict = district ? district : (
          role === 'viewer' || role === 'mospi' ? 'ALL' : undefined
        )
        const newMpId = mpId ? mpId : (
          role === 'viewer' || role === 'mospi' ? 'ALL' : undefined
        )
        const newMpName = mpName ? mpName : (
          role === 'viewer' || role === 'mospi' ? 'All Members of Parliament' : undefined
        )

        // 1. Instantaneous local update: reset search query & set clean role state
        set({
          searchQuery: '',
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

        // 2. Clear ALL role-specific, searched and cached data from session storage and RAM
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.clear()
          } catch {}
          clearApiCache()
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
          console.log('[SATARK-ROLE] Background sync note:', err)
        })
      },
    }),
    {
      name: 'mplads-user-session',
      version: 4,
      partialize: (state) => ({
        theme: state.theme,
        lang: state.lang,
        bannerDismissed: state.bannerDismissed,
        user: {
          role: state.user.role,
          state: state.user.state,
          district: state.user.district,
          mpId: state.user.mpId,
          mpName: state.user.mpName,
          permissions: state.user.permissions,
          sessionToken: state.user.sessionToken
        }
      }),
      migrate: (persistedState: any, version: number) => {
        if (version < 3) {
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

