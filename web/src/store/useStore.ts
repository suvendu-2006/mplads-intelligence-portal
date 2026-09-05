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
      theme: 'device',
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
        try {
          const res = await fetch('/api/switch-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role,
              state,
              district,
              mp_id: mpId,
              mp_name: mpName
            }),
          })
          if (res.ok) {
            const json = await res.json()
            set({
              user: {
                role: json.data.role,
                state: json.data.state,
                district: json.data.district,
                mpId: json.data.mp_id,
                mpName: json.data.mp_name,
                sessionToken: json.data.session_token,
                permissions: json.data.permissions || []
              }
            })
          }
        } catch (err) {
          console.error('Failed to switch role:', err)
        }
      },
    }),
    {
      name: 'mplads-user-session',
    }
  )
)

