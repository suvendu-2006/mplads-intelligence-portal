import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  AlertOctagon,
  Lock,
  FileText,
  Mail,
  Info,
  X,
  Copy,
  Check,
  ShieldCheck
} from 'lucide-react'
import { useToastStore, ToastType, ActionModalData } from '../../store/useToastStore'

export const GlobalNotificationContainer: React.FC = () => {
  const { toasts, dismissToast, actionModal, closeActionModal } = useToastStore()
  const [copiedRef, setCopiedRef] = useState(false)

  // Scroll lock when actionModal is open
  useEffect(() => {
    if (!actionModal) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [actionModal])

  // Auto-dismiss action modal after 7 seconds if user does not click
  useEffect(() => {
    if (!actionModal) return
    const timer = setTimeout(() => {
      closeActionModal()
    }, 7000)
    return () => clearTimeout(timer)
  }, [actionModal, closeActionModal])

  const copyRef = (refId: string) => {
    navigator.clipboard.writeText(refId)
    setCopiedRef(true)
    setTimeout(() => setCopiedRef(false), 2000)
  }

  const getModalIcon = (type?: ToastType) => {
    switch (type) {
      case 'freeze':
        return <Lock size={30} className="text-rose-500 animate-pulse" />
      case 'notice':
        return <FileText size={30} className="text-blue-500 animate-pulse" />
      case 'letter':
        return <Mail size={30} className="text-amber-500 animate-pulse" />
      default:
        return <ShieldCheck size={32} className="text-emerald-500 animate-bounce" />
    }
  }

  const getModalColorStyle = (type?: ToastType) => {
    switch (type) {
      case 'freeze':
        return {
          iconBg: 'bg-rose-500/15 border-rose-500/35 text-rose-500 shadow-rose-500/20',
          badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
          border: 'border-rose-500/40',
          btn: 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
        }
      case 'notice':
        return {
          iconBg: 'bg-blue-500/15 border-blue-500/35 text-blue-500 shadow-blue-500/20',
          badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
          border: 'border-blue-500/40',
          btn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
        }
      case 'letter':
        return {
          iconBg: 'bg-amber-500/15 border-amber-500/35 text-amber-500 shadow-amber-500/20',
          badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
          border: 'border-amber-500/40',
          btn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
        }
      default:
        return {
          iconBg: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-500 shadow-emerald-500/20',
          badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
          border: 'border-emerald-500/40',
          btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
        }
    }
  }

  const getToastIcon = (type?: ToastType) => {
    switch (type) {
      case 'freeze':
      case 'error':
        return <AlertOctagon size={18} className="text-rose-500 shrink-0" />
      case 'notice':
        return <FileText size={18} className="text-blue-500 shrink-0" />
      case 'letter':
        return <Mail size={18} className="text-amber-500 shrink-0" />
      case 'info':
        return <Info size={18} className="text-sky-500 shrink-0" />
      default:
        return <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
    }
  }

  const modalStyle = getModalColorStyle(actionModal?.type)

  return (
    <>
      {/* 1. Global Floating Action Confirmation Pop-up Modal (z-[9999]) */}
      {actionModal && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={closeActionModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-3xl bg-[var(--surface-primary)] border ${modalStyle.border} shadow-2xl p-5 sm:p-7 text-center space-y-4 animate-in zoom-in-95 duration-200`}
          >
            {/* Top Close Button */}
            <button
              onClick={closeActionModal}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)] transition cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {/* Glowing Icon Header */}
            <div className={`w-16 h-16 mx-auto rounded-2xl border flex items-center justify-center shadow-lg ${modalStyle.iconBg}`}>
              {getModalIcon(actionModal.type)}
            </div>

            {/* Badge & Title */}
            <div>
              <span className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border inline-flex items-center gap-1.5 ${modalStyle.badge}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                <span>{actionModal.badgeText || 'ACTION TRANSMITTED • SOVEREIGN AUDIT LEDGER'}</span>
              </span>

              <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] mt-3 tracking-tight">
                {actionModal.title}
              </h2>

              {actionModal.subtitle && (
                <div className="text-xs font-semibold text-[var(--text-secondary)] mt-0.5">
                  {actionModal.subtitle}
                </div>
              )}
            </div>

            {/* Message Body */}
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
              {actionModal.message}
            </p>

            {/* Cryptographic Proof Hash / Reference */}
            {actionModal.refId && (
              <div className="p-3 rounded-2xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-left flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)]">
                    Forensic Ledger Reference ID
                  </div>
                  <div className="font-mono text-xs text-[var(--brand-primary)] font-bold truncate">
                    {actionModal.refId}
                  </div>
                </div>
                <button
                  onClick={() => copyRef(actionModal.refId!)}
                  className="p-2 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition shrink-0 cursor-pointer"
                  title="Copy Reference"
                >
                  {copiedRef ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            )}

            {/* Meta Row: Timestamp & Signature */}
            <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)] pt-1">
              <span className="flex items-center gap-1">
                <ShieldCheck size={12} className="text-emerald-500" /> NIC Digital Sign: Verified
              </span>
              <span>{new Date().toLocaleTimeString()} IST</span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              <button
                onClick={() => {
                  if (actionModal.onConfirm) actionModal.onConfirm()
                  closeActionModal()
                }}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary)]/90 transition shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 2. Global Floating Toast Notifications (z-[9998]) */}
      <div className="fixed top-5 right-5 z-[9998] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto rounded-2xl p-4 bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-2xl shadow-black/15 flex items-start gap-3 text-xs text-[var(--text-primary)] animate-in slide-in-from-top-4 duration-300 relative overflow-hidden"
          >
            {getToastIcon(t.type)}
            <div className="flex-1 min-w-0 pr-4">
              {t.title && (
                <div className="font-extrabold text-[var(--text-primary)] tracking-tight mb-0.5">
                  {t.title}
                </div>
              )}
              <div className="text-[var(--text-secondary)] font-medium leading-snug break-words">
                {t.message}
              </div>
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition shrink-0 cursor-pointer"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
