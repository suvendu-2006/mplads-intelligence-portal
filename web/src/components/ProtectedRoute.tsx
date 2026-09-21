import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { Lock, ShieldAlert, ArrowRight, UserCheck } from 'lucide-react'
import { useTranslation } from '../lib/i18n'
import { BackButton } from './BackButton'

interface Props {
  allowedRoles: string[]
  roleName: string
  children: React.ReactNode
}

export const ProtectedRoute: React.FC<Props> = ({ allowedRoles, roleName, children }) => {
  const { user } = useStore()
  const location = useLocation()
  const { t } = useTranslation()

  const isAllowed = user.isAuthenticated && allowedRoles.includes(user.role)

  if (!isAllowed) {
    const primaryRole = allowedRoles[0]
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="lux-card max-w-lg w-full p-8 text-center space-y-5 border-2 border-[var(--border-primary)] shadow-xl">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/15 border-2 border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
            <Lock size={32} />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-wider">
              <ShieldAlert size={14} />
              <span>Restricted Official Section</span>
            </div>
            <h2 className="text-2xl font-black text-[var(--text-primary)]">
              Authentication Required
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
              This console is strictly restricted to designated <strong>{roleName}</strong>. You are currently browsing as {user.isAuthenticated ? <strong>{user.role}</strong> : 'an unauthenticated guest'}.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <BackButton fallback="/" label="Go Back to Previous Page" />

            <Link
              to={`/login?role=${primaryRole}&redirect=${encodeURIComponent(location.pathname)}`}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer"
            >
              <UserCheck size={16} />
              <span>Log in as {roleName}</span>
              <ArrowRight size={14} />
            </Link>

            <Link
              to="/"
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition text-center"
            >
              Public Overview
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
