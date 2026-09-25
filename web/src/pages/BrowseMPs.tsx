import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { EmptyState } from '../components/shared'
import { ALL_MP_SEATS } from '../lib/allMpsData'
import { findAssemblyConstituencies, ASSEMBLY_CONSTITUENCIES } from '../lib/assemblyConstituencies'
import { useStore } from '../store/useStore'
import {
  Users,
  Search,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Landmark,
  MapPin,
  TrendingUp,
  FileCheck2,
  CheckCircle2,
  X,
  ArrowUpDown
} from 'lucide-react'
import { useTranslation, translateState, translateConstituency, translateMP } from '../lib/i18n'
import { ALL_36_STATES_AND_UTS } from '../lib/constants'

export const BrowseMPs: React.FC = () => {
  const { user, setMpJurisdiction } = useStore()
  const { t, toNativeDigits: formatNum, lang } = useTranslation()
  const [searchParams] = useSearchParams()
  const qParam = searchParams.get('q') || ''

  // State Nodal Officer Scope Detection
  const isStateNodal = user.role === 'state_nodal_officer' && Boolean(user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES')
  const nodalState = isStateNodal ? user.state! : ''

  // Filters & State
  const [search, setSearch] = useState(qParam)
  const [prevQParam, setPrevQParam] = useState(qParam)
  const [stateFilter, setStateFilter] = useState<string>(() => {
    if (isStateNodal) return nodalState
    return searchParams.get('state') || 'ALL'
  })
  const [house, setHouse] = useState('all')
  const [sort, setSort] = useState('allocated')
  const [order, setOrder] = useState('desc')
  const [page, setPage] = useState(1)

  // Sync state filter whenever State Nodal Officer role or state changes
  useEffect(() => {
    if (user.role === 'state_nodal_officer' && user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES') {
      setStateFilter(user.state)
      setPage(1)
    }
  }, [user.role, user.state])

  if (qParam !== prevQParam) {
    setPrevQParam(qParam)
    setSearch(qParam)
    setPage(1)
  }

  const effectiveStateFilter = isStateNodal ? nodalState : stateFilter
  const hasState = Boolean(effectiveStateFilter && effectiveStateFilter !== 'ALL')

  const [mps, setMps] = useState<any[]>(() => {
    const effectiveInitialState = isStateNodal ? nodalState : (searchParams.get('state') || 'ALL')
    const initialSeats = (effectiveInitialState && effectiveInitialState !== 'ALL')
      ? ALL_MP_SEATS.filter(s => s.state.toLowerCase() === effectiveInitialState.toLowerCase())
      : ALL_MP_SEATS

    try {
      const saved = sessionStorage.getItem(`cached_mps_1_allocated_desc_all_${effectiveInitialState || 'ALL'}_`)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && parsed.length > 0) return parsed
      }
    } catch {}

    // Seed with state-scoped canonical seat list so page 1 renders instantaneously with 0 buffering
    return initialSeats.slice(0, 50).map(s => ({
      id: s.id,
      mpName: s.name,
      constituency: s.constituency,
      state: s.state,
      house: s.house,
      allocated: 150000000,
      expenditure: 50000000,
      utilizationPercentage: 33.3,
      redFlagCount: 0,
      redFlagPct: 0.0,
      completedWorksCount: 50,
      recommendedWorksCount: 100,
      completionRate: 50.0
    }))
  })
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const qClean = search.trim().toLowerCase()
    
    // 1. Instant 0ms client-side filter fallback across all seats and 4,120+ Assembly Constituencies
    if (qClean || house !== 'all' || hasState) {
      const acMatches = qClean ? findAssemblyConstituencies(qClean, 30) : []
      const matchedPcNames = new Set(acMatches.map(a => a.pc.toUpperCase()))
      const matchedMpIds = new Set(acMatches.map(a => a.mpId).filter(id => id && id !== 'vacant'))
      const acNameMap = new Map<string, string>()
      acMatches.forEach(a => {
        if (a.mpId && a.mpId !== 'vacant') acNameMap.set(a.mpId, a.ac)
        if (a.pc) acNameMap.set(a.pc.toUpperCase(), a.ac)
      })

      const localMatches = ALL_MP_SEATS.filter(s => {
        if (hasState && s.state.toLowerCase() !== effectiveStateFilter.toLowerCase()) return false
        if (house !== 'all' && s.house !== house) return false
        if (!qClean) return true
        const isDirect = (
          s.name.toLowerCase().includes(qClean) ||
          s.constituency.toLowerCase().includes(qClean) ||
          s.state.toLowerCase().includes(qClean) ||
          s.id.toLowerCase().includes(qClean)
        )
        const isAc = matchedPcNames.has(s.constituency.toUpperCase()) || matchedMpIds.has(s.id)
        return isDirect || isAc
      })

      // Immediately render local matching subset while network fetch is in-flight
      const offset = (page - 1) * 50
      const localPage = localMatches.slice(offset, offset + 50).map(s => {
        const matchedAc = acNameMap.get(s.id) || acNameMap.get(s.constituency.toUpperCase())
        return {
          id: s.id,
          mpName: s.name,
          constituency: s.constituency,
          state: s.state,
          house: s.house,
          matched_via: matchedAc ? 'assembly_constituency' : undefined,
          assembly_name: matchedAc,
          allocated: 150000000,
          expenditure: 50000000,
          utilizationPercentage: 33.3,
          redFlagCount: 0,
          redFlagPct: 0.0,
          completedWorksCount: 50,
          recommendedWorksCount: 100,
          completionRate: 50.0
        }
      })
      setMps(localPage)
      setMeta({
        page,
        page_size: 50,
        total: localMatches.length,
        total_pages: Math.max(1, Math.ceil(localMatches.length / 50))
      })
    }

    // 2. Debounced API synchronization to load full live audited financial metrics
    const timer = setTimeout(async () => {
      const cacheKey = `cached_mps_${page}_${sort}_${order}_${house}_${effectiveStateFilter}_${search}`
      try {
        const saved = sessionStorage.getItem(cacheKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed && parsed.length > 0) {
            setMps(parsed)
            return
          }
        }
      } catch {}

      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          page_size: '50',
          sort,
          order,
        })
        if (search.trim()) queryParams.set('q', search.trim())
        if (house !== 'all') queryParams.set('house', house)
        if (hasState) queryParams.set('state', effectiveStateFilter)

        const res = await fetch(`/api/mps?${queryParams.toString()}`)
        if (res.ok) {
          const json = await res.json()
          const items = json.data || []
          setMps(items)
          if (json.meta) setMeta(json.meta)
          try { sessionStorage.setItem(cacheKey, JSON.stringify(items)) } catch {}
        }
      } catch (err) {
        console.error('Failed to load MPs from API, using client dataset:', err)
      } finally {
        setLoading(false)
      }
    }, search ? 250 : 0)

    return () => clearTimeout(timer)
  }, [page, sort, order, house, search, stateFilter, isStateNodal, nodalState, effectiveStateFilter, hasState])

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
      return `₹${formatNum(Math.round(cr).toLocaleString('en-IN'))} ${t('unit.cr')}`
    }
    return `₹${formatNum(cr.toFixed(1))} ${t('unit.cr')}`
  }

  const totalRecords = meta?.total_records ?? meta?.total ?? (mps ? mps.length : 0)
  const totalPages = meta?.total_pages ?? Math.max(1, Math.ceil(totalRecords / 48))

  const suggestedAcs = React.useMemo(() => {
    if (!search || search.trim().length < 2) return []
    return findAssemblyConstituencies(search.trim(), 6)
  }, [search])

  return (
    <div className="space-y-6 pt-1">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight flex items-center gap-2.5">
              <Users className="w-7 h-7 text-[var(--brand-primary)] shrink-0" />
              {t('mps.title')}
            </h1>
            {isStateNodal && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] dark:bg-blue-950/60 border border-[#BFDBFE] dark:border-blue-800/70 text-[#1D4ED8] dark:text-blue-300 text-xs font-black uppercase tracking-wider">
                <MapPin size={12} className="text-[#2563EB]" />
                <span>{translateState(nodalState, lang)} Jurisdiction Scope</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 max-w-3xl">
            {isStateNodal ? (
              <span>
                Showing Lok Sabha and Rajya Sabha representatives exclusively for <strong>{translateState(nodalState, lang)}</strong>.
              </span>
            ) : (
              t('mps.subtitle')
            )}
          </p>
        </div>

        {/* Global Summary Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-[var(--surface-primary)] dark:bg-[#0D121D] border border-slate-200 dark:border-[#1E293B] flex items-center gap-2 shadow-2xs">
            <span className="text-[var(--text-tertiary)] font-bold">Total MPs:</span>
            <span className="font-black text-[var(--text-primary)] tabular-nums">{formatNum(totalRecords)}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[var(--surface-primary)] dark:bg-[#0D121D] border border-slate-200 dark:border-[#1E293B] flex items-center gap-2 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[var(--text-tertiary)] font-bold">Lok Sabha:</span>
            <span className="font-black text-[var(--text-primary)] tabular-nums">{formatNum(543)}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[var(--surface-primary)] dark:bg-[#0D121D] border border-slate-200 dark:border-[#1E293B] flex items-center gap-2 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-[var(--text-tertiary)] font-bold">Rajya Sabha:</span>
            <span className="font-black text-[var(--text-primary)] tabular-nums">{formatNum(245)}</span>
          </div>
        </div>
      </div>

      {/* Global Controls & Filter Toolbar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-[var(--surface-primary)] dark:bg-[#0D121D] border border-slate-200 dark:border-[#1E293B] shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Left: Search input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder={isStateNodal ? `Search ${nodalState} MPs...` : t('mps.search_placeholder')}
              className="w-full pl-10 pr-9 py-2 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] dark:border-[#222F43] text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--brand-primary)] focus:bg-[var(--surface-primary)] transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setPage(1)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Right: State, House, Sort, Order Controls */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* State / Jurisdiction Selector */}
            <select
              value={effectiveStateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value)
                setPage(1)
              }}
              disabled={isStateNodal}
              className={`px-3 py-2 rounded-xl bg-[var(--surface-alt)] border text-xs font-semibold outline-none transition cursor-pointer min-w-[150px] ${
                isStateNodal
                  ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] font-bold opacity-90 cursor-not-allowed'
                  : 'border-[var(--border-primary)] dark:border-[#222F43] text-[var(--text-primary)] focus:border-[var(--brand-primary)]'
              }`}
              title={isStateNodal ? `Locked to ${nodalState} (State Nodal Officer)` : 'Filter by State / UT'}
            >
              {!isStateNodal && <option value="ALL">All States &amp; UTs (36)</option>}
              {ALL_36_STATES_AND_UTS.filter(s => s !== 'ALL STATES & UNION TERRITORIES').map((st) => (
                <option key={st} value={st}>
                  {translateState(st, lang)}
                </option>
              ))}
            </select>

            {/* House Selector */}
            <select
              value={house}
              onChange={(e) => {
                setHouse(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] dark:border-[#222F43] text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] min-w-[125px]"
            >
              <option value="all">{t('mps.all_houses')}</option>
              <option value="Lok Sabha">{t('mps.lok_sabha_count')}</option>
              <option value="Rajya Sabha">{t('mps.rajya_sabha_count')}</option>
            </select>

            {/* Sort Selector */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] dark:border-[#222F43] text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] min-w-[130px]"
            >
              <option value="allocated">{t('mps.sort_allocated')}</option>
              <option value="utilization">{t('mps.sort_utilization')}</option>
              <option value="red_pct">{t('mps.sort_red_pct')}</option>
            </select>

            {/* Order Toggle */}
            <button
              type="button"
              onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] dark:border-[#222F43] text-[var(--text-primary)] hover:border-[var(--brand-primary)] flex items-center gap-1.5 transition shrink-0 cursor-pointer"
              title={`Order: ${order.toUpperCase()}`}
            >
              <ArrowUpDown size={13} className="text-[var(--text-tertiary)]" />
              <span>{order === 'asc' ? t('common.asc') : t('common.desc')}</span>
            </button>

            {/* Clear Filters (if active) */}
            {(search || house !== 'all' || (effectiveStateFilter && effectiveStateFilter !== 'ALL' && !isStateNodal)) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setHouse('all')
                  if (!isStateNodal) setStateFilter('ALL')
                  setPage(1)
                }}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition shrink-0 cursor-pointer"
                title="Clear all filters"
              >
                {t('common.clear_filters')}
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} height="h-44" />
      ) : mps.length === 0 ? (
        <div className="space-y-6">
          <EmptyState
            title="No direct representative matches found"
            description={`No MP matches "${search}". Check for spelling or explore Assembly Constituencies.`}
            action={
              <button
                onClick={() => {
                  setSearch('')
                  setHouse('all')
                }}
                className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow"
              >
                {t('common.clear_filters')}
              </button>
            }
          />
          {suggestedAcs.length > 0 && (
            <div className="lux-card p-4 max-w-lg mx-auto text-left">
              <div className="text-xs font-bold text-[var(--text-secondary)] mb-2 flex items-center gap-1.5">
                <span>Did you mean one of these Assembly Constituencies?</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedAcs.map(a => (
                  <button
                    key={`${a.ac}-${a.pc}-${a.state}`}
                    onClick={() => setSearch(a.ac)}
                    className="px-2.5 py-1 rounded-lg bg-[var(--surface-alt)] hover:bg-[var(--surface-primary)] border border-[var(--border-primary)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition hover:border-[var(--brand-primary)]"
                  >
                    <span>🏛️ {a.ac}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">({a.pc}, {a.state})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
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
                className="lux-card card-content-opt p-5 flex flex-col justify-between rounded-2xl border border-blue-300 dark:border-[#222F43] hover:!border-blue-500 dark:hover:!border-blue-400 hover:shadow-md transition-colors duration-150 bg-[var(--surface-primary)] dark:bg-[#0D121D]"
              >
                <div>
                  {/* Top row: Avatar + House badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] dark:from-[#1E293B] dark:to-[#0F172A] border border-[#BFDBFE] dark:border-[#334155] flex items-center justify-center font-black text-xs text-[#1E40AF] dark:text-[#60A5FA] shadow-xs shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-[var(--text-primary)] tracking-tight truncate" title={mp.mpName}>
                          {translateMP(mp.mpName, lang)}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide ${
                              isLokSabha
                                ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60'
                                : 'bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE] dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/60'
                            }`}
                          >
                            {mp.house}
                          </span>
                          {mp.party && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--surface-alt)] text-[var(--text-secondary)] border border-[var(--border-primary)] dark:border-[#222F43]">
                              {mp.party}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Constituency & State */}
                  <div className="text-xs text-[var(--text-secondary)] mb-2 flex items-center gap-1.5 truncate">
                    <MapPin size={12} className="text-[var(--text-tertiary)] shrink-0" />
                    <span className="font-semibold text-[var(--text-primary)] truncate">
                      {mp.constituency ? translateConstituency(mp.constituency, lang) : 'Sitting Rajya Sabha'}
                    </span>
                    <span className="text-[var(--text-tertiary)]">&bull;</span>
                    <span className="truncate">{translateState(mp.state, lang)}</span>
                  </div>

                  {/* Assembly Constituency Badge if matched via AC */}
                  {mp.assembly_name && (
                    <div className="mb-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F0F9FF] dark:bg-sky-950/50 text-[#0369A1] dark:text-sky-300 border border-[#BAE6FD] dark:border-sky-800/60">
                      <span>🏛️ Assembly: {translateConstituency(mp.assembly_name, lang)}</span>
                    </div>
                  )}

                  {/* Dual Financial Outlay: Fund Allocated vs Utilization */}
                  <div className="grid grid-cols-2 gap-2.5 my-3 p-2.5 rounded-xl bg-slate-50/70 dark:bg-[#070B12]/80 border border-slate-100 dark:border-[#1E293B]">
                    <div>
                      <span className="text-[10px] uppercase font-extrabold text-[var(--text-tertiary)] block tracking-wider">
                        {t('mps.fund_allocated')}
                      </span>
                      <div className="text-base sm:text-lg font-black tabular-nums text-[var(--text-primary)] mt-0.5">
                        {formatCrores(mp.allocatedAmount ?? mp.totalAllocated ?? mp.allocated ?? 0)}
                      </div>
                      <span className="text-[11px] font-medium text-[var(--text-secondary)] block mt-0.5 truncate">
                        {t('mps.disbursed')}: <span className="text-black dark:text-[#FE9F3B] font-extrabold">{formatCrores(mp.totalExpenditure ?? mp.expenditure ?? 0)}</span>
                      </span>
                    </div>

                    <div className="text-right flex flex-col justify-between items-end">
                      <div className="flex items-center justify-end gap-1.5 w-full">
                        <span className="text-[10px] uppercase font-extrabold text-[var(--text-tertiary)] dark:text-[#FE9F3B] tracking-wider">
                          {t('mps.utilization')}
                        </span>
                      </div>
                      
                      {/* Red Percentage in light mode, Orange in dark mode */}
                      <div className="flex items-center justify-end gap-1 font-black text-base sm:text-lg tabular-nums text-rose-600 dark:text-[#FE9F3B] mt-0.5">
                        <TrendingUp size={15} className="shrink-0 stroke-[2.5] text-rose-600 dark:text-[#FE9F3B]" />
                        <span>{formatNum(util.toFixed(1))}%</span>
                      </div>

                      {/* Green Progress Bar in light mode, Orange in dark mode */}
                      <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-800/90 mt-1.5 overflow-hidden border border-slate-300/40 dark:border-slate-700/60">
                        <div
                          className="h-full rounded-full bg-emerald-500 dark:bg-[#FE9F3B] transition-[width] duration-500 ease-out shadow-xs"
                          style={{ width: `${Math.min(100, Math.max(3, util))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Recommended Works vs Completed Summary */}
                  <div className="flex items-center justify-between text-xs px-1 py-1 text-[var(--text-secondary)]">
                    <span className="font-bold flex items-center gap-1.5 text-[var(--text-primary)]">
                      <FileCheck2 size={13} className="text-blue-500 shrink-0" />
                      <span>{t('kpi.recommended')}: <strong>{formatNum(mp.recommendedWorksCount || mp.totalWorks || 0)}</strong></span>
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1 shrink-0">
                      <CheckCircle2 size={12} className="shrink-0" />
                      <span>{formatNum(mp.completedWorksCount || 0)} {t('status.completed')}</span>
                    </span>
                  </div>
                </div>

                {/* View Details Action with Blue Button for MP Console and Blue Hover on Public Report */}
                <div className="pt-2.5 border-t border-[var(--border-primary)] dark:border-[#1E293B] mt-2 grid grid-cols-2 gap-2">
                  <Link
                    to={`/mps/${mp.id}`}
                    className="py-2 px-2.5 rounded-xl bg-[var(--surface-primary)] dark:bg-[#121926] hover:bg-blue-50 dark:hover:bg-blue-950/40 text-[var(--text-secondary)] hover:text-blue-600 dark:hover:text-blue-400 text-xs font-bold flex items-center justify-center gap-1 transition-colors duration-150 border border-[var(--border-primary)] dark:border-[#222F43] hover:border-blue-400 dark:hover:border-blue-500 shadow-xs truncate group cursor-pointer"
                  >
                    <span className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{t('btn.public_report')}</span>
                  </Link>
                  <Link
                    to={`/mp-dashboard?id=${encodeURIComponent(mp.id)}`}
                    onClick={() => setMpJurisdiction(mp.id, mp.mpName, mp.state)}
                    className="py-2 px-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-600 dark:hover:bg-blue-600 text-blue-700 dark:text-blue-300 hover:text-white dark:hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-150 border border-blue-200 dark:border-blue-800 hover:border-blue-600 shadow-xs truncate group cursor-pointer"
                  >
                    <Landmark size={12} className="text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors" />
                    <span className="text-blue-700 dark:text-blue-300 group-hover:text-white transition-colors font-black">{t('nav.mp_console')}</span>
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
            {t('common.page')} <strong className="text-[var(--text-primary)]">{formatNum(page)}</strong> {t('common.of')}{' '}
            <strong className="text-[var(--text-primary)]">{formatNum(totalPages)}</strong> ({formatNum(totalRecords)} {t('unit.mps')})
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              <span>{t('common.previous')}</span>
            </button>

            <span className="text-xs font-bold px-2 tabular-nums">
              {formatNum(page)} / {formatNum(totalPages)}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40 flex items-center gap-1"
            >
              <span>{t('common.next')}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
