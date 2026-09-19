import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { EmptyState } from '../components/shared'
import { StateOverviewCard } from '../components/StateOverviewCard'
import { ALL_36_STATES_OVERVIEW, StateOverviewItem } from '../lib/allStatesData'
import {
  MapPin,
  Search,
  ArrowUpDown,
  X
} from 'lucide-react'
import { STATE_DISTRICTS_MAP } from '../lib/stateDistricts'

export const BrowseStates: React.FC = () => {
  const { user } = useStore()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<string>('rank')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [jurisdictionFilter, setJurisdictionFilter] = useState<'all' | 'states' | 'uts'>('all')

  const [statesData, setStatesData] = useState<StateOverviewItem[]>(() => {
    try {
      const saved = sessionStorage.getItem('cached_all_36_states')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return ALL_36_STATES_OVERVIEW
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    async function syncBackendStates() {
      try {
        const res = await fetch('/api/states')
        if (res.ok) {
          const json = await res.json()
          const items: any[] = json?.data || []
          if (items.length > 0) {
            // Merge dynamic API counts while preserving calibrated benchmark metrics
            const merged = ALL_36_STATES_OVERVIEW.map((orig) => {
              const found = items.find((i) => i.state?.toLowerCase() === orig.state.toLowerCase())
              if (found) {
                return {
                  ...orig,
                  totalAllocated: found.totalAllocated || orig.totalAllocated,
                  totalExpenditure: found.totalExpenditure || orig.totalExpenditure,
                  mps: found.totalMPs || found.mpCount || orig.mps
                }
              }
              return orig
            })
            setStatesData(merged)
            try { sessionStorage.setItem('cached_all_36_states', JSON.stringify(merged)) } catch {}
          }
        }
      } catch (err) {
        console.log('[SATARK] Using pre-calibrated 36 states data:', err)
      }
    }
    syncBackendStates()
  }, [])

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase()

    let list = statesData.filter((s) => {
      const matchesState = s.state.toLowerCase().includes(q)
      const matchesDistrict = q.length >= 2 && (() => {
        const dists = STATE_DISTRICTS_MAP[s.state] || []
        return dists.some((d: string) => d.toLowerCase().includes(q))
      })()
      const matchesSearch = !q || matchesState || matchesDistrict

      if (jurisdictionFilter === 'states') return matchesSearch && !s.isUT
      if (jurisdictionFilter === 'uts') return matchesSearch && s.isUT
      return matchesSearch
    })

    // Sort logic
    list.sort((a, b) => {
      let cmp = 0
      if (sort === 'rank') {
        cmp = a.rank - b.rank
      } else if (sort === 'allocated') {
        cmp = a.allocatedCr - b.allocatedCr
      } else if (sort === 'expenditure') {
        cmp = a.expenditureCr - b.expenditureCr
      } else if (sort === 'rate') {
        cmp = a.expenditureRate - b.expenditureRate
      } else if (sort === 'works') {
        cmp = a.completedWorks - b.completedWorks
      } else if (sort === 'completion') {
        cmp = a.completionRate - b.completionRate
      } else if (sort === 'name') {
        cmp = a.state.localeCompare(b.state)
      }

      // Default rank order is ascending (#1 to #36)
      if (sort === 'rank') {
        return order === 'desc' ? -cmp : cmp
      }
      return order === 'desc' ? -cmp : cmp
    })

    return list
  }, [statesData, search, sort, order, jurisdictionFilter])

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Page Description */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={20} className="text-[var(--brand-primary)]" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
              State &amp; UT Overview
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Comparative performance directory across 28 States &amp; 8 Union Territories showing fund allocation, expenditure velocity, and project delivery.
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
              placeholder="Search state or district..."
              className="w-full pl-9 pr-7 py-1.5 text-xs rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)] shadow-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-xs shadow-sm">
              <ArrowUpDown size={13} className="text-[var(--text-tertiary)]" />
              <span className="text-[var(--text-secondary)] text-[11px] font-medium">Sort:</span>
              <select
                value={sort}
                onChange={(e) => {
                  const val = e.target.value
                  setSort(val)
                  // For rank and name default to asc, for money/percentage default to desc
                  if (val === 'rank' || val === 'name') {
                    setOrder('asc')
                  } else {
                    setOrder('desc')
                  }
                }}
                className="bg-transparent text-xs font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer"
              >
                <option value="rank">Rank (#1 to #36)</option>
                <option value="allocated">Allocated Budget</option>
                <option value="expenditure">Recorded Expenditure</option>
                <option value="rate">Expenditure Rate (%)</option>
                <option value="completion">Completion (%)</option>
                <option value="works">Works Completed</option>
                <option value="name">State Name (A-Z)</option>
              </select>
            </div>

            <button
              onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
              className="px-3 py-1.5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition shadow-sm cursor-pointer"
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
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            jurisdictionFilter === 'all'
              ? 'bg-[var(--brand-primary)] text-white shadow-sm'
              : 'bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
          }`}
        >
          All 36 Jurisdictions
        </button>
        <button
          onClick={() => setJurisdictionFilter('states')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            jurisdictionFilter === 'states'
              ? 'bg-[var(--brand-primary)] text-white shadow-sm'
              : 'bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
          }`}
        >
          States (28)
        </button>
        <button
          onClick={() => setJurisdictionFilter('uts')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
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
      ) : filteredAndSorted.length === 0 ? (
        <EmptyState
          title="No states match your search"
          description={`No results found for "${search}". Try checking the spelling or clear the search input.`}
          action={
            <button
              onClick={() => setSearch('')}
              className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow cursor-pointer"
            >
              Clear Search Filter
            </button>
          }
        />
      ) : (
        /* State Cards Grid (4 columns on desktop matching screenshot) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredAndSorted.map((st) => (
            <StateOverviewCard key={st.state} item={st} />
          ))}
        </div>
      )}
    </div>
  )
}
