import React, { useEffect, useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { Navbar } from './Navbar'
import { ErrorBoundary } from './ErrorBoundary'
import { GlobalNotificationContainer } from './shared/GlobalNotificationContainer'
import { useStore } from '../store/useStore'
import {
  LayoutDashboard,
  MapPin,
  Users,
  Globe2,
  Building2,
  ShieldAlert,
  LogOut,
  UserCheck,
  KeyRound
} from 'lucide-react'
import { useTranslation, translateState } from '../lib/i18n'

function getDeviceTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export const Layout: React.FC = () => {
  const { theme, user, logout } = useStore()
  const { t, lang } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [deviceTheme, setDeviceTheme] = useState<'light' | 'dark'>(getDeviceTheme)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      setDeviceTheme(e.matches ? 'dark' : 'light')
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    let resolved: 'light' | 'dark' = 'light'
    if (theme === 'light' || theme === 'dark') {
      resolved = theme
    } else {
      // 'device' (or legacy 'auto') automatically matches device theme
      resolved = deviceTheme
    }
    document.documentElement.setAttribute('data-theme', resolved)
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme, deviceTheme])

  useEffect(() => {
    document.documentElement.lang = lang
    const isRtl = lang === 'ur' || lang === 'ks' || lang === 'sd'
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
  }, [lang])

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true
    if (path !== '/' && location.pathname.startsWith(path)) return true
    return false
  }

  const navLinkClasses = (path: string) => {
    const active = isActive(path)
    return `relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 whitespace-nowrap ${
      active
        ? 'bg-[var(--surface-alt)] text-[var(--brand-primary)] shadow-2xs'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]/60'
    }`
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Top Header */}
      <Navbar />

      {/* Sleek Horizontal Navigation Bar (Replaces 240px vertical sidebar for maximum space) */}
      <div className="w-full bg-[var(--surface-primary)] border-b border-[var(--border-primary)] shadow-2xs sticky top-16 z-40">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Main Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2 py-2 overflow-x-auto scrollbar-none">
            <Link to="/" className={navLinkClasses('/')}>
              <LayoutDashboard size={14} className={isActive('/') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-tertiary)]'} />
              <span>{t('nav.overview')}</span>
              {isActive('/') && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand-primary)] rounded-full" />}
            </Link>

            <Link
              to="/states"
              onMouseEnter={() => {
                import('../pages/BrowseStates').catch(() => {})
                fetch('/api/states?sort=red_pct&order=desc').catch(() => {})
              }}
              className={navLinkClasses('/states')}
            >
              <MapPin size={14} className={isActive('/states') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-tertiary)]'} />
              <span>{t('nav.browse_states')}</span>
              {isActive('/states') && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand-primary)] rounded-full" />}
            </Link>

            <Link
              to="/mps"
              onMouseEnter={() => {
                import('../pages/BrowseMPs').catch(() => {})
                fetch('/api/mps?page=1&page_size=50&sort=allocated&order=desc').catch(() => {})
              }}
              className={navLinkClasses('/mps')}
            >
              <Users size={14} className={isActive('/mps') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-tertiary)]'} />
              <span>{t('nav.browse_mps')}</span>
              {isActive('/mps') && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand-primary)] rounded-full" />}
            </Link>

            <Link
              to="/map"
              onMouseEnter={() => {
                import('../pages/GISMap').catch(() => {})
                fetch('/api/map/pcs').catch(() => {})
              }}
              className={navLinkClasses('/map')}
            >
              <Globe2 size={14} className={isActive('/map') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-tertiary)]'} />
              <span>{t('nav.gis_map')}</span>
              {isActive('/map') && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand-primary)] rounded-full" />}
            </Link>

            {/* Audit Desk - Strictly only visible for authenticated MoSPI Central Authority */}
            {user.isAuthenticated && user.role === 'mospi' && (
              <Link
                to="/audit"
                onMouseEnter={() => {
                  import('../pages/AuditDesk').catch(() => {})
                  fetch('/api/flags?page=1&page_size=50').catch(() => {})
                }}
                className={navLinkClasses('/audit')}
              >
                <ShieldAlert size={14} className={isActive('/audit') ? 'text-rose-500' : 'text-[var(--text-tertiary)]'} />
                <span>{t('nav.audit_desk')}</span>
                {isActive('/audit') && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-rose-500 rounded-full" />}
              </Link>
            )}

            {/* Contextual Role Console tabs - Strictly visible ONLY when authenticated in that role */}
            {user.isAuthenticated && user.role === 'mospi' && (
              <Link
                to={user.mpId && user.mpId !== 'ALL' ? `/mp-dashboard?id=${encodeURIComponent(user.mpId)}` : '/mp-dashboard'}
                onMouseEnter={() => import('../pages/MPDashboard').catch(() => {})}
                className={navLinkClasses('/mp-dashboard')}
              >
                <Users size={14} className="text-[var(--brand-accent)]" />
                <span className="font-extrabold text-[var(--gold-text)]">
                  {t('nav.mp_console')} {user.mpName && !user.mpName.includes('All') ? `(${user.mpName.split(' ').slice(-1)[0]})` : ''}
                </span>
                {isActive('/mp-dashboard') && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand-accent)] rounded-full" />}
              </Link>
            )}

            {user.isAuthenticated && user.role === 'state_nodal_officer' && (
              <Link
                to="/my-state"
                onMouseEnter={() => import('../pages/MyState').catch(() => {})}
                className={location.pathname === '/my-state' || (Boolean(user.state) && location.pathname.toLowerCase() === `/states/${encodeURIComponent(user.state || '').toLowerCase()}`)
                  ? 'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 whitespace-nowrap bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-2xs border border-emerald-500/30'
                  : 'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 whitespace-nowrap text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]/60'
                }
              >
                <MapPin size={14} className="text-emerald-500" />
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  {t('nav.state_console')} {user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES' ? `(${translateState(user.state, lang)})` : ''}
                </span>
                {(location.pathname === '/my-state' || (Boolean(user.state) && location.pathname.toLowerCase() === `/states/${encodeURIComponent(user.state || '').toLowerCase()}`)) && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-500 rounded-full" />
                )}
              </Link>
            )}

            {user.isAuthenticated && user.role === 'district_authority' && (
              <Link
                to={user.district && user.district !== 'ALL' ? `/districts/${encodeURIComponent(user.district)}` : '/district-dashboard'}
                onMouseEnter={() => import('../pages/DistrictDashboard').catch(() => {})}
                className={location.pathname === '/district-dashboard' || (Boolean(user.district) && location.pathname.toLowerCase() === `/districts/${encodeURIComponent(user.district || '').toLowerCase()}`)
                  ? 'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 whitespace-nowrap bg-[var(--surface-alt)] text-[var(--brand-primary)] shadow-2xs border border-[var(--brand-primary)]/30'
                  : 'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 whitespace-nowrap text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]/60'
                }
              >
                <Building2 size={14} className="text-[var(--brand-primary)]" />
                <span className="font-extrabold text-[var(--brand-primary)]">
                  {t('nav.district_console')} {user.district && user.district !== 'ALL' ? `(${user.district})` : ''}
                </span>
                {(location.pathname === '/district-dashboard' || (Boolean(user.district) && location.pathname.toLowerCase() === `/districts/${encodeURIComponent(user.district || '').toLowerCase()}`)) && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand-primary)] rounded-full" />
                )}
              </Link>
            )}

            {user.isAuthenticated && user.role === 'mp' && (
              <Link
                to={user.mpId && user.mpId !== 'ALL' ? `/mp-dashboard?id=${encodeURIComponent(user.mpId)}` : '/mp-dashboard'}
                onMouseEnter={() => import('../pages/MPDashboard').catch(() => {})}
                className={navLinkClasses('/mp-dashboard')}
              >
                <Users size={14} className="text-[var(--brand-accent)]" />
                <span className="font-extrabold text-[var(--gold-text)]">
                  {t('nav.mp_console')} {user.mpName && !user.mpName.includes('All') ? `(${user.mpName.split(' ').slice(-1)[0]})` : ''}
                </span>
                {isActive('/mp-dashboard') && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand-accent)] rounded-full" />}
              </Link>
            )}
          </nav>

          {/* Right Status / Persona Indicator */}
          <div className="hidden md:flex items-center gap-2 py-1 text-xs shrink-0">
            {user.isAuthenticated && user.role !== 'viewer' ? (
              <div className="flex items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-secondary)] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    {t('label.active_role')}:{' '}
                    <strong className={user.role === 'mospi' ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--text-primary)]'}>
                      {user.role === 'mospi'
                        ? t('role.mospi')
                        : user.role === 'state_nodal_officer'
                        ? t('role.state_nodal')
                        : user.role === 'district_authority'
                        ? t('role.district_authority')
                        : t('role.mp')}
                    </strong>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    logout()
                    navigate('/')
                  }}
                  className="px-2 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition flex items-center gap-1 cursor-pointer"
                  title="Sign Out of Session"
                >
                  <LogOut size={11} />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-3.5 py-1 rounded-full text-[11px] font-black bg-[var(--brand-primary)] !text-white shadow-sm hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer"
                style={{ color: '#ffffff' }}
              >
                <UserCheck size={13} style={{ color: '#ffffff' }} />
                <span style={{ color: '#ffffff' }}>Profile Login (Autofilled)</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Full-width Main Application Content */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 lg:pb-8">
        <ErrorBoundary>
          <React.Suspense fallback={
            <div className="w-full space-y-4 animate-pulse">
              <div className="h-8 bg-[var(--surface-alt)] rounded-lg w-1/4 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="h-28 bg-[var(--surface-alt)] rounded-xl" />
                <div className="h-28 bg-[var(--surface-alt)] rounded-xl" />
                <div className="h-28 bg-[var(--surface-alt)] rounded-xl" />
              </div>
            </div>
          }>
            <Outlet />
          </React.Suspense>
        </ErrorBoundary>
      </main>

      {/* Mobile Bottom Tab Bar (< 1024px) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-primary)] border-t border-[var(--border-primary)] shadow-lg px-2 py-1 flex items-center justify-around">
        <Link
          to="/"
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-bold ${
            isActive('/') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          <LayoutDashboard size={18} />
          <span>{t('nav.home')}</span>
        </Link>
        <Link
          to="/states"
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-bold ${
            isActive('/states') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          <MapPin size={18} />
          <span>{t('nav.browse_states')}</span>
        </Link>
        <Link
          to="/mps"
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-bold ${
            isActive('/mps') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          <Users size={18} />
          <span>{t('nav.browse_mps')}</span>
        </Link>
        <Link
          to="/map"
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-bold ${
            isActive('/map') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          <Globe2 size={18} />
          <span>{t('nav.gis_map')}</span>
        </Link>
        {user.isAuthenticated && user.role !== 'viewer' ? (
          <Link
            to={user.role === 'state_nodal_officer' ? '/my-state' : user.role === 'district_authority' ? (user.district && user.district !== 'ALL' ? `/districts/${encodeURIComponent(user.district)}` : '/district-dashboard') : user.role === 'mp' ? (user.mpId && user.mpId !== 'ALL' ? `/mp-dashboard?id=${encodeURIComponent(user.mpId)}` : '/mp-dashboard') : '/audit'}
            className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-bold ${
              isActive('/audit') || isActive('/my-state') || isActive('/district-dashboard') || isActive('/mp-dashboard')
                ? 'text-rose-500'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            <ShieldAlert size={18} />
            <span>{user.role === 'state_nodal_officer' ? t('nav.my_state') : user.role === 'district_authority' ? t('nav.district_dash') : user.role === 'mp' ? t('nav.mp_dash') : t('nav.audit_desk')}</span>
          </Link>
        ) : (
          <Link
            to="/login"
            className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-bold ${
              isActive('/login') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            <KeyRound size={18} />
            <span>Login</span>
          </Link>
        )}
      </nav>

      {/* Footer */}
      <footer className="border-t border-[var(--border-primary)] bg-[var(--surface-primary)] py-4 px-4 text-center text-xs text-[var(--text-secondary)]">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>🇮🇳 <strong>SATARK-MPLADS</strong> &bull; {t('footer.ministry')}</span>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              ● {t('footer.audited_data')}
            </span>
          </div>
          <div className="text-xs text-[var(--text-tertiary)] font-medium">
            {t('footer.forensic_center')}
          </div>
        </div>
      </footer>

      {/* Global Toast & Action Notification Container (z-[9999]) */}
      <GlobalNotificationContainer />
    </div>
  )
}
