import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { Shield, ChevronDown, Check, User, Building2, Landmark, MapPin, ChevronRight, Search, X, ArrowRight, SlidersHorizontal } from 'lucide-react'
import { t } from '../lib/i18n'
import { STATE_DISTRICTS_MAP } from '../lib/stateDistricts'
import { ALL_MP_SEATS } from '../lib/allMpsData'
import {
  DEFAULT_STATE,
  DEFAULT_STATE_DISPLAY,
  DEFAULT_DISTRICT,
  DEFAULT_DISTRICT_DISPLAY,
  DEFAULT_MP_ID,
  DEFAULT_MP_NAME,
  ALL_36_STATES_AND_UTS
} from '../lib/constants'

// Exactly 5 Governance Roles:
// 1. User (Public Citizen)
// 2. MoSPI (Apex Central Authority)
// 3. State Nodal (State Nodal Officer)
// 4. District Authority (District Collector / DM)
// 5. MP (Member of Parliament)
const ROLES = [
  { id: 'viewer', label: 'User', sublabel: 'Public Citizen & National Transparency Overview', icon: User, targetPage: 'National Overview' },
  { id: 'mospi', label: 'MoSPI', sublabel: 'Central Authority (Full System Action & Audit Desk)', icon: Shield, targetPage: 'Audit Desk' },
  { id: 'state_nodal_officer', label: 'State Nodal', sublabel: 'State Nodal Command & Jurisdiction Supervision', icon: Building2, targetPage: 'State Console' },
  { id: 'district_authority', label: 'District Authority', sublabel: 'District Collector / DM Sanctions & Inspection Desk', icon: MapPin, targetPage: 'District Console' },
  { id: 'mp', label: 'MP', sublabel: 'Member of Parliament (Works Ledger & Allocations)', icon: Landmark, targetPage: 'MP Console' },
]

export const SwitchRoleDropdown: React.FC = () => {
  const { user, switchRole } = useStore()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  // Track which role questionnaire is currently expanded for jurisdiction customization
  const [expandedRole, setExpandedRole] = useState<string | null>(null)

  // State Nodal selection (no default unless user already chosen)
  const [selectedState, setSelectedState] = useState(
    user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES'
      ? user.state
      : ''
  )

  // District Authority (DM) selection: State & District (no default unless user already chosen)
  const [dmState, setDmState] = useState<string>(
    user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES'
      ? user.state
      : ''
  )
  const [dmDistrict, setDmDistrict] = useState<string>(
    user.district && user.district !== 'ALL' && user.district !== 'ALL DISTRICTS'
      ? user.district
      : ''
  )

  // MP selection & filters (State, House, Search across all 774 parliamentary seats)
  const [mpState, setMpState] = useState<string>(
    user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES'
      ? user.state.toUpperCase()
      : 'ALL'
  )
  const [mpHouse, setMpHouse] = useState<'ALL' | 'Lok Sabha' | 'Rajya Sabha'>('ALL')
  const [mpSearch, setMpSearch] = useState<string>('')
  const [selectedMpId, setSelectedMpId] = useState<string>(
    user.mpId && user.mpId !== 'ALL' ? user.mpId : ''
  )

  // Filtered parliamentary seats based on State, House, and Search Query
  const filteredMps = useMemo(() => {
    return ALL_MP_SEATS.filter(m => {
      if (mpState !== 'ALL' && m.state.toUpperCase() !== mpState.toUpperCase()) {
        return false
      }
      if (mpHouse !== 'ALL' && m.house !== mpHouse) {
        return false
      }
      if (mpSearch.trim()) {
        const q = mpSearch.toLowerCase().trim()
        const matchName = m.name.toLowerCase().includes(q)
        const matchConst = m.constituency.toLowerCase().includes(q)
        const matchState = m.state.toLowerCase().includes(q)
        return matchName || matchConst || matchState
      }
      return true
    })
  }, [mpState, mpHouse, mpSearch])

  const selectedMpName = useMemo(() => {
    if (!selectedMpId || selectedMpId === 'ALL') return 'Select MP'
    const found = ALL_MP_SEATS.find(m => m.id === selectedMpId)
    return found ? (found.constituency !== 'Sitting Rajya Sabha' ? `${found.constituency} (${found.name.split(' ').slice(-1)[0]})` : found.name) : 'Select MP'
  }, [selectedMpId])

  // Available districts for the chosen dmState
  const availableDistricts = dmState ? (STATE_DISTRICTS_MAP[dmState] || STATE_DISTRICTS_MAP[dmState.toUpperCase()] || []) : []

  // Toggle open/close
  const toggleOpen = () => {
    if (!isOpen) {
      setExpandedRole(null)
    }
    setIsOpen(!isOpen)
  }

  // ROLE SWITCH HANDLER: Never auto-opens default page for State Nodal, District Authority, or MP!
  const handleRoleCardClick = async (roleId: string) => {
    if (roleId === 'viewer') {
      await switchRole('viewer', 'ALL', 'ALL', 'ALL', 'All Members of Parliament')
      setIsOpen(false)
      navigate('/')
      return
    }

    if (roleId === 'mospi') {
      await switchRole('mospi', 'ALL', 'ALL', 'ALL', 'All Members of Parliament')
      setIsOpen(false)
      navigate('/audit')
      return
    }

    // Explicit choice required: Toggle drawer so user selects State, District, or MP before opening
    if (roleId === 'state_nodal_officer') {
      setExpandedRole(expandedRole === 'state_nodal_officer' ? null : 'state_nodal_officer')
      return
    }

    if (roleId === 'district_authority') {
      setExpandedRole(expandedRole === 'district_authority' ? null : 'district_authority')
      return
    }

    if (roleId === 'mp') {
      setExpandedRole(expandedRole === 'mp' ? null : 'mp')
      return
    }
  }

  const getRoleDisplayTitle = () => {
    if (user.role === 'mospi') {
      return 'MoSPI (Apex Authority)'
    }
    if (user.role === 'state_nodal_officer') {
      const st = user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES'
        ? user.state.split(' ')[0]
        : null
      return st ? `State Nodal (${st})` : 'State Nodal (Select)'
    }
    if (user.role === 'district_authority') {
      const dist = user.district && user.district !== 'ALL' && user.district !== 'ALL DISTRICTS'
        ? user.district
        : null
      return dist ? `District (${dist})` : 'District (Select)'
    }
    if (user.role === 'mp') {
      if (user.mpId && user.mpId !== 'ALL') {
        const found = ALL_MP_SEATS.find(m => m.id === user.mpId)
        if (found) {
          const label = found.constituency !== 'Sitting Rajya Sabha' ? found.constituency : found.name.split(' ').slice(-1)[0]
          return `MP (${label})`
        }
      }
      return 'MP (Select)'
    }
    return 'User (Citizen)'
  }

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        aria-label="Switch User Role"
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] hover:border-[var(--brand-primary)] text-xs font-medium transition shadow-sm cursor-pointer"
      >
        <div className="text-left">
          <div className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] tracking-wider leading-tight">
            {t('btn.switch_role')}
          </div>
          <div className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[150px]">
            {getRoleDisplayTitle()}
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
                  <Shield className="w-3.5 h-3.5" /> Demo Persona Switcher
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Click any profile to switch instantly to that governance dashboard
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)] transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* List of Role Cards */}
            <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-0.5">
              {ROLES.map((r) => {
                const isActive = user.role === r.id
                const isExpanded = expandedRole === r.id
                const Icon = r.icon
                const hasScopeConfig = ['state_nodal_officer', 'district_authority', 'mp'].includes(r.id)

                return (
                  <div
                    key={r.id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isActive
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 shadow-xs'
                        : 'border-[var(--border-primary)] bg-[var(--surface-primary)] hover:border-[var(--brand-primary)] hover:bg-[var(--surface-alt)]/80 hover:shadow-xs'
                    }`}
                  >
                    {/* Main Row: Click to switch role & navigate directly! */}
                    <div
                      onClick={() => handleRoleCardClick(r.id)}
                      className="w-full flex items-center justify-between p-2.5 text-left text-xs transition cursor-pointer group select-none active:scale-[0.995]"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 pr-2">
                        <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                          isActive
                            ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                            : 'bg-[var(--surface-alt)] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                        }`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-[var(--text-primary)] text-xs">{r.label}</span>
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] leading-snug mt-0.5">
                            {r.sublabel}
                          </div>
                          <div className="text-[10px] font-semibold text-[var(--brand-primary)] mt-1 flex items-center gap-1">
                            {r.id === 'state_nodal_officer' ? (
                              <span>{user.role === 'state_nodal_officer' && user.state && user.state !== 'ALL' ? `Active: ${user.state}` : 'Select State to open console'}</span>
                            ) : r.id === 'district_authority' ? (
                              <span>{user.role === 'district_authority' && user.district && user.district !== 'ALL' ? `Active: ${user.district}` : 'Select District to open console'}</span>
                            ) : r.id === 'mp' ? (
                              <span>{user.role === 'mp' && user.mpName && !user.mpName.includes('All') ? `Active: ${user.mpName}` : 'Select MP to open console'}</span>
                            ) : (
                              <span>Opens {r.targetPage}</span>
                            )}
                            <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>

                      {/* Right action: Scope toggle & status indicator */}
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {hasScopeConfig && (
                          <button
                            type="button"
                            title="Customize State or District Scope"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedRole(isExpanded ? null : r.id)
                            }}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                              isExpanded
                                ? 'bg-[var(--surface-primary)] border-[var(--brand-primary)] text-[var(--brand-primary)]'
                                : 'bg-[var(--surface-alt)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--brand-primary)]/40'
                            }`}
                          >
                            <SlidersHorizontal size={11} />
                            <span className="text-[10px]">Scope</span>
                            <ChevronDown size={10} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}

                        {isActive ? (
                          <div
                            title="Active Persona"
                            className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0"
                          >
                            <Check size={14} strokeWidth={2.5} />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-tertiary)] group-hover:text-[var(--brand-primary)] group-hover:bg-[var(--surface-alt)] transition-all shrink-0">
                            <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Scope Config Drawer for State Nodal */}
                    {r.id === 'state_nodal_officer' && isExpanded && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-3 border-t border-[var(--border-primary)] bg-[var(--surface-alt)] space-y-2 animate-in fade-in duration-150"
                      >
                        <div className="text-[11px] font-extrabold text-[var(--text-primary)] flex items-center justify-between">
                          <span className="text-[var(--brand-primary)]">Select State Jurisdiction:</span>
                          <span className="text-[9px] text-[var(--text-tertiary)] font-bold">36 States &amp; UTs</span>
                        </div>
                        <select
                          value={selectedState}
                          onChange={async (e) => {
                            const val = e.target.value
                            if (!val) return
                            setSelectedState(val)
                            await switchRole('state_nodal_officer', val)
                            setIsOpen(false)
                            navigate('/my-state')
                          }}
                          className="w-full text-xs bg-[var(--surface-primary)] border-2 border-[var(--border-primary)] rounded-lg px-2.5 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] font-bold shadow-xs cursor-pointer"
                        >
                          <option value="" disabled>-- Select State / UT (36 Available) --</option>
                          {ALL_36_STATES_AND_UTS.filter(s => s !== 'ALL STATES & UNION TERRITORIES').map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!selectedState}
                          onClick={async () => {
                            if (!selectedState) return
                            await switchRole('state_nodal_officer', selectedState)
                            setIsOpen(false)
                            navigate('/my-state')
                          }}
                          className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-bold text-xs shadow transition ${
                            selectedState
                              ? 'bg-[var(--brand-primary)] hover:opacity-90 text-white cursor-pointer'
                              : 'bg-[var(--surface-alt)] text-[var(--text-tertiary)] border border-[var(--border-primary)] cursor-not-allowed opacity-60'
                          }`}
                        >
                          <span>{selectedState ? `Confirm & Open State Console (${selectedState})` : 'Select a State to Open Console'}</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    )}

                    {/* Scope Config Drawer for District Authority */}
                    {r.id === 'district_authority' && isExpanded && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-3 border-t border-[var(--border-primary)] bg-[var(--surface-alt)] space-y-2.5 animate-in fade-in duration-150"
                      >
                        <div>
                          <div className="text-[11px] font-extrabold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                            <span className="text-[var(--brand-primary)]">1. Select State:</span>
                            <span className="text-[9px] text-[var(--text-tertiary)] font-bold">36 States</span>
                          </div>
                          <select
                            value={dmState}
                            onChange={(e) => {
                              const newState = e.target.value
                              setDmState(newState)
                              setDmDistrict('')
                            }}
                            className="w-full text-xs bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] font-bold cursor-pointer"
                          >
                            <option value="" disabled>-- Choose State First --</option>
                            {ALL_36_STATES_AND_UTS.filter(s => s !== 'ALL STATES & UNION TERRITORIES').map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="text-[11px] font-extrabold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                            <span className="text-[var(--brand-primary)]">2. Select District:</span>
                            <span className="text-[9px] text-[var(--text-tertiary)] font-bold">{availableDistricts.length} Districts</span>
                          </div>
                          <select
                            value={dmDistrict}
                            disabled={!dmState}
                            onChange={async (e) => {
                              const newDist = e.target.value
                              if (!newDist) return
                              setDmDistrict(newDist)
                              await switchRole('district_authority', dmState, newDist)
                              setIsOpen(false)
                              navigate(`/districts/${encodeURIComponent(newDist)}`)
                            }}
                            className="w-full text-xs bg-[var(--surface-primary)] border-2 border-[var(--brand-primary)]/40 rounded-lg px-2.5 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] font-bold shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            <option value="" disabled>{dmState ? '-- Choose District --' : '-- Select State in Step 1 First --'}</option>
                            {availableDistricts.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          disabled={!dmDistrict}
                          onClick={async () => {
                            if (!dmDistrict || !dmState) return
                            await switchRole('district_authority', dmState, dmDistrict)
                            setIsOpen(false)
                            navigate(`/districts/${encodeURIComponent(dmDistrict)}`)
                          }}
                          className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-bold text-xs shadow transition ${
                            dmDistrict
                              ? 'bg-[var(--brand-primary)] hover:opacity-90 text-white cursor-pointer'
                              : 'bg-[var(--surface-alt)] text-[var(--text-tertiary)] border border-[var(--border-primary)] cursor-not-allowed opacity-60'
                          }`}
                        >
                          <span>{dmDistrict ? `Confirm & Open District Console (${dmDistrict})` : 'Select State & District to Open Console'}</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    )}

                    {/* Scope Config Drawer for MP */}
                    {r.id === 'mp' && isExpanded && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-3 border-t border-[var(--border-primary)] bg-[var(--surface-alt)] space-y-2.5 animate-in fade-in duration-150"
                      >
                        <div>
                          <div className="text-[11px] font-extrabold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                            <span className="text-[var(--gold-text)]">1. State Scope:</span>
                            <span className="text-[9px] text-[var(--text-tertiary)] font-bold">36 States + Pan-India</span>
                          </div>
                          <select
                            value={mpState}
                            onChange={(e) => setMpState(e.target.value)}
                            className="w-full text-xs bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--brand-accent)] font-bold cursor-pointer"
                          >
                            <option value="ALL">ALL STATES &amp; UNION TERRITORIES (Pan-India)</option>
                            {ALL_36_STATES_AND_UTS.filter(s => s !== 'ALL STATES & UNION TERRITORIES').map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="text-[11px] font-extrabold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                            <span className="text-[var(--gold-text)]">2. Member of Parliament Seat:</span>
                            <span className="text-[9px] text-[var(--text-tertiary)] font-bold">{filteredMps.length} Seats</span>
                          </div>

                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="relative flex-1">
                              <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="Search seat or MP..."
                                value={mpSearch}
                                onChange={(e) => setMpSearch(e.target.value)}
                                className="w-full text-xs bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-lg pl-8 pr-6 py-1.5 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--brand-accent)] font-medium"
                              />
                              {mpSearch && (
                                <button
                                  type="button"
                                  onClick={() => setMpSearch('')}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                            <select
                              value={mpHouse}
                              onChange={(e) => setMpHouse(e.target.value as any)}
                              className="text-[11px] bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--brand-accent)] font-semibold cursor-pointer shrink-0"
                            >
                              <option value="ALL">All Houses</option>
                              <option value="Lok Sabha">Lok Sabha</option>
                              <option value="Rajya Sabha">Rajya Sabha</option>
                            </select>
                          </div>

                          <select
                            value={selectedMpId}
                            onChange={async (e) => {
                              const val = e.target.value
                              if (!val) return
                              setSelectedMpId(val)
                              const found = ALL_MP_SEATS.find(m => m.id === val)
                              if (found) {
                                await switchRole('mp', found.state, undefined, found.id, found.name)
                                setIsOpen(false)
                                navigate(`/mp-dashboard?id=${encodeURIComponent(found.id)}`)
                              }
                            }}
                            className="w-full text-xs bg-[var(--surface-primary)] border-2 border-[var(--brand-accent)]/40 rounded-lg px-2.5 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--brand-accent)] font-bold shadow-xs cursor-pointer"
                          >
                            <option value="" disabled>-- Select Member of Parliament ({filteredMps.length} Seats) --</option>
                            {filteredMps.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.constituency !== 'Sitting Rajya Sabha' ? `${m.constituency} — ` : ''}{m.name} ({m.house}, {m.state})
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          disabled={!selectedMpId}
                          onClick={async () => {
                            if (!selectedMpId) return
                            const found = ALL_MP_SEATS.find(m => m.id === selectedMpId)
                            if (found) {
                              await switchRole('mp', found?.state || DEFAULT_STATE_DISPLAY, undefined, found?.id, found?.name)
                              setIsOpen(false)
                              navigate(`/mp-dashboard?id=${encodeURIComponent(found?.id)}`)
                            }
                          }}
                          className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-bold text-xs shadow transition ${
                            selectedMpId
                              ? 'bg-[var(--brand-accent)] hover:opacity-90 text-white cursor-pointer'
                              : 'bg-[var(--surface-alt)] text-[var(--text-tertiary)] border border-[var(--border-primary)] cursor-not-allowed opacity-60'
                          }`}
                        >
                          <span>{selectedMpId ? `Confirm & Open MP Console` : 'Select an MP to Open Console'}</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    )}
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
