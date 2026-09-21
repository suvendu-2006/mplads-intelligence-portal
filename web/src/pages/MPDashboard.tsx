import React, { useEffect, useState, useMemo } from 'react'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { FlagDossierModal, FlagDossierData } from '../components/FlagDossierModal'
import { BackButton } from '../components/BackButton'
import {
  FundCard,
  StatCard,
  TierBadge,
  EmptyState
} from '../components/shared'
import {
  Landmark,
  FileCheck2,
  AlertTriangle,
  Lock,
  Clock,
  Coins,
  Percent,
  Layers,
  Search,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { DEFAULT_MP_ID, DEFAULT_STATE_DISPLAY, ALL_36_STATES_AND_UTS } from '../lib/constants'
import { ALL_MP_SEATS } from '../lib/allMpsData'
import { useTranslation, translateState, translateSector } from '../lib/i18n'

export const MPDashboard: React.FC = () => {
  const { id: paramId } = useParams<{ id?: string }>()
  const { t, toNativeDigits: formatNum, lang } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryId = searchParams.get('id') || searchParams.get('mpId')
  const { user, switchRole, setMpJurisdiction } = useStore()
  const navigate = useNavigate()

  // Priority: URL route param -> URL query param -> logged-in MP's assigned mpId
  const activeMpId = paramId || queryId || (user.role === 'mp' && user.mpId && user.mpId !== 'ALL' ? user.mpId : '')
  const hasSelectedMp = Boolean(activeMpId)
  const isAuthorized = Boolean(user.isAuthenticated && ['mp', 'admin', 'mospi'].includes(user.role))

  // Gate selection state
  const isStateNodal = user.role === 'state_nodal_officer' && Boolean(user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES')
  const nodalState = isStateNodal ? user.state! : ''

  const [gateSearch, setGateSearch] = useState('')
  const [gateHouse, setGateHouse] = useState<'ALL' | 'Lok Sabha' | 'Rajya Sabha'>('ALL')
  const [gateState, setGateState] = useState<string>(() => isStateNodal ? nodalState : 'ALL')
  const [gatePage, setGatePage] = useState(1)
  const [gatePageSize, setGatePageSize] = useState<number | 'all'>(30)

  useEffect(() => {
    if (user.role === 'state_nodal_officer' && user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES') {
      setGateState(user.state)
    }
  }, [user.role, user.state])

  useEffect(() => {
    setGatePage(1)
  }, [gateSearch, gateHouse, gateState, gatePageSize])

  const [data, setData] = useState<any>(() => {
    try {
      if (!activeMpId) return null
      const saved = sessionStorage.getItem(`cached_mp_${activeMpId}`)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(() => {
    try {
      if (!activeMpId) return false
      return !sessionStorage.getItem(`cached_mp_${activeMpId}`)
    } catch { return false }
  })
  const [activeTab, setActiveTab] = useState<'works' | 'spending' | 'flags'>('works')
  const [workFilter, setWorkFilter] = useState<'all' | 'completed' | 'in_progress'>('all')
  const effectiveTab = (user.role === 'viewer' && activeTab === 'flags') ? 'works' : activeTab
  const [selectedFlag, setSelectedFlag] = useState<FlagDossierData | null>(null)

  useEffect(() => {
    async function loadMPDossier() {
      if (!activeMpId) {
        setLoading(false)
        return
      }
      if (!sessionStorage.getItem(`cached_mp_${activeMpId}`)) {
        setLoading(true)
      }
      try {
        const res = await fetch(`/api/mps/${activeMpId}`)
        if (res.ok) {
          const json = await res.json()
          setData(json.data)
          try { sessionStorage.setItem(`cached_mp_${activeMpId}`, JSON.stringify(json.data)) } catch {}
          if (json.data?.summary?.mpName) {
            setMpJurisdiction(activeMpId, json.data.summary.mpName, json.data.summary.state)
          }
        }
      } catch (err) {
        console.error('Failed to load MP profile:', err)
      } finally {
        setLoading(false)
      }
    }
    loadMPDossier()
  }, [activeMpId])

  const filteredGateMps = useMemo(() => {
    return ALL_MP_SEATS.filter((m) => {
      if (gateHouse !== 'ALL' && m.house !== gateHouse) return false
      if (gateState !== 'ALL' && m.state.toUpperCase() !== gateState.toUpperCase()) return false
      if (gateSearch.trim()) {
        const q = gateSearch.toLowerCase().trim()
        const matchName = m.name.toLowerCase().includes(q)
        const matchConst = m.constituency.toLowerCase().includes(q)
        const matchState = m.state.toLowerCase().includes(q)
        return matchName || matchConst || matchState
      }
      return true
    })
  }, [gateSearch, gateHouse, gateState])

  const totalGateMps = filteredGateMps.length
  const totalGatePages = gatePageSize === 'all' ? 1 : (Math.ceil(totalGateMps / Number(gatePageSize)) || 1)
  const pagedGateMps = useMemo(() => {
    if (gatePageSize === 'all') return filteredGateMps
    const start = (gatePage - 1) * Number(gatePageSize)
    return filteredGateMps.slice(start, start + Number(gatePageSize))
  }, [filteredGateMps, gatePage, gatePageSize])

  if (!isAuthorized) {
    return (
      <div className="lux-card p-10 max-w-lg mx-auto text-center my-12 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
          <Lock size={26} />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Member of Parliament Access Required
        </h2>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          The Parliamentary Constituency Command Dashboard is designed exclusively for Lok Sabha and Rajya Sabha representatives.
        </p>
        <button
          onClick={() => navigate('/login?role=mp')}
          className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow hover:opacity-95 transition cursor-pointer"
        >
          Log In as Member of Parliament (Autofilled)
        </button>
      </div>
    )
  }

  // If no MP is selected yet, show the full-screen selection gate
  if (!hasSelectedMp) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-start">
          <BackButton fallback="/mps" />
        </div>
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--gold-text)] flex items-center justify-center mx-auto">
            <Landmark size={24} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
            {t('mp.command_console')}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-xl mx-auto">
            Select an Hon'ble Member of Parliament to access the parliamentary ledger, inspect works execution, and audit expenditures.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="lux-card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                Search Representative
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Name, constituency..."
                  value={gateSearch}
                  onChange={(e) => setGateSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]"
                />
              </div>
            </div>

            {/* State Filter */}
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                State / UT
              </label>
              <select
                value={gateState}
                disabled={isStateNodal}
                onChange={(e) => setGateState(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] disabled:opacity-60"
              >
                {!isStateNodal && <option value="ALL">All States &amp; UTs</option>}
                {ALL_36_STATES_AND_UTS.map((s) => (
                  <option key={s} value={s}>{translateState(s, lang)}</option>
                ))}
              </select>
            </div>

            {/* House Filter */}
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                Parliamentary House
              </label>
              <div className="flex rounded-xl bg-[var(--surface-alt)] p-0.5 border border-[var(--border-primary)]">
                {(['ALL', 'Lok Sabha', 'Rajya Sabha'] as const).map((h) => (
                  <button
                    key={h}
                    onClick={() => setGateHouse(h)}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition ${
                      gateHouse === h
                        ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {h === 'ALL' ? 'All' : h === 'Lok Sabha' ? 'LS' : 'RS'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* MP Grid & Pagination */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[var(--text-tertiary)] px-1">
            <div className="font-semibold">
              {gatePageSize === 'all' ? (
                <span>Showing all {formatNum(totalGateMps)} Members of Parliament</span>
              ) : (
                <span>
                  Showing {formatNum((gatePage - 1) * Number(gatePageSize) + 1)} – {formatNum(Math.min(totalGateMps, gatePage * Number(gatePageSize)))} of {formatNum(totalGateMps)} Members of Parliament
                </span>
              )}
            </div>

            {/* Page Size Options */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">Per page:</span>
              {[30, 60, 90, 'all'].map((sz) => (
                <button
                  key={String(sz)}
                  type="button"
                  onClick={() => setGatePageSize(sz as any)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    gatePageSize === sz
                      ? 'bg-[var(--brand-primary)] !text-white shadow-xs'
                      : 'bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
                  }`}
                  style={gatePageSize === sz ? { color: '#ffffff' } : undefined}
                >
                  {sz === 'all' ? `All (${formatNum(totalGateMps)})` : formatNum(sz)}
                </button>
              ))}
            </div>
          </div>

          {pagedGateMps.length === 0 ? (
            <div className="p-8 text-center bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-2xl">
              <p className="text-sm font-bold text-[var(--text-secondary)]">No Members of Parliament found matching your filters.</p>
              <button
                type="button"
                onClick={() => { setGateSearch(''); setGateState('ALL'); setGateHouse('ALL'); }}
                className="mt-3 px-4 py-1.5 rounded-xl bg-[var(--brand-primary)] !text-white text-xs font-bold shadow-sm cursor-pointer"
                style={{ color: '#ffffff' }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-1">
              {pagedGateMps.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setMpJurisdiction(m.id, m.name, m.state)
                    setSearchParams({ id: m.id }, { replace: true })
                  }}
                  className="lux-card p-3.5 text-left hover:border-[var(--brand-accent)] transition-colors duration-150 flex items-center justify-between group cursor-pointer shadow-xs hover:shadow-sm"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors duration-150 truncate">
                      {m.name}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate">
                      {m.constituency !== 'Sitting Rajya Sabha' ? `${m.constituency}, ` : ''}{translateState(m.state, lang)}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                        m.house === 'Lok Sabha'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                      }`}>
                        {m.house}
                      </span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-[var(--surface-alt)] flex items-center justify-center text-[var(--text-tertiary)] group-hover:bg-[var(--brand-primary)] group-hover:text-white transition-colors duration-150 shrink-0">
                    <CheckCircle2 size={14} />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Bottom Pagination Controls */}
          {totalGatePages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border-primary)] px-1">
              <div className="text-xs text-[var(--text-secondary)] font-medium">
                Page <strong className="text-[var(--text-primary)]">{formatNum(gatePage)}</strong> of{' '}
                <strong className="text-[var(--text-primary)]">{formatNum(totalGatePages)}</strong> ({formatNum(totalGateMps)} total MPs)
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={gatePage <= 1}
                  onClick={() => {
                    setGatePage((p) => Math.max(1, p - 1))
                    window.scrollTo({ top: 120, behavior: 'smooth' })
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40 flex items-center gap-1 cursor-pointer hover:bg-[var(--surface-alt)] transition-colors shadow-xs"
                >
                  <ChevronLeft size={14} />
                  <span>{t('common.previous')}</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalGatePages) }, (_, idx) => {
                    let pageNum = gatePage <= 3 ? idx + 1 : gatePage >= totalGatePages - 2 ? totalGatePages - 4 + idx : gatePage - 2 + idx
                    if (pageNum < 1 || pageNum > totalGatePages) return null
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => {
                          setGatePage(pageNum)
                          window.scrollTo({ top: 120, behavior: 'smooth' })
                        }}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                          gatePage === pageNum
                            ? 'bg-[var(--brand-primary)] !text-white shadow-xs'
                            : 'bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)]'
                        }`}
                        style={gatePage === pageNum ? { color: '#ffffff' } : undefined}
                      >
                        {formatNum(pageNum)}
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  disabled={gatePage >= totalGatePages}
                  onClick={() => {
                    setGatePage((p) => Math.min(totalGatePages, p + 1))
                    window.scrollTo({ top: 120, behavior: 'smooth' })
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40 flex items-center gap-1 cursor-pointer hover:bg-[var(--surface-alt)] transition-colors shadow-xs"
                >
                  <span>{t('common.next')}</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return <LoadingSkeleton rows={6} height="h-32" />
  }

  const summary = data?.summary || {}
  const works = data?.works || []
  const flags = data?.flags || []

  let rawAlloc = Number(summary.allocatedAmount || 0)
  let rawExp = Number(summary.totalExpenditure || 0)
  let rawUnspent = Number(summary.unspentAmount || 0)
  let util = Number(summary.utilizationRate || summary.utilizationPercentage || 0)

  if (rawAlloc <= 0 && rawExp > 0 && util > 0) {
    rawAlloc = (rawExp / (util / 100))
    rawUnspent = Math.max(0, rawAlloc - rawExp)
  } else if (rawAlloc <= 0 && util > 0) {
    rawAlloc = 147000000
    rawExp = (rawAlloc * util) / 100
    rawUnspent = Math.max(0, rawAlloc - rawExp)
  } else if (rawUnspent <= 0 && rawAlloc > rawExp) {
    rawUnspent = Math.max(0, rawAlloc - rawExp)
  }
  if (util <= 0 && rawAlloc > 0 && rawExp > 0) {
    util = Number(((rawExp / rawAlloc) * 100).toFixed(1))
  }

  const formatCrores = (val: number) => {
    const cr = val / 10000000
    if (cr === 0) return formatNum('0')
    if (cr >= 100) return formatNum(Math.round(cr).toLocaleString('en-IN'))
    if (cr < 10 && cr !== Math.floor(cr) && (cr * 10) % 1 !== 0) return formatNum(cr.toFixed(2))
    return formatNum(cr.toFixed(1))
  }

  const allocCr = formatCrores(rawAlloc)
  const expCr = formatCrores(rawExp)
  const unspentCr = formatCrores(rawUnspent)

  const completedWorks = works.filter((w: any) => (w.status || '').toLowerCase().includes('completed')).length
  const ongoingWorks = Math.max(0, works.length - completedWorks)

  const filteredWorks = workFilter === 'completed'
    ? works.filter((w: any) => (w.status || '').toLowerCase().includes('completed'))
    : workFilter === 'in_progress'
    ? works.filter((w: any) => !(w.status || '').toLowerCase().includes('completed'))
    : works

  const isSittingMP = user.role === 'mp' && user.mpId === activeMpId

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Executive Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border-primary)]">
        <div className="flex items-start gap-3">
          <BackButton fallback="/mps" className="mt-1" />
          <div>
            <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-wider text-[var(--gold-text)] flex items-center gap-1.5">
              <Landmark size={15} />
              <span>{t('mp.command_console')}</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
              summary.house === 'Lok Sabha' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
            }`}>
              {summary.house || 'Lok Sabha'}
            </span>
          </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {summary.mpName || user.mpName || t('mp.member_of_parliament')}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
              {summary.constituency ? `${summary.constituency}, ` : ''}{translateState(summary.state || user.state, lang)} &bull; {summary.party || 'Independent'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/mps/${activeMpId}`}
            className="text-xs px-3 py-1.5 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-primary)] font-bold transition"
          >
            {t('btn.public_report')}
          </Link>
        </div>
      </div>

      {/* Top Highlight: Real ACRU Debit-Card Style Fund Card */}
      <FundCard
        allocated={rawAlloc}
        used={rawExp}
        balance={rawUnspent}
        utilization={util}
        mpName={summary.mpName || user.mpName || 'MP'}
        constituency={summary.constituency}
        house={summary.house}
        party={summary.party}
        term={summary.term || '17th Lok Sabha'}
      />

      {/* 4-KPI Money Band */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Landmark}
          label="mps.fund_allocated"
          value={Number(allocCr)}
          prefix="₹"
          unit="Cr"
          theme="gold"
          description="kpi.total_central_sanction"
        />
        <StatCard
          icon={Coins}
          label="mps.disbursed"
          value={Number(expCr)}
          prefix="₹"
          unit="Cr"
          theme="gold"
          description="kpi.verified_expenditure"
        />
        <StatCard
          icon={Percent}
          label="kpi.utilization"
          value={Number(util)}
          unit="%"
          theme="emerald"
          gaugeValue={Number(util)}
          description="kpi.expenditure_ratio"
        />
        <StatCard
          icon={Clock}
          label="kpi.payment_gap"
          value={Number(unspentCr)}
          prefix="₹"
          unit="Cr"
          theme="amber"
          description="kpi.pending_disbursement"
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
          <span>{t('mp.tab_works')} ({formatNum(works.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('spending')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            effectiveTab === 'spending'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Layers size={14} />
          <span>{t('mps.sector_spending')}</span>
        </button>

        {user.role !== 'viewer' && (
          <button
            onClick={() => setActiveTab('flags')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              effectiveTab === 'flags'
                ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <AlertTriangle size={14} className="text-amber-500" />
            <span>{t('audit.tab_all_flags')} ({formatNum(flags.length)})</span>
          </button>
        )}
      </div>

      {/* TAB 1: PROJECTS */}
      {effectiveTab === 'works' && (
        <div className="space-y-4">
          {works.length === 0 ? (
            <EmptyState
              title={t('mp.no_projects_recommended')}
              description={t('mp.no_projects_desc')}
            />
          ) : (
            <>
              {/* Work Status Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setWorkFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    workFilter === 'all'
                      ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                      : 'bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {t('filter.all')} ({formatNum(works.length)})
                </button>
                <button
                  onClick={() => setWorkFilter('completed')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    workFilter === 'completed'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-[var(--surface-alt)] text-emerald-700 dark:text-emerald-400 hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <CheckCircle2 size={13} />
                  <span>{t('status.completed')} ({formatNum(completedWorks)})</span>
                </button>
                <button
                  onClick={() => setWorkFilter('in_progress')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    workFilter === 'in_progress'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-[var(--surface-alt)] text-amber-700 dark:text-amber-400 hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Clock size={13} />
                  <span>{t('status.in_progress')} ({formatNum(ongoingWorks)})</span>
                </button>
              </div>

              {(() => {
                const displayedWorks = works.filter((w: any) => {
                  const isDone = (w.status || '').toLowerCase().includes('completed')
                  if (workFilter === 'completed') return isDone
                  if (workFilter === 'in_progress') return !isDone
                  return true
                })

                return displayedWorks.length === 0 ? (
                  <div className="lux-card p-8 text-center text-xs text-[var(--text-secondary)]">
                    {workFilter === 'completed'
                      ? 'No completed works recorded in this portfolio yet.'
                      : 'No ongoing works currently in progress.'}
                  </div>
                ) : (
                  <div className="lux-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                            <th className="p-3 font-bold whitespace-nowrap">{t('table.work_id')}</th>
                            <th className="p-3 font-bold min-w-[260px] max-w-sm">{t('table.description')}</th>
                            <th className="p-3 font-bold whitespace-nowrap">{t('table.district')}</th>
                            <th className="p-3 font-bold whitespace-nowrap text-right">{t('table.amount')}</th>
                            <th className="p-3 font-bold text-center whitespace-nowrap">{t('table.status')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-primary)]">
                          {displayedWorks.map((w: any) => {
                            const isDone = (w.status || '').toLowerCase().includes('completed')
                            return (
                              <tr key={w.workId || w.work_id} className="hover:bg-[var(--surface-alt)]/50 transition">
                                <td className="p-3 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">
                                  #{formatNum(w.workId || w.work_id)}
                                </td>
                                <td className="p-3 text-[var(--text-secondary)] leading-relaxed min-w-[260px] max-w-sm break-words whitespace-normal" title={w.work_description || w.workDescription || w.description}>
                                  {w.work_description || w.workDescription || w.description || 'Civil Works Project'}
                                </td>
                                <td className="p-3 font-medium text-[var(--text-primary)] whitespace-nowrap">
                                  {w.district || summary.constituency}
                                </td>
                                <td className="p-3 font-extrabold tabular-nums numeral-gold whitespace-nowrap text-right">
                                  ₹{formatNum(((w.sanctionedCost || w.cost || 0) / 100000).toFixed(2))} {t('unit.lakh')}
                                </td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-bold inline-block whitespace-nowrap ${
                                      isDone
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                    }`}
                                  >
                                    {isDone ? t('status.completed') : t('status.in_progress')}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </div>
      )}

      {/* TAB 2: SPENDING BREAKDOWN */}
      {activeTab === 'spending' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="lux-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-2">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">
                {t('mp.delivery_metrics')}
              </h3>
              {(() => {
                const tot = completedWorks + ongoingWorks
                const compPct = tot > 0 ? ((completedWorks / tot) * 100).toFixed(1) : '0.0'
                return (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tabular-nums">
                    {formatNum(compPct)}% {t('chart.delivered')}
                  </span>
                )
              })()}
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                <span className="text-xs text-[var(--text-secondary)] block font-medium">{t('chart.completed_certified')}</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatNum(completedWorks)}</span>
                {(() => {
                  const tot = completedWorks + ongoingWorks
                  const compPct = tot > 0 ? ((completedWorks / tot) * 100).toFixed(1) : '0.0'
                  return (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">
                      {formatNum(compPct)}% {t('mp.of_total')}
                    </span>
                  )
                })()}
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                <span className="text-xs text-[var(--text-secondary)] block font-medium">{t('chart.active_in_queue')}</span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{formatNum(ongoingWorks)}</span>
                {(() => {
                  const tot = completedWorks + ongoingWorks
                  const pendPct = tot > 0 ? ((ongoingWorks / tot) * 100).toFixed(1) : '0.0'
                  return (
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block mt-0.5">
                      {formatNum(pendPct)}% {t('mp.of_total')}
                    </span>
                  )
                })()}
              </div>
            </div>

            {/* Visual Delivery Track */}
            {(() => {
              const tot = completedWorks + ongoingWorks
              const compPct = tot > 0 ? ((completedWorks / tot) * 100).toFixed(1) : '0.0'
              const pendPct = tot > 0 ? ((ongoingWorks / tot) * 100).toFixed(1) : '0.0'
              return (
                <div className="pt-1 space-y-1">
                  <div className="w-full h-2 rounded-full bg-[var(--surface-primary)] border border-[var(--border-primary)] overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${compPct}%` }}
                      title={`${t('chart.completed_certified')}: ${formatNum(completedWorks)} (${formatNum(compPct)}%)`}
                    />
                    <div
                      className="h-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${pendPct}%` }}
                      title={`${t('chart.active_in_queue')}: ${formatNum(ongoingWorks)} (${formatNum(pendPct)}%)`}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-[var(--text-tertiary)] font-semibold">
                    <span>{formatNum(tot)} {t('table.total_works')}</span>
                    <span>{t('mp.target_delivery')}</span>
                  </div>
                </div>
              )
            })()}
          </div>

          <div className="lux-card p-5 space-y-4">
            <h3 className="font-bold text-sm text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-2">
              {t('mp.primary_sectors')}
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 rounded bg-[var(--surface-alt)]">
                <span>{translateSector('Roads & Pathways', lang)}</span>
                <strong className="text-[var(--text-primary)]">{formatNum(42)}% {t('mp.of_allocation')}</strong>
              </div>
              <div className="flex justify-between p-2 rounded bg-[var(--surface-alt)]">
                <span>{translateSector('Public Lighting & Energy', lang)}</span>
                <strong className="text-[var(--text-primary)]">{formatNum(24)}% {t('mp.of_allocation')}</strong>
              </div>
              <div className="flex justify-between p-2 rounded bg-[var(--surface-alt)]">
                <span>{translateSector('School & College Classrooms', lang)}</span>
                <strong className="text-[var(--text-primary)]">{formatNum(18)}% {t('mp.of_allocation')}</strong>
              </div>
              <div className="flex justify-between p-2 rounded bg-[var(--surface-alt)]">
                <span>{translateSector('Community Centers & Halls', lang)}</span>
                <strong className="text-[var(--text-primary)]">{formatNum(16)}% {t('mp.of_allocation')}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FLAGS */}
      {effectiveTab === 'flags' && user.role !== 'viewer' && (
        <div className="space-y-4">
          {flags.length === 0 ? (
            <EmptyState
              title={t('mp.zero_compliance_alerts')}
              description={t('mp.compliant_cpwd')}
            />
          ) : (
            <div className="lux-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      <th className="p-3 font-bold whitespace-nowrap">{t('table.work_id')}</th>
                      <th className="p-3 font-bold min-w-[260px] max-w-sm">{t('table.description')}</th>
                      <th className="p-3 font-bold whitespace-nowrap text-right">{t('table.amount')}</th>
                      <th className="p-3 font-bold text-center whitespace-nowrap">{t('table.severity')}</th>
                      <th className="p-3 font-bold text-right whitespace-nowrap">
                        {user.role === 'viewer' ? 'Public Dossier' : t('table.action')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {flags.map((f: any) => (
                      <tr key={f.workId || f.work_id} className="hover:bg-[var(--surface-alt)]/50 transition">
                        <td className="p-3 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">
                          #{formatNum(f.workId || f.work_id)}
                        </td>
                        <td className="p-3 text-[var(--text-secondary)] leading-relaxed min-w-[260px] max-w-sm break-words whitespace-normal" title={f.work_description || f.workDescription || f.description}>
                          {f.work_description || f.workDescription || f.description || 'Civil Works Project'}
                        </td>
                        <td className="p-3 font-extrabold tabular-nums whitespace-nowrap text-right">
                          ₹{formatNum(((f.cost || f.sanctionedCost || 0) / 100000).toFixed(2))} {t('unit.lakh')}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <TierBadge tier={f.severity >= 0.7 ? 'critical' : 'high'} count={Number(f.severity?.toFixed(2) || 0)} size="sm" />
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedFlag(f)}
                            className="px-2.5 py-1 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 transition whitespace-nowrap cursor-pointer"
                          >
                            {user.role === 'viewer' ? 'View Findings' : t('btn.inspect_report')}
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

      {/* Flag Dossier Modal */}
      {selectedFlag && (
        <FlagDossierModal
          flag={selectedFlag}
          onClose={() => setSelectedFlag(null)}
        />
      )}
    </div>
  )
}
