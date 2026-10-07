import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
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
  ChevronRight,
  Building2,
  FileCheck2,
  ShieldAlert,
  ShieldCheck,
  Search,
  ArrowRight,
  CheckCircle2,
  Landmark,
  Coins,
  Percent,
  Clock,
  X,
  Lock,
  TrendingUp,
  Users,
  Check
} from 'lucide-react'
import { useTranslation, translateState, translateMP, translateDistrict } from '../lib/i18n'
import { useToastStore } from '../store/useToastStore'
import { ALL_36_STATES_OVERVIEW } from '../lib/allStatesData'
import { STATE_DISTRICTS_MAP } from '../lib/stateDistricts'
import { getDistrictsForState } from '../lib/allDistrictsData'

const UNION_TERRITORIES = [
  'Andaman And Nicobar Islands',
  'Chandigarh',
  'The Dadra And Nagar Haveli And Daman And Diu',
  'Delhi',
  'Jammu And Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
]

function getSafeSessionState(stateName: string | undefined): any {
  if (!stateName || typeof window === 'undefined') return null
  try {
    const saved = sessionStorage.getItem(`cached_state_${stateName}`)
    if (saved) return JSON.parse(saved)
  } catch {}

  // Instant 0ms seed from ALL_36_STATES_OVERVIEW for light-speed rendering
  const found = ALL_36_STATES_OVERVIEW.find(
    s => s.state.toLowerCase() === stateName.trim().toLowerCase()
  )
  if (found) {
    const realDistricts = getDistrictsForState(found.state)
    const rawDistricts = STATE_DISTRICTS_MAP[found.state] || []
    const mappedDistricts = realDistricts.length > 0
      ? realDistricts.map(d => ({
          district: d.district,
          districtNodal: d.districtNodal,
          totalWorks: d.totalWorks,
          completedWorks: d.completedWorks,
          recommendedWorks: d.recommendedWorks,
          completionRatePct: d.completionRatePct,
          portfolioValue: d.portfolioValue,
          tier: d.tier,
          expenditure: d.expenditure,
          balance: d.balance,
          inProgressPayments: d.inProgressPayments,
          mpCount: d.mpCount,
          mpsActive: d.mpsActive,
          constituenciesCovered: d.constituenciesCovered,
          primarySector: d.primarySector,
          implementingAgency: d.implementingAgency
        }))
      : rawDistricts.map((d: string) => ({
          district: d,
          districtNodal: d,
          totalWorks: 0,
          completedWorks: 0,
          recommendedWorks: 0,
          completionRatePct: 0.0,
          portfolioValue: 0,
          tier: 'green'
        }))

    return {
      state: found.state,
      isUT: found.isUT,
      rank: found.rank,
      summary: {
        state: found.state,
        totalAllocated: found.totalAllocated,
        totalExpenditure: found.totalExpenditure,
        utilizationPercentage: found.expenditureRate,
        totalWorksCompleted: found.completedWorks,
        totalWorksRecommended: Math.round(found.completedWorks * 1.6),
        completionRate: found.completionRate,
        mpCount: found.mps,
        districtCount: mappedDistricts.length || rawDistricts.length || 30
      },
      districts: mappedDistricts
    }
  }
  return null
}

function getSafeLocalThanks(stateName: string | undefined): number {
  if (!stateName || typeof window === 'undefined') return 0
  try {
    const saved = localStorage.getItem(`thanks_state_${stateName}`)
    return saved ? parseInt(saved, 10) || 0 : 0
  } catch {
    return 0
  }
}

export const StateDetail: React.FC = () => {
  const { state } = useParams<{ state: string }>()
  const { user } = useStore()
  const { t, toNativeDigits: formatNum, lang } = useTranslation()
  const isAuditorOrAdmin = ['state_nodal_officer', 'district_authority', 'admin', 'mospi'].includes(user?.role)

  const [data, setData] = useState<any>(() => getSafeSessionState(state))
  const [flags, setFlags] = useState<any[]>([])
  const [loading, setLoading] = useState(() => !getSafeSessionState(state))
  const [activeTab, setActiveTab] = useState<'districts' | 'works' | 'flags'>('districts')
  const effectiveTab = (!isAuditorOrAdmin && activeTab === 'flags') ? 'districts' : activeTab
  const [selectedFlag, setSelectedFlag] = useState<FlagDossierData | null>(null)

  // District search, sort & pagination
  const [districtSearch, setDistrictSearch] = useState('')
  const [districtSort, setDistrictSort] = useState<'name' | 'works' | 'outlay' | 'risk'>('name')
  const [districtPage, setDistrictPage] = useState(1)
  const [districtPageSize, setDistrictPageSize] = useState<number | 'all'>(30)

  // Give thanks feature
  const [thanksCount, setThanksCount] = useState<number>(() => getSafeLocalThanks(state))
  const [thanked, setThanked] = useState(false)
  const { showToast } = useToastStore()

  // STRICT JURISDICTION RESTRICTIONS:
  const currentState = (state || '').trim().toLowerCase()
  const userState = (user.state || '').trim().toLowerCase()
  const isOwnState = Boolean(userState && userState !== 'all' && (currentState === userState || currentState.includes(userState) || userState.includes(currentState)))

  const canTakeStateAction = Boolean(
    user.isAuthenticated && (
      user.role === 'mospi' ||
      (user.role === 'state_nodal_officer' && isOwnState)
    )
  )
  const isOutOfStateOfficer = user.role === 'state_nodal_officer' && !isOwnState

  const handleThankState = () => {
    if (isOutOfStateOfficer) {
      showToast(`Official actions are restricted to your assigned jurisdiction (${translateState(user.state, lang)}).`, 'info', 3500)
      return
    }
    const next = thanksCount + 1
    setThanksCount(next)
    setThanked(true)
    if (state && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`thanks_state_${state}`, String(next))
      } catch (e) {
        console.error(e)
      }
    }
    showToast(`Citizenship appreciation recorded for ${translateState(state, lang)}!`, 'success', 3500)
    setTimeout(() => setThanked(false), 3500)
  }

  // Works search, filter & pagination
  const [works, setWorks] = useState<any[]>([])
  const [worksTotal, setWorksTotal] = useState(0)
  const [worksLoading, setWorksLoading] = useState(false)
  const [worksPage, setWorksPage] = useState(1)
  const [worksSearch, setWorksSearch] = useState('')
  const [debouncedWorksSearch, setDebouncedWorksSearch] = useState('')
  const [worksStatus, setWorksStatus] = useState('all')
  const WORKS_PER_PAGE = 30

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedWorksSearch(worksSearch)
    }, 250)
    return () => clearTimeout(handler)
  }, [worksSearch])

  // Flags filter & state
  const [flagTierFilter, setFlagTierFilter] = useState('all')
  const [flagsLoading, setFlagsLoading] = useState(false)
  const [flagsTotal, setFlagsTotal] = useState(0)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    async function loadStateData() {
      if (!state) {
        setLoading(false)
        return
      }
      if (!getSafeSessionState(state)) {
        setLoading(true)
      }
      try {
        const resState = await fetch(`/api/states/${encodeURIComponent(state)}`)
        if (resState.ok) {
          const jsonState = await resState.json()
          if (jsonState.data) {
            setData(jsonState.data)
            if (typeof window !== 'undefined') {
              try { sessionStorage.setItem(`cached_state_${state}`, JSON.stringify(jsonState.data)) } catch {}
            }
            setLoading(false)
            return
          }
        }
      } catch (err) {
        console.error('Failed to load state detail from API, using master benchmark fallback:', err)
      }

      // Resilient fallback from calibrated master datasets
      const cleanState = state.trim().toLowerCase()
      const matchedOverview = ALL_36_STATES_OVERVIEW.find(
        (s) => s.state.toLowerCase() === cleanState
      ) || ALL_36_STATES_OVERVIEW.find(
        (s) => s.state.toLowerCase().includes(cleanState) || cleanState.includes(s.state.toLowerCase())
      )

      if (matchedOverview) {
        const distNames = STATE_DISTRICTS_MAP[matchedOverview.state] || STATE_DISTRICTS_MAP[state] || []
        const distCount = Math.max(1, distNames.length)
        const fallbackDistricts = distNames.map((dName) => ({
          district_nodal: dName,
          district: dName,
          districtNodal: dName,
          total_works: Math.round(matchedOverview.completedWorks / distCount) || 28,
          completed_works_count: Math.round(matchedOverview.completedWorks / distCount) || 20,
          completion_rate_pct: matchedOverview.completionRate,
          portfolio_value: Math.round(matchedOverview.totalAllocated / distCount),
          expenditure: Math.round(matchedOverview.totalExpenditure / distCount),
          mp_count: Math.max(1, Math.round(matchedOverview.mps / distCount)),
          mps_count: Math.max(1, Math.round(matchedOverview.mps / distCount))
        }))

        const fallbackPayload = {
          state: matchedOverview.state,
          summary: {
            totalAllocated: matchedOverview.totalAllocated,
            totalExpenditure: matchedOverview.totalExpenditure,
            utilizationPercentage: matchedOverview.expenditureRate,
            utilizationRate: matchedOverview.expenditureRate,
            mpCount: matchedOverview.mps,
            activeMpCount: matchedOverview.mps,
            districtCount: distNames.length,
            totalWorksCompleted: matchedOverview.completedWorks,
            redFlagPct: 2.8
          },
          districts: fallbackDistricts
        }
        setData(fallbackPayload)
      }
      setLoading(false)
    }
    loadStateData()
  }, [state])

  useEffect(() => {
    async function loadFlags() {
      if (!state) return
      setFlagsLoading(true)
      try {
        const tierParam = flagTierFilter !== 'all' ? `&tier=${flagTierFilter}` : ''
        const res = await fetch(`/api/states/${encodeURIComponent(state)}/flags?page=1&page_size=100${tierParam}`)
        if (res.ok) {
          const json = await res.json()
          setFlags(json.data || [])
          setFlagsTotal(json.meta?.total ?? (json.data || []).length)
        }
      } catch (err) {
        console.error('Failed to load state flags:', err)
      } finally {
        setFlagsLoading(false)
      }
    }
    loadFlags()
  }, [state, flagTierFilter])

  useEffect(() => {
    async function loadWorks() {
      if (!state) return
      setWorksLoading(true)
      try {
        const queryParams = new URLSearchParams({
          page: String(worksPage),
          page_size: String(WORKS_PER_PAGE)
        })
        if (worksStatus !== 'all') queryParams.set('status', worksStatus)
        if (debouncedWorksSearch.trim()) queryParams.set('search', debouncedWorksSearch.trim())

        const res = await fetch(`/api/states/${encodeURIComponent(state)}/works?${queryParams.toString()}`)
        if (res.ok) {
          const json = await res.json()
          setWorks(json.data || [])
          setWorksTotal(json.meta?.total ?? (json.data || []).length)
        }
      } catch (err) {
        console.error('Failed to load state works:', err)
      } finally {
        setWorksLoading(false)
      }
    }
    loadWorks()
  }, [state, worksPage, worksStatus, debouncedWorksSearch])

  if (loading) {
    return <LoadingSkeleton rows={6} height="h-32" />
  }

  if (!data) {
    return (
      <EmptyState
        title={t('state.not_found')}
        description={`The requested state "${translateState(state, lang)}" could not be retrieved from master records.`}
        action={
          <Link
            to="/states"
            className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow"
          >
            {t('state.back_to_directory')}
          </Link>
        }
      />
    )
  }

  const { summary, districts } = data
  const allocCr = summary ? Math.round((summary.totalAllocated || 0) / 10000000) : 0
  const expCr = summary ? Math.round((summary.totalExpenditure || 0) / 10000000) : 0
  const util = Number(summary?.utilizationPercentage ?? summary?.utilizationRate ?? 0)
  const paymentGap = summary ? Math.max(0, 100 - util).toFixed(1) : '0.0'

  const isUT = state ? UNION_TERRITORIES.includes(state) : false

  // Filter & Sort districts
  const filteredDistricts = (districts || []).filter((d: any) =>
    (d.district_nodal || d.districtNodal || d.district || '').toLowerCase().includes(districtSearch.toLowerCase())
  )

  const sortedDistricts = [...filteredDistricts].sort((a: any, b: any) => {
    if (districtSort === 'works') {
      return (b.total_works ?? b.totalWorks ?? 0) - (a.total_works ?? a.totalWorks ?? 0)
    }
    if (districtSort === 'outlay') {
      const pA = a.portfolio_value ?? a.portfolioValue ?? 0
      const pB = b.portfolio_value ?? b.portfolioValue ?? 0
      return pB - pA
    }
    if (districtSort === 'risk') {
      const rA = (a.tier_counts?.red || 0) + (a.tier_counts?.orange || 0)
      const rB = (b.tier_counts?.red || 0) + (b.tier_counts?.orange || 0)
      return rB - rA
    }
    const nameA = a.district_nodal || a.districtNodal || a.district || ''
    const nameB = b.district_nodal || b.districtNodal || b.district || ''
    return nameA.localeCompare(nameB)
  })

  const paginatedDistricts = districtPageSize === 'all'
    ? sortedDistricts
    : sortedDistricts.slice(
        (districtPage - 1) * Number(districtPageSize),
        districtPage * Number(districtPageSize)
      )
  const totalDistrictPages = districtPageSize === 'all'
    ? 1
    : Math.ceil(filteredDistricts.length / Number(districtPageSize)) || 1
  const totalWorksPages = Math.ceil(worksTotal / WORKS_PER_PAGE) || 1

  // Filter flags (server-side filtered)
  const filteredFlags = flags

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/states" />
        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] flex-wrap">
          <Link to="/" className="hover:text-[var(--text-primary)] transition">
            {t('nav.home')}
          </Link>
          <ChevronRight size={12} />
          <Link to="/states" className="hover:text-[var(--text-primary)] transition">
            {t('nav.browse_states')}
          </Link>
          <ChevronRight size={12} />
          <span className="font-bold text-[var(--text-primary)]">{translateState(state, lang)}</span>
        </div>
      </div>

      {/* State Header & Appreciation Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {isOutOfStateOfficer && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-bold mb-2">
              <Lock size={12} />
              <span>Public Transparency View (Official Jurisdiction: {translateState(user.state, lang)})</span>
            </div>
          )}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--brand-primary)]">
              {t('state.jurisdiction_report')}
            </span>
            {isUT ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30">
                {t('state.union_territory')}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                {t('state.state')}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
            {translateState(state, lang)}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
            {formatNum(summary?.districtCount || districts?.length || 0)} {t('state.districts_count')} &bull; {formatNum(summary?.activeMpCount || summary?.mpCount || 0)} {t('table.members_of_parliament')}
          </p>
        </div>

        {/* Give Thanks to State Action Button */}
        <div className="flex items-center gap-2">
          {isOutOfStateOfficer ? (
            <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs text-[var(--text-tertiary)] font-bold">
              <Lock size={12} className="text-amber-500" />
              <span>Appreciation Locked (Odisha Officer)</span>
            </div>
          ) : (
            <button
              onClick={handleThankState}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] hover:border-[var(--brand-accent)] shadow-sm text-xs font-bold transition group"
            >
              <span className="text-base group-hover:scale-110 transition-transform">👏</span>
              <span className="text-[var(--text-primary)]">
                {t('state.appreciate')} {translateState(state, lang)} ({formatNum(thanksCount)})
              </span>
            </button>
          )}
        </div>
      </div>

      {thanked && (
        <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>✓ {t('state.appreciation_recorded')}</span>
        </div>
      )}

      {/* State-Scoped Money Band (4 KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Landmark}
          label="mps.fund_allocated"
          value={Number(allocCr)}
          prefix="₹"
          unit="Cr"
          theme="slate"
          description="kpi.total_central_sanction"
          tooltip={`Cumulative statutory MPLADS fund allocated across all constituencies in ${state}.`}
        />
        <StatCard
          icon={Coins}
          label="mps.disbursed"
          value={Number(expCr)}
          prefix="₹"
          unit="Cr"
          theme="slate"
          description="kpi.verified_expenditure"
          tooltip={`Total funds disbursed and verified by District Authorities with valid Utilization Certificates in ${state}.`}
        />
        <StatCard
          icon={Percent}
          label="kpi.utilization"
          value={Number(util)}
          unit="%"
          theme="emerald"
          gaugeValue={util}
          description="kpi.expenditure_ratio"
          tooltip={`State-level fund realization percentage across all districts in ${state}.`}
        />
        <StatCard
          icon={Clock}
          label="kpi.payment_gap"
          value={Number(paymentGap)}
          unit="%"
          theme="amber"
          description="kpi.pending_disbursement"
          tooltip={`Percentage gap between sanctioned committed amounts and cleared treasury releases in ${state}.`}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-primary)] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('districts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            effectiveTab === 'districts'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Building2 size={14} />
          <span>{t('states.tab_districts')} ({formatNum(districts?.length || 0)})</span>
        </button>

        <button
          onClick={() => setActiveTab('works')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            effectiveTab === 'works'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <FileCheck2 size={14} />
          <span>{t('kpi.recommended')} ({formatNum(worksTotal || summary?.recommendedWorksCount || 0)})</span>
        </button>

        {isAuditorOrAdmin && (
          <button
            onClick={() => setActiveTab('flags')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              effectiveTab === 'flags'
                ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {flagsTotal > 0 ? (
              <ShieldAlert size={14} className="text-rose-500" />
            ) : (
              <ShieldCheck size={14} className="text-emerald-500" />
            )}
            <span>{t('states.tab_forensic_flags')} ({formatNum(flagsTotal)})</span>
          </button>
        )}
      </div>

      {/* TAB 1: DISTRICTS */}
      {effectiveTab === 'districts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={districtSearch}
                  onChange={(e) => {
                    setDistrictSearch(e.target.value)
                    setDistrictPage(1)
                  }}
                  placeholder={t('district.filter_placeholder')}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-xs shadow-sm">
                <span className="text-[var(--text-secondary)] text-[11px] font-medium whitespace-nowrap">{t('common.sort_by')}:</span>
                <select
                  value={districtSort}
                  onChange={(e) => setDistrictSort(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer"
                >
                  <option value="name">{t('district.sort_az')}</option>
                  <option value="works">{t('states.sort_works')}</option>
                  <option value="outlay">{t('states.sort_allocated')}</option>
                  <option value="risk">{t('table.severity')}</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-[var(--surface-alt)] p-0.5 rounded-lg border border-[var(--border-primary)] text-xs">
                <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] px-1.5">{t('common.view')}</span>
                {[30, 60, 'all'].map((sz) => (
                  <button
                    key={String(sz)}
                    onClick={() => {
                      setDistrictPageSize(sz as any)
                      setDistrictPage(1)
                    }}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition ${
                      districtPageSize === sz
                        ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {sz === 'all' ? `${t('common.all')} (${formatNum(filteredDistricts.length)})` : formatNum(sz)}
                  </button>
                ))}
              </div>

              <div className="text-xs text-[var(--text-secondary)] font-medium">
                {t('common.showing_simple', { count: paginatedDistricts.length, total: filteredDistricts.length })}
              </div>
            </div>
          </div>

          {paginatedDistricts.length === 0 ? (
            <EmptyState
              title={t('state.no_districts_match')}
              description={`No district matches "${districtSearch}".`}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedDistricts.map((d: any, idx: number) => {
                const distName = d.district_nodal || d.districtNodal || d.district || 'District'
                const completionPct = Number(d.completion_rate_pct ?? d.completionRatePct ?? 0)
                const totWorks = d.total_works ?? d.totalWorks ?? 0
                const rawPort = d.portfolio_value ?? d.portfolioValue ?? d.totalExpenditure ?? 0
                const allocatedVal = rawPort > 0 ? rawPort : (totWorks * 2500000.0)
                const spentVal = d.expenditure ?? d.totalExpenditure ?? (allocatedVal * (completionPct / 100))
                const allocatedCr = (allocatedVal / 10000000).toFixed(1)
                const spentCr = (spentVal / 10000000).toFixed(1)

                const compW = d.completed_works_count ?? d.completedWorks ?? Math.round(totWorks * (completionPct / 100))
                const activeMps = d.mps_active || d.activeMps || ''
                const mpCount = d.mp_count ?? d.mpCount ?? (activeMps ? activeMps.split(',').filter(Boolean).length : (d.mps_count || 1))

                const expRate = allocatedVal > 0 ? ((spentVal / allocatedVal) * 100).toFixed(1) : '0.0'
                const compRate = totWorks > 0 ? ((compW / totWorks) * 100).toFixed(1) : '0.0'
                const rankNum = (districtPage - 1) * (districtPageSize === 'all' ? 0 : Number(districtPageSize)) + idx + 1

                return (
                  <div
                    key={distName}
                    className="group bg-[var(--surface-primary)] rounded-2xl border border-[var(--border-primary)] hover:border-[var(--brand-accent)] p-5 flex flex-col justify-between transition-colors duration-150 hover:shadow-md relative overflow-hidden"
                  >
                    <div>
                      {/* Top Row: Name & Rank Badge */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-base sm:text-lg font-black text-[var(--text-primary)] group-hover:text-[var(--brand-accent)] transition tracking-tight">
                          {translateDistrict(distName, lang)}
                        </h3>
                        <span className="shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {t('label.rank')} #{formatNum(rankNum)} / {formatNum(filteredDistricts.length)}
                        </span>
                      </div>

                      {/* MP count */}
                      <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] font-bold mb-4">
                        <Users size={12} />
                        <span>{formatNum(mpCount)} {t('unit.mps')}</span>
                      </div>

                      {/* 2-Col Budget: ALLOCATED BUDGET vs RECORDED EXPENDITURE */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">
                            {t('kpi.allocated')}
                          </div>
                          <div className="text-lg font-black text-[var(--text-primary)] mt-0.5">
                            ₹{formatNum(allocatedCr)} {t('unit.cr')}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">
                            {t('kpi.used')}
                          </div>
                          <div className="text-lg font-black text-[var(--text-primary)] mt-0.5">
                            ₹{formatNum(spentCr)} {t('unit.cr')}
                          </div>
                        </div>
                      </div>

                      {/* Expenditure Rate with Progress Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                          <span className="text-[var(--text-secondary)]">{t('kpi.utilization')}</span>
                          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-black">
                            <TrendingUp size={12} />
                            {formatNum(expRate)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-[width] duration-700 ease-out"
                            style={{ width: `${Math.min(100, Math.max(3, Number(expRate)))}%` }}
                          />
                        </div>
                      </div>

                      {/* Bottom Row: Works Completed & Completion Rate */}
                      <div className="flex items-center justify-between text-xs py-2 border-t border-[var(--border-primary)]/40 text-[var(--text-secondary)]">
                        <div className="flex items-center gap-1.5 font-bold">
                          <div className="w-4 h-4 rounded-full border border-emerald-500/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <Check size={10} strokeWidth={3} />
                          </div>
                          <span>
                            <strong className="text-[var(--text-primary)]">{formatNum(compW)}</strong> {t('kpi.completed')}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[var(--text-tertiary)] block font-semibold">{t('kpi.completion_rate')}</span>
                          <span className="font-extrabold text-[var(--text-primary)]">{formatNum(compRate)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* View Details Link */}
                    <Link
                      to={`/districts/${encodeURIComponent(distName)}`}
                      onMouseEnter={() => {
                        import('./DistrictDashboard').catch(() => {})
                        fetch(`/api/districts/${encodeURIComponent(distName)}`).catch(() => {})
                      }}
                      className="mt-4 pt-3 border-t border-[var(--border-primary)]/40 flex items-center justify-center gap-1 text-xs font-black text-[var(--text-primary)] group-hover:text-[var(--brand-accent)] transition"
                    >
                      <span>{t('btn.show_details')}</span>
                      <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalDistrictPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                disabled={districtPage === 1}
                onClick={() => setDistrictPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
              >
                {t('common.previous')}
              </button>
              <span className="text-xs font-semibold text-[var(--text-secondary)] px-2">
                {t('common.page')} {formatNum(districtPage)} {t('common.of')} {formatNum(totalDistrictPages)}
              </span>
              <button
                disabled={districtPage === totalDistrictPages}
                onClick={() => setDistrictPage((p) => Math.min(totalDistrictPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
              >
                {t('common.next')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WORKS LEDGER */}
      {effectiveTab === 'works' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-2.5" />
              <input
                type="text"
                value={worksSearch}
                onChange={(e) => {
                  setWorksSearch(e.target.value)
                  setWorksPage(1)
                }}
                placeholder={t('state.search_works_placeholder')}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
              />
              {worksSearch && (
                <button
                  onClick={() => {
                    setWorksSearch('')
                    setWorksPage(1)
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-secondary)]">{t('table.status')}:</span>
              <div className="flex items-center gap-1">
                {[
                  { id: 'all', label: `${t('common.all')} ${t('common.works')}` },
                  { id: 'recommended', label: t('status.recommended') },
                  { id: 'completed', label: t('status.completed') }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setWorksStatus(s.id)
                      setWorksPage(1)
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      worksStatus === s.id
                        ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                        : 'bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {worksLoading ? (
            <LoadingSkeleton rows={5} height="h-12" />
          ) : works.length === 0 ? (
            <EmptyState
              title={t('state.no_works_match')}
              description={t('state.no_works_desc')}
            />
          ) : (
            <div className="lux-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      <th className="p-3 font-bold w-20">{t('table.work_id')}</th>
                      <th className="p-3 font-bold min-w-[200px]">{t('table.description')}</th>
                      <th className="p-3 font-bold min-w-[170px] w-48">{t('table.sponsoring_mp')}</th>
                      <th className="p-3 font-bold min-w-[140px] w-36">{t('table.district')}</th>
                      <th className="p-3 font-bold min-w-[150px] w-40">{t('table.category')}</th>
                      <th className="p-3 font-bold min-w-[220px] w-64">{t('table.agency')}</th>
                      <th className="p-3 font-bold text-right w-28 whitespace-nowrap">{t('table.sanctioned_amount')}</th>
                      <th className="p-3 font-bold text-center w-24">{t('table.status')}</th>
                      <th className="p-3 font-bold text-center w-24">{t('table.progress')}</th>
                      <th className="p-3 font-bold w-24 text-center">{t('table.delay')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {works.map((w: any) => {
                      const st = (w.status || '').toLowerCase()
                      const isCompleted = st.includes('completed')
                      const isRecommended = st.includes('recommended')
                      const prog = w.progressPct ?? w.progress_pct ?? (isCompleted ? 100 : isRecommended ? 25 : 55)
                      const del = w.delayDays ?? w.delay_days ?? (isCompleted ? 0 : 45)

                      return (
                        <tr key={w.work_id} className="hover:bg-[var(--surface-alt)]/50 transition-colors duration-100">
                          <td className="p-3 font-mono font-bold text-[var(--text-primary)]">
                            #{formatNum(w.work_id)}
                          </td>
                          <td className="p-3">
                            <div className="line-clamp-2 break-words text-xs font-medium text-[var(--text-primary)] leading-relaxed" title={w.work_description}>
                              {w.work_description}
                            </div>
                          </td>
                          <td className="p-3 text-[var(--text-secondary)] font-semibold break-words leading-snug" title={translateMP(w.mp_name, lang)}>
                            {translateMP(w.mp_name, lang)}
                          </td>
                          <td className="p-3 text-[var(--text-tertiary)] uppercase font-semibold text-[11px] break-words" title={translateDistrict(w.district, lang)}>
                            {translateDistrict(w.district, lang)}
                          </td>
                          <td className="p-3">
                            <span className="px-2.5 py-1 rounded-md bg-[var(--surface-alt)] text-[11px] font-semibold text-[var(--text-secondary)] border border-[var(--border-primary)] inline-block break-words leading-snug">
                              {w.category}
                            </span>
                          </td>
                          <td className="p-3">
                            <AgencyBadge agency={w.implementingAgency || w.implementing_agency || 'District Authority'} size="sm" />
                          </td>
                          <td className="p-3 font-extrabold tabular-nums text-right text-[var(--text-primary)]">
                            {w.cost >= 10000000
                              ? `₹${formatNum((w.cost / 10000000).toFixed(2))} ${t('unit.cr')}`
                              : `₹${formatNum((w.cost / 100000).toFixed(2))} ${t('unit.lakh')}`}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border inline-block ${
                                isCompleted
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : isRecommended
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {isCompleted ? t('status.completed') : isRecommended ? t('status.recommended') : t('status.in_progress')}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-10 h-1.5 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                                <div
                                  className={`h-full ${isCompleted ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                  style={{ width: `${Math.min(100, prog)}%` }}
                                />
                              </div>
                              <span className="font-extrabold tabular-nums text-[11px] text-[var(--text-primary)]">
                                {formatNum(prog)}%
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {isCompleted ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center justify-center gap-1 text-[11px]">
                                <CheckCircle2 size={12} />
                                <span>{t('status.on_schedule')}</span>
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-bold inline-flex items-center justify-center gap-1 text-[11px]">
                                <Clock size={12} />
                                <span>{formatNum(del)}d</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Works Pagination */}
              {totalWorksPages > 1 && (
                <div className="p-3 border-t border-[var(--border-primary)] flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">
                    {t('common.showing_works', { count: `${formatNum((worksPage - 1) * 30 + 1)} - ${formatNum(Math.min(worksTotal, worksPage * 30))}`, total: formatNum(worksTotal.toLocaleString()) })}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={worksPage === 1}
                      onClick={() => setWorksPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
                    >
                      {t('common.previous')}
                    </button>
                    <span className="text-xs font-semibold text-[var(--text-secondary)] px-2">
                      {t('common.page')} {formatNum(worksPage)} {t('common.of')} {formatNum(totalWorksPages)}
                    </span>
                    <button
                      disabled={worksPage === totalWorksPages}
                      onClick={() => setWorksPage((p) => Math.min(totalWorksPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
                    >
                      {t('common.next')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FLAGS */}
      {effectiveTab === 'flags' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-secondary)]">{t('filter.priority')}</span>
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'all', label: t('filter.all_anomalies') },
                  { id: 'red', label: t('filter.priority_audit') },
                  { id: 'orange', label: t('filter.elevated_review') }
                ].map((tierItem) => (
                  <button
                    key={tierItem.id}
                    onClick={() => setFlagTierFilter(tierItem.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      flagTierFilter === tierItem.id
                        ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                        : 'bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{tierItem.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)]">
                {t('common.showing_simple', { count: formatNum(filteredFlags.length), total: formatNum(flagsTotal) })}
              </span>
            </div>
          </div>

          {flagsLoading ? (
            <LoadingSkeleton rows={5} height="h-12" />
          ) : filteredFlags.length === 0 ? (
            <EmptyState
              title="No flags detected"
              description="No anomaly flags match the selected tier filter for this state."
            />
          ) : (
            <div className="lux-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      <th className="p-3 font-bold w-20 shrink-0">{t('table.work_id')}</th>
                      <th className="p-3 font-bold min-w-[180px]">{t('table.description')}</th>
                      <th className="p-3 font-bold min-w-[140px] w-40">{t('table.district')}</th>
                      <th className="p-3 font-bold min-w-[220px] w-64">{t('table.agency')}</th>
                      <th className="p-3 font-bold w-28 text-right shrink-0 whitespace-nowrap">{t('table.sanctioned_amount')}</th>
                      <th className="p-3 font-bold w-24 text-center shrink-0">{t('table.severity')}</th>
                      <th className="p-3 font-bold w-32 sm:w-36 text-right shrink-0">{canTakeStateAction ? t('table.action') : 'Public Dossier'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {filteredFlags.map((flag: any) => (
                      <tr
                        key={flag.workId || flag.work_id}
                        className="hover:bg-[var(--surface-alt)]/50 transition-colors duration-100 cursor-pointer"
                        onClick={() => setSelectedFlag(flag)}
                      >
                        <td className="p-3 font-mono font-bold text-[var(--text-primary)]">
                          #{formatNum(flag.work_id || flag.workId)}
                        </td>
                        <td className="p-3 text-[var(--text-secondary)] leading-relaxed" title={flag.work_description || flag.workDescription || flag.description}>
                          <div className="font-medium text-[var(--text-primary)] line-clamp-2">
                            {flag.work_description || flag.workDescription || flag.description || 'Civil Works Project'}
                          </div>
                        </td>
                        <td className="p-3 font-medium text-[var(--text-primary)]">
                          <div className="break-words leading-snug" title={flag.district || 'Statewide'}>
                            {flag.district || 'Statewide'}
                          </div>
                        </td>
                        <td className="p-3">
                          <AgencyBadge agency={flag.implementingAgency || flag.implementing_agency || 'District Authority'} size="sm" className="max-w-full" />
                        </td>
                        <td className="p-3 font-extrabold tabular-nums text-[var(--text-primary)] text-right">
                          ₹{formatNum(((flag.cost || flag.sanctionedCost || 0) / 100000).toFixed(2))} {t('unit.lakh')}
                        </td>
                        <td className="p-3 text-center">
                          <TierBadge
                            tier={flag.tier || (flag.severity >= 0.7 ? 'critical' : 'high')}
                            count={Number(flag.severity?.toFixed(2) || 0)}
                            showLabel={false}
                            size="sm"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedFlag(flag)
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-bold hover:bg-[var(--brand-primary)] hover:text-white transition whitespace-nowrap text-xs cursor-pointer"
                          >
                            {canTakeStateAction ? t('table.report') : 'View Findings'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Flag Diagnostic Report Modal */}
      {selectedFlag && (
        <FlagDossierModal
          flag={selectedFlag}
          onClose={() => setSelectedFlag(null)}
        />
      )}
    </div>
  )
}
