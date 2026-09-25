import React, { useEffect, useState } from 'react'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { FlagDossierModal, FlagDossierData } from '../components/FlagDossierModal'
import { BackButton } from '../components/BackButton'
import { TierBadge, EmptyState, SectionCard, AgencyBadge } from '../components/shared'
import { useStore } from '../store/useStore'
import {
  ShieldAlert,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Building2,
  X
} from 'lucide-react'
import { useTranslation, translateState } from '../lib/i18n'
import { useToastStore } from '../store/useToastStore'

const ALL_STATES_LIST = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
]

export const AuditDesk: React.FC = () => {
  const { user } = useStore()
  const { t, formatNum, toNativeDigits, lang } = useTranslation()
  const { showToast } = useToastStore()
  const isStateNodal = user.role === 'state_nodal_officer' && user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES'
  const initialRoleState = isStateNodal ? user.state : ''
  const [flags, setFlags] = useState<any[]>(() => {
    try {
      const saved = sessionStorage.getItem('cached_audit_flags_1')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem('cached_audit_flags_1')
    } catch { return true }
  })
  const [selectedFlag, setSelectedFlag] = useState<FlagDossierData | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stateFilter, setStateFilter] = useState(initialRoleState)
  const [prevUserStateKey, setPrevUserStateKey] = useState(() => `${user.role}:${user.state}`)
  const [tierFilter, setTierFilter] = useState('')
  const [agencyFilter, setAgencyFilter] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  // Debounce search input by 250ms to prevent request flood
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
    }, 250)
    return () => clearTimeout(handler)
  }, [search])

  // Sync stateFilter during render if user role/state changes
  const currentUserStateKey = `${user.role}:${user.state}`
  if (currentUserStateKey !== prevUserStateKey) {
    setPrevUserStateKey(currentUserStateKey)
    setStateFilter(initialRoleState)
  }

  // Available entity risks
  const [entityTab, setEntityTab] = useState<'ida' | 'mp'>('ida')
  const [idaRisks, setIdaRisks] = useState<any[]>([])
  const [mpRisks, setMpRisks] = useState<any[]>([])

  useEffect(() => {
    async function loadRisks() {
      try {
        const stateParam = stateFilter && stateFilter !== 'ALL' ? `&state=${encodeURIComponent(stateFilter)}` : ''
        const [resIda, resMp] = await Promise.all([
          fetch(`/api/entity-risks?entity_type=ida&page=1&page_size=12${stateParam}`),
          fetch(`/api/entity-risks?entity_type=mp&page=1&page_size=12${stateParam}`)
        ])
        if (resIda.ok) {
          const jsonIda = await resIda.json()
          setIdaRisks(jsonIda.data || [])
        }
        if (resMp.ok) {
          const jsonMp = await resMp.json()
          setMpRisks(jsonMp.data || [])
        }
      } catch (err) {
        console.error('Failed to load entity risks:', err)
      }
    }
    loadRisks()
  }, [stateFilter])

  useEffect(() => {
    async function fetchFlags() {
      sessionStorage.removeItem('cached_audit_flags_1')
      if (!sessionStorage.getItem('cached_audit_flags_v2_1') || debouncedSearch || tierFilter || stateFilter || agencyFilter) {
        setLoading(true)
      }
      try {
        const params = new URLSearchParams({
          page: String(page),
          page_size: '50',
        })
        if (debouncedSearch) params.set('q', debouncedSearch)
        if (stateFilter && stateFilter !== 'ALL' && stateFilter !== 'ALL STATES & UNION TERRITORIES') {
          params.set('state', stateFilter)
        }
        if (tierFilter) params.set('tier', tierFilter)
        if (agencyFilter) params.set('agency', agencyFilter)

        const res = await fetch(`/api/flags?${params.toString()}`)
        if (res.ok) {
          const json = await res.json()
          setFlags(json.data || [])
          setMeta(json.meta)
          if (page === 1 && !debouncedSearch && !tierFilter && !agencyFilter && (!stateFilter || stateFilter === 'ALL' || stateFilter === 'ALL STATES & UNION TERRITORIES')) {
            try { sessionStorage.setItem('cached_audit_flags_v2_1', JSON.stringify(json.data || [])) } catch {}
          }
        }
      } catch (err) {
        console.error('Failed to load audit flags:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchFlags()
  }, [page, debouncedSearch, stateFilter, tierFilter, agencyFilter])

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (stateFilter && stateFilter !== 'ALL' && stateFilter !== 'ALL STATES & UNION TERRITORIES') {
        params.append('state', stateFilter)
      }
      if (tierFilter) params.append('tier', tierFilter)
      if (agencyFilter) params.append('agency', agencyFilter)
      const url = params.toString() ? `/api/flags/export?${params.toString()}` : '/api/flags/export'

      const res = await fetch(url)
      if (res.ok) {
        const blob = await res.blob()
        const downloadUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = `MPLADS_Forensic_Flags_${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(a)
        a.click()
        a.remove()
        showToast('Forensic audit flags CSV successfully exported', 'success', 4000, 'Audit Export')
      }
    } catch (err) {
      console.error('CSV Export failed:', err)
      showToast('CSV Export encountered an issue', 'error', 4000, 'Export Failed')
    } finally {
      setExporting(false)
    }
  }

  const totalPages = meta?.total_pages || Math.ceil((meta?.total || 100) / 50)

  if (user.role === 'viewer') {
    return (
      <div className="lux-card p-10 max-w-lg mx-auto text-center my-12 space-y-4 animate-in fade-in">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
          <ShieldAlert size={26} />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Administrative & Vigilance Access Required
        </h2>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          The Statutory Audit Desk and anomaly surveillance records are reserved for designated auditing authorities, State Nodal Officers, and District Authorities.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 8B. Header & Export */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <BackButton fallback="/" className="mt-1" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                <ShieldAlert size={16} />
                <span>{t('audit.workbench')}</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {t('audit.title')}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
              {t('audit.subtitle')}
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-xs font-bold text-[var(--text-primary)] transition shadow-sm shrink-0 disabled:opacity-50"
        >
          <Download size={14} className="text-[var(--brand-primary)]" />
          <span>{exporting ? t('audit.generating_csv') : t('btn.export_csv')}</span>
        </button>
      </div>

      {/* Filter Toolbar (Chips UI) */}
      <div className="lux-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('')
                  setPage(1)
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* State Jurisdiction Filter */}
          <select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value)
              setPage(1)
            }}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold outline-none transition cursor-pointer ${
              stateFilter
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
                : 'bg-[var(--surface-alt)] border-[var(--border-primary)] text-[var(--text-primary)]'
            }`}
          >
            <option value="">{t('audit.all_states_national')}</option>
            {ALL_STATES_LIST.map((st) => (
              <option key={st} value={st}>
                {translateState(st, lang)}
              </option>
            ))}
          </select>

          {/* Agency Filter */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Building2 className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={t('audit.filter_agency')}
              value={agencyFilter}
              onChange={(e) => {
                setAgencyFilter(e.target.value)
                setPage(1)
              }}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
            />
          </div>

          {/* State Nodal Active Indicator */}
          {user.role === 'state_nodal_officer' && stateFilter && (
            <span className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-extrabold flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t('audit.jurisdiction')}: {translateState(stateFilter, lang)}</span>
            </span>
          )}

          {/* Clear Filters */}
          {(search || tierFilter || agencyFilter || (stateFilter && stateFilter !== initialRoleState)) && (
            <button
              onClick={() => {
                setSearch('')
                setTierFilter('')
                setAgencyFilter('')
                setStateFilter(initialRoleState)
                setPage(1)
              }}
              className="text-xs font-bold text-rose-500 hover:underline px-2"
            >
              {t('common.reset_filters')}
            </button>
          )}
        </div>

        {/* Tier Filter Chips */}
        <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-primary)]">
          <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
            {t('filter.priority')}:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: '', label: t('audit.all_priority') },
              { id: 'red', label: t('audit.immediate_action') },
              { id: 'orange', label: t('audit.priority_review') },
              { id: 'yellow', label: t('audit.standard_check') }
            ].map((tier) => (
              <button
                key={tier.id}
                onClick={() => {
                  setTierFilter(tier.id)
                  setPage(1)
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                  tierFilter === tier.id
                    ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                    : 'bg-[var(--surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
                }`}
              >
                {tier.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Flag Table (50/page) */}
      {loading ? (
        <LoadingSkeleton rows={8} height="h-28" />
      ) : flags.length === 0 ? (
        <EmptyState
          title={t('audit.no_anomalies_title')}
          description={t('audit.no_anomalies_desc')}
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
                  <th className="p-3 font-bold w-32 sm:w-36 text-right shrink-0">{user.role === 'viewer' ? 'Public Dossier' : t('table.action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {flags.map((flag: any) => (
                  <tr
                    key={flag.workId || flag.work_id}
                    className="hover:bg-[var(--surface-alt)]/50 transition-colors duration-100 cursor-pointer"
                    onClick={() => setSelectedFlag(flag)}
                  >
                    <td className="p-3 font-mono font-bold text-[var(--text-primary)]">
                      #{toNativeDigits(flag.workId || flag.work_id)}
                    </td>
                    <td className="p-3 text-[var(--text-secondary)] leading-relaxed" title={flag.work_description || flag.workDescription || flag.description}>
                      <div className="font-medium text-[var(--text-primary)] line-clamp-2">
                        {flag.work_description || flag.workDescription || flag.description || 'Civil Works Project'}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-[var(--text-primary)] break-words leading-snug" title={flag.district || 'Statewide'}>
                        {flag.district || 'Statewide'}
                      </div>
                      <div className="text-[11px] text-[var(--text-tertiary)] break-words leading-snug" title={translateState(flag.state, lang)}>
                        {translateState(flag.state, lang)}
                      </div>
                    </td>
                    <td className="p-3">
                      <AgencyBadge
                        agency={flag.implementingAgency || flag.implementing_agency || 'District Authority'}
                        variant={flag.severity >= 0.7 ? 'critical' : flag.severity >= 0.4 ? 'warning' : 'default'}
                        size="sm"
                        className="max-w-full"
                      />
                    </td>
                    <td className="p-3 font-extrabold tabular-nums text-[var(--text-primary)] text-right">
                      ₹{formatNum(((flag.cost || flag.sanctionedCost || 0) / 100000).toFixed(2))} {t('unit.lakh')}
                    </td>
                    <td className="p-3 text-center">
                      <TierBadge
                        tier={flag.severity >= 0.7 ? 'critical' : flag.severity >= 0.4 ? 'high' : 'medium'}
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
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white font-bold hover:opacity-90 transition shadow-sm text-xs whitespace-nowrap cursor-pointer"
                      >
                        {user.role === 'viewer' ? 'View Findings' : t('btn.inspect_report')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div>
              <div className="mx-4 mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 text-center font-medium">
                Showing {flags.length} of {meta?.total_records || 0} flags on this page. Use filters to narrow forensic search.
              </div>
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="text-xs text-[var(--text-secondary)]">
                  Page <strong className="text-[var(--text-primary)]">{page}</strong> of{' '}
                  <strong className="text-[var(--text-primary)]">{totalPages}</strong> ({meta?.total_records || 0} Total Flags)
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    aria-label="Previous page"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-bold px-2 tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    aria-label="Next page"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] text-xs font-bold disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Entity Risks Workbench (Tabs: IDAs | MPs) */}
      <SectionCard
        title={t('audit.watchlist_title')}
        subtitle={t('audit.watchlist_subtitle')}
        action={
          <div className="flex items-center rounded-lg bg-[var(--surface-alt)] p-0.5 border border-[var(--border-primary)] text-xs font-bold">
            <button
              onClick={() => setEntityTab('ida')}
              className={`px-3 py-1 rounded-md text-xs transition ${
                entityTab === 'ida'
                  ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('audit.idas_contractors')} ({formatNum(idaRisks.length)})
            </button>
            <button
              onClick={() => setEntityTab('mp')}
              className={`px-3 py-1 rounded-md text-xs transition ${
                entityTab === 'mp'
                  ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('audit.mp_portfolios')} ({formatNum(mpRisks.length)})
            </button>
          </div>
        }
      >
        {(entityTab === 'ida' ? idaRisks : mpRisks).length === 0 ? (
          <EmptyState
            title={`No ${entityTab === 'ida' ? 'IDAs' : 'MP portfolios'} flagged in ${stateFilter || 'records'}`}
            description="No implementing entities exceed risk screening thresholds under the current filter."
            action={
              stateFilter ? (
                <button
                  onClick={() => setStateFilter('')}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs font-bold text-[var(--brand-primary)]"
                >
                  {t('audit.pan_india_matrix')}
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(entityTab === 'ida' ? idaRisks : mpRisks).map((entity: any) => {
              const score = entity.composite_risk_score ?? entity.composite_risk ?? 0
              const tier = entity.risk_tier || (score >= 15 ? 'critical' : score >= 10 ? 'high' : 'medium')

              const displayName = entity.entity_name || entity.entity_key || entity.name || 'Implementing Entity'
              const locText = entity.district
                ? `${entity.district}${entity.state ? `, ${entity.state}` : ''}`
                : entity.state || (stateFilter ? stateFilter : 'National Ledger')

              const concPct = Math.round(Number(entity.concentration_score ?? 0.5) * 100)
              const velocPct = Math.round(Number(entity.velocity_score ?? 0.5) * 100)
              const patternPct = Math.round(Number(entity.pattern_score ?? 0.5) * 100)

              return (
              <div
                key={entity.entity_id || entity.entity_key || entity.entity_name || entity.name}
                className="lux-card card-content-opt p-4 flex flex-col justify-between border-l-4"
                style={{
                  borderLeftColor: score >= 15 ? 'var(--danger)' : score >= 10 ? 'var(--warning)' : 'var(--success)'
                }}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)] line-clamp-1">
                        {displayName}
                      </h4>
                      <span className="text-[10px] text-[var(--brand-primary)] uppercase font-extrabold flex items-center gap-1 mt-0.5">
                        <MapPin size={10} />
                        <span>{locText}</span>
                      </span>
                    </div>
                    <TierBadge tier={tier} size="sm" />
                  </div>

                  <div className="my-2 p-2.5 rounded-lg bg-[var(--surface-alt)] flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">{t('audit.overall_risk')}</span>
                    <span className="text-sm font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
                      {score > 0 ? `${formatNum(score.toFixed(1))} / ${formatNum('20.0')}` : '—'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[9px] text-center pt-2 border-t border-[var(--border-primary)] mt-2">
                  <div className="p-1.5 rounded bg-[var(--surface-alt)]">
                    <span className="text-[var(--text-tertiary)] block font-bold text-[8px] uppercase tracking-wider">{t('audit.monopoly_share')}</span>
                    <span className="font-extrabold text-[var(--text-primary)] text-[11px] tabular-nums">
                      {formatNum(concPct)}%
                    </span>
                  </div>
                  <div className="p-1.5 rounded bg-[var(--surface-alt)]">
                    <span className="text-[var(--text-tertiary)] block font-bold text-[8px] uppercase tracking-wider">{t('audit.march_rush')}</span>
                    <span className="font-extrabold text-[var(--text-primary)] text-[11px] tabular-nums">
                      {formatNum(velocPct)}%
                    </span>
                  </div>
                  <div className="p-1.5 rounded bg-[var(--surface-alt)]">
                    <span className="text-[var(--text-tertiary)] block font-bold text-[8px] uppercase tracking-wider">{t('audit.bill_anomaly')}</span>
                    <span className="font-extrabold text-[var(--text-primary)] text-[11px] tabular-nums">
                      {formatNum(patternPct)}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
          </div>
        )}
      </SectionCard>

      {/* Flag Diagnostic Report Drawer */}
      {selectedFlag && (
        <FlagDossierModal
          flag={selectedFlag}
          onClose={() => setSelectedFlag(null)}
        />
      )}
    </div>
  )
}
