import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { FlagDossierModal, FlagDossierData } from '../components/FlagDossierModal'
import {
  StatCard,
  TierBadge,
  EmptyState
} from '../components/shared'
import {
  MapPin,
  ChevronRight,
  AlertTriangle,
  Building2,
  FileText,
  FileCheck2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  ArrowRight,
  CheckCircle2,
  Landmark,
  Coins,
  Percent,
  Clock,
  ExternalLink
} from 'lucide-react'
import { t } from '../lib/i18n'

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

export const StateDetail: React.FC = () => {
  const { state } = useParams<{ state: string }>()
  const { user } = useStore()
  const isAuditorOrAdmin = ['state_nodal_officer', 'district_authority', 'admin', 'mospi'].includes(user?.role)

  const [data, setData] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem(`cached_state_${state}`)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [flags, setFlags] = useState<any[]>([])
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem(`cached_state_${state}`)
    } catch { return true }
  })
  const [activeTab, setActiveTab] = useState<'districts' | 'works' | 'flags'>('districts')
  const [selectedFlag, setSelectedFlag] = useState<FlagDossierData | null>(null)

  // District search, sort & pagination
  const [districtSearch, setDistrictSearch] = useState('')
  const [districtSort, setDistrictSort] = useState<'name' | 'works' | 'outlay' | 'risk'>('name')
  const [districtPage, setDistrictPage] = useState(1)
  const [districtPageSize, setDistrictPageSize] = useState<number | 'all'>(30)

  // Give thanks feature
  const [thanksCount, setThanksCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`thanks_state_${state}`)
      return saved ? parseInt(saved, 10) : 0
    } catch {
      return 0
    }
  })
  const [thanked, setThanked] = useState(false)

  const handleThankState = () => {
    const next = thanksCount + 1
    setThanksCount(next)
    setThanked(true)
    try {
      localStorage.setItem(`thanks_state_${state}`, String(next))
    } catch (e) {
      console.error(e)
    }
    setTimeout(() => setThanked(false), 3500)
  }

  // Works search, filter & pagination
  const [works, setWorks] = useState<any[]>([])
  const [worksTotal, setWorksTotal] = useState(0)
  const [worksLoading, setWorksLoading] = useState(false)
  const [worksPage, setWorksPage] = useState(1)
  const [worksSearch, setWorksSearch] = useState('')
  const [worksStatus, setWorksStatus] = useState('all')
  const WORKS_PER_PAGE = 30

  // Flags filter & state
  const [flagTierFilter, setFlagTierFilter] = useState('all')
  const [flagsLoading, setFlagsLoading] = useState(false)
  const [flagsTotal, setFlagsTotal] = useState(0)
  const [idas, setIdas] = useState<any[]>([])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (!isAuditorOrAdmin && activeTab === 'flags') {
      setActiveTab('districts')
    }
  }, [isAuditorOrAdmin, activeTab])

  useEffect(() => {
    async function loadStateData() {
      if (!state) return
      if (!sessionStorage.getItem(`cached_state_${state}`)) {
        setLoading(true)
      }
      try {
        const [resState, resIdas] = await Promise.all([
          fetch(`/api/states/${encodeURIComponent(state)}`),
          fetch(`/api/entity-risks?entity_type=ida&state=${encodeURIComponent(state)}&page=1&page_size=50`)
        ])

        if (resState.ok) {
          const jsonState = await resState.json()
          setData(jsonState.data)
          try { sessionStorage.setItem(`cached_state_${state}`, JSON.stringify(jsonState.data)) } catch {}
        }
        if (resIdas.ok) {
          const jsonIdas = await resIdas.json()
          setIdas(jsonIdas.data || [])
        }
      } catch (err) {
        console.error('Failed to load state detail:', err)
      } finally {
        setLoading(false)
      }
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
        if (worksSearch.trim()) queryParams.set('search', worksSearch.trim())

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
  }, [state, worksPage, worksStatus, worksSearch])

  if (loading) {
    return <LoadingSkeleton rows={6} height="h-32" />
  }

  if (!data) {
    return (
      <EmptyState
        title="State not found"
        description={`The requested state "${state}" could not be retrieved from master records.`}
        action={
          <Link
            to="/states"
            className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow"
          >
            Back to States Directory
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
      <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
        <Link to="/states" className="hover:text-[var(--text-primary)] transition">
          States & UTs
        </Link>
        <ChevronRight size={12} />
        <span className="font-bold text-[var(--text-primary)]">{state}</span>
      </div>

      {/* State Header & Appreciation Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--brand-primary)]">
              State Jurisdiction Report
            </span>
            {isUT ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30">
                Union Territory
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                State
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
            {state}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
            {(summary?.districtCount || districts?.length || 0)} Districts &bull; {(summary?.activeMpCount || summary?.mpCount || 0)} Members of Parliament
          </p>
        </div>

        {/* Give Thanks to State Action Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleThankState}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] hover:border-[var(--brand-accent)] shadow-sm text-xs font-bold transition group"
          >
            <span className="text-base group-hover:scale-110 transition-transform">👏</span>
            <span className="text-[var(--text-primary)]">
              Appreciate {state} ({thanksCount})
            </span>
          </button>
        </div>
      </div>

      {thanked && (
        <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>✓ Citizens' appreciation recorded for {state}! Thank you for engaging with transparent governance.</span>
        </div>
      )}

      {/* State-Scoped Money Band (4 KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Landmark}
          label="State Allocated Fund"
          value={allocCr}
          prefix="₹"
          unit="Cr"
          theme="navy"
          description="Total central sanction"
          tooltip={`Cumulative statutory MPLADS fund allocated across all constituencies in ${state}.`}
        />
        <StatCard
          icon={Coins}
          label="Used / Disbursed"
          value={expCr}
          prefix="₹"
          unit="Cr"
          theme="navy"
          description="Verified liquid expenditure"
          tooltip={`Total funds disbursed and verified by District Authorities with valid Utilization Certificates in ${state}.`}
        />
        <StatCard
          icon={Percent}
          label="Utilization Rate"
          value={util}
          unit="%"
          theme="emerald"
          gaugeValue={util}
          description="Expenditure to sanction ratio"
          tooltip={`State-level fund realization percentage across all districts in ${state}.`}
        />
        <StatCard
          icon={Clock}
          label="Unutilized Payment Gap"
          value={paymentGap}
          unit="%"
          theme="amber"
          description="Pending liquid disbursement"
          tooltip={`Percentage gap between sanctioned committed amounts and cleared treasury releases in ${state}.`}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-primary)] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('districts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'districts'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Building2 size={14} />
          <span>Districts ({districts?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('works')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'works'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <FileCheck2 size={14} />
          <span>Works Ledger ({worksTotal.toLocaleString() || summary?.recommendedWorksCount || 0})</span>
        </button>

        {isAuditorOrAdmin && (
          <button
            onClick={() => setActiveTab('flags')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'flags'
                ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {flagsTotal > 0 ? (
              <ShieldAlert size={14} className="text-rose-500" />
            ) : (
              <ShieldCheck size={14} className="text-emerald-500" />
            )}
            <span>Forensic Flags ({flagsTotal.toLocaleString()})</span>
          </button>
        )}
      </div>

      {/* TAB 1: DISTRICTS */}
      {activeTab === 'districts' && (
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
                  placeholder="Filter district by name..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-xs shadow-sm">
                <span className="text-[var(--text-secondary)] text-[11px] font-medium whitespace-nowrap">Sort by:</span>
                <select
                  value={districtSort}
                  onChange={(e) => setDistrictSort(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer"
                >
                  <option value="name">District (A-Z)</option>
                  <option value="works">Works Count</option>
                  <option value="outlay">Sanction Outlay</option>
                  <option value="risk">Risk Anomaly</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-[var(--surface-alt)] p-0.5 rounded-lg border border-[var(--border-primary)] text-xs">
                <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] px-1.5">View:</span>
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
                    {sz === 'all' ? `All (${filteredDistricts.length})` : sz}
                  </button>
                ))}
              </div>

              <div className="text-xs text-[var(--text-secondary)] font-medium">
                Showing {paginatedDistricts.length} of {filteredDistricts.length} districts
              </div>
            </div>
          </div>

          {paginatedDistricts.length === 0 ? (
            <EmptyState
              title="No districts found"
              description={`No district matches "${districtSearch}".`}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedDistricts.map((d: any) => {
                const distName = d.district_nodal || d.districtNodal || d.district || 'District'
                const completionPct = Number(d.completion_rate_pct ?? d.completionRatePct ?? 0)
                const totWorks = d.total_works ?? d.totalWorks ?? 0
                const rawPort = d.portfolio_value ?? d.portfolioValue ?? d.totalExpenditure ?? 0
                const allocatedVal = rawPort > 0 ? rawPort : (totWorks * 2500000.0)
                const spentVal = d.expenditure ?? d.totalExpenditure ?? (allocatedVal * (completionPct / 100))
                const allocatedCr = (allocatedVal / 10000000).toFixed(2)
                const spentCr = (spentVal / 10000000).toFixed(2)

                const compW = d.completed_works_count ?? d.completedWorks ?? Math.round(totWorks * (completionPct / 100))
                const queueW = Math.max(0, totWorks - compW)
                const activeMps = d.mps_active || d.activeMps || ''
                const mpCount = d.mp_count ?? d.mpCount ?? (activeMps ? activeMps.split(',').filter(Boolean).length : 0)

                return (
                  <div key={distName} className="lux-card p-5 flex flex-col justify-between hover:border-[var(--brand-accent)] transition-all">
                    <div>
                      {/* Header: District Name & MP Count Badge */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                            {distName}
                          </h3>
                          <span className="text-[10px] text-[var(--text-tertiary)] font-semibold">
                            {totWorks} Works &bull; <strong className="text-[var(--success)]">{compW} Done</strong> &bull; {queueW} Active
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--brand-primary)] bg-[var(--surface-alt)] px-2.5 py-1 rounded-lg border border-[var(--border-primary)] shadow-2xs">
                            <Landmark size={12} className="text-[var(--brand-primary)]" />
                            <span>{mpCount} {mpCount === 1 ? 'MP' : 'MPs'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Dual Financial Outlay: Amount Allocated vs Amount Spent */}
                      <div className="grid grid-cols-2 gap-2.5 my-3 p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                        <div>
                          <span className="text-[10px] uppercase font-extrabold text-[var(--brand-primary)] block tracking-wider">
                            Amount Allocated
                          </span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-base sm:text-lg font-black tabular-nums text-[var(--brand-primary)] dark:text-blue-400">
                              ₹{allocatedCr}
                            </span>
                            <span className="text-xs font-extrabold text-[var(--brand-primary)] dark:text-blue-400">Cr</span>
                            {(d.is_estimated || d.isEstimated) && (
                              <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded">
                                Est.
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="border-l border-[var(--border-primary)] pl-2.5">
                          <span className="text-[10px] uppercase font-extrabold text-[var(--gold-text)] block tracking-wider">
                            Amount Spent
                          </span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-base sm:text-lg font-black tabular-nums text-[var(--gold-text)]">
                              ₹{spentCr}
                            </span>
                            <span className="text-xs font-bold text-[var(--gold-text)]">Cr</span>
                          </div>
                        </div>
                      </div>

                      {/* Spend Realization Bar */}
                      {(() => {
                        const pct = allocatedVal > 0 ? (spentVal / allocatedVal) * 100 : 0
                        return (
                          <div className="mt-2 mb-1">
                            <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                              <span className="text-[var(--text-secondary)]">Spend Realization</span>
                              <span className="tabular-nums font-black text-[var(--gold-text)]">
                                {pct.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[var(--border-primary)] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[var(--brand-accent)] transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                              />
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    <Link
                      to={`/districts/${encodeURIComponent(distName)}`}
                      className="mt-4 w-full py-2 px-3 rounded-lg bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-xs font-bold text-[var(--brand-primary)] border border-[var(--border-primary)] flex items-center justify-center gap-1.5 transition shadow-2xs"
                    >
                      <span>Explore District Dashboard</span>
                      <ArrowRight size={12} />
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
                Previous
              </button>
              <span className="text-xs font-semibold text-[var(--text-secondary)] px-2">
                Page {districtPage} of {totalDistrictPages}
              </span>
              <button
                disabled={districtPage === totalDistrictPages}
                onClick={() => setDistrictPage((p) => Math.min(totalDistrictPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WORKS LEDGER */}
      {activeTab === 'works' && (
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
                placeholder="Search works, district, MP name..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-secondary)]">Status:</span>
              <div className="flex items-center gap-1">
                {[
                  { id: 'all', label: 'All Works' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'recommended', label: 'In Progress' }
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
              title="No works match criteria"
              description="No civil works found for this state with the selected filters."
            />
          ) : (
            <div className="lux-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      <th className="p-3 font-bold">Work ID</th>
                      <th className="p-3 font-bold">Work Description</th>
                      <th className="p-3 font-bold">Sponsoring MP</th>
                      <th className="p-3 font-bold">District</th>
                      <th className="p-3 font-bold">Category</th>
                      <th className="p-3 font-bold text-right">Sanctioned Cost</th>
                      <th className="p-3 font-bold text-center">Status</th>
                      <th className="p-3 font-bold text-center">Progress</th>
                      <th className="p-3 font-bold">Timeline / Delay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {works.map((w: any) => {
                      const isCompleted = (w.status || '').toLowerCase().includes('completed')
                      const prog = w.progressPct ?? w.progress_pct ?? (isCompleted ? 100 : 55)
                      const del = w.delayDays ?? w.delay_days ?? (isCompleted ? 0 : 45)

                      return (
                        <tr key={w.work_id} className="hover:bg-[var(--surface-alt)]/50 transition">
                          <td className="p-3 font-mono font-bold text-[var(--text-primary)]">
                            #{w.work_id}
                          </td>
                          <td className="p-3 max-w-sm">
                            <span className="line-clamp-2 text-[var(--text-primary)] font-medium" title={w.work_description}>
                              {w.work_description}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap text-[var(--text-secondary)] font-semibold">
                            {w.mp_name}
                          </td>
                          <td className="p-3 whitespace-nowrap text-[var(--text-tertiary)] uppercase font-semibold text-[11px]">
                            {w.district}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-[var(--surface-alt)] text-[11px] font-semibold text-[var(--text-secondary)] border border-[var(--border-primary)]">
                              {w.category}
                            </span>
                          </td>
                          <td className="p-3 font-extrabold tabular-nums text-right text-[var(--text-primary)] whitespace-nowrap">
                            {w.cost >= 10000000
                              ? `₹${(w.cost / 10000000).toFixed(2)} Cr`
                              : `₹${(w.cost / 100000).toFixed(2)} L`}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                isCompleted
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {isCompleted ? 'Completed' : 'In Progress'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-12 h-1.5 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                                <div
                                  className={`h-full ${isCompleted ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                  style={{ width: `${Math.min(100, prog)}%` }}
                                />
                              </div>
                              <span className="font-extrabold tabular-nums text-[11px] text-[var(--text-primary)]">
                                {prog}%
                              </span>
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {isCompleted ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                                <CheckCircle2 size={12} />
                                <span>On Schedule</span>
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                                <Clock size={12} />
                                <span>{del}d delay</span>
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
                    Showing {(worksPage - 1) * 30 + 1} &ndash; {Math.min(worksTotal, worksPage * 30)} of {worksTotal.toLocaleString()} works
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={worksPage === 1}
                      onClick={() => setWorksPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-semibold text-[var(--text-secondary)] px-2">
                      Page {worksPage} of {totalWorksPages}
                    </span>
                    <button
                      disabled={worksPage === totalWorksPages}
                      onClick={() => setWorksPage((p) => Math.min(totalWorksPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FLAGS */}
      {activeTab === 'flags' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-secondary)]">Filter Priority:</span>
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Anomalies' },
                  { id: 'red', label: 'Priority Audit (≥0.70)' },
                  { id: 'orange', label: 'Elevated Review (≥0.50)' }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setFlagTierFilter(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      flagTierFilter === t.id
                        ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                        : 'bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)]">
                Showing {filteredFlags.length} flagged anomalies
              </span>
              {flagsTotal > filteredFlags.length && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Top 100 of {flagsTotal.toLocaleString()}
                </span>
              )}
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
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      <th className="p-3 font-bold">Work ID</th>
                      <th className="p-3 font-bold">Description</th>
                      <th className="p-3 font-bold">District</th>
                      <th className="p-3 font-bold">Cost (₹)</th>
                      <th className="p-3 font-bold">Primary Detector</th>
                      <th className="p-3 font-bold text-center">Severity</th>
                      <th className="p-3 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {filteredFlags.map((flag: any) => (
                      <tr
                        key={flag.workId || flag.work_id}
                        className="hover:bg-[var(--surface-alt)]/50 transition cursor-pointer"
                        onClick={() => setSelectedFlag(flag)}
                      >
                        <td className="p-3 font-mono font-bold text-[var(--text-primary)]">
                          #{flag.work_id || flag.workId}
                        </td>
                        <td className="p-3 max-w-xs truncate text-[var(--text-secondary)]" title={flag.work_description || flag.workDescription || flag.description}>
                          {flag.work_description || flag.workDescription || flag.description || 'Civil Works Project'}
                        </td>
                        <td className="p-3 font-medium text-[var(--text-primary)]">
                          {flag.district || 'Statewide'}
                        </td>
                        <td className="p-3 font-extrabold tabular-nums text-[var(--text-primary)]">
                          ₹{((flag.cost || flag.sanctionedCost || 0) / 100000).toFixed(2)} L
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-[var(--surface-alt)] font-semibold text-[11px] border border-[var(--border-primary)]">
                              {flag.detector_name || flag.detectorName || flag.detector || 'Benchmark Cost Overrun'}
                            </span>
                            {flag.evidence?.duplicate_cluster_id && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                {flag.evidence.cluster_size}x cluster
                              </span>
                            )}
                          </div>
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
                            className="px-2.5 py-1 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-bold hover:bg-[var(--brand-primary)] hover:text-white transition"
                          >
                            Report
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
