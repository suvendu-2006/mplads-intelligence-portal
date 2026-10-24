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

export const DEFAULT_USER_STATE: UserState = {
  role: 'viewer',
  permissions: ['read:national', 'read:states', 'read:mps', 'read:map'],
  sessionToken: 'default_viewer',
  isAuthenticated: false,
  email: 'citizen@satark.gov.in',
  state: undefined,
  district: undefined,
  mpId: undefined,
  mpName: undefined
}

// Purge legacy user state from localStorage so clicking links always defaults to 'User'
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem('mplads-user-session')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.state?.user) {
        delete parsed.state.user
        localStorage.setItem('mplads-user-session', JSON.stringify(parsed))
      }
    }
  } catch {}
}

export function getInitialUserState(): UserState {
  if (typeof window !== 'undefined') {
    try {
      // 1. Explicit role/profile query parameters in the URL
      const params = new URLSearchParams(window.location.search)
      const roleParam = (params.get('role') || params.get('profile'))?.toLowerCase()
      if (roleParam === 'user' || roleParam === 'viewer' || roleParam === 'citizen') {
        try { sessionStorage.removeItem('satark_active_session') } catch {}
        return { ...DEFAULT_USER_STATE }
      }

      // 2. Tab-scoped active login session
      const raw = sessionStorage.getItem('satark_active_session')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.role && parsed.role !== 'viewer' && parsed.isAuthenticated) {
          return parsed
        }
      }
    } catch {}
  }
  // 3. Default profile is ALWAYS User (Public Citizen)
  return { ...DEFAULT_USER_STATE }
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      user: getInitialUserState(),
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
        const isOfficial = role !== 'viewer'
        const defaultPermissions = getRoleDefaultPermissions(role)

        const newState = state ? state : undefined
        const newDistrict = district ? district : undefined
        const newMpId = mpId ? mpId : undefined
        const newMpName = mpName ? mpName : undefined

        const newUser: UserState = {
          role,
          state: newState,
          district: newDistrict,
          mpId: newMpId,
          mpName: newMpName,
          sessionToken: isOfficial ? `auth_session_${role}_${Date.now()}` : 'default_viewer',
          permissions: defaultPermissions,
          isAuthenticated: isOfficial,
          email: email || (isOfficial ? `${role}@satark.gov.in` : 'citizen@satark.gov.in')
        }

        if (typeof window !== 'undefined') {
          try {
            if (isOfficial) {
              sessionStorage.setItem('satark_active_session', JSON.stringify(newUser))
            } else {
              sessionStorage.removeItem('satark_active_session')
            }
          } catch {}
          clearApiCache()
        }

        set({
          searchQuery: '',
          user: newUser
        })

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
              set((prev) => {
                const updatedUser = {
                  ...prev.user,
                  role: json.data.role || prev.user.role,
                  sessionToken: json.data.session_token || prev.user.sessionToken,
                  permissions: json.data.permissions || prev.user.permissions
                }
                if (typeof window !== 'undefined' && isOfficial) {
                  try {
                    sessionStorage.setItem('satark_active_session', JSON.stringify(updatedUser))
                  } catch {}
                }
                return { user: updatedUser }
              })
            }
          }
        } catch (err) {
          console.warn('[SATARK-LOGIN] Role session sync note (offline/demo fallback):', err)
        }
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem('satark_active_session')
          } catch {}
          clearApiCache()
        }
        set({
          searchQuery: '',
          user: { ...DEFAULT_USER_STATE }
        })
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

        const newUser: UserState = {
          role,
          state: newState,
          district: newDistrict,
          mpId: newMpId,
          mpName: newMpName,
          sessionToken: isOfficial ? `session_${role}_${Date.now()}` : 'default_viewer',
          permissions: defaultPermissions,
          isAuthenticated: isOfficial,
          email: defaultEmail
        }

        // 1. Instantaneous local update: reset search query & set clean role state
        set(() => ({
          searchQuery: '',
          user: newUser
        }))

        // 2. Tab-scoped session synchronization
        if (typeof window !== 'undefined') {
          try {
            if (isOfficial) {
              sessionStorage.setItem('satark_active_session', JSON.stringify(newUser))
            } else {
              sessionStorage.removeItem('satark_active_session')
            }
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
              set((prev) => {
                const updatedUser = {
                  ...prev.user,
                  role: json.data.role || prev.user.role,
                  sessionToken: json.data.session_token || prev.user.sessionToken,
                  permissions: json.data.permissions || prev.user.permissions
                }
                if (typeof window !== 'undefined' && isOfficial) {
                  try {
                    sessionStorage.setItem('satark_active_session', JSON.stringify(updatedUser))
                  } catch {}
                }
                return { user: updatedUser }
              })
            }
          }
        } catch (err) {
          console.warn('[SATARK-ROLE] Role switch sync note (offline/demo fallback):', err)
        }
      },
    }),
    {
      name: 'mplads-user-session',
      version: 8,
      partialize: (state) => ({
        theme: state.theme,
        lang: state.lang,
        bannerDismissed: state.bannerDismissed,
      }),
      migrate: (persistedState: any) => {
        const cleanState = { ...persistedState }
        delete cleanState.user
        return {
          ...cleanState,
          theme: persistedState?.theme || 'light',
          lang: persistedState?.lang || 'en',
          bannerDismissed: persistedState?.bannerDismissed || false
        }
      }
    }
  )
)

