import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore'
import {
  Shield,
  Building2,
  Users,
  Lock,
  Landmark,
  MapPin,
  CheckCircle2,
  ArrowRight,
  KeyRound,
  ShieldCheck
} from 'lucide-react'
import { clearApiCache } from '../lib/api'
import { useTranslation, translateState } from '../lib/i18n'
import { ALL_36_STATES_AND_UTS } from '../lib/constants'
import { ALL_MP_SEATS } from '../lib/allMpsData'
import { STATE_DISTRICTS_MAP } from '../lib/stateDistricts'
import { BackButton } from '../components/BackButton'

interface Persona {
  role: string
  title: string
  hindiTitle: string
  icon: any
  badge: string
  description: string
  route: string
  demoId: string
  demoPass: string
  requiresArea: boolean
  defaultContext: {
    state?: string
    district?: string
    mpId?: string
    mpName?: string
  }
}

const PERSONAS: Persona[] = [
  {
    role: 'viewer',
    title: 'Public Citizen',
    hindiTitle: 'सार्वजनिक नागरिक',
    icon: Users,
    badge: 'Open Transparency',
    description: 'Explore national fiscal realizations, browse state and MP ledgers, and view GIS boundaries.',
    route: '/',
    demoId: 'citizen@satark.gov.in',
    demoPass: 'PublicAccess2026',
    requiresArea: false,
    defaultContext: {
      state: 'ALL',
      district: 'ALL'
    }
  },
  {
    role: 'mp',
    title: 'Member of Parliament (MP)',
    hindiTitle: 'संसद सदस्य (सांसद)',
    icon: Landmark,
    badge: 'Constituency Command',
    description: 'Track your ₹5 Cr/year entitlement corpus, verify recommended works delivery, and review social vigilance.',
    route: '/mp-dashboard',
    demoId: '',
    demoPass: 'MP@2026',
    requiresArea: true,
    defaultContext: {}
  },
  {
    role: 'district_authority',
    title: 'District Authority (Collector)',
    hindiTitle: 'जिला प्राधिकरण (जिलाधिकारी)',
    icon: Building2,
    badge: 'Collectorate Sanctions',
    description: 'Supervise district works sanction queue, verify Measurement Books (MB), and inspect IDA agencies.',
    route: '/district-dashboard',
    demoId: '',
    demoPass: 'Collector@2026',
    requiresArea: true,
    defaultContext: {}
  },
  {
    role: 'state_nodal_officer',
    title: 'State Nodal Authority (SNA)',
    hindiTitle: 'राज्य नोडल अधिकारी',
    icon: MapPin,
    badge: 'State Surveillance',
    description: 'Monitor cross-district liability, track Single Nodal Account (SNA) releases, and issue Show-Cause notices.',
    route: '/my-state',
    demoId: '',
    demoPass: 'StateNodal@2026',
    requiresArea: true,
    defaultContext: {}
  },
  {
    role: 'mospi',
    title: 'MoSPI Central Authority',
    hindiTitle: 'सांख्यिकी और कार्यक्रम कार्यान्वयन मंत्रालय (MoSPI)',
    icon: Shield,
    badge: 'Apex Executive Oversight',
    description: 'Omnipotent system authority: screen national works, freeze treasury holds, certify civil projects, and take action.',
    route: '/audit',
    demoId: 'officer.mospi@gov.in',
    demoPass: 'MoSPI@2026',
    requiresArea: false,
    defaultContext: {
      state: 'ALL',
      district: 'ALL'
    }
  }
]

const slugify = (str: string) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialRole = searchParams.get('role') || 'viewer'
  const redirectTarget = searchParams.get('redirect') || ''
  const { login, logout, user, setMpJurisdiction } = useStore()
  const { t, lang } = useTranslation()

  const [selectedRole, setSelectedRole] = useState<string>(() => {
    const valid = PERSONAS.some((p) => p.role === initialRole)
    return valid ? initialRole : 'viewer'
  })

  // Dynamically update selected persona if URL query param changes
  useEffect(() => {
    const roleParam = searchParams.get('role')
    if (roleParam && PERSONAS.some((p) => p.role === roleParam)) {
      setSelectedRole(roleParam)
    }
  }, [searchParams])

  const currentPersona = PERSONAS.find((p) => p.role === selectedRole) || PERSONAS[0]

  // Regional area selection state (Never prefilled on fresh visit or reload!)
  const [mpState, setMpState] = useState<string>('')
  const [selectedMpId, setSelectedMpId] = useState<string>('')
  const [dmState, setDmState] = useState<string>('')
  const [dmDistrict, setDmDistrict] = useState<string>('')
  const [snaState, setSnaState] = useState<string>('')

  // Clean stale query parameters from URL on mount so browser reload never retains previous area selections
  useEffect(() => {
    if (searchParams.has('state') || searchParams.has('district') || searchParams.has('mpId')) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('state')
      newParams.delete('district')
      newParams.delete('mpId')
      navigate({ search: newParams.toString() }, { replace: true })
    }
  }, [])

  // Check if the required jurisdiction area has been selected by the user
  const isAreaSelected = useMemo(() => {
    if (selectedRole === 'state_nodal_officer') {
      return Boolean(snaState)
    }
    if (selectedRole === 'district_authority') {
      return Boolean(dmState && dmDistrict)
    }
    if (selectedRole === 'mp') {
      return Boolean(mpState && selectedMpId)
    }
    return true // viewer and mospi are national scope
  }, [selectedRole, snaState, dmState, dmDistrict, mpState, selectedMpId])

  // Available districts for chosen dmState
  const availableDistricts = useMemo(() => {
    if (!dmState) return []
    return STATE_DISTRICTS_MAP[dmState] || STATE_DISTRICTS_MAP[dmState.toUpperCase()] || []
  }, [dmState])

  // Available MPs for selected mpState
  const availableMps = useMemo(() => {
    if (!mpState) return []
    return ALL_MP_SEATS.filter(
      (m) => m.state.toLowerCase() === mpState.toLowerCase()
    )
  }, [mpState])

  // Active selected MP item
  const selectedMp = useMemo(() => {
    if (!selectedMpId) return null
    return availableMps.find((m) => m.id === selectedMpId) || ALL_MP_SEATS.find((m) => m.id === selectedMpId) || null
  }, [selectedMpId, availableMps])

  // Autofill credentials state based on selected persona & jurisdiction
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [authSuccess, setAuthSuccess] = useState(false)

  // Dynamically autofill credentials ONLY when the required jurisdiction area is selected!
  useEffect(() => {
    if (selectedRole === 'mp') {
      if (mpState && selectedMpId && selectedMp) {
        const emailSlug = slugify(selectedMp.constituency !== 'Sitting Rajya Sabha' ? selectedMp.constituency : selectedMp.name)
        setUsername(`mp.${emailSlug}@sansad.nic.in`)
        setPassword('MP@2026')
      } else {
        setUsername('')
        setPassword('')
      }
    } else if (selectedRole === 'district_authority') {
      if (dmState && dmDistrict) {
        setUsername(`collector.${slugify(dmDistrict)}@gov.in`)
        setPassword('Collector@2026')
      } else {
        setUsername('')
        setPassword('')
      }
    } else if (selectedRole === 'state_nodal_officer') {
      if (snaState) {
        setUsername(`sna.${slugify(snaState)}@gov.in`)
        setPassword('StateNodal@2026')
      } else {
        setUsername('')
        setPassword('')
      }
    } else {
      const p = PERSONAS.find((item) => item.role === selectedRole) || PERSONAS[0]
      setUsername(p.demoId)
      setPassword(p.demoPass)
    }
  }, [selectedRole, selectedMpId, selectedMp, mpState, dmState, dmDistrict, snaState])

  const [isEditingArea, setIsEditingArea] = useState(false)

  const handleMpStateChange = (newState: string) => {
    setMpState(newState)
    setSelectedMpId('')
    setUsername('')
    setPassword('')
    setIsEditingArea(true)
  }

  const handleMpSeatChange = (newMpId: string) => {
    setSelectedMpId(newMpId)
    if (newMpId && mpState) {
      setIsEditingArea(false)
    }
  }

  const handleDmStateChange = (newState: string) => {
    setDmState(newState)
    setDmDistrict('')
    setUsername('')
    setPassword('')
    setIsEditingArea(true)
  }

  const handleDmDistrictChange = (newDistrict: string) => {
    setDmDistrict(newDistrict)
    if (newDistrict && dmState) {
      setIsEditingArea(false)
    }
  }

  const handleSnaStateChange = (newState: string) => {
    setSnaState(newState)
    if (newState) {
      setIsEditingArea(false)
    }
  }

  const handleAuthenticate = async (
    e?: React.FormEvent,
    overridePersona?: Persona
  ) => {
    if (e) e.preventDefault()
    const targetRole = overridePersona ? overridePersona.role : selectedRole

    // Strict Guard: Until area is selected, the login cannot proceed!
    if (targetRole === 'mp' && (!mpState || !selectedMpId || !selectedMp)) {
      return
    }
    if (targetRole === 'district_authority' && (!dmState || !dmDistrict)) {
      return
    }
    if (targetRole === 'state_nodal_officer' && !snaState) {
      return
    }

    setLoading(true)

    try {
      if (typeof window !== 'undefined') {
        try { sessionStorage.clear() } catch {}
        clearApiCache()
      }

      if (targetRole === 'mp') {
        const mpToAuth = selectedMp!
        await login(
          'mp',
          username,
          mpToAuth.state,
          mpToAuth.constituency,
          mpToAuth.id,
          mpToAuth.name
        )
        setMpJurisdiction(mpToAuth.id, mpToAuth.name, mpToAuth.state)
        setAuthSuccess(true)

        setTimeout(() => {
          navigate(`/mp-dashboard?id=${mpToAuth.id}`, { replace: true })
        }, 300)
        return
      }

      if (targetRole === 'district_authority') {
        await login(
          'district_authority',
          username,
          dmState,
          dmDistrict
        )
        setAuthSuccess(true)

        setTimeout(() => {
          navigate(`/districts/${encodeURIComponent(dmDistrict)}`, { replace: true })
        }, 300)
        return
      }

      if (targetRole === 'state_nodal_officer') {
        await login(
          'state_nodal_officer',
          username,
          snaState
        )
        setAuthSuccess(true)

        setTimeout(() => {
          navigate('/my-state', { replace: true })
        }, 300)
        return
      }

      const targetPersona = overridePersona || currentPersona
      await login(
        targetPersona.role,
        overridePersona ? targetPersona.demoId : username,
        targetPersona.defaultContext.state,
        targetPersona.defaultContext.district,
        targetPersona.defaultContext.mpId,
        targetPersona.defaultContext.mpName
      )

      setAuthSuccess(true)

      setTimeout(() => {
        if (redirectTarget) {
          navigate(redirectTarget, { replace: true })
        } else {
          navigate(targetPersona.route, { replace: true })
        }
      }, 300)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectRole = (role: string) => {
    if (role === 'viewer') {
      logout()
      navigate('/')
      return
    }
    setSelectedRole(role)
    setIsEditingArea(false)
    if (role === 'state_nodal_officer') {
      setSnaState('')
    } else if (role === 'district_authority') {
      setDmState('')
      setDmDistrict('')
    } else if (role === 'mp') {
      setMpState('')
      setSelectedMpId('')
    }
  }

  return (
    <div className="min-h-[82vh] flex items-center justify-center py-6 px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-5xl space-y-8">
        {/* Top Back Navigation */}
        <div className="flex items-center justify-start">
          <BackButton fallback="/" label="Back to Previous Page" />
        </div>

        {/* Portal Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 text-xs font-bold uppercase tracking-wider">
            <span>सत्यमेव जयते &bull; Sovereign Fiscal Surveillance</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tight">
            Profile Access &amp; Authentication Gate
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl mx-auto">
            Select your assigned governance profile. For regional officers, <strong className="text-amber-600 dark:text-amber-400 font-extrabold underline decoration-amber-500">select your jurisdiction area first</strong> to unlock official login credentials.
          </p>
        </div>

        {/* Persona Selection Tabs */}
        <div className="space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
            <span>CHOOSE GOVERNANCE PROFILE</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {PERSONAS.map((persona) => {
              const Icon = persona.icon
              const isSelected = selectedRole === persona.role
              const roleHasArea = persona.role === 'state_nodal_officer'
                ? Boolean(snaState)
                : persona.role === 'district_authority'
                ? Boolean(dmState && dmDistrict)
                : persona.role === 'mp'
                ? Boolean(mpState && selectedMpId)
                : true

              return (
                <div
                  key={persona.role}
                  onClick={() => handleSelectRole(persona.role)}
                  className={`lux-card p-4 cursor-pointer flex flex-col justify-between transition-colors duration-150 relative ${
                    isSelected
                      ? 'border-[var(--brand-primary)] shadow-md ring-2 ring-[var(--brand-primary)]/25 bg-[var(--surface-primary)]'
                      : 'hover:border-[var(--brand-accent)] opacity-85 hover:opacity-100'
                  }`}
                >
                  {isSelected && (
                    <div
                      className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-[var(--brand-primary)] !text-white text-[9px] font-black uppercase tracking-wider shadow flex items-center gap-1"
                      style={{ color: '#ffffff' }}
                    >
                      <CheckCircle2 size={10} style={{ color: '#ffffff' }} />
                      <span style={{ color: '#ffffff' }}>Active</span>
                    </div>
                  )}

                  <div>
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${
                      isSelected
                        ? 'bg-[var(--brand-primary)]/15 border-[var(--brand-primary)]/30 text-[var(--brand-primary)]'
                        : 'bg-[var(--surface-alt)] border-[var(--border-primary)] text-[var(--text-secondary)]'
                    }`}>
                      <Icon size={20} />
                    </div>

                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-primary)] block mb-0.5">
                      {persona.badge}
                    </span>

                    <h3 className="text-xs font-black text-[var(--text-primary)] tracking-tight leading-snug">
                      {persona.title}
                    </h3>
                    <span className="text-[10px] text-[var(--text-tertiary)] block mb-1.5 font-medium">
                      {persona.hindiTitle}
                    </span>

                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                      {persona.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[var(--border-primary)]/60 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (persona.role === 'viewer') {
                          handleSelectRole('viewer')
                        } else if (selectedRole !== persona.role) {
                          handleSelectRole(persona.role)
                        } else if (roleHasArea) {
                          handleAuthenticate(undefined, persona)
                        } else {
                          handleSelectRole(persona.role)
                        }
                      }}
                      className={`w-full py-2 px-2.5 rounded-lg text-[10px] font-extrabold transition flex items-center justify-center gap-1 cursor-pointer ${
                        roleHasArea
                          ? isSelected
                            ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                            : 'bg-[var(--surface-alt)] hover:bg-[var(--brand-primary)] text-[var(--text-secondary)] hover:text-white'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                      }`}
                    >
                      <span>
                        {persona.role === 'viewer'
                          ? 'See the dashboard'
                          : persona.role === 'mospi'
                          ? 'Sign In'
                          : roleHasArea
                          ? 'Sign In'
                          : persona.role === 'mp'
                          ? 'Select Area'
                          : persona.role === 'district_authority'
                          ? 'Select District'
                          : 'Select State'}
                      </span>
                      <ArrowRight size={10} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Mandatory Area / Jurisdiction Selection for Regional Roles */}
        {currentPersona.requiresArea && (!isAreaSelected || isEditingArea) && (
          <div className="lux-card max-w-xl mx-auto p-5 sm:p-6 space-y-4 border-2 border-[var(--brand-primary)]/40 shadow-xl bg-[var(--surface-primary)] animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-primary)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] flex items-center justify-center">
                  <MapPin size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brand-primary)]">
                    {selectedRole === 'state_nodal_officer'
                      ? 'Select State / UT Jurisdiction'
                      : selectedRole === 'district_authority'
                      ? 'Select District Jurisdiction'
                      : 'Select Parliamentary Area & MP'}
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {selectedRole === 'state_nodal_officer'
                      ? 'Select your State / UT to open official State Nodal Officer login'
                      : selectedRole === 'district_authority'
                      ? 'Select your State and District to open official Collectorate login'
                      : 'Select your Region and Parliamentary Constituency to open official MP login'}
                  </p>
                </div>
              </div>
            </div>

            {/* MP Area Selector */}
            {selectedRole === 'mp' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1 flex items-center justify-between">
                    <span>1. Select Region / State (राज्य / केंद्र शासित प्रदेश)</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">36 States &amp; UTs</span>
                  </label>
                  <select
                    value={mpState}
                    onChange={(e) => handleMpStateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--surface-alt)] border-2 border-[var(--border-primary)] text-[var(--text-primary)] font-bold text-xs outline-none focus:border-[var(--brand-primary)] cursor-pointer"
                  >
                    <option value="" disabled>-- Choose State / UT First (36 Available) --</option>
                    {ALL_36_STATES_AND_UTS.map((st) => (
                      <option key={st} value={st}>
                        {translateState(st, lang)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1 flex items-center justify-between">
                    <span>2. Select MP Seat / Constituency (सांसदीय क्षेत्र)</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {mpState ? `${availableMps.length} Seats in ${mpState}` : 'Select State first'}
                    </span>
                  </label>
                  <select
                    value={selectedMpId}
                    disabled={!mpState}
                    onChange={(e) => handleMpSeatChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--surface-alt)] border-2 border-[var(--border-primary)] text-[var(--text-primary)] font-bold text-xs outline-none focus:border-[var(--brand-primary)] cursor-pointer disabled:opacity-50"
                  >
                    <option value="" disabled>
                      {mpState ? '-- Choose Parliamentary Constituency & MP --' : '-- Select Region First --'}
                    </option>
                    {availableMps.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.constituency !== 'Sitting Rajya Sabha' ? `${m.constituency} — ` : ''}{m.name} ({m.house})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedMp && (
                  <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-emerald-500/30 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-[var(--text-tertiary)] block">Active Seat &amp; Member</span>
                      <strong className="text-[var(--text-primary)]">
                        {selectedMp.constituency !== 'Sitting Rajya Sabha' ? `${selectedMp.constituency} • ` : ''}{selectedMp.name}
                      </strong>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500 text-white">
                      {selectedMp.house}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* District Authority Area Selector */}
            {selectedRole === 'district_authority' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1 flex items-center justify-between">
                    <span>1. Select State / UT (राज्य / केंद्र शासित प्रदेश)</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">36 States</span>
                  </label>
                  <select
                    value={dmState}
                    onChange={(e) => handleDmStateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--surface-alt)] border-2 border-[var(--border-primary)] text-[var(--text-primary)] font-bold text-xs outline-none focus:border-[var(--brand-primary)] cursor-pointer"
                  >
                    <option value="" disabled>-- Choose State First (36 Available) --</option>
                    {ALL_36_STATES_AND_UTS.map((st) => (
                      <option key={st} value={st}>
                        {translateState(st, lang)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1 flex items-center justify-between">
                    <span>2. Select District Collectorate (जिला)</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {dmState ? `${availableDistricts.length} Districts in ${dmState}` : 'Select State first'}
                    </span>
                  </label>
                  <select
                    value={dmDistrict}
                    disabled={!dmState}
                    onChange={(e) => handleDmDistrictChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--surface-alt)] border-2 border-[var(--border-primary)] text-[var(--text-primary)] font-bold text-xs outline-none focus:border-[var(--brand-primary)] cursor-pointer disabled:opacity-50"
                  >
                    <option value="" disabled>
                      {dmState ? '-- Choose District --' : '-- Select State First --'}
                    </option>
                    {availableDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {dmState && dmDistrict && (
                  <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-emerald-500/30 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-[var(--text-tertiary)] block">Collectorate Jurisdiction</span>
                      <strong className="text-[var(--text-primary)]">
                        {dmDistrict}, {dmState}
                      </strong>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500 text-white">
                      Verified
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* State Nodal Officer Area Selector */}
            {selectedRole === 'state_nodal_officer' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1 flex items-center justify-between">
                    <span>Select State / UT Jurisdiction (राज्य / केंद्र शासित प्रदेश)</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">36 States &amp; UTs</span>
                  </label>
                  <select
                    value={snaState}
                    onChange={(e) => handleSnaStateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--surface-alt)] border-2 border-[var(--border-primary)] text-[var(--text-primary)] font-bold text-xs outline-none focus:border-[var(--brand-primary)] cursor-pointer"
                  >
                    <option value="" disabled>-- Choose State / UT (36 Available) --</option>
                    {ALL_36_STATES_AND_UTS.map((st) => (
                      <option key={st} value={st}>
                        {translateState(st, lang)}
                      </option>
                    ))}
                  </select>
                </div>

                {snaState && (
                  <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-emerald-500/30 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-[var(--text-tertiary)] block">State Nodal Authority</span>
                      <strong className="text-[var(--text-primary)]">
                        {snaState}
                      </strong>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500 text-white">
                      Verified
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* If area is already selected, provide Proceed to Login button */}
            {isAreaSelected && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingArea(false)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-xs shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Proceed to {currentPersona.title} Login</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dedicated Authenticated Login Box - Appears ONLY after area selection (never for public citizen!) */}
        {selectedRole !== 'viewer' && (!currentPersona.requiresArea || (isAreaSelected && !isEditingArea)) && (
          <div className="lux-card max-w-lg mx-auto p-6 sm:p-8 space-y-5 border-2 border-[var(--border-primary)] shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] flex items-center justify-center">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">
                    {currentPersona.title} Login
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentPersona.requiresArea && (
                  <button
                    type="button"
                    onClick={() => setIsEditingArea(true)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/30 transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>Change {selectedRole === 'state_nodal_officer' ? 'State' : selectedRole === 'district_authority' ? 'District' : 'Area'}</span>
                  </button>
                )}

                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck size={12} />
                  <span>Autofilled</span>
                </span>
              </div>
            </div>

            <form onSubmit={handleAuthenticate} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[var(--text-secondary)] mb-1">
                  Official Account ID / Email
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-alt)] border-2 border-[var(--border-primary)] text-[var(--text-primary)] font-mono text-xs outline-none focus:border-[var(--brand-primary)] shadow-inner"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--text-secondary)] mb-1">
                  Password / Security Key
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-alt)] border-2 border-[var(--border-primary)] text-[var(--text-primary)] font-mono text-xs outline-none focus:border-[var(--brand-primary)] shadow-inner"
                />
              </div>

              {/* Verified Jurisdiction Summary */}
              <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">
                  Assigned Jurisdiction
                </span>
                <div className="text-xs font-bold text-[var(--text-primary)] flex items-center justify-between">
                  <span>
                    {selectedRole === 'mp' && selectedMp
                      ? `${selectedMp.state} • ${selectedMp.constituency} • ${selectedMp.name}`
                      : selectedRole === 'district_authority'
                      ? `${dmState} • ${dmDistrict}`
                      : selectedRole === 'state_nodal_officer'
                      ? snaState
                      : currentPersona.defaultContext.state}
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold">Verified</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || authSuccess}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-xs shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Authenticating Secure Profile...</span>
                ) : authSuccess ? (
                  <span className="flex items-center gap-1.5 text-white">
                    <CheckCircle2 size={16} />
                    <span>Authenticated! Entering Console...</span>
                  </span>
                ) : (
                  <>
                    <Lock size={15} />
                    <span>Authenticate & Enter {currentPersona.title.split(' ')[0]} Console</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <p className="text-[10px] text-center text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-primary)]">
              🔒 Protected under the Public Financial Management System (PFMS) & National Informatics Centre (NIC) security framework. Cross-profile access strictly restricted.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
