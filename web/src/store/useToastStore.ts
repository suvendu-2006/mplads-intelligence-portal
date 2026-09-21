import { create } from 'zustand'

export type ToastType = 'success' | 'info' | 'warning' | 'error' | 'freeze' | 'notice' | 'letter'

export interface ToastNotification {
  id: string
  title?: string
  message: string
  type?: ToastType
  duration?: number
}

export interface ActionModalData {
  title: string
  subtitle?: string
  message: string
  refId?: string
  badgeText?: string
  type?: ToastType
  meta?: {
    workId?: number | string
    district?: string
    state?: string
    timestamp?: string
  }
  onConfirm?: () => void
}

interface ToastStore {
  toasts: ToastNotification[]
  actionModal: ActionModalData | null
  showToast: (message: string, type?: ToastType, duration?: number, title?: string) => void
  dismissToast: (id: string) => void
  showActionModal: (data: ActionModalData) => void
  closeActionModal: () => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  actionModal: null,
  showToast: (message, type = 'success', duration = 4500, title) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration, title }]
    }))
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id)
        }))
      }, duration)
    }
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    })),
  showActionModal: (data) => set({ actionModal: data }),
  closeActionModal: () => set({ actionModal: null })
}))
