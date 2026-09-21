import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { FlagDossierModal, FlagDossierData } from '../components/FlagDossierModal'
import { BackButton } from '../components/BackButton'
import {
  StatCard,
  TierBadge,
  EmptyState,
  AgencyBadge
} from '../components/shared'
import {
  Building2,
  Users,
  FileCheck2,
  Lock,
  ArrowRight,
  CheckCircle2,
  Clock,
  Landmark,
  Percent,
  ShieldAlert,
  Search,
  X,
  MapPin,
  RotateCcw,
  ChevronRight
} from 'lucide-react'
import { ALL_36_STATES_AND_UTS } from '../lib/constants'
import { STATE_DISTRICTS_MAP } from '../lib/stateDistricts'
import { useTranslation, translateState, toNativeDigits } from '../lib/i18n'
import { useToastStore } from '../store/useToastStore'

export const DistrictDashboard: React.FC = () => {
  const { user, switchRole } = useStore()
  const { t, toNativeDigits: formatNum, lang } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { district } = useParams<{ district?: string }>()
  const stateParam = searchParams.get('state')

  // Priority: URL route param OR user's assigned district if district_authority!
  const districtName = district || (user.role === 'district_authority' && user.district && user.district !== 'ALL' ? user.district : '')
  const hasSelectedDistrict = Boolean(districtName)

  // If user is district authority and accesses /district-dashboard directly without a param, redirect to their assigned district
  useEffect(() => {
    if (!district && user.role === 'district_authority' && user.district && user.district !== 'ALL') {
      navigate(`/districts/${encodeURIComponent(user.district)}`, { replace: true })
    }
  }, [district, user.role, user.district, navigate])

  // Gate Selection State
  const [gateState, setGateState] = useState<string>(() => {
    if (user.role === 'state_nodal_officer' && user.state && user.state !== 'ALL') {
      return user.state
    }
    if (stateParam && stateParam !== 'ALL') {
      return stateParam
    }
    if (user.state && user.state !== 'ALL') {
      return user.state
    }
    return ''
  })
  const [gateDistrictSearch, setGateDistrictSearch] = useState<string>('')

  useEffect(() => {
    if (user.role === 'state_nodal_officer' && user.state && user.state !== 'ALL') {
      setGateState(user.state)
    } else if (stateParam && stateParam !== 'ALL') {
      setGateState(stateParam)
    }
  }, [stateParam, user.role, user.state])

  const [data, setData] = useState<any>(() => {
    try {
      if (!districtName) return null
      const saved = sessionStorage.getItem(`cached_district_${districtName}`)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(() => {
    try {
      if (!districtName) return false
      return !sessionStorage.getItem(`cached_district_${districtName}`)
    } catch { return false }
  })

  // JURISDICTION ENFORCEMENT:
  // MoSPI has national authority.
  // State Nodal Officer has authority ONLY for districts in user.state.
  // District Authority has authority ONLY for user.district.
  const summary = data?.summary || {}
  const currentDistrictState = (summary.state || '').trim().toLowerCase()
  const currentDistrictName = (districtName || '').trim().toLowerCase()
  const userState = (user.state || '').trim().toLowerCase()
  const userDistrict = (user.district || '').trim().toLowerCase()

  const isStateMatch = Boolean(userState && userState !== 'all' && (currentDistrictState === userState || !currentDistrictState))
  const isDistrictMatch = Boolean(userDistrict && userDistrict !== 'all' && currentDistrictName === userDistrict)

  const isAuthorized = Boolean(
    user.isAuthenticated && (
      user.role === 'mospi' ||
      (user.role === 'state_nodal_officer' && isStateMatch) ||
      (user.role === 'district_authority' && isDistrictMatch)
    )
  )

  const [activeTab, setActiveTab] = useState<'works' | 'mps' | 'idas' | 'compliance'>('works')
  const effectiveTab = (!isAuthorized && activeTab === 'compliance') ? 'works' : activeTab

  const { showToast, showActionModal } = useToastStore()
  const [selectedFlag, setSelectedFlag] = useState<FlagDossierData | null>(null)
  const [selectedMBWork, setSelectedMBWork] = useState<any | null>(null)
  const [verifiedMBWorks, setVerifiedMBWorks] = useState<number[]>([])
  const [worksStatusFilter, setWorksStatusFilter] = useState<'all' | 'completed' | 'active'>('all')
  const [worksSearch, setWorksSearch] = useState('')
  const [worksPage, setWorksPage] = useState(1)
  const [worksPageSize, setWorksPageSize] = useState<number | 'all'>(30)

  const certifyMB = (workId: number) => {
    setVerifiedMBWorks((prev) => [...prev, workId])
    handleAction(`✓ Measurement Book (MB) physically verified & certified for Work #${workId}`)
    setSelectedMBWork(null)
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    async function loadDistrict() {
      if (!districtName) {
        setLoading(false)
        return
      }
      sessionStorage.removeItem(`cached_district_${districtName}`)
      if (!sessionStorage.getItem(`cached_district_v2_${districtName}`)) {
        setLoading(true)
      }
      try {
        const res = await fetch(`/api/districts/${encodeURIComponent(districtName)}`)
        if (res.ok) {
          const json = await res.json()
          setData(json.data)
          try { sessionStorage.setItem(`cached_district_v2_${districtName}`, JSON.stringify(json.data)) } catch {}
        }
      } catch (err) {
        console.error('Failed to load district report:', err)
      } finally {
        setLoading(false)
      }
    }
    loadDistrict()
  }, [district, districtName])

  // DISTRICT JURISDICTION GATE: User must select state and district first! No default page!
  if (!hasSelectedDistrict) {
    const districtsForState = gateState ? (STATE_DISTRICTS_MAP[gateState] || STATE_DISTRICTS_MAP[gateState.toUpperCase()] || []) : []
    const filteredDistricts = districtsForState.filter((d: string) =>
      d.toLowerCase().includes(gateDistrictSearch.toLowerCase().trim())
    )

    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6 animate-in fade-in duration-300">
        <div className="rounded-3xl p-6 sm:p-8 bg-[var(--surface-primary)] border-2 border-[var(--border-primary)] shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 text-[var(--brand-primary)] flex items-center justify-center mx-auto shadow-sm">
            <Building2 size={28} />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-xs font-bold uppercase tracking-wider">
              <span>{t('district.command_gate')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">
              {gateState ? `Select District (${translateState(gateState, lang)})` : t('district.select_jurisdiction')}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-lg mx-auto">
              {gateState
                ? `Choose a district in ${translateState(gateState, lang)} to access civil project ledgers and physical inspection reports.`
                : t('district.gate_desc')}
            </p>
          </div>

          {gateState ? (
            <div className="max-w-md mx-auto pt-2 text-left space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold text-[var(--text-primary)] block">
                  {t('district.step2_filter_district')} ({toNativeDigits(districtsForState.length, lang)} {t('common.available')})
                </label>
                {user.role !== 'state_nodal_officer' && (
                  <button
                    type="button"
                    onClick={() => {
                      setGateState('')
                      setGateDistrictSearch('')
                    }}
                    className="text-[11px] font-bold text-[var(--brand-primary)] hover:underline cursor-pointer"
                  >
                    Change State
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('district.type_district_name')}
                  value={gateDistrictSearch}
                  onChange={(e) => setGateDistrictSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--surface-alt)] border-2 border-[var(--border-primary)] text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--brand-primary)] font-medium"
                  autoFocus
                />
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto pt-2 text-left">
              <label className="text-[11px] font-extrabold text-[var(--text-primary)] mb-1 block">
                {t('district.step1_select_state')}
              </label>
              <select
                value={gateState}
                onChange={(e) => {
                  setGateState(e.target.value)
                  setGateDistrictSearch('')
                }}
                className="w-full text-xs bg-[var(--surface-alt)] border-2 border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[var(--text-primary)] font-bold outline-none focus:border-[var(--brand-primary)] cursor-pointer shadow-xs"
              >
                <option value="" disabled>{t('district.choose_state_placeholder')}</option>
                {ALL_36_STATES_AND_UTS.filter(s => s !== 'ALL STATES & UNION TERRITORIES').map((st) => (
                  <option key={st} value={st}>
                    {translateState(st, lang)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {gateState && (
          <div className="space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
              Select District in {translateState(gateState, lang)} ({filteredDistricts.length} matches):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredDistricts.map((d: string) => (
                <button
                  key={d}
                  onClick={async () => {
                    if (user.role === 'district_authority') {
                      await switchRole('district_authority', gateState, d)
                    }
                    navigate(`/districts/${encodeURIComponent(d)}`)
                  }}
                  className="p-3.5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors duration-150 text-left flex items-center justify-between group cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-alt)] text-[var(--brand-primary)] group-hover:bg-[var(--brand-primary)] group-hover:text-white transition-colors duration-150 flex items-center justify-center shrink-0">
                      <MapPin size={15} />
                    </div>
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {d}
                    </span>
                  </div>
                  <ArrowRight size={14} className="text-[var(--text-tertiary)] group-hover:text-[var(--brand-primary)] group-hover:translate-x-1 transition-transform duration-150 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return <LoadingSkeleton rows={6} height="h-32" />
  }

  const works = data?.works || []
  const anomalies = data?.anomalies || []
  const idas = data?.idas || []
  const mpsList = data?.mps || []

  const portfolioVal = summary.portfolioValue || 0
  const portfolioCr = portfolioVal >= 10000000 
    ? (portfolioVal / 10000000).toFixed(2)
    : (portfolioVal / 100000).toFixed(2)
  const portfolioUnit = portfolioVal >= 10000000 ? 'Cr' : 'L'
  const completionRate = summary.completionRate || 0
  const totalWorks = summary.totalWorks || works.length || 0
  const completedCount = summary.completedWorks ?? Math.round(totalWorks * (completionRate / 100))
  const pendingCount = summary.recommendedWorks ?? Math.max(0, totalWorks - completedCount)

  const activeMpsList = summary.activeMps ? summary.activeMps.split(',').map((s: string) => s.trim()) : []

  const handleAction = (msg: string) => {
    showToast(msg, 'success', 5000, 'Compliance Action Logged')
    showActionModal({
      title: 'District Compliance Action Executed',
      subtitle: `${districtName}, ${translateState(summary?.state || user.state, lang) || 'India'}`,
      message: msg,
      refId: `DIST-LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      badgeText: 'DISTRICT AUDIT LOG',
      type: 'success'
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/states" />
        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] flex-wrap">
          <Link to="/" className="hover:text-[var(--text-primary)] transition">{t('nav.home')}</Link>
          <ChevronRight size={12} />
          {(summary.state || user.state) && (
            <>
              <Link to={`/states/${encodeURIComponent(summary.state || user.state || '')}`} className="hover:text-[var(--text-primary)] transition">
                {translateState(summary.state || user.state, lang)}
              </Link>
              <ChevronRight size={12} />
            </>
          )}
          <span className="font-bold text-[var(--text-primary)]">{districtName}</span>
        </div>
      </div>

      {/* Official District Collectorate Header */}
      <div className="rounded-2xl p-5 bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center font-bold shrink-0">
            <Building2 size={22} />
          </div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-primary)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t('district.console_title')}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {districtName}, {translateState(summary.state || user.state, lang) || 'India'}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {t('geo.search_pc_mp')}: <strong className="text-[var(--text-primary)]">{summary.constituencies || districtName}</strong> &bull; {formatNum(activeMpsList.length)} {t('table.members_of_parliament')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user.role !== 'district_authority' && (
            <button
              onClick={() => {
                const targetState = summary.state || user.state || ''
                navigate(targetState && targetState !== 'ALL' ? `/district-dashboard?state=${encodeURIComponent(targetState)}` : '/district-dashboard')
              }}
              className="text-xs px-3 py-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-alt)] hover:border-[var(--brand-primary)] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw size={12} />
              <span>{t('district.change_district')}</span>
            </button>
          )}
          <span className="text-xs px-3 py-1.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] font-bold text-[var(--text-secondary)]">
            {user.role === 'district_authority' ? t('district.role_badge') : t('district.public_view')}
          </span>
          {user.role !== 'district_authority' && (
            <Link
              to={summary.state && summary.state !== 'ALL' ? `/states/${encodeURIComponent(summary.state)}` : '/states'}
              className="text-xs px-3.5 py-1.5 rounded-xl bg-[var(--brand-primary)] !text-white font-bold hover:opacity-90 shadow-sm transition"
              style={{ color: '#ffffff' }}
            >
              <span style={{ color: '#ffffff' }}>{t('district.state_overview')}</span>
            </Link>
          )}
        </div>
      </div>



      {/* 4-KPI Money Band (Real Data from backend) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Landmark}
          label="district.title"
          value={Number(portfolioCr)}
          prefix="₹"
          unit="Cr"
          theme="gold"
          description="district.cumulative_sanctioned"
        />
        <StatCard
          icon={CheckCircle2}
          label="status.completed"
          value={Number(completedCount)}
          theme="emerald"
          description={`${formatNum(Number(completionRate).toFixed(1))}% ${t('district.realization_rate')}`}
        />
        <StatCard
          icon={Percent}
          label="kpi.utilization"
          value={Number(completionRate)}
          unit="%"
          theme="emerald"
          gaugeValue={Number(completionRate)}
          description="district.physical_delivery_ratio"
        />
        <StatCard
          icon={Clock}
          label="status.in_progress"
          value={Number(pendingCount)}
          theme="amber"
          description="district.active_contractor_tranches"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-primary)] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('works')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            effectiveTab === 'works'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <FileCheck2 size={14} />
          <span>{t('states.tab_works_ledger')} ({formatNum(summary?.totalWorks ?? works.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('mps')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            effectiveTab === 'mps'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Users size={14} />
          <span>{t('district.mps_in_district')} ({formatNum(activeMpsList.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('idas')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            effectiveTab === 'idas'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Building2 size={14} />
          <span>{t('district.idas')} ({formatNum(summary?.idaCount ?? idas.length)})</span>
        </button>

        {isAuthorized && (
          <button
            onClick={() => setActiveTab('compliance')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              effectiveTab === 'compliance'
                ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ShieldAlert size={14} className="text-amber-500" />
            <span>Vigilance & Verification ({summary?.anomalyCount ?? anomalies.length})</span>
          </button>
        )}
      </div>

      {/* TAB 1: WORKS LEDGER */}
      {effectiveTab === 'works' && (() => {
        const qClean = worksSearch.trim().toLowerCase()
        const filteredWorks = works.filter((w: any) => {
          const isComp = String(w.status || '').toLowerCase().includes('completed')
          if (worksStatusFilter === 'completed' && !isComp) return false
          if (worksStatusFilter === 'active' && isComp) return false
          if (!qClean) return true

          const wId = String(w.workId || '')
          const desc = String(w.work_description || w.workDescription || w.description || '').toLowerCase()
          const mp = String(w.mpName || '').toLowerCase()
          const cat = String(w.category || '').toLowerCase()
          const agency = String(w.implementingAgency || w.implementing_agency || '').toLowerCase()

          return wId.includes(qClean) || desc.includes(qClean) || mp.includes(qClean) || cat.includes(qClean) || agency.includes(qClean)
        })

        const activeCount = works.filter((w: any) => !String(w.status || '').toLowerCase().includes('completed')).length
        const completedCountInLedger = works.filter((w: any) => String(w.status || '').toLowerCase().includes('completed')).length

        return (
          <div className="space-y-4">
            {works.length === 0 ? (
              <EmptyState
                title="No Works Registered in Central Ledger"
                description={`No individual civil works are currently recorded for district ${districtName}. Total aggregated summary count is ${totalWorks}.`}
              />
            ) : (
              <div className="space-y-3">
                {/* Search & Status Filter Toolbar */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    {/* Live Search Input */}
                    <div className="relative min-w-[200px] sm:min-w-[260px] max-w-sm">
                      <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search Work ID, project, MP..."
                        value={worksSearch}
                        onChange={(e) => {
                          setWorksSearch(e.target.value)
                          setWorksPage(1)
                        }}
                        className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-primary)] shadow-2xs"
                      />
                      {worksSearch && (
                        <button
                          onClick={() => {
                            setWorksSearch('')
                            setWorksPage(1)
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs">
                      <button
                        onClick={() => {
                          setWorksStatusFilter('all')
                          setWorksPage(1)
                        }}
                        className={`px-3 py-1 rounded-lg font-bold transition ${
                          worksStatusFilter === 'all'
                            ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-xs'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        All ({works.length})
                      </button>
                      <button
                        onClick={() => {
                          setWorksStatusFilter('active')
                          setWorksPage(1)
                        }}
                        className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                          worksStatusFilter === 'active'
                            ? 'bg-[var(--surface-primary)] text-amber-600 dark:text-amber-400 shadow-xs'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>Under Execution ({activeCount})</span>
                      </button>
                      <button
                        onClick={() => {
                          setWorksStatusFilter('completed')
                          setWorksPage(1)
                        }}
                        className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                          worksStatusFilter === 'completed'
                            ? 'bg-[var(--surface-primary)] text-emerald-600 dark:text-emerald-400 shadow-xs'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Completed ({completedCountInLedger})</span>
                      </button>
                    </div>

                    {/* Page Size Selector */}
                    <div className="flex items-center gap-1 bg-[var(--surface-alt)] px-2 py-1 rounded-xl border border-[var(--border-primary)] text-xs">
                      <span className="text-[10px] text-[var(--text-tertiary)] font-bold uppercase mr-1">{t('common.per_page')}:</span>
                      {[30, 50, 100, 'all'].map((sz) => (
                        <button
                          key={sz}
                          onClick={() => {
                            setWorksPageSize(sz as any)
                            setWorksPage(1)
                          }}
                          className={`px-2 py-0.5 rounded text-xs font-bold transition ${
                            worksPageSize === sz
                              ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {sz === 'all' ? t('common.all') : formatNum(sz)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <span className="text-[11px] text-[var(--text-tertiary)] font-medium">
                    {t('common.showing_simple', { count: formatNum(filteredWorks.length), total: formatNum(works.length) })}
                  </span>
                </div>

                {(() => {
                  const paginatedWorks = worksPageSize === 'all'
                    ? filteredWorks
                    : filteredWorks.slice((worksPage - 1) * Number(worksPageSize), worksPage * Number(worksPageSize))
                  const totalWorksPages = worksPageSize === 'all' ? 1 : Math.ceil(filteredWorks.length / Number(worksPageSize)) || 1

                  return (
                    <div className="lux-card overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                              <th className="p-3 font-bold whitespace-nowrap">{t('table.work_id')}</th>
                              <th className="p-3 font-bold min-w-[260px] max-w-sm">{t('table.description')}</th>
                              <th className="p-3 font-bold whitespace-nowrap text-right">{t('table.sanctioned_amount')}</th>
                              <th className="p-3 font-bold whitespace-nowrap">{t('table.sponsoring_mp')}</th>
                              <th className="p-3 font-bold whitespace-nowrap">{t('table.category')}</th>
                              <th className="p-3 font-bold whitespace-nowrap">{t('table.agency')}</th>
                              <th className="p-3 font-bold whitespace-nowrap text-center">{t('table.status')}</th>
                              {isAuthorized && <th className="p-3 font-bold text-right whitespace-nowrap">{t('table.action')}</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-primary)]">
                            {paginatedWorks.map((w: any) => {
                              const isCompleted = String(w.status || '').toLowerCase().includes('completed')
                              return (
                                <tr key={w.workId} className="hover:bg-[var(--surface-alt)]/50 transition-colors duration-100">
                                  <td className="p-3 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">
                                    #{formatNum(w.workId)}
                                  </td>
                                  <td className="p-3 text-[var(--text-secondary)] leading-relaxed min-w-[260px] max-w-sm break-words whitespace-normal" title={w.work_description || w.workDescription || w.description}>
                                    {w.work_description || w.workDescription || w.description || 'Civil Works Project'}
                                  </td>
                                  <td className="p-3 font-extrabold tabular-nums numeral-gold whitespace-nowrap text-right">
                                    ₹{formatNum((w.cost / 100000).toFixed(2))} {t('unit.lakh')}
                                  </td>
                                  <td className="p-3 font-medium text-[var(--text-primary)] whitespace-nowrap">
                                    {w.mpName}
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    <span className="px-2 py-0.5 rounded bg-[var(--surface-alt)] font-medium text-[11px] border border-[var(--border-primary)] inline-block whitespace-nowrap">
                                      {w.category}
                                    </span>
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    <AgencyBadge agency={w.implementingAgency || w.implementing_agency || 'District Authority'} size="sm" />
                                  </td>
                                  <td className="p-3 text-center whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold inline-block whitespace-nowrap ${
                                      isCompleted
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                                    }`}>
                                      {isCompleted ? t('status.completed') : t('status.in_progress')}
                                    </span>
                                  </td>
                                  {isAuthorized && (
                                    <td className="p-3 text-right whitespace-nowrap">
                                      {verifiedMBWorks.includes(w.workId) ? (
                                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] inline-flex items-center gap-1 whitespace-nowrap">
                                          <CheckCircle2 size={13} />
                                          <span>MB Certified</span>
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => setSelectedMBWork(w)}
                                          className="px-2.5 py-1 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-bold hover:bg-[var(--brand-primary)] hover:text-white transition shadow-sm whitespace-nowrap"
                                        >
                                          Verify MB
                                        </button>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="p-3 bg-[var(--surface-alt)] border-t border-[var(--border-primary)] text-xs text-[var(--text-secondary)] flex flex-wrap justify-between items-center gap-2">
                        <span>
                          Showing {paginatedWorks.length} of {filteredWorks.length} projects in view ({totalWorks} statutory total)
                        </span>
                        {totalWorksPages > 1 && (
                          <div className="flex items-center gap-2">
                            <button
                              disabled={worksPage === 1}
                              onClick={() => setWorksPage((p) => Math.max(1, p - 1))}
                              className="px-2.5 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
                            >
                              {t('common.previous')}
                            </button>
                            <span className="text-xs font-semibold text-[var(--text-secondary)] px-1">
                              {t('common.page')} {formatNum(worksPage)} {t('common.of')} {formatNum(totalWorksPages)}
                            </span>
                            <button
                              disabled={worksPage === totalWorksPages}
                              onClick={() => setWorksPage((p) => Math.min(totalWorksPages, p + 1))}
                              className="px-2.5 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
                            >
                              {t('common.next')}
                            </button>
                          </div>
                        )}
                        <span className="text-[11px] font-medium text-[var(--text-tertiary)]">{summary?.scope || 'District Ledger'}</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )
      })()}

      {/* TAB 2: MPS IN DISTRICT */}
      {effectiveTab === 'mps' && (
        <div className="space-y-4">
          <div className="text-xs text-[var(--text-secondary)]">
            Members of Parliament representing or allocating development tranches within {districtName}:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mpsList.length > 0 ? (
              mpsList.map((mp: any, idx: number) => {
                const targetUrl = mp.id ? `/mps/${mp.id}` : `/mps/${encodeURIComponent(mp.name)}`
                const constLabel = mp.constituency ? `${mp.constituency}${mp.house ? `, ${mp.house}` : ''}` : (summary.constituencies || districtName)
                return (
                  <div key={mp.id || idx} className="lux-card p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-center font-bold text-xs text-[var(--brand-primary)]">
                          MP
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[var(--text-primary)]">
                            {mp.name}
                          </h4>
                          <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold">
                            {constLabel}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs space-y-1.5 mb-3">
                        <div className="flex justify-between">
                          <span className="text-[var(--text-tertiary)]">District Allocations:</span>
                          <span className="font-bold text-[var(--text-primary)]">{mp.status || 'Active'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-tertiary)]">Sanction Status:</span>
                          <span className="font-bold text-emerald-600">Compliant</span>
                        </div>
                      </div>
                    </div>

                    <Link
                      to={targetUrl}
                      onMouseEnter={() => {
                        import('./MPDetail').catch(() => {})
                        if (mp.id) fetch(`/api/mps/${encodeURIComponent(mp.id)}`).catch(() => {})
                      }}
                      className="w-full py-1.5 px-3 rounded-lg bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-xs font-bold text-[var(--brand-primary)] border border-[var(--border-primary)] flex items-center justify-center gap-1.5 transition shadow-2xs"
                    >
                      <span>View Parliamentary Record</span>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                )
              })
            ) : (
              activeMpsList.map((mpName: string, idx: number) => (
                <div key={idx} className="lux-card p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-center font-bold text-xs text-[var(--brand-primary)]">
                        MP
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          {mpName}
                        </h4>
                        <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold">
                          {summary.constituencies || districtName}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs space-y-1.5 mb-3">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">District Allocations:</span>
                        <span className="font-bold text-[var(--text-primary)]">Active</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">Sanction Status:</span>
                        <span className="font-bold text-emerald-600">Compliant</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/mps/${encodeURIComponent(mpName)}`}
                    className="w-full py-1.5 px-3 rounded-lg bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-xs font-bold text-[var(--brand-primary)] border border-[var(--border-primary)] flex items-center justify-center gap-1 transition"
                  >
                    <span>View Parliamentary Record</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: IDAs & CONTRACTORS */}
      {effectiveTab === 'idas' && (
        <div className="space-y-4">
          <div className="text-xs text-[var(--text-secondary)]">
            Implementing Development Agencies (IDAs) executing civil infrastructure in {districtName}:
          </div>

          {idas.length === 0 ? (
            <div className="lux-card p-6 text-center text-xs text-[var(--text-secondary)]">
              All agencies operating in {districtName} are currently within baseline variance tolerances.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {idas.map((ida: any) => (
                <div key={ida.entityId} className="lux-card p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-[var(--text-primary)] line-clamp-1">
                      {ida.name}
                    </h4>
                    <TierBadge tier={ida.riskTier} size="sm" />
                  </div>

                  <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Composite Risk</span>
                    <span className="font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
                      {ida.compositeRiskScore.toFixed(2)} / 20.0
                    </span>
                  </div>

                  {isAuthorized ? (
                    <button
                      onClick={() =>
                        handleAction(`Site inspection audit summons dispatched to ${ida.name}`)
                      }
                      className="w-full py-1.5 px-3 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 transition cursor-pointer"
                    >
                      Summon Agency Inspection
                    </button>
                  ) : (
                    <div className="text-[11px] text-[var(--text-tertiary)] font-medium text-center py-1 px-2 bg-[var(--surface-alt)] rounded-lg border border-[var(--border-primary)]/60">
                      Executing Agency &bull; Public Record
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMPLIANCE & ANOMALIES */}
      {effectiveTab === 'compliance' && (
        <div className="space-y-4">
          {anomalies.length === 0 ? (
            <EmptyState
              title="Zero Compliance Alerts"
              description={`All verified works in ${districtName} are within statutory CPWD benchmark cost limits and single-bidder thresholds.`}
            />
          ) : (
            <div className="lux-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      <th className="p-3 font-bold whitespace-nowrap">Work ID</th>
                      <th className="p-3 font-bold min-w-[260px] max-w-sm">Description</th>
                      <th className="p-3 font-bold whitespace-nowrap text-right">Cost</th>
                      <th className="p-3 font-bold whitespace-nowrap">Implementing Agency</th>
                      <th className="p-3 font-bold text-center whitespace-nowrap">Severity</th>
                      <th className="p-3 font-bold text-right whitespace-nowrap">
                        {isAuthorized ? 'Collectorate Action' : 'Audit Findings'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {anomalies.map((a: any) => (
                      <tr key={a.workId} className="hover:bg-[var(--surface-alt)]/50 transition">
                        <td className="p-3 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">
                          #{a.workId}
                        </td>
                        <td className="p-3 text-[var(--text-secondary)] leading-relaxed min-w-[260px] max-w-sm break-words whitespace-normal" title={a.work_description || a.workDescription || a.description}>
                          {a.work_description || a.workDescription || a.description || 'Civil Works Project'}
                        </td>
                        <td className="p-3 font-extrabold tabular-nums whitespace-nowrap text-right">
                          ₹{((a.cost || a.sanctionedCost || 0) / 100000).toFixed(2)} L
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <AgencyBadge agency={a.implementingAgency || a.implementing_agency || 'District Authority'} size="sm" />
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <TierBadge tier={a.tier} count={Number(a.severity.toFixed(2))} size="sm" />
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedFlag(a)}
                            className="px-2.5 py-1 rounded-lg bg-[var(--brand-primary)] text-white font-bold text-xs hover:opacity-90 transition whitespace-nowrap cursor-pointer"
                          >
                            {isAuthorized ? 'Investigate' : 'View Dossier'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-[var(--surface-alt)] border-t border-[var(--border-primary)] text-xs text-[var(--text-secondary)] flex justify-between items-center">
                <span>Showing {anomalies.length} of {summary?.anomalyCount ?? anomalies.length} detected vigilance flags (Prioritized by risk severity)</span>
                <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Real-time Forensic Triage</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Measurement Book (MB) Verification Dialog */}
      {isAuthorized && selectedMBWork && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in">
          <div className="lux-card max-w-xl w-full p-6 relative shadow-2xl space-y-4">
            <button
              onClick={() => setSelectedMBWork(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-[var(--surface-alt)]"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-[var(--border-primary)] pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-bold">
                <FileCheck2 size={22} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                  Statutory Physical Verification &bull; CPWD SOR
                </span>
                <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                  Measurement Book (MB) &bull; Work #{selectedMBWork.workId}
                </h3>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] space-y-2 text-xs">
              <div>
                <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold block">Full Project Description</span>
                <p className="font-semibold text-[var(--text-primary)] mt-0.5 leading-relaxed">
                  {selectedMBWork.work_description || selectedMBWork.workDescription || selectedMBWork.description || 'Public Infrastructure Development'}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--border-primary)]">
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block font-medium">Sanction Outlay</span>
                  <span className="font-extrabold text-[var(--text-primary)] tabular-nums">
                    ₹{((selectedMBWork.cost || 0) / 100000).toFixed(2)} Lakhs
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block font-medium">Sponsoring MP</span>
                  <span className="font-bold text-[var(--text-primary)] truncate block">
                    {selectedMBWork.mpName || 'Constituency MP'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block font-medium">Category</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {selectedMBWork.category || 'Civil Works'}
                  </span>
                </div>
              </div>
            </div>

            {/* Inspection Checklist */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Statutory Inspection Checkpoints
              </div>
              <div className="space-y-1.5">
                <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-between">
                  <span className="font-medium text-[var(--text-secondary)]">1. Geo-tagged Site Inspection (GPS Match)</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    <span>Verified 100%</span>
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-between">
                  <span className="font-medium text-[var(--text-secondary)]">2. Quantity Measurements (Bill of Quantities)</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    <span>Reconciled</span>
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-between">
                  <span className="font-medium text-[var(--text-secondary)]">3. Executive Engineer Technical Sign-off</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    <span>Approved</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-primary)]">
              <button
                onClick={() => setSelectedMBWork(null)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-xs font-bold text-[var(--text-secondary)] transition"
              >
                Close
              </button>
              <button
                onClick={() => certifyMB(selectedMBWork.workId)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Certify MB & Record</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag Report Modal */}
      {selectedFlag && (
        <FlagDossierModal
          flag={selectedFlag}
          onClose={() => setSelectedFlag(null)}
        />
      )}
    </div>
  )
}
