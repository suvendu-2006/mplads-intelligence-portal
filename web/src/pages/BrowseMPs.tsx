import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { EmptyState } from '../components/shared'
import {
  Users,
  Search,
  ArrowUpDown,
  ArrowRight,
  Filter,
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { t } from '../lib/i18n'

export const BrowseMPs: React.FC = () => {
  // Filters & State
  const [search, setSearch] = useState('')
  const [house, setHouse] = useState('all')
  const [sort, setSort] = useState('allocated')
  const [order, setOrder] = useState('desc')
  const [page, setPage] = useState(1)

  const [mps, setMps] = useState<any[]>(() => {
    try {
      const saved = sessionStorage.getItem('cached_mps_1_allocated_desc_all_')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem('cached_mps_1_allocated_desc_all_')
    } catch { return true }
  })

  useEffect(() => {
    async function loadMPs() {
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          page_size: '48',
          sort,
          order,
        })
        if (search) queryParams.set('q', search)
        if (house !== 'all') queryParams.set('house', house)

        const res = await fetch(`/api/mps?${queryParams.toString()}`)
        if (res.ok) {
          const json = await res.json()
          const items = json.data || []
          setMps(items)
          setMeta(json.meta)
          try { sessionStorage.setItem(`cached_mps_${page}_${sort}_${order}_${house}_${search}`, JSON.stringify(items)) } catch {}
        }
      } catch (err) {
        console.error('Failed to load MPs:', err)
      } finally {
        setLoading(false)
      }
    }
    loadMPs()
  }, [page, sort, order, house, search])

  const getInitials = (name: string) => {
    const parts = name.replace(/^(Shri|Smt\.|Dr\.|Prof\.)\s+/i, '').split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const formatCrores = (val: number) => {
    const cr = val / 10000000
    if (cr >= 100) {
      return `₹${Math.round(cr).toLocaleString('en-IN')} Cr`
    }
    return `₹${cr.toFixed(1)} Cr`
  }

  const totalRecords = meta?.total_records || meta?.total || 774
  const totalPages = meta?.total_pages || Math.ceil(totalRecords / 48)

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
            <Users className="text-[var(--brand-primary)]" size={26} />
            <span>Browse Members of Parliament</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Performance directory across Lok Sabha and Rajya Sabha representatives, tracking statutory allocations, liquid expenditure, and utilization velocity.
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search MP or constituency..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
            />
          </div>

          <select
            value={house}
            onChange={(e) => {
              setHouse(e.target.value)
              setPage(1)
            }}
            className="px-3 py-2 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]"
          >
            <option value="all">All Houses</option>
            <option value="Lok Sabha">Lok Sabha</option>
            <option value="Rajya Sabha">Rajya Sabha</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]"
          >
            <option value="allocated">Sort: Allocated</option>
            <option value="utilization">Sort: Utilization %</option>
            <option value="red_pct">Sort: Red Flag %</option>
          </select>

          <button
            onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] hover:border-[var(--brand-primary)]"
          >
            {order.toUpperCase()}
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} height="h-44" />
      ) : mps.length === 0 ? (
        <EmptyState
          title="No representatives found"
          description={`No MP matches "${search}". Try clearing search keywords or selecting All Houses.`}
          action={
            <button
              onClick={() => {
                setSearch('')
                setHouse('all')
              }}
              className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow"
            >
              Clear Filters
            </button>
          }
        />
      ) : (
        /* MP Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {mps.map((mp: any) => {
            const util = Number(mp.utilizationPercentage ?? mp.utilizationRate ?? 0)
            const initials = getInitials(mp.mpName || 'MP')
            const isLokSabha = (mp.house || '').toLowerCase().includes('lok')

            return (
              <div
                key={mp.id}
                className="lux-card p-5 flex flex-col justify-between hover:border-[var(--brand-accent)] transition-all"
              >
                <div>
                  {/* Top row: Avatar + House badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-center font-extrabold text-xs text-[var(--brand-primary)] shadow-sm shrink-0">
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-[var(--text-primary)] tracking-tight line-clamp-1">
                          {mp.mpName}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isLokSabha
                                ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                                : 'bg-[var(--success)]/10 text-[var(--success)]'
                            }`}
                          >
                            {mp.house}
                          </span>
                          {mp.party && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--surface-alt)] text-[var(--text-secondary)] border border-[var(--border-primary)]">
                              {mp.party}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Constituency & State */}
                  <div className="text-xs text-[var(--text-secondary)] mb-3 flex items-center gap-1">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {mp.constituency || 'General'}
                    </span>
                    <span>&bull;</span>
                    <span>{mp.state}</span>
                  </div>

                  {/* Dual Financial Outlay: Fund Allocated vs Utilization */}
                  <div className="grid grid-cols-2 gap-2.5 my-2.5 p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                    <div>
                      <span className="text-[10px] uppercase font-extrabold text-[var(--brand-primary)] block tracking-wider">
                        Fund Allocated
                      </span>
                      <div className="text-base sm:text-lg font-black tabular-nums text-[var(--brand-primary)] dark:text-blue-400 mt-0.5">
                        {formatCrores(mp.allocatedAmount ?? mp.totalAllocated ?? 0)}
                      </div>
                      <span className="text-[11px] font-bold text-[var(--text-secondary)] block mt-0.5">
                        Disbursed: <span className="text-[var(--gold-text)] font-extrabold">{formatCrores(mp.totalExpenditure || 0)}</span>
                      </span>
                    </div>

                    <div className="text-right flex flex-col justify-between items-end">
                      <div className="flex items-center justify-end gap-1.5 w-full">
                        <span className="text-[10px] uppercase font-extrabold text-[var(--gold-text)] tracking-wider">
                          Utilization
                        </span>
                      </div>
                      <div className="text-base sm:text-lg font-black tabular-nums text-[var(--gold-text)] mt-0.5">
                        {util.toFixed(1)}%
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[var(--border-primary)] mt-1 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--brand-accent)] transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(4, util))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* View Details Action */}
                <div className="pt-3 border-t border-[var(--border-primary)] mt-3">
                  <Link
                    to={`/mps/${mp.id}`}
                    className="w-full py-2 px-3 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-[var(--brand-primary)] text-xs font-bold flex items-center justify-center gap-1.5 transition border border-[var(--border-primary)]"
                  >
                    <span>View Financial Report</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-secondary)]">
            Showing Page <strong className="text-[var(--text-primary)]">{page}</strong> of{' '}
            <strong className="text-[var(--text-primary)]">{totalPages}</strong> ({totalRecords} Total MPs)
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>

            <span className="text-xs font-bold px-2 tabular-nums">
              {page} / {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40 flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
