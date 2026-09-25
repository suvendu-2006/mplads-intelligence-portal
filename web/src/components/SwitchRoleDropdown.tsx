import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import {
  Shield,
  ChevronDown,
  Check,
  User,
  Building2,
  Landmark,
  MapPin,
  ChevronRight,
  X,
  LogOut
} from 'lucide-react'
import { useTranslation } from '../lib/i18n'
import { ALL_MP_SEATS } from '../lib/allMpsData'

// Exactly 5 Governance Roles:
// 1. User (Public Citizen)
// 2. MoSPI (Apex Central Authority)
// 3. State Nodal (State Nodal Officer)
// 4. District Authority (District Collector / DM)
// 5. MP (Member of Parliament)
const ROLES = [
  {
    id: 'viewer',
    labelKey: 'role.citizen',
    label: 'User',
    sublabel: 'Public Citizen & National Transparency Overview',
    icon: User,
    targetPage: 'National Overview'
  },
  {
    id: 'mospi',
    labelKey: 'role.mospi',
    label: 'MoSPI',
    sublabel: 'Central Authority (Full System Action & Audit Desk)',
    icon: Shield,
    targetPage: 'Audit Desk'
  },
  {
    id: 'state_nodal_officer',
    labelKey: 'role.state_nodal',
    label: 'State Nodal',
    sublabel: 'State Nodal Command & Jurisdiction Supervision',
    icon: Building2,
    targetPage: 'State Console'
  },
  {
    id: 'district_authority',
    labelKey: 'role.district_authority',
    label: 'District Authority',
    sublabel: 'District Collector / DM Sanctions & Inspection Desk',
    icon: MapPin,
    targetPage: 'District Console'
  },
  {
    id: 'mp',
    labelKey: 'role.mp',
    label: 'MP',
    sublabel: 'Member of Parliament (Works Ledger & Allocations)',
    icon: Landmark,
    targetPage: 'MP Console'
  },
]

export const SwitchRoleDropdown: React.FC = () => {
  const { user, logout } = useStore()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  // Toggle open/close
  const toggleOpen = () => {
    setIsOpen(!isOpen)
  }

  // ROLE SWITCH HANDLER: Routes to the comprehensive official Login Gate with role preselected
  const handleRoleCardClick = (roleId: string) => {
    setIsOpen(false)

    if (roleId === 'viewer') {
      logout()
      navigate('/')
      return
    }

    // If already authenticated as this specific role, navigate directly to that role's console
    if (user.isAuthenticated && user.role === roleId) {
      const target = roleId === 'mospi'
        ? '/audit'
        : roleId === 'state_nodal_officer'
        ? '/my-state'
        : roleId === 'district_authority'
        ? (user.district && user.district !== 'ALL' ? `/districts/${encodeURIComponent(user.district)}` : '/district-dashboard')
        : (user.mpId && user.mpId !== 'ALL' ? `/mp-dashboard?id=${encodeURIComponent(user.mpId)}` : '/mp-dashboard')
      navigate(target)
      return
    }

    // Otherwise, redirect to login page with this profile pre-selected!
    navigate(`/login?role=${roleId}`)
  }

  const getRoleDisplayTitle = () => {
    if (!user.isAuthenticated || user.role === 'viewer') {
      return t('role.citizen')
    }
    if (user.role === 'mospi') {
      return `${t('role.mospi')} (Verified)`
    }
    if (user.role === 'state_nodal_officer') {
      const st = user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES'
        ? user.state.split(' ')[0]
        : null
      return st ? `${t('role.state_nodal')} (${st})` : `${t('role.state_nodal')}`
    }
    if (user.role === 'district_authority') {
      const dist = user.district && user.district !== 'ALL' && user.district !== 'ALL DISTRICTS'
        ? user.district
        : null
      return dist ? `${t('table.district')} (${dist})` : `${t('table.district')}`
    }
    if (user.role === 'mp') {
      if (user.mpId && user.mpId !== 'ALL') {
        const found = ALL_MP_SEATS.find(m => m.id === user.mpId)
        if (found) {
          const label = found.constituency !== 'Sitting Rajya Sabha' ? found.constituency : found.name.split(' ').slice(-1)[0]
          return `${t('geo.mp')} (${label})`
        }
      }
      return `${t('geo.mp')}`
    }
    return t('role.citizen')
  }

  const getActiveDotColor = () => {
    if (!user.isAuthenticated || user.role === 'viewer') return 'bg-slate-400'
    if (user.role === 'mospi') return 'bg-amber-500 ring-2 ring-amber-500/20'
    if (user.role === 'state_nodal_officer') return 'bg-emerald-500 ring-2 ring-emerald-500/20'
    if (user.role === 'district_authority') return 'bg-sky-500 ring-2 ring-sky-500/20'
    if (user.role === 'mp') return 'bg-purple-500 ring-2 ring-purple-500/20'
    return 'bg-emerald-500'
  }

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        aria-label="Switch User Role"
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] hover:border-[var(--brand-primary)] text-xs font-medium transition shadow-2xs hover:shadow-xs cursor-pointer select-none"
      >
        <div className="text-left flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${getActiveDotColor()}`} />
          <div>
            <div className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] tracking-wider leading-tight flex items-center gap-1">
              <span>{user.isAuthenticated && user.role !== 'viewer' ? 'Active Profile' : t('btn.switch_role')}</span>
            </div>
            <div className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[150px]">
              {getRoleDisplayTitle()}
            </div>
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-tertiary)] ml-0.5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop overlay to close on outside click */}
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-[400px] max-w-[92vw] rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] p-3.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="px-2 py-1.5 border-b border-[var(--border-primary)] mb-2.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Sovereign Governance Profiles
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Profile login with autofilled credentials &amp; strict access control
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)] transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Authenticated Session Badge & Sign Out Button */}
            {user.isAuthenticated && user.role !== 'viewer' && (
              <div className="p-2.5 mb-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block uppercase tracking-wider">
                    Logged In Session
                  </span>
                  <span className="font-mono text-[11px] font-bold text-[var(--text-primary)]">
                    {user.email || user.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout()
                    setIsOpen(false)
                    navigate('/')
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 transition flex items-center gap-1 cursor-pointer shadow-sm"
                >
                  <LogOut size={12} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}

            {/* List of Role Cards */}
            <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-0.5">
              {ROLES.map((r) => {
                const isActive = user.role === r.id && (r.id === 'viewer' || user.isAuthenticated)
                const Icon = r.icon

                return (
                  <div
                    key={r.id}
                    onClick={() => handleRoleCardClick(r.id)}
                    className={`rounded-xl border transition-colors duration-150 overflow-hidden cursor-pointer select-none ${
                      isActive
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 shadow-xs'
                        : 'border-[var(--border-primary)] bg-[var(--surface-primary)] hover:border-[var(--brand-primary)] hover:bg-[var(--surface-alt)]/80 hover:shadow-xs'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between p-3 text-left text-xs transition-colors duration-150 group">
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-150 ${
                            isActive
                              ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                              : 'bg-[var(--surface-alt)] text-[var(--brand-primary)] group-hover:bg-[var(--brand-primary)] group-hover:text-white'
                          }`}
                        >
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[var(--text-primary)] truncate text-xs flex items-center gap-1.5">
                            <span>{t(r.labelKey)}</span>
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] truncate">
                            {r.sublabel}
                          </div>
                        </div>
                      </div>

                      {/* Selection radio or indicator */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isActive ? (
                          <div
                            title="Active Persona"
                            className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0"
                          >
                            <Check size={14} strokeWidth={2.5} />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-tertiary)] group-hover:text-[var(--brand-primary)] group-hover:bg-[var(--surface-alt)] transition-colors duration-150 shrink-0">
                            <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
