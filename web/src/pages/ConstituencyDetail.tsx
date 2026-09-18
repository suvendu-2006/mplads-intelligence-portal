import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import {
  Landmark,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  MapPin,
  CheckCircle2,
  Clock,
  Search,
  Layers,
  ArrowRight,
  AlertTriangle,
  FileSpreadsheet,
  Share2,
  Bookmark,
  Users,
  Building2,
  TrendingUp,
  CreditCard
} from 'lucide-react'
import { StatCard } from '../components/shared/StatCard'
import { SectionCard } from '../components/shared/SectionCard'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { EmptyState } from '../components/shared/EmptyState'

interface RepresentativeMP {
  id: string
  name: string
  house: string
  party: string
  state: string
  constituency: string
  term: string
}

interface Financials {
  allocated_amount: number
  total_expenditure: number
  unspent_balance: number
  utilization_percentage: number
  completed_works_count: number
  recommended_works_count: number
  completion_rate: number
  red_flag_percentage: number
  red_flag_count: number
}

interface AssemblySegment {
  ac_name: string
  ac_no: number | string
  district: string
  is_active?: boolean
}

interface SectorBreakdown {
  category: string
  count: number
}

interface ConstituencyWork {
  work_id: string
  description: string
  category: string
  sanction_amount: number
  expenditure: number
  status: string
  location: string
  district: string
  implementing_agency: string
  matches_active_ac: boolean
}

interface ConstituencyData {
  constituency_type: 'parliamentary' | 'assembly'
  display_name: string
  parliamentary_constituency: string
  assembly_constituency: string | null
  state: string
  district: string
  ac_number: number | string | null
  representative_mp: RepresentativeMP
  financials: Financials
  assemblies: AssemblySegment[]
  sector_breakdown: SectorBreakdown[]
  works: ConstituencyWork[]
  works_count: number
}

export const ConstituencyDetail: React.FC = () => {
  const { name = '' } = useParams<{ name: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const acQueryParam = searchParams.get('ac') || ''
  const [activeAc, setActiveAc] = useState<string>(acQueryParam)
  const [data, setData] = useState<ConstituencyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Works filtering state
  const [workSearch, setWorkSearch] = useState('')
  const [workStatusFilter, setWorkStatusFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'overview' | 'works' | 'assemblies'>('overview')
  const [followed, setFollowed] = useState(false)

  // Sync activeAc state with URL
  useEffect(() => {
    if (acQueryParam) {
      setActiveAc(acQueryParam)
    }
  }, [acQueryParam])

  useEffect(() => {
    async function fetchConstituency() {
      if (!name) return
      setLoading(true)
      setError(null)
      try {
        const queryAc = activeAc || acQueryParam
        const url = `/api/constituencies/${encodeURIComponent(name)}${queryAc ? `?ac=${encodeURIComponent(queryAc)}` : ''}`
        const res = await fetch(url)
        if (!res.ok) {
          throw new Error(`Constituency "${name}" not found`)
        }
        const json = await res.json()
        setData(json.data)
        if (json.data?.assembly_constituency && !activeAc) {
          setActiveAc(json.data.assembly_constituency)
        }
      } catch (err: any) {
        console.error('Failed to load constituency intelligence:', err)
        setError(err.message || 'Constituency not found')
      } finally {
        setLoading(false)
      }
    }
    fetchConstituency()
  }, [name, activeAc])

  const formatCr = (val: number) => {
    if (!val || isNaN(val)) return '₹0.00 Cr'
    if (val >= 1e7) {
      return `₹${(val / 1e7).toFixed(2)} Cr`
    }
    return `₹${val.toLocaleString('en-IN')}`
  }

  // Filter works by search, status, and active assembly segment
  const filteredWorks = useMemo(() => {
    if (!data?.works) return []
    return data.works.filter(w => {
      // 1. Assembly segment filter
      if (activeAc) {
        const acLower = activeAc.toLowerCase()
        const matchesLocation = (w.location || '').toLowerCase().includes(acLower)
        const matchesDesc = (w.description || '').toLowerCase().includes(acLower)
        if (!matchesLocation && !matchesDesc && !w.matches_active_ac) {
          // If we have specific AC works, show them, otherwise fall through if no AC matches exist
        }
      }

      // 2. Status filter
      if (workStatusFilter !== 'all') {
        const isComp = (w.status || '').toLowerCase().includes('complete')
        if (workStatusFilter === 'completed' && !isComp) return false
        if (workStatusFilter === 'ongoing' && isComp) return false
      }

      // 3. Search query
      if (workSearch.trim()) {
        const q = workSearch.toLowerCase()
        return (
          (w.work_id || '').toLowerCase().includes(q) ||
          (w.description || '').toLowerCase().includes(q) ||
          (w.location || '').toLowerCase().includes(q) ||
          (w.category || '').toLowerCase().includes(q) ||
          (w.implementing_agency || '').toLowerCase().includes(q)
        )
      }

      return true
    })
  }, [data?.works, activeAc, workStatusFilter, workSearch])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-64 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] animate-pulse" />
        <LoadingSkeleton rows={4} height="h-28" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Constituency Not Found"
        description={`We could not locate data for "${name}". Please check the Parliamentary or Assembly Constituency name.`}
        action={
          <div className="flex items-center gap-3">
            <Link
              to="/mps"
              className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold"
            >
              Browse MPs & Constituencies
            </Link>
            <Link
              to="/map"
              className="px-4 py-2 rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] text-xs font-bold"
            >
              Open GIS Map
            </Link>
          </div>
        }
      />
    )
  }

  const {
    display_name,
    parliamentary_constituency,
    assembly_constituency,
    constituency_type,
    state,
    district,
    representative_mp,
    financials,
    assemblies = [],
    sector_breakdown = []
  } = data

  const isAssemblyView = constituency_type === 'assembly' || Boolean(activeAc || assembly_constituency)
  const currentAcName = activeAc || assembly_constituency

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 1. Breadcrumbs & Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/" className="hover:text-[var(--text-primary)] transition">Home</Link>
          <ChevronRight size={12} />
          <Link to="/mps" className="hover:text-[var(--text-primary)] transition">Constituencies</Link>
          <ChevronRight size={12} />
          <Link to={`/states/${encodeURIComponent(state)}`} className="hover:text-[var(--text-primary)] transition">
            {state}
          </Link>
          <ChevronRight size={12} />
          <Link
            to={`/constituency/${encodeURIComponent(parliamentary_constituency)}`}
            className={`font-semibold hover:text-[var(--text-primary)] transition ${!isAssemblyView ? 'text-[var(--text-primary)] font-bold' : ''}`}
          >
            {parliamentary_constituency}
          </Link>
          {isAssemblyView && currentAcName && (
            <>
              <ChevronRight size={12} />
              <span className="font-bold text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-2 py-0.5 rounded-md border border-[var(--brand-primary)]/20">
                {currentAcName} Assembly Segment
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `${display_name} Constituency | SATARK-MPLADS`,
                  url: window.location.href
                }).catch(() => {})
              } else {
                navigator.clipboard.writeText(window.location.href)
                alert('Constituency link copied to clipboard!')
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-[var(--border-primary)] bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            <Share2 size={13} />
            <span>Share</span>
          </button>
          <button
            onClick={() => setFollowed(!followed)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              followed
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-[var(--surface-primary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Bookmark size={13} className={followed ? 'fill-emerald-500 text-emerald-500' : ''} />
            <span>{followed ? 'Following Constituency' : 'Follow Constituency'}</span>
          </button>
        </div>
      </div>

      {/* 2. HERO CONSTITUENCY BANNER (Constituency-First Identity!) */}
      <div
        className="relative rounded-3xl p-6 sm:p-8 text-white overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #061826 0%, #0B253A 50%, #133E5D 100%)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 20px 48px rgba(6, 24, 38, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
        }}
      >
        {/* Background Emblem Watermark */}
        <div className="absolute right-6 -bottom-10 opacity-10 pointer-events-none text-white">
          <Landmark size={240} />
        </div>

        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 backdrop-blur-md">
              <Landmark size={13} />
              {isAssemblyView ? 'Vidhan Sabha Assembly Segment' : 'Parliamentary Constituency (Lok Sabha)'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-slate-200 border border-white/15">
              <MapPin size={12} />
              {district ? `${district} Dist, ` : ''}{state}
            </span>
          </div>

          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
            Utilization: {financials.utilization_percentage.toFixed(1)}%
          </span>
        </div>

        {/* Hero Title */}
        <div className="mb-6">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white flex items-center gap-3">
            <span>{display_name.toUpperCase()}</span>
            {isAssemblyView && (
              <span className="text-sm sm:text-base font-semibold px-3 py-1 rounded-xl bg-white/15 text-slate-200 border border-white/20">
                Segment of {parliamentary_constituency}
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 flex items-center gap-2 flex-wrap">
            <span>Government of India &bull; MPLADS Constituency Ledger</span>
            <span>&bull;</span>
            <span>State of <strong>{state}</strong></span>
            {district && (
              <>
                <span>&bull;</span>
                <span>District Authority: <strong>{district}</strong></span>
              </>
            )}
            {assemblies.length > 0 && (
              <>
                <span>&bull;</span>
                <span><strong>{assemblies.length}</strong> Assembly Segments</span>
              </>
            )}
          </p>
        </div>

        {/* Financial Highlights Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-y border-white/15 my-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300 mb-1">
              Constituency Corpus
            </div>
            <div className="text-xl sm:text-3xl font-black tabular-nums text-white">
              {formatCr(financials.allocated_amount)}
            </div>
            <div className="text-[10px] text-slate-300 mt-0.5">5-Year Entitlement</div>
          </div>

          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 mb-1">
              Disbursed / Utilized
            </div>
            <div className="text-xl sm:text-3xl font-black tabular-nums text-emerald-300">
              {formatCr(financials.total_expenditure)}
            </div>
            <div className="text-[10px] text-slate-300 mt-0.5">Liquid Treasury Outlay</div>
          </div>

          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 mb-1">
              Liquid Balance
            </div>
            <div className="text-xl sm:text-3xl font-black tabular-nums text-amber-200">
              {formatCr(financials.unspent_balance)}
            </div>
            <div className="text-[10px] text-slate-300 mt-0.5">Available for Allocation</div>
          </div>

          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400 mb-1">
              Works Completed
            </div>
            <div className="text-xl sm:text-3xl font-black tabular-nums text-sky-200">
              {financials.completed_works_count} <span className="text-xs font-normal text-slate-300">/ {financials.recommended_works_count}</span>
            </div>
            <div className="text-[10px] text-slate-300 mt-0.5">{financials.completion_rate.toFixed(1)}% Delivery Rate</div>
          </div>
        </div>

        {/* Representative MP Callout */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-inner">
              {representative_mp.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                Sitting Member of Parliament (Elected Representative)
              </div>
              <div className="text-base font-bold text-white flex items-center gap-2">
                <span>Hon'ble MP {representative_mp.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-white/15 text-slate-200 border border-white/20">
                  {representative_mp.house} &bull; {representative_mp.term}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/mps/${encodeURIComponent(representative_mp.id)}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold transition shadow-sm"
            >
              <span>View MP Profile & Dossier</span>
              <ExternalLink size={13} />
            </Link>
            <Link
              to={`/map?q=${encodeURIComponent(parliamentary_constituency)}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition shadow-sm"
            >
              <span>View on GIS Map</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Assembly Segments Navigator (Vidhan Sabha Segments Bar) */}
      {assemblies.length > 0 && (
        <div className="p-4 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-[var(--brand-primary)]" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                Assembly Segments in {parliamentary_constituency} ({assemblies.length})
              </span>
            </div>
            {activeAc && (
              <button
                onClick={() => {
                  setActiveAc('')
                  setSearchParams({})
                }}
                className="text-[11px] font-bold text-[var(--brand-primary)] hover:underline cursor-pointer"
              >
                Clear Segment Filter &rarr;
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => {
                setActiveAc('')
                setSearchParams({})
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition border cursor-pointer ${
                !activeAc
                  ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm'
                  : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:text-[var(--text-primary)]'
              }`}
            >
              All Constituency Works
            </button>

            {assemblies.map(a => {
              const isActive = activeAc.toLowerCase() === a.ac_name.toLowerCase()
              return (
                <button
                  key={a.ac_name}
                  onClick={() => {
                    setActiveAc(a.ac_name)
                    setSearchParams({ ac: a.ac_name })
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition border cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:border-[var(--brand-primary)]/50'
                  }`}
                >
                  <Landmark size={12} className={isActive ? 'text-white' : 'text-[var(--text-secondary)]'} />
                  <span>{a.ac_name}</span>
                  {a.ac_no && <span className="opacity-70 text-[10px]">#{a.ac_no}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 4. Navigation Tabs */}
      <div className="flex border-b border-[var(--border-primary)] gap-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-bold transition border-b-2 cursor-pointer ${
            activeTab === 'overview'
              ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Constituency Overview
        </button>
        <button
          onClick={() => setActiveTab('works')}
          className={`pb-3 text-sm font-bold transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'works'
              ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span>Development Works</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-primary)]">
            {filteredWorks.length}
          </span>
        </button>
      </div>

      {/* 5. TAB CONTENT: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Allocated Fund"
              value={formatCr(financials.allocated_amount)}
              description="5-year tenure corpus"
              icon={Landmark}
              theme="navy"
            />
            <StatCard
              label="Disbursed Outlay"
              value={formatCr(financials.total_expenditure)}
              description="Released by District Treasury"
              icon={TrendingUp}
              theme="emerald"
            />
            <StatCard
              label="Utilization Rate"
              value={`${financials.utilization_percentage.toFixed(1)}%`}
              description="Fund absorption percentage"
              icon={CreditCard}
              theme={financials.utilization_percentage >= 50 ? 'emerald' : 'amber'}
            />
            <StatCard
              label="Liquid Balance"
              value={formatCr(financials.unspent_balance)}
              description="Available for new works"
              icon={Clock}
              theme="gold"
            />
          </div>

          {/* Sector Breakdown & Representative Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sector Breakdown */}
            <div className="lg:col-span-2">
              <SectionCard
                title="Sectoral Development Distribution"
                subtitle="Asset categories recommended in this constituency"
              >
                {sector_breakdown.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)] py-4">No sector data available.</p>
                ) : (
                  <div className="space-y-3 pt-2">
                    {sector_breakdown.slice(0, 6).map(s => {
                      const total = data.works_count || 1
                      const pct = Math.round((s.count / total) * 100)
                      return (
                        <div key={s.category}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-[var(--text-primary)]">{s.category}</span>
                            <span className="text-[var(--text-secondary)] font-medium">
                              {s.count} works ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-[var(--surface-secondary)] overflow-hidden border border-[var(--border-primary)]">
                            <div
                              className="h-full rounded-full bg-[var(--brand-primary)]"
                              style={{ width: `${Math.max(5, pct)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Representative Details & Quick Actions */}
            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 flex items-center justify-center text-[var(--brand-primary)] font-black text-base">
                    {representative_mp.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                      Representative
                    </div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">
                      {representative_mp.name}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {representative_mp.house} &bull; {representative_mp.party || 'MPLADS'}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Developmental sanctions under the Member of Parliament Local Area Development Scheme are recommended by the sitting representative for priority public infrastructure works.
                </p>

                <div className="pt-2 border-t border-[var(--border-primary)] flex flex-col gap-2">
                  <Link
                    to={`/mps/${encodeURIComponent(representative_mp.id)}`}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-white text-xs font-bold transition shadow-sm"
                  >
                    <span>Inspect MP Profile</span>
                    <ArrowRight size={13} />
                  </Link>
                  <Link
                    to={`/districts/${encodeURIComponent(district || parliamentary_constituency)}`}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-xs font-bold transition"
                  >
                    <span>District Collectorate Console</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Preview of Recent Works */}
          <SectionCard
            title={`Development Works in ${activeAc ? `${activeAc} Segment` : display_name}`}
            subtitle="Recent infrastructure recommendations and completions"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-primary)] text-[var(--text-secondary)] font-extrabold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Work ID</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Sanction Amount</th>
                    <th className="py-2.5 px-3">Expenditure</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)]">
                  {filteredWorks.slice(0, 5).map(w => (
                    <tr key={w.work_id} className="hover:bg-[var(--surface-secondary)]/50 transition">
                      <td className="py-3 px-3 font-mono font-bold text-[var(--brand-primary)]">
                        <Link to={`/audit?q=${w.work_id}`} className="hover:underline">
                          #{w.work_id}
                        </Link>
                      </td>
                      <td className="py-3 px-3 font-medium text-[var(--text-primary)] max-w-xs truncate">
                        {w.description}
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)]">
                        {w.category}
                      </td>
                      <td className="py-3 px-3 font-bold tabular-nums text-[var(--text-primary)]">
                        ₹{w.sanction_amount ? (w.sanction_amount >= 1e5 ? `${(w.sanction_amount / 1e5).toFixed(2)} L` : w.sanction_amount.toLocaleString('en-IN')) : '0'}
                      </td>
                      <td className="py-3 px-3 font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        ₹{w.expenditure ? (w.expenditure >= 1e5 ? `${(w.expenditure / 1e5).toFixed(2)} L` : w.expenditure.toLocaleString('en-IN')) : '0'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          w.status.toLowerCase().includes('complete')
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                        }`}>
                          {w.status.toLowerCase().includes('complete') ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                          {w.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-[var(--border-primary)] flex justify-end">
              <button
                onClick={() => setActiveTab('works')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand-primary)] hover:underline cursor-pointer"
              >
                <span>View all {filteredWorks.length} works in this ledger</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* 6. TAB CONTENT: Works Ledger */}
      {activeTab === 'works' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="p-4 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={workSearch}
                onChange={e => setWorkSearch(e.target.value)}
                placeholder="Search works, category, agency, ID..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-1 bg-[var(--surface-secondary)] p-1 rounded-xl border border-[var(--border-primary)] text-xs font-bold">
                <button
                  onClick={() => setWorkStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    workStatusFilter === 'all'
                      ? 'bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setWorkStatusFilter('completed')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    workStatusFilter === 'completed'
                      ? 'bg-[var(--surface-primary)] text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Completed
                </button>
                <button
                  onClick={() => setWorkStatusFilter('ongoing')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    workStatusFilter === 'ongoing'
                      ? 'bg-[var(--surface-primary)] text-amber-600 dark:text-amber-400 shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Ongoing
                </button>
              </div>

              <span className="text-xs text-[var(--text-secondary)] font-medium">
                Showing <strong>{filteredWorks.length}</strong> works
              </span>
            </div>
          </div>

          {/* Works Table */}
          <div className="rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-primary)] bg-[var(--surface-secondary)]/50 text-[var(--text-secondary)] font-extrabold uppercase text-[10px]">
                    <th className="py-3 px-4">Work ID</th>
                    <th className="py-3 px-4">Description & Location</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Sanction Amount</th>
                    <th className="py-3 px-4">Total Paid</th>
                    <th className="py-3 px-4">Implementing Agency</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)]">
                  {filteredWorks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[var(--text-secondary)]">
                        No development works found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredWorks.map(w => (
                      <tr key={w.work_id} className="hover:bg-[var(--surface-secondary)]/50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-[var(--brand-primary)] whitespace-nowrap">
                          <Link to={`/audit?q=${w.work_id}`} className="hover:underline flex items-center gap-1">
                            <span>#{w.work_id}</span>
                            <ExternalLink size={10} />
                          </Link>
                        </td>
                        <td className="py-3 px-4 max-w-sm">
                          <div className="font-bold text-[var(--text-primary)] leading-tight">
                            {w.description}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 flex items-center gap-1">
                            <MapPin size={10} />
                            <span>{w.location || w.district || parliamentary_constituency}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[var(--text-secondary)] whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-[11px] font-medium">
                            {w.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold tabular-nums text-[var(--text-primary)] whitespace-nowrap">
                          ₹{w.sanction_amount ? (w.sanction_amount >= 1e5 ? `${(w.sanction_amount / 1e5).toFixed(2)} L` : w.sanction_amount.toLocaleString('en-IN')) : '0'}
                        </td>
                        <td className="py-3 px-4 font-bold tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          ₹{w.expenditure ? (w.expenditure >= 1e5 ? `${(w.expenditure / 1e5).toFixed(2)} L` : w.expenditure.toLocaleString('en-IN')) : '0'}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-secondary)] max-w-xs truncate">
                          {w.implementing_agency || 'District Authority'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            w.status.toLowerCase().includes('complete')
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                          }`}>
                            {w.status.toLowerCase().includes('complete') ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                            {w.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConstituencyDetail
