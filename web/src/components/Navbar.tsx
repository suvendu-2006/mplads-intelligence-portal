import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { SwitchRoleDropdown } from './SwitchRoleDropdown'
import { Search, Moon, Sun, Monitor, X, MapPin, Building2, Users, FileText, ArrowRight, Landmark } from 'lucide-react'
import { t } from '../lib/i18n'

import { pingBackend } from '../lib/api'
import { STATE_DISTRICTS_MAP } from '../lib/stateDistricts'
import { ALL_MP_SEATS, MPSeatItem } from '../lib/allMpsData'

export const Navbar: React.FC = () => {
  const { theme, lang, searchQuery, setTheme, setLang, setSearchQuery } = useStore()
  const [syncStatus, setSyncStatus] = React.useState<{ online: boolean; latencyMs: number }>({ online: true, latencyMs: 12 })
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)
  const searchContainerRef = React.useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  React.useEffect(() => {
    async function check() {
      const status = await pingBackend()
      setSyncStatus(status)
    }
    check()
    const interval = setInterval(check, 15000)
    return () => clearInterval(interval)
  }, [])

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
  ]

  // Query matching MPs when searchQuery changes
  const qClean = searchQuery.trim().toLowerCase()
  const isDigits = /^\d+$/.test(qClean)

  // Instant matching of Parliamentary Constituencies & MPs across all 774 seats
  const { matchingConstituencies, matchingMps } = React.useMemo(() => {
    if (qClean.length < 1 || isDigits) {
      return { matchingConstituencies: [], matchingMps: [] }
    }

    const constMatches: MPSeatItem[] = []
    const mpMatches: MPSeatItem[] = []

    for (const seat of ALL_MP_SEATS) {
      const isConst = seat.constituency.toLowerCase().includes(qClean)
      const isMp = seat.name.toLowerCase().includes(qClean)

      if (isConst) {
        constMatches.push(seat)
      } else if (isMp) {
        mpMatches.push(seat)
      }

      if (constMatches.length >= 6 && mpMatches.length >= 4) {
        break
      }
    }

    return {
      matchingConstituencies: constMatches.slice(0, 5),
      matchingMps: mpMatches.slice(0, 4),
    }
  }, [qClean, isDigits])

  // Filter matching states
  const matchingStates = qClean.length >= 1
    ? INDIAN_STATES.filter(s => s.toLowerCase().includes(qClean)).slice(0, 4)
    : []

  // Filter matching districts
  const matchingDistricts: { state: string; district: string }[] = []
  if (qClean.length >= 2) {
    for (const [st, dists] of Object.entries(STATE_DISTRICTS_MAP)) {
      for (const d of dists) {
        if (d.toLowerCase().includes(qClean)) {
          matchingDistricts.push({ state: st, district: d })
          if (matchingDistricts.length >= 5) break
        }
      }
      if (matchingDistricts.length >= 5) break
    }
  }

  const hasSuggestions = isDropdownOpen && qClean.length >= 1 && (
    matchingConstituencies.length > 0 ||
    matchingMps.length > 0 ||
    matchingStates.length > 0 ||
    matchingDistricts.length > 0 ||
    isDigits
  )

  const handleSelectState = (stateName: string) => {
    setIsDropdownOpen(false)
    navigate(`/states/${encodeURIComponent(stateName)}`)
  }

  const handleSelectDistrict = (distName: string) => {
    setIsDropdownOpen(false)
    navigate(`/districts/${encodeURIComponent(distName)}`)
  }

  const handleSelectMp = (mpId: string) => {
    setIsDropdownOpen(false)
    navigate(`/mps/${encodeURIComponent(mpId)}`)
  }

  const handleSelectWork = (workId: string) => {
    setIsDropdownOpen(false)
    navigate(`/audit?q=${encodeURIComponent(workId)}`)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    setIsDropdownOpen(false)

    // 1. Pure digits -> Work ID lookup ONLY in Audit Desk
    if (/^\d+$/.test(q)) {
      navigate(`/audit?q=${encodeURIComponent(q)}`)
      return
    }

    const qLower = q.toLowerCase()

    // 2. Exact or partial Constituency match -> Direct to Constituency / MP page!
    const matchedConst = ALL_MP_SEATS.find(
      m => m.constituency.toLowerCase() === qLower ||
           m.constituency.toLowerCase().startsWith(qLower) ||
           m.constituency.toLowerCase().includes(qLower)
    )
    if (matchedConst && q.length >= 2) {
      navigate(`/mps/${encodeURIComponent(matchedConst.id)}`)
      return
    }

    // 3. Exact or partial MP Name match -> Direct to MP page!
    const matchedMp = ALL_MP_SEATS.find(
      m => m.name.toLowerCase() === qLower ||
           m.name.toLowerCase().includes(qLower)
    )
    if (matchedMp && q.length >= 3) {
      navigate(`/mps/${encodeURIComponent(matchedMp.id)}`)
      return
    }

    // 4. State name match -> State Detail page
    const matchedState = INDIAN_STATES.find(
      s => s.toLowerCase() === qLower || s.toLowerCase().startsWith(qLower)
    )
    if (matchedState && q.length >= 3) {
      navigate(`/states/${encodeURIComponent(matchedState)}`)
      return
    }

    // 5. District name match -> District Dashboard page
    for (const [st, dists] of Object.entries(STATE_DISTRICTS_MAP)) {
      const matchedDist = dists.find(
        d => d.toLowerCase() === qLower || d.toLowerCase().startsWith(qLower)
      )
      if (matchedDist && q.length >= 3) {
        navigate(`/districts/${encodeURIComponent(matchedDist)}`)
        return
      }
    }

    // 6. Default fallback -> MPs Directory with query
    navigate(`/mps?q=${encodeURIComponent(q)}`)
  }

  return (
    <header className="sticky top-0 z-40 bg-[var(--surface-primary)] border-b border-[var(--border-primary)] shadow-sm">
      {/* 3px Official Indian Flag Tricolor Strip */}
      <div
        className="w-full h-[3px]"
        style={{
          background: 'linear-gradient(to right, var(--tricolor-saffron), var(--tricolor-white), var(--tricolor-green))'
        }}
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6">
        {/* Brand */}
        <Link to="/" className="flex items-center shrink-0 group">
          <span className="font-extrabold text-lg sm:text-xl tracking-tight text-[var(--text-primary)] hover:text-[var(--brand-primary)] transition">
            SATARK&bull;MPLADS
          </span>
        </Link>

        {/* Global Search Bar with Live Suggestions Dropdown */}
        <div ref={searchContainerRef} className="flex-1 max-w-xs md:max-w-md hidden md:block relative">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative">
              <button
                type="submit"
                aria-label="Execute search"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--brand-primary)] transition cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setIsDropdownOpen(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsDropdownOpen(false)
                }}
                placeholder="Search MP, Constituency, State, or District..."
                className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-primary)] focus:bg-[var(--surface-primary)] transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setIsDropdownOpen(false)
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-md transition cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>

          {/* Autocomplete Dropdown */}
          {hasSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="max-h-96 overflow-y-auto p-1.5 space-y-1">
                {/* 1. Work ID Match */}
                {isDigits && (
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] px-2.5 py-1">
                      Audit Work Inspection Report
                    </div>
                    <button
                      onClick={() => handleSelectWork(qClean)}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs hover:bg-[var(--surface-alt)] transition group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
                          <FileText size={14} />
                        </div>
                        <div>
                          <div className="font-bold text-[var(--text-primary)]">Work #{qClean}</div>
                          <div className="text-[10px] text-[var(--text-secondary)]">Direct Forensic Audit Investigation</div>
                        </div>
                      </div>
                      <ArrowRight size={12} className="text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition" />
                    </button>
                  </div>
                )}

                {/* 2. Parliamentary Constituencies (Instant 0ms match) */}
                {matchingConstituencies.length > 0 && (
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] px-2.5 py-1 flex items-center justify-between">
                      <span>Parliamentary Constituencies</span>
                      <span className="text-[9px] text-[var(--brand-primary)] font-bold">Lok Sabha &bull; {matchingConstituencies.length} matches</span>
                    </div>
                    {matchingConstituencies.map((c) => (
                      <button
                        key={`const-${c.id}`}
                        onClick={() => handleSelectMp(c.id)}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs hover:bg-[var(--surface-alt)] transition group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] shrink-0">
                            <Landmark size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[var(--text-primary)] truncate">
                              {c.constituency}
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)] truncate">
                              MP: <strong className="text-[var(--text-primary)]">{c.name}</strong> &bull; {c.state} ({c.house})
                            </div>
                          </div>
                        </div>
                        <ArrowRight size={12} className="text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                )}

                {/* 3. Members of Parliament */}
                {matchingMps.length > 0 && (
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] px-2.5 py-1">
                      Members of Parliament
                    </div>
                    {matchingMps.map((m) => (
                      <button
                        key={`mp-${m.id}`}
                        onClick={() => handleSelectMp(m.id)}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs hover:bg-[var(--surface-alt)] transition group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-[var(--brand-accent)]/15 text-[var(--gold-text)] shrink-0">
                            <Users size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[var(--text-primary)] truncate">{m.name}</div>
                            <div className="text-[10px] text-[var(--text-secondary)] truncate">
                              {m.constituency} &bull; {m.state} ({m.house})
                            </div>
                          </div>
                        </div>
                        <ArrowRight size={12} className="text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                )}

                {/* 4. State Matches */}
                {matchingStates.length > 0 && (
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] px-2.5 py-1">
                      States &amp; UTs
                    </div>
                    {matchingStates.map((st) => (
                      <button
                        key={st}
                        onClick={() => handleSelectState(st)}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs hover:bg-[var(--surface-alt)] transition group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                            🇮🇳
                          </div>
                          <div>
                            <div className="font-bold text-[var(--text-primary)]">{st}</div>
                            <div className="text-[10px] text-[var(--text-secondary)]">Open State Command Dashboard</div>
                          </div>
                        </div>
                        <ArrowRight size={12} className="text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition" />
                      </button>
                    ))}
                  </div>
                )}

                {/* 5. District Matches */}
                {matchingDistricts.length > 0 && (
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] px-2.5 py-1">
                      Districts
                    </div>
                    {matchingDistricts.map((d) => (
                      <button
                        key={`${d.state}-${d.district}`}
                        onClick={() => handleSelectDistrict(d.district)}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs hover:bg-[var(--surface-alt)] transition group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                            <Building2 size={14} />
                          </div>
                          <div>
                            <div className="font-bold text-[var(--text-primary)]">{d.district}</div>
                            <div className="text-[10px] text-[var(--text-secondary)]">{d.state} District Dashboard</div>
                          </div>
                        </div>
                        <ArrowRight size={12} className="text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-3 py-1.5 bg-[var(--surface-alt)] border-t border-[var(--border-primary)] flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
                <span>Press <strong>Enter</strong> to search all records</span>
                <span>ESC to close</span>
              </div>
            </div>
          )}
        </div>

        {/* Controls: Theme + Role Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Theme Selector: [🌙 | ☀️ | Auto] */}
          <div className="flex items-center rounded-xl bg-[var(--surface-alt)] p-0.5 border border-[var(--border-primary)] text-xs">
            <button
              onClick={() => setTheme('light')}
              aria-label="Switch theme to Light Lux mode"
              className={`p-1.5 rounded-lg transition ${
                theme === 'light'
                  ? 'bg-[var(--surface-primary)] text-amber-500 shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
              title="Light Lux Mode"
            >
              <Sun size={14} />
            </button>
            <button
              onClick={() => setTheme('dark')}
              aria-label="Switch theme to Dark Command mode"
              className={`p-1.5 rounded-lg transition ${
                theme === 'dark'
                  ? 'bg-[var(--surface-primary)] text-sky-400 shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
              title="Dark Command Mode"
            >
              <Moon size={14} />
            </button>
            <button
              onClick={() => setTheme('device')}
              aria-label="Switch theme to Device mode"
              className={`px-2 py-1 rounded-lg font-bold text-[10px] tracking-wider transition ${
                theme === 'device' || theme === 'auto'
                  ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
              title="Device Mode: Automatically shifts according to your device theme"
            >
              DEVICE
            </button>
          </div>

          {/* Switch Role Dropdown */}
          <SwitchRoleDropdown />
        </div>
      </div>
    </header>
  )
}
