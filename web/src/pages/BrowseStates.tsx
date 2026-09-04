import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { EmptyState } from '../components/shared'
import { DEFAULT_TOP_STATES } from '../lib/defaultData'
import {
  MapPin,
  Search,
  ArrowUpDown,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Landmark,
  Layers,
  ShieldAlert
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

export const BrowseStates: React.FC = () => {
  const { user } = useStore()
  const isAuditorOrAdmin = ['state_nodal_officer', 'district_authority', 'admin'].includes(user?.role)

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('allocated')
  const [order, setOrder] = useState('desc')
  const [jurisdictionFilter, setJurisdictionFilter] = useState<'all' | 'states' | 'uts'>('all')

  const [states, setStates] = useState<any[]>(() => {
    try {
      const saved = sessionStorage.getItem('cached_states_allocated_desc')
      const parsed = saved ? JSON.parse(saved) : null
      return (parsed && parsed.length > 0) ? parsed : DEFAULT_TOP_STATES
    } catch { return DEFAULT_TOP_STATES }
  })
  const [loading, setLoading] = useState(() => {
    try {
      const saved = sessionStorage.getItem('cached_states_allocated_desc')
      return !saved && (!DEFAULT_TOP_STATES || DEFAULT_TOP_STATES.length === 0)
    } catch { return false }
  })

  useEffect(() => {
    if (!isAuditorOrAdmin && sort === 'red_pct') {
      setSort('allocated')
    }
  }, [isAuditorOrAdmin, sort])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    async function fetchStates() {
      try {
        const res = await fetch(`/api/states?sort=${sort}&order=${order}`)
        if (res.ok) {
          const json = await res.json()
          const items = json.data || []
          setStates(items)
          try { sessionStorage.setItem(`cached_states_${sort}_${order}`, JSON.stringify(items)) } catch {}
        }
      } catch (err) {
        console.error('Failed to load states:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStates()
  }, [sort, order])

  const filtered = states.filter((s) => {
    const matchesSearch = s.state.toLowerCase().includes(search.toLowerCase())
    const isUT = UNION_TERRITORIES.includes(s.state)
    if (jurisdictionFilter === 'states') return matchesSearch && !isUT
    if (jurisdictionFilter === 'uts') return matchesSearch && isUT
    return matchesSearch
  })

  const formatCrores = (val: number) => {
    const cr = val / 10000000
    if (cr >= 1000) {
      return `₹${Math.round(cr).toLocaleString('en-IN')} Cr`
    }
    return `₹${cr.toFixed(1)} Cr`
  }


  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Page Description */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={20} className="text-[var(--brand-primary)]" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Browse States & Union Territories
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Comparative performance directory across 28 States & 8 Union Territories showing fund allocation, expenditure velocity, and project delivery.
          </p>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search size={15} className="absolute left-3 top-2.5 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search state name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)] shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-xs shadow-sm">
              <ArrowUpDown size={13} className="text-[var(--text-tertiary)]" />
              <span className="text-[var(--text-secondary)] text-[11px] font-medium">Sort:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-transparent text-xs font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer"
              >
                <option value="allocated">Allocated</option>
                <option value="utilization">Utilization</option>
                {isAuditorOrAdmin && <option value="red_pct">Red Flags</option>}
              </select>
            </div>

            <button
              onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
              className="px-3 py-1.5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition shadow-sm"
              title="Toggle Sort Order"
            >
              {order.toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      {/* Jurisdiction Category Filters (States vs UTs) */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setJurisdictionFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            jurisdictionFilter === 'all'
              ? 'bg-[var(--brand-primary)] text-white shadow-sm'
              : 'bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
          }`}
        >
          All 36 Jurisdictions
        </button>
        <button
          onClick={() => setJurisdictionFilter('states')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            jurisdictionFilter === 'states'
              ? 'bg-[var(--brand-primary)] text-white shadow-sm'
              : 'bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
          }`}
        >
          States (28)
        </button>
        <button
          onClick={() => setJurisdictionFilter('uts')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            jurisdictionFilter === 'uts'
              ? 'bg-[var(--brand-primary)] text-white shadow-sm'
              : 'bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
          }`}
        >
          Union Territories (8)
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} height="h-44" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No states match your search"
          description={`No results found for "${search}". Try checking the spelling or clear the search input.`}
          action={
            <button
              onClick={() => setSearch('')}
              className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow"
            >
              Clear Search Filter
            </button>
          }
        />
      ) : (
        /* State Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((st) => {
            const util = Number(st.utilizationPercentage ?? st.utilizationRate ?? 0)
            const redPct = st.redFlagPct || 0
            const distCount = st.districtCount || 0
            const mpCount = st.activeMpCount || st.totalMPs || st.mpCount || 0
            const completedWorks = st.completedWorksCount || st.totalWorksCompleted || 0
            const pendingWorks = st.pendingWorksCount || Math.max(0, (st.recommendedWorksCount || 0) - completedWorks)

            return (
              <div
                key={st.state}
                className="lux-card p-5 flex flex-col justify-between hover:border-[var(--brand-accent)] transition-all"
              >
                <div>
                  {/* Card Header: State Name + Red Flag Badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">
                          {st.state}
                        </h3>
                        {UNION_TERRITORIES.includes(st.state) ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30">
                            UT
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                            State
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                        {distCount} Districts &bull; {mpCount} Representing MPs
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--surface-alt)] text-[var(--brand-primary)] border border-[var(--border-primary)] shadow-2xs">
                      {util.toFixed(1)}% Realized
                    </span>
                  </div>

                  {/* Allocated Fund in Authoritative Navy & Spent in Gold */}
                  <div className="my-3 p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-baseline justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-extrabold text-[var(--brand-primary)] tracking-wider">
                        Fund Allocated
                      </div>
                      <div className="text-xl sm:text-2xl font-black tabular-nums text-[var(--brand-primary)] dark:text-blue-400 mt-0.5">
                        {formatCrores(st.totalAllocated || 0)}
                      </div>
                    </div>
                    <div className="text-right border-l border-[var(--border-primary)] pl-3">
                      <div className="text-[10px] uppercase font-extrabold text-[var(--gold-text)] tracking-wider">
                        Disbursed Outlay
                      </div>
                      <div className="text-base sm:text-lg font-black tabular-nums text-[var(--gold-text)] mt-0.5">
                        {formatCrores(st.totalExpenditure || (st.totalAllocated ? st.totalAllocated * (util / 100) : 0))}
                      </div>
                    </div>
                  </div>

                  {/* Utilization Bar */}
                  <div className="space-y-1 mb-4">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-[var(--text-secondary)]">Utilization Rate</span>
                      <span className="tabular-nums font-black text-[var(--gold-text)]">
                        {util.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--border-primary)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--brand-accent)] rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, Math.max(2, util))}%` }}
                      />
                    </div>
                  </div>

                  {/* Completed vs Pending stats */}
                  <div className="grid grid-cols-2 gap-2 py-2 border-t border-[var(--border-primary)] text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={13} />
                      <span className="tabular-nums font-bold">
                        {completedWorks.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">Done</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <Clock size={13} />
                      <span className="tabular-nums font-bold">
                        {pendingWorks.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">Queue</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Button */}
                <div className="pt-3 border-t border-[var(--border-primary)] mt-3">
                  <Link
                    to={`/states/${encodeURIComponent(st.state)}`}
                    className="w-full py-2 px-3 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-xs font-bold text-[var(--brand-primary)] border border-[var(--border-primary)] flex items-center justify-center gap-1.5 transition"
                  >
                    <span>Show Details</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
