import React, { useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { ErrorBoundary } from './ErrorBoundary'
import { useStore, ThemeMode } from '../store/useStore'
import {
  LayoutDashboard,
  MapPin,
  Users,
  Globe2,
  Building2,
  ShieldAlert
} from 'lucide-react'
import { t } from '../lib/i18n'

function resolveTheme(theme: ThemeMode, pathname: string): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') {
    return theme
  }
  const rolePaths = ['/my-state', '/audit']
  return rolePaths.includes(pathname) ? 'dark' : 'light'
}

export const Layout: React.FC = () => {
  const { theme, user } = useStore()
  const location = useLocation()

  useEffect(() => {
    const resolved = resolveTheme(theme, location.pathname)
    document.documentElement.setAttribute('data-theme', resolved)
  }, [theme, location.pathname])

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true
    if (path !== '/' && location.pathname.startsWith(path)) return true
    return false
  }

  const navLinkClasses = (path: string) => {
    const active = isActive(path)
    return `relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
      active
        ? 'bg-[var(--surface-alt)] text-[var(--brand-primary)] shadow-2xs'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]/60'
    }`
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-250">
      {/* Top Header */}
      <Navbar />

      {/* Sleek Horizontal Navigation Bar (Replaces 240px vertical sidebar for maximum space) */}
      <div className="w-full bg-[var(--surface-primary)] border-b border-[var(--border-primary)] shadow-2xs sticky top-16 z-30 transition-colors">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Main Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2 py-2 overflow-x-auto scrollbar-none">
            <Link to="/" className={navLinkClasses('/')}>
              <LayoutDashboard size={14} className={isActive('/') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-tertiary)]'} />
              <span>{t('nav.overview')}</span>
              {isActive('/') && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand-primary)] rounded-full" />}
            </Link>

            <Link to="/states" className={navLinkClasses('/states')}>
              <MapPin size={14} className={isActive('/states') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-tertiary)]'} />
              <span>Browse States &amp; UTs</span>
              {isActive('/states') && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand-primary)] rounded-full" />}
            </Link>

            <Link to="/mps" className={navLinkClasses('/mps')}>
              <Users size={14} className={isActive('/mps') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-tertiary)]'} />
              <span>MPs Performance</span>
              {isActive('/mps') && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand-primary)] rounded-full" />}
            </Link>

            <Link to="/map" className={navLinkClasses('/map')}>
              <Globe2 size={14} className={isActive('/map') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-tertiary)]'} />
              <span>GIS Map</span>
              {isActive('/map') && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand-primary)] rounded-full" />}
            </Link>

            {/* Audit Desk - Only visible for administrative/auditor roles (Hidden for Public Citizen) */}
            {user.role !== 'viewer' && (
              <Link to="/audit" className={navLinkClasses('/audit')}>
                <ShieldAlert size={14} className={isActive('/audit') ? 'text-rose-500' : 'text-[var(--text-tertiary)]'} />
                <span>Audit Desk</span>
                {isActive('/audit') && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-rose-500 rounded-full" />}
              </Link>
            )}

            {/* Contextual Role Console tabs - Only visible when relevant role is active */}
            {user.role === 'state_nodal_officer' && (
              <Link
                to={user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES' ? `/states/${encodeURIComponent(user.state)}` : '/states'}
                className={navLinkClasses(user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES' ? `/states/${encodeURIComponent(user.state)}` : '/states')}
              >
                <Building2 size={14} className="text-emerald-500" />
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  State Console {user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES' ? `(${user.state.split(' ')[0]})` : '(All)'}
                </span>
                {(user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES' ? (location.pathname.startsWith('/states') || location.pathname.startsWith('/my-state')) : isActive('/states')) && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-500 rounded-full" />
                )}
              </Link>
            )}

            {user.role === 'district_authority' && (
              <Link
                to={user.district && user.district !== 'ALL' && user.district !== 'ALL DISTRICTS' ? `/districts/${encodeURIComponent(user.district)}` : '/district-dashboard'}
                className={navLinkClasses(user.district && user.district !== 'ALL' && user.district !== 'ALL DISTRICTS' ? `/districts/${user.district}` : '/district-dashboard')}
              >
                <Building2 size={14} className="text-[var(--brand-primary)]" />
                <span className="font-extrabold text-[var(--brand-primary)]">
                  District Console {user.district && user.district !== 'ALL' && user.district !== 'ALL DISTRICTS' ? `(${user.district})` : '(All)'}
                </span>
                {(isActive('/district') || isActive('/districts')) && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand-primary)] rounded-full" />}
              </Link>
            )}

            {user.role === 'mp' && (
              <Link to="/mp-dashboard" className={navLinkClasses('/mp-dashboard')}>
                <Users size={14} className="text-[var(--brand-accent)]" />
                <span className="font-extrabold text-[var(--gold-text)]">
                  MP Console {user.mpName && !user.mpName.includes('All') ? `(${user.mpName.split(' ').slice(-1)[0]})` : ''}
                </span>
                {isActive('/mp-dashboard') && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--brand-accent)] rounded-full" />}
              </Link>
            )}
          </nav>

          {/* Right Status / Persona Indicator */}
          <div className="hidden md:flex items-center gap-2 py-1 text-xs shrink-0">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-secondary)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Active Role:{' '}
                <strong className="text-[var(--text-primary)]">
                  {user.role === 'viewer'
                    ? 'User (Public)'
                    : user.role === 'state_nodal_officer'
                    ? 'State Nodal'
                    : user.role === 'district_authority'
                    ? 'District Authority'
                    : 'MP'}
                </strong>
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Full-width Main Application Content */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 lg:pb-8">
        <ErrorBoundary>
          <Outlet />
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
          <span>Home</span>
        </Link>
        <Link
          to="/states"
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-bold ${
            isActive('/states') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          <MapPin size={18} />
          <span>States</span>
        </Link>
        <Link
          to="/mps"
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-bold ${
            isActive('/mps') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          <Users size={18} />
          <span>MPs</span>
        </Link>
        <Link
          to="/map"
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-bold ${
            isActive('/map') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          <Globe2 size={18} />
          <span>Map</span>
        </Link>
        <Link
          to={user.role === 'state_nodal_officer' ? '/my-state' : user.role === 'district_authority' ? '/district-dashboard' : user.role === 'mp' ? '/mp-dashboard' : '/audit'}
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-bold ${
            isActive('/audit') || isActive('/my-state') || isActive('/district-dashboard') || isActive('/mp-dashboard')
              ? 'text-rose-500'
              : 'text-[var(--text-secondary)]'
          }`}
        >
          <ShieldAlert size={18} />
          <span>{user.role === 'state_nodal_officer' ? 'State' : user.role === 'district_authority' ? 'District' : user.role === 'mp' ? 'MP' : 'Audit'}</span>
        </Link>
      </nav>

      {/* Footer */}
      <footer className="border-t border-[var(--border-primary)] bg-[var(--surface-primary)] py-4 px-4 text-center text-xs text-[var(--text-secondary)]">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>🇮🇳 <strong>SATARK-MPLADS</strong> &bull; Ministry of Statistics &amp; Programme Implementation (MoSPI)</span>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              ● Audited Data as of Aug 2026
            </span>
          </div>
          <div>Smart Infrastructure Hackathon 2026 &bull; Production Demonstration System</div>
        </div>
      </footer>
    </div>
  )
}
