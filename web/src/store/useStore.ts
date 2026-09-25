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
export type LangMode =
  | 'en'
  | 'hi'
  | 'bn'
  | 'te'
  | 'mr'
  | 'ta'
  | 'ur'
  | 'gu'
  | 'kn'
  | 'or'
  | 'ml'
  | 'pa'
  | 'as'
  | 'mai'
  | 'sat'
  | 'ks'
  | 'ne'
  | 'kok'
  | 'sd'
  | 'doi'
  | 'mni'
  | 'brx'
  | 'sa'

export interface UserState {
  role: string
  state?: string
  district?: string
  mpId?: string
  mpName?: string
  sessionToken?: string
  permissions: string[]
  isAuthenticated: boolean
  email?: string
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
  login: (
    role: string,
    email?: string,
    state?: string,
    district?: string,
    mpId?: string,
    mpName?: string
  ) => Promise<void>
  logout: () => void
  switchRole: (
    role: string,
    state?: string,
    district?: string,
    mpId?: string,
    mpName?: string
  ) => Promise<void>
}

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  viewer: ['read:national', 'read:states', 'read:mps', 'read:map'],
  mp: ['read:mp_dashboard', 'read:national', 'read:states', 'read:mps', 'read:map', 'action:do_letter'],
  district_authority: ['read:district_dashboard', 'read:national', 'read:states', 'read:mps', 'read:map', 'action:sanction_work', 'action:review_mb'],
  analyst: ['read:*', 'filter:advanced'],
  auditor: ['read:*', 'filter:*', 'export:flags'],
  state_nodal_officer: ['read:my_state', 'read:entity_risks', 'read:national', 'read:states', 'read:mps', 'read:map'],
  admin: ['*'],
  mospi: ['*']
}

export function getRoleDefaultPermissions(role: string): string[] {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      user: {
        role: 'viewer',
        permissions: getRoleDefaultPermissions('viewer'),
        sessionToken: 'default_viewer',
        isAuthenticated: false,
        email: 'citizen@satark.gov.in'
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
      login: async (
        role: string,
        email?: string,
        state?: string,
        district?: string,
        mpId?: string,
        mpName?: string
      ) => {
        const defaultPermissions = getRoleDefaultPermissions(role)

        const newState = state ? state : (
          role === 'viewer' || role === 'mospi' ? undefined : undefined
        )
        const newDistrict = district ? district : undefined
        const newMpId = mpId ? mpId : undefined
        const newMpName = mpName ? mpName : (
          role === 'viewer' || role === 'mospi' ? undefined : undefined
        )

        set({
          searchQuery: '',
          user: {
            role,
            state: newState,
            district: newDistrict,
            mpId: newMpId,
            mpName: newMpName,
            sessionToken: `auth_session_${role}_${Date.now()}`,
            permissions: defaultPermissions,
            isAuthenticated: true,
            email: email || `${role}@satark.gov.in`
          }
        })

        if (typeof window !== 'undefined') {
          try {
            sessionStorage.clear()
          } catch {}
          clearApiCache()
        }

        try {
          const res = await fetch('/api/switch-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role,
              state: newState,
              district: newDistrict,
              mp_id: newMpId,
              mp_name: newMpName
            }),
          })
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
        } catch (err) {
          console.warn('[SATARK-LOGIN] Role session sync note (offline/demo fallback):', err)
        }
      },
      logout: () => {
        set({
          searchQuery: '',
          user: {
            role: 'viewer',
            permissions: getRoleDefaultPermissions('viewer'),
            sessionToken: 'default_viewer',
            isAuthenticated: false,
            email: 'citizen@satark.gov.in',
            state: undefined,
            district: undefined,
            mpId: undefined,
            mpName: undefined
          }
        })
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.clear()
          } catch {}
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
        const isOfficial = role !== 'viewer'
        const defaultPermissions = getRoleDefaultPermissions(role)

        const newState = state ? state : (
          role === 'state_nodal_officer' || role === 'district_authority' || role === 'mp' ? 'Odisha' : undefined
        )
        const newDistrict = district ? district : (
          role === 'district_authority' ? 'Sambalpur' : undefined
        )
        const newMpId = mpId ? mpId : (
          role === 'mp' ? 'MP-OD-03' : undefined
        )
        const newMpName = mpName ? mpName : (
          role === 'mp' ? 'Dharmendra Pradhan' : undefined
        )

        const defaultEmail = role === 'viewer'
          ? 'citizen@satark.gov.in'
          : role === 'mospi'
          ? 'officer.mospi@gov.in'
          : role === 'state_nodal_officer'
          ? `sna.${(newState || 'odisha').toLowerCase().replace(/\s+/g, '')}@gov.in`
          : role === 'district_authority'
          ? `collector.${(newDistrict || 'sambalpur').toLowerCase().replace(/\s+/g, '')}@gov.in`
          : `mp.${(newMpId || 'sambalpur').toLowerCase()}@sansad.nic.in`

        // 1. Instantaneous local update: reset search query & set clean role state
        set(() => ({
          searchQuery: '',
          user: {
            role,
            state: newState,
            district: newDistrict,
            mpId: newMpId,
            mpName: newMpName,
            sessionToken: `session_${role}_${Date.now()}`,
            permissions: defaultPermissions,
            isAuthenticated: isOfficial,
            email: defaultEmail
          }
        }))

        // 2. Clear ALL role-specific, searched and cached data from session storage and RAM
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.clear()
          } catch {}
          clearApiCache()
        }

        // 3. Synchronize with backend and await resolution to keep state & permissions unified
        try {
          const res = await fetch('/api/switch-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role,
              state: newState,
              district: newDistrict,
              mp_id: newMpId,
              mp_name: newMpName
            }),
          })
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
        } catch (err) {
          console.warn('[SATARK-ROLE] Role switch sync note (offline/demo fallback):', err)
        }
      },
    }),
    {
      name: 'mplads-user-session',
      version: 7,
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
          sessionToken: state.user.sessionToken,
          isAuthenticated: state.user.isAuthenticated,
          email: state.user.email
        }
      }),
      migrate: (persistedState: any, version: number) => {
        if (version < 7) {
          return {
            ...persistedState,
            theme: 'light', // User explicitly requests website to open in light mode by default
            user: {
              role: persistedState?.user?.role || 'viewer',
              permissions: persistedState?.user?.permissions || ['read:national', 'read:states', 'read:mps', 'read:map'],
              sessionToken: persistedState?.user?.sessionToken || 'default_viewer',
              isAuthenticated: Boolean(persistedState?.user?.isAuthenticated && persistedState?.user?.role !== 'viewer'),
              email: persistedState?.user?.email || 'citizen@satark.gov.in',
              state: persistedState?.user?.state || 'ALL',
              district: persistedState?.user?.district || 'ALL',
              mpId: persistedState?.user?.mpId || 'ALL',
              mpName: persistedState?.user?.mpName || 'All Members of Parliament'
            }
          }
        }
        return persistedState
      }
    }
  )
)

