import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { Shield, ChevronDown, Check, User, Building2, Landmark, MapPin, ChevronRight, Search, X } from 'lucide-react'
import { t } from '../lib/i18n'
import { STATE_DISTRICTS_MAP } from '../lib/stateDistricts'
import { ALL_MP_SEATS, MPSeatItem } from '../lib/allMpsData'

// Exactly 4 Switch Role Options:
// 1. User (Public Citizen)
// 2. MP (Member of Parliament)
// 3. State Nodal (State Nodal Officer)
// 4. District Authority (District Collector / Authority)
const ROLES = [
  { id: 'viewer', label: 'User', sublabel: 'Public Citizen & National Transparency', icon: User },
  { id: 'mospi', label: 'MoSPI', sublabel: 'Ministry of Statistics & Programme Implementation (Apex Central Authority - Full System Action)', icon: Shield },
  { id: 'mp', label: 'MP', sublabel: 'Member of Parliament (Works Ledger & Allocations)', icon: Landmark },
  { id: 'state_nodal_officer', label: 'State Nodal', sublabel: 'State Nodal Command & Jurisdiction Supervision', icon: Building2 },
  { id: 'district_authority', label: 'District Authority', sublabel: 'District Collector / DM Sanctions & MB Inspection', icon: MapPin },
]

// Complete list of all 36 States & Union Territories + "ALL" option
const ALL_36_STATES_AND_UTS = [
  'ALL STATES & UNION TERRITORIES',
  'ANDAMAN AND NICOBAR ISLANDS',
  'ANDHRA PRADESH',
  'ARUNACHAL PRADESH',
  'ASSAM',
  'BIHAR',
  'CHANDIGARH',
  'CHHATTISGARH',
  'THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
  'DELHI',
  'GOA',
  'GUJARAT',
  'HARYANA',
  'HIMACHAL PRADESH',
  'JAMMU AND KASHMIR',
  'JHARKHAND',
  'KARNATAKA',
  'KERALA',
  'LADAKH',
  'LAKSHADWEEP',
  'MADHYA PRADESH',
  'MAHARASHTRA',
  'MANIPUR',
  'MEGHALAYA',
  'MIZORAM',
  'NAGALAND',
  'ODISHA',
  'PUDUCHERRY',
  'PUNJAB',
  'RAJASTHAN',
  'SIKKIM',
  'TAMIL NADU',
  'TELANGANA',
  'TRIPURA',
  'UTTAR PRADESH',
  'UTTARAKHAND',
  'WEST BENGAL'
]

export const SwitchRoleDropdown: React.FC = () => {
  const { user, switchRole } = useStore()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  // Track which role questionnaire is currently expanded
  const [expandedRole, setExpandedRole] = useState<string | null>(null)

  // State Nodal selection
  const [selectedState, setSelectedState] = useState(user.state || 'ALL STATES & UNION TERRITORIES')

  // District Authority (DM) 2-step selection:
  // Step 1: Select State
  // Step 2: Select Respective District within that State
  const [dmState, setDmState] = useState<string>(
    user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES'
      ? user.state
      : 'UTTAR PRADESH'
  )
  const [dmDistrict, setDmDistrict] = useState<string>(user.district || 'ALL DISTRICTS')

  // MP selection & filters (State, House, Search across all 774 parliamentary seats)
  const [mpState, setMpState] = useState<string>(
    user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES'
      ? user.state.toUpperCase()
      : 'ALL'
  )
  const [mpHouse, setMpHouse] = useState<'ALL' | 'Lok Sabha' | 'Rajya Sabha'>('ALL')
  const [mpSearch, setMpSearch] = useState<string>('')
  const [selectedMpId, setSelectedMpId] = useState<string>(user.mpId || 'ALL')

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

  // When opening modal, expand the active role
  useEffect(() => {
    if (isOpen) {
      setExpandedRole(user.role)
    }
  }, [isOpen, user.role])

  // Available districts for the chosen dmState
  const availableDistricts = STATE_DISTRICTS_MAP[dmState] || STATE_DISTRICTS_MAP[dmState.toUpperCase()] || []

  // Handle clicking a role option in the list
  const handleRoleCardClick = async (roleId: string) => {
    if (roleId === 'viewer') {
      // User role requires no questions -> directly switch and go to national overview
      await switchRole('viewer')
      setIsOpen(false)
      navigate('/')
      return
    }

    if (roleId === 'mospi') {
      // MoSPI has apex central oversight over all 36 States, all Districts, and all MPs
      await switchRole('mospi', 'ALL', 'ALL', 'ALL', 'All Members of Parliament')
      setIsOpen(false)
      navigate('/audit')
      return
    }

    // For State Nodal, District Authority, or MP:
    // Expand the questionnaire asking for their jurisdiction / seat!
    setExpandedRole(roleId)
  }

  const getRoleDisplayTitle = () => {
    if (user.role === 'mospi') {
      return 'MoSPI (Apex Authority)'
    }
    if (user.role === 'state_nodal_officer') {
      const st = user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES'
        ? user.state.split(' ')[0]
        : 'All States'
      return `State Nodal (${st})`
    }
    if (user.role === 'district_authority') {
      const dist = user.district && user.district !== 'ALL' && user.district !== 'ALL DISTRICTS'
        ? user.district
        : 'All Districts'
      return `District Authority (${dist})`
    }
    if (user.role === 'mp') {
      const found = ALL_MP_SEATS.find(m => m.id === user.mpId)
      if (found) {
        const label = found.constituency !== 'Sitting Rajya Sabha' ? found.constituency : found.name.split(' ').slice(-1)[0]
        return `MP (${label})`
      }
      const mpN = user.mpName && !user.mpName.includes('All')
        ? user.mpName.split(' ').slice(-1)[0]
        : 'All MPs'
      return `MP (${mpN})`
    }
    return 'User'
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] hover:border-[var(--brand-primary)] text-xs font-medium transition shadow-sm"
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
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-96 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-2 py-1.5 border-b border-[var(--border-primary)] mb-2">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Demo Persona Switcher
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Select your governance persona and jurisdiction scope
              </p>
            </div>

            <div className="space-y-1.5 max-h-[75vh] overflow-y-auto pr-0.5">
              {ROLES.map((r) => {
                const isActive = user.role === r.id
                const isExpanded = expandedRole === r.id
                const Icon = r.icon
                return (
                  <div key={r.id} className="rounded-xl border border-transparent transition overflow-hidden">
                    <button
                      onClick={() => handleRoleCardClick(r.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition ${
                        isActive
                          ? 'bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/40 text-[var(--text-primary)] font-bold'
                          : isExpanded
                          ? 'bg-[var(--surface-alt)] border border-[var(--border-primary)]'
                          : 'hover:bg-[var(--surface-alt)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`p-1.5 rounded-lg mt-0.5 ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-alt)] text-[var(--text-secondary)]'}`}>
                          <Icon size={14} />
                        </div>
                        <div>
                          <div className="font-bold text-[var(--text-primary)] text-xs">{r.label}</div>
                          <div className="text-[10px] text-[var(--text-secondary)] leading-snug mt-0.5">{r.sublabel}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {isActive && <Check className="w-4 h-4 text-[var(--brand-primary)] mr-1" />}
                        {r.id !== 'viewer' && (
                          <ChevronRight className={`w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                        )}
                      </div>
                    </button>

                    {/* Question for State Nodal: Ask which state, then land on that state's overall dashboard */}
                    {r.id === 'state_nodal_officer' && isExpanded && (
                      <div className="pl-9 pr-2 py-3 mt-1.5 bg-[var(--surface-alt)] rounded-xl border border-[var(--border-primary)] shadow-xs animate-in fade-in duration-150">
                        <div className="text-[11px] font-extrabold text-[var(--text-primary)] mb-1.5 flex items-center justify-between">
                          <span className="text-[var(--brand-primary)]">Which State do you represent?</span>
                          <span className="text-[9px] text-[var(--text-tertiary)] font-bold">36 States &amp; UTs</span>
                        </div>
                        <select
                          autoFocus
                          value={selectedState}
                          onChange={async (e) => {
                            const val = e.target.value
                            if (!val) return
                            setSelectedState(val)
                            const stateParam = val === 'ALL STATES & UNION TERRITORIES' ? 'ALL' : val
                            await switchRole('state_nodal_officer', stateParam)
                            setIsOpen(false)
                            if (stateParam === 'ALL') {
                              navigate('/states')
                            } else {
                              navigate(`/states/${encodeURIComponent(stateParam)}`)
                            }
                          }}
                          className="w-full text-xs bg-[var(--surface-primary)] border-2 border-[var(--border-primary)] rounded-lg px-2.5 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] font-bold shadow-xs cursor-pointer"
                        >
                          <option value="" disabled>-- Select State / Union Territory --</option>
                          {ALL_36_STATES_AND_UTS.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5 font-medium">
                          Selecting a state will immediately open that state&apos;s overall dashboard.
                        </p>
                      </div>
                    )}

                    {/* Question for District Authority (DM): 2 Questions as requested:
                        Question 1: Select State
                        Question 2: Select Respective District, then land on that district's dashboard */}
                    {r.id === 'district_authority' && isExpanded && (
                      <div className="pl-9 pr-2 py-3 mt-1.5 bg-[var(--surface-alt)] rounded-xl border border-[var(--border-primary)] shadow-xs space-y-2.5 animate-in fade-in duration-150">
                        {/* Question 1: Selection of State */}
                        <div>
                          <div className="text-[11px] font-extrabold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                            <span className="text-[var(--brand-primary)]">1. Which State / UT is your Collectorate in?</span>
                            <span className="text-[9px] text-[var(--text-tertiary)] font-bold">36 States</span>
                          </div>
                          <select
                            value={dmState}
                            onChange={(e) => {
                              const newState = e.target.value
                              setDmState(newState)
                              const dists = STATE_DISTRICTS_MAP[newState] || STATE_DISTRICTS_MAP[newState.toUpperCase()] || []
                              setDmDistrict(dists[0] || 'ALL DISTRICTS')
                            }}
                            className="w-full text-xs bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] font-bold cursor-pointer"
                          >
                            <option value="" disabled>-- Select State --</option>
                            {ALL_36_STATES_AND_UTS.filter(s => s !== 'ALL STATES & UNION TERRITORIES').map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Question 2: Selection of Respective District */}
                        <div>
                          <div className="text-[11px] font-extrabold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                            <span className="text-[var(--brand-primary)]">2. Select Respective District:</span>
                            <span className="text-[9px] text-[var(--text-tertiary)] font-bold">{availableDistricts.length} Districts</span>
                          </div>
                          <select
                            value={dmDistrict}
                            onChange={async (e) => {
                              const newDist = e.target.value
                              if (!newDist) return
                              setDmDistrict(newDist)
                              await switchRole('district_authority', dmState, newDist)
                              setIsOpen(false)
                              if (newDist !== 'ALL DISTRICTS') {
                                navigate(`/districts/${encodeURIComponent(newDist)}`)
                              } else {
                                navigate('/district-dashboard')
                              }
                            }}
                            className="w-full text-xs bg-[var(--surface-primary)] border-2 border-[var(--brand-primary)]/40 rounded-lg px-2.5 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] font-bold shadow-xs cursor-pointer"
                          >
                            <option value="" disabled>-- Select District --</option>
                            <option value="ALL DISTRICTS">All Districts ({dmState})</option>
                            {availableDistricts.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="text-[10px] text-[var(--text-tertiary)] font-medium">
                          Selecting a district will immediately open that district&apos;s inspection dashboard.
                        </p>
                      </div>
                    )}

                    {/* Question for MP: Parliamentary Seat Scope across all 774 Parliamentary Seats */}
                    {r.id === 'mp' && isExpanded && (
                      <div className="pl-9 pr-2 py-3 mt-1.5 bg-[var(--surface-alt)] rounded-xl border border-[var(--brand-accent)]/30 shadow-xs space-y-2.5 animate-in fade-in duration-150">
                        {/* Question 1: Selection of State / UT or Pan-India */}
                        <div>
                          <div className="text-[11px] font-extrabold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                            <span className="text-[var(--gold-text)]">1. Which State / UT is your Parliamentary Seat in?</span>
                            <span className="text-[9px] text-[var(--text-tertiary)] font-bold">36 States + Pan-India</span>
                          </div>
                          <select
                            value={mpState}
                            onChange={(e) => {
                              const newState = e.target.value
                              setMpState(newState)
                            }}
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

                        {/* Question 2: Selection of Parliamentary Seat / MP */}
                        <div>
                          <div className="text-[11px] font-extrabold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                            <span className="text-[var(--gold-text)]">2. Select Parliamentary Seat / MP:</span>
                            <span className="text-[9px] text-[var(--text-tertiary)] font-bold">
                              {filteredMps.length} Seats Available
                            </span>
                          </div>

                          {/* Quick Filter Controls: Search & House Selector */}
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="relative flex-1">
                              <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="Search seat or MP (e.g. Varanasi, Shimla)..."
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
                              setSelectedMpId(val)
                              if (val === 'ALL') {
                                await switchRole('mp', 'ALL', undefined, 'ALL', 'All Members of Parliament')
                                setIsOpen(false)
                                navigate('/mps')
                              } else {
                                const found = ALL_MP_SEATS.find(m => m.id === val)
                                if (found) {
                                  await switchRole('mp', found.state, undefined, found.id, found.name)
                                  setIsOpen(false)
                                  navigate(`/mps/${encodeURIComponent(found.id)}`)
                                }
                              }
                            }}
                            className="w-full text-xs bg-[var(--surface-primary)] border-2 border-[var(--brand-accent)]/40 rounded-lg px-2.5 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--brand-accent)] font-bold shadow-xs cursor-pointer"
                          >
                            <option value="" disabled>-- Select MP / Parliamentary Seat --</option>
                            <option value="ALL">All Members of Parliament — National (Pan-India)</option>
                            {filteredMps.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.constituency !== 'Sitting Rajya Sabha' ? `${m.constituency} — ` : ''}{m.name} ({m.house}, {m.state})
                              </option>
                            ))}
                          </select>
                        </div>

                        <p className="text-[10px] text-[var(--text-tertiary)] font-medium">
                          Selecting an MP will immediately open that member&apos;s allocation ledger.
                        </p>
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
