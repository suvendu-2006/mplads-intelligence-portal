import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { FlagDossierModal, FlagDossierData } from '../components/FlagDossierModal'
import { BackButton } from '../components/BackButton'
import {
  StatCard,
  EmptyState,
  SectionCard
} from '../components/shared'
import {
  Building2,
  Lock,
  CheckCircle2,
  Coins,
  Percent,
  Clock,
  Landmark,
  Search,
  ArrowRight,
  RotateCcw,
  MapPin,
  TrendingUp,
  Users,
  Check,
  Eye
} from 'lucide-react'
import { apiFetch } from '../lib/api'
import { useTranslation, translateState } from '../lib/i18n'
import { fmtCrore } from '../lib/currency'
import { ALL_36_STATES_AND_UTS } from '../lib/constants'

export const MyState: React.FC = () => {
  const { user, switchRole } = useStore()
  const { t, toNativeDigits: formatNum, lang } = useTranslation()
  const navigate = useNavigate()
  const isAuthorized = Boolean(user.isAuthenticated && ['state_nodal_officer', 'admin', 'mospi'].includes(user.role))
  const hasSelectedState = Boolean(user.state && user.state !== 'ALL' && user.state !== 'ALL STATES & UNION TERRITORIES')
  const targetState = hasSelectedState ? user.state! : ''
  const [stateSearch, setStateSearch] = useState('')

  const [data, setData] = useState<any>(() => {
    try {
      if (!targetState) return null
      const saved = sessionStorage.getItem(`cached_my_state_${targetState}`)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [nationalMeta, setNationalMeta] = useState<any>(null)
  const [flags, setFlags] = useState<any[]>([])
  const [idas, setIdas] = useState<any[]>([])
  const [loading, setLoading] = useState(() => {
    try {
      if (!targetState) return false
      return !sessionStorage.getItem(`cached_my_state_${targetState}`)
    } catch { return false }
  })
  const [selectedFlag, setSelectedFlag] = useState<FlagDossierData | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/national')
      .then(r => r.json())
      .then(j => { if (j?.data) setNationalMeta(j.data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    async function loadMyState() {
      if (!isAuthorized || !hasSelectedState) {
        setLoading(false)
        return
      }
      let hasCached = false
      try {
        hasCached = Boolean(targetState && sessionStorage.getItem(`cached_my_state_${targetState}`))
      } catch {}
      if (!hasCached) {
        setLoading(true)
      }
      try {
        let stateData: any = null
        try {
          const json = await apiFetch(`/api/my-state?state=${encodeURIComponent(targetState)}`)
          if (json?.data) stateData = json.data
        } catch (e) {
          console.log('apiFetch /api/my-state failed, trying direct state endpoint:', e)
        }

        if (!stateData) {
          const res = await fetch(`/api/states/${encodeURIComponent(targetState)}`)
          if (res.ok) {
            const fallbackJson = await res.json()
            stateData = fallbackJson.data
          }
        }

        setData(stateData)
        try { sessionStorage.setItem(`cached_my_state_${targetState}`, JSON.stringify(stateData)) } catch {}

        const resolvedState = stateData?.state || targetState
        const [fRes, idaRes] = await Promise.all([
          fetch(`/api/states/${encodeURIComponent(resolvedState)}/flags?page=1&page_size=50`),
          fetch(`/api/entity-risks?entity_type=ida&state=${encodeURIComponent(resolvedState)}&page=1&page_size=20`)
        ])

        if (fRes.ok) {
          const fJson = await fRes.json()
          setFlags(fJson.data || [])
        }
        if (idaRes.ok) {
          const idaJson = await idaRes.json()
          setIdas(idaJson.data || [])
        }
      } catch (err) {
        console.error('Failed to load my-state:', err)
      } finally {
        setLoading(false)
      }
    }
    loadMyState()
  }, [isAuthorized, hasSelectedState, targetState, user.sessionToken])

  if (!isAuthorized) {
    return (
      <div className="lux-card p-10 max-w-lg mx-auto text-center my-12 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
          <Lock size={26} />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          State Nodal Authority Access Required
        </h2>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          The State Nodal Officer Command Center is restricted to designated state administrative secretaries and central oversight auditors.
        </p>
        <button
          onClick={() => navigate('/login?role=state_nodal_officer')}
          className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow hover:opacity-95 transition cursor-pointer"
        >
          Log In as State Nodal Authority (Autofilled)
        </button>
      </div>
    )
  }

  // JURISDICTION GATE: User must explicitly choose a state first! No default state!
  if (!hasSelectedState) {
    const filteredStates = ALL_36_STATES_AND_UTS.filter(s =>
      s !== 'ALL STATES & UNION TERRITORIES' &&
      s.toLowerCase().includes(stateSearch.toLowerCase().trim())
    )

    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-start">
          <BackButton fallback="/states" />
        </div>
        <div className="rounded-3xl p-6 sm:p-8 bg-[var(--surface-primary)] border-2 border-[var(--border-primary)] shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto shadow-sm">
            <Building2 size={28} />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <span>Sovereign State Surveillance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">
              Select State / UT Jurisdiction
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-lg mx-auto">
              Please choose a State or Union Territory below to access sovereign audit ledgers and district telemetry. No state is loaded by default.
            </p>
          </div>

          <div className="max-w-md mx-auto relative">
            <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search among 36 States & UTs..."
              value={stateSearch}
              onChange={(e) => setStateSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-emerald-500 font-medium transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredStates.map((st) => (
            <button
              key={st}
              onClick={async () => {
                await switchRole('state_nodal_officer', st)
              }}
              className="p-3.5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] hover:border-emerald-500 hover:bg-emerald-500/5 transition-colors duration-150 text-left flex items-center justify-between group cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-alt)] text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-150 flex items-center justify-center shrink-0">
                  <MapPin size={15} />
                </div>
                <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {st}
                </span>
              </div>
              <ArrowRight size={14} className="text-[var(--text-tertiary)] group-hover:text-emerald-500 group-hover:translate-x-1 transition-transform duration-150 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (loading) {
    return <LoadingSkeleton rows={6} height="h-32" />
  }

  const stateName = data?.state || user.state || ''
  const summary = data?.summary || {}
  const districts = data?.districts || []

  const allocCr = Math.round((summary.totalAllocated || 0) / 10000000)
  const expCr = Math.round((summary.totalExpenditure || 0) / 10000000)
  const util = Number(summary.utilizationPercentage ?? summary.utilizationRate ?? 0)
  const paymentGap = Math.max(0, 100 - util).toFixed(1)

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 8A. Banner: You are viewing your assigned state */}
      <div className="rounded-2xl p-4 sm:p-5 bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallback="/states" />
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold">
            <Building2 size={20} />
          </div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t('state_nodal.banner_title')}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {translateState(stateName, lang)}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] font-bold text-[var(--text-secondary)]">
            {t('state_nodal.role_badge')}
          </span>
          <Link
            to={`/states/${encodeURIComponent(stateName)}`}
            className="text-xs px-3.5 py-1.5 rounded-xl bg-[var(--brand-primary)] !text-white font-bold hover:opacity-90 shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            style={{ color: '#ffffff' }}
          >
            <Eye size={13} style={{ color: '#ffffff' }} />
            <span style={{ color: '#ffffff' }}>{t('state_nodal.public_view')}</span>
          </Link>
        </div>
      </div>

      {/* National Mini KPIs (Context Only, 4 small cards) */}
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 px-1">
          {t('macro.title')}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]">
            <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] block">{t('macro.corpus')}</span>
            <span className="text-base font-extrabold tabular-nums text-[var(--text-primary)]">
              ₹{formatNum(fmtCrore(nationalMeta?.totalAllocated ?? 116819035627.53))} {t('unit.cr')}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]">
            <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] block">{t('macro.disbursed')}</span>
            <span className="text-base font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
              ₹{formatNum(fmtCrore(nationalMeta?.totalExpenditure ?? 39642944289.14))} {t('unit.cr')}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]">
            <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] block">{t('macro.realization')}</span>
            <span className="text-base font-extrabold tabular-nums text-[var(--text-primary)]">
              {formatNum(nationalMeta?.utilizationPercentage != null ? nationalMeta.utilizationPercentage.toFixed(1) : '33.9')}%
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]">
            <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] block">{t('macro.monitored_mps')}</span>
            <span className="text-base font-extrabold tabular-nums text-[var(--text-primary)]">
              {formatNum(nationalMeta?.totalMPs ?? 788)}
            </span>
          </div>
        </div>
      </div>

      {/* State Focus (4 KPIs, large) */}
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 px-1">
          {t('state.operational_outlay')} ({translateState(stateName, lang)})
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Landmark}
            label="mps.fund_allocated"
            value={Number(allocCr)}
            prefix="₹"
            unit="Cr"
            theme="slate"
            description="kpi.total_central_sanction"
          />
          <StatCard
            icon={Coins}
            label="mps.disbursed"
            value={Number(expCr)}
            prefix="₹"
            unit="Cr"
            theme="slate"
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
            value={Number(paymentGap)}
            unit="%"
            theme="amber"
            description="kpi.pending_disbursement"
          />
        </div>
      </div>

      {/* District Performance & Liability Ledger (Card Grid Style) */}
      <SectionCard
        title={t('ledger.title')}
        subtitle={t('ledger.subtitle', { count: formatNum(districts.length), state: translateState(stateName, lang) })}
      >
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-2.5" />
              <input
                type="text"
                value={stateSearch}
                onChange={(e) => setStateSearch(e.target.value)}
                placeholder={t('district.filter_placeholder')}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            <div className="text-xs text-[var(--text-secondary)] font-medium">
              {t('common.showing_simple', {
                count: formatNum(districts.filter((d: any) => (d.district_nodal || d.districtNodal || d.district || '').toLowerCase().includes(stateSearch.toLowerCase().trim())).length),
                total: formatNum(districts.length)
              })}
            </div>
          </div>

          {districts.filter((d: any) => (d.district_nodal || d.districtNodal || d.district || '').toLowerCase().includes(stateSearch.toLowerCase().trim())).length === 0 ? (
            <EmptyState
              title={t('state.no_districts_match')}
              description={`No district matches "${stateSearch}".`}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {districts
                .filter((d: any) => (d.district_nodal || d.districtNodal || d.district || '').toLowerCase().includes(stateSearch.toLowerCase().trim()))
                .map((d: any, idx: number) => {
                  const distName = d.district_nodal || d.districtNodal || d.district || 'District'
                  const completionPct = Number(d.completion_rate_pct ?? d.completionRatePct ?? 0)
                  const totWorks = d.total_works ?? d.totalWorks ?? 0
                  const rawPort = d.portfolio_value ?? d.portfolioValue ?? d.totalExpenditure ?? 0
                  const allocatedVal = rawPort > 0 ? rawPort : (totWorks * 2500000.0)
                  const spentVal = d.expenditure ?? d.totalExpenditure ?? (allocatedVal * (completionPct / 100))
                  const allocatedCr = (allocatedVal / 10000000).toFixed(2)
                  const spentCr = (spentVal / 10000000).toFixed(2)
                  const activeMps = d.mps_active || d.activeMps || ''
                  const mpCount = d.mp_count ?? d.mpCount ?? (activeMps ? activeMps.split(',').filter(Boolean).length : 0)
                  const compW = d.completed_works_count ?? d.completedWorks ?? Math.round(totWorks * (completionPct / 100))
                  const expenditureRate = allocatedVal > 0 ? Number(((spentVal / allocatedVal) * 100).toFixed(1)) : completionPct

                  return (
                    <div
                      key={distName}
                      className="rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] p-5 sm:p-6 shadow-xs hover:border-[var(--brand-accent)] hover:shadow-md transition-colors duration-150 flex flex-col justify-between group"
                    >
                      <div>
                        {/* Header: District Name + MPs + Rank Badge */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              to={`/districts/${encodeURIComponent(distName)}`}
                              className="text-lg sm:text-xl font-bold font-sans text-[var(--text-primary)] tracking-tight hover:text-[var(--brand-primary)] transition truncate block"
                            >
                              {distName}
                            </Link>

                            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium mt-1">
                              <Users size={13} className="text-[var(--text-tertiary)]" />
                              <span>{formatNum(mpCount)} {mpCount === 1 ? t('unit.mp') : t('unit.mps')}</span>
                            </div>
                          </div>

                          {/* Rank Badge */}
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/60 shrink-0">
                            {t('label.rank')} #{formatNum(idx + 1)} / {formatNum(districts.length)}
                          </span>
                        </div>

                        {/* Two-Column Metrics: ALLOCATED vs RECORDED EXPENDITURE */}
                        <div className="mt-5 mb-4 grid grid-cols-2 gap-4">
                          <div className="flex flex-col">
                            <div className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-[var(--text-secondary)] h-8 flex items-end pb-0.5">
                              {t('kpi.allocated')}
                            </div>
                            <div className="text-base sm:text-lg font-black text-[var(--text-primary)] tabular-nums leading-snug">
                              ₹{formatNum(allocatedCr)} {t('unit.cr')}
                            </div>
                          </div>

                          <div className="flex flex-col">
                            <div className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-[var(--text-secondary)] h-8 flex items-end pb-0.5">
                              {t('kpi.used')}
                            </div>
                            <div className="text-base sm:text-lg font-black text-[var(--text-primary)] tabular-nums leading-snug">
                              ₹{formatNum(spentCr)} {t('unit.cr')}
                            </div>
                          </div>
                        </div>

                        {/* Expenditure Rate with TrendingUp icon + Uniform Progress Bar */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-[var(--text-secondary)]">{t('kpi.utilization')}</span>
                            <span className="font-bold flex items-center gap-0.5 tabular-nums text-rose-600 dark:text-rose-400">
                              <TrendingUp size={14} className="shrink-0" />
                              <span>{formatNum(expenditureRate.toFixed(1))}%</span>
                            </span>
                          </div>

                          <div className="w-full h-1.5 sm:h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-1.5">
                            <div
                              className="h-full rounded-full transition-[width] duration-500 ease-out bg-emerald-500"
                              style={{ width: `${Math.min(100, Math.max(3, expenditureRate))}%` }}
                            />
                          </div>
                        </div>

                        {/* Works Completed & Completion Rate */}
                        <div className="flex items-center justify-between py-3 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full border border-emerald-500 text-emerald-500 flex items-center justify-center shrink-0">
                              <Check size={11} strokeWidth={3} />
                            </div>
                            <div>
                              <div className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-tight tabular-nums">
                                {formatNum(compW.toLocaleString())}
                              </div>
                              <div className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-semibold leading-tight">
                                {t('kpi.completed')}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-semibold">
                              {t('kpi.completion_rate')}
                            </div>
                            <div className="text-sm sm:text-base font-bold text-sky-900 dark:text-sky-200 tabular-nums">
                              {formatNum(completionPct.toFixed(1))}%
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer Link */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 mt-1 text-center">
                        <Link
                          to={`/districts/${encodeURIComponent(distName)}`}
                          className="text-xs font-semibold text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 inline-flex items-center justify-center gap-1 group-hover:underline transition"
                        >
                          <span>{t('btn.show_details')}</span>
                          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Elevated IDA Entity Risks (Top High-Risk Districts) */}
      {idas.length > 0 && (
        <SectionCard
          title={t('state.ida_risk_title')}
          subtitle={t('state.ida_risk_subtitle')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {idas.slice(0, 3).map((ida: any) => {
              const score = ida.composite_risk_score ?? ida.composite_risk ?? 0
              const displayName = ida.entity_name || ida.entity_key || ida.name || 'District Development Agency'
              return (
                <div key={ida.entity_key || ida.entity_name || ida.name} className="lux-card p-5 border-l-4 border-l-rose-500">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">
                      {displayName}
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--surface-alt)] text-rose-500 border border-[var(--border-primary)]">
                      Critical Priority
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mb-3">
                    District: <strong className="text-[var(--text-primary)]">{ida.district || ida.entity_key || stateName}</strong>
                  </div>
                  <div className="p-2 rounded bg-[var(--surface-alt)] text-xs flex justify-between items-center mb-3">
                    <span className="text-[var(--text-secondary)]">Audit Risk Rating:</span>
                    <span className="font-extrabold text-rose-500 tabular-nums">{score > 0 ? `${score.toFixed(1)} / 20.0` : '—'}</span>
                  </div>
                  <button
                    onClick={() =>
                      setActionNotice(
                        `Formal Inquiry issued to District Magistrate for ${displayName} regarding high audit risk rating (${score.toFixed(1)}/20).`
                      )
                    }
                    className="w-full py-1.5 px-3 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 transition"
                  >
                    Dispatch Audit Notice
                  </button>
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {/* Works Under Review (Action Queue) */}
      <SectionCard
        title="Works Under Formal Review"
        subtitle="Flagged civil projects requiring Action-Taken Report (ATR) from District Collector"
      >
        {flags.length === 0 ? (
          <EmptyState
            title="All Works Audited"
            description="No works in this state currently require urgent administrative action."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                  <th className="p-3 font-bold w-20 shrink-0 whitespace-nowrap">Work ID</th>
                  <th className="p-3 font-bold min-w-[200px]">Description</th>
                  <th className="p-3 font-bold w-28 text-right shrink-0 whitespace-nowrap">Cost (₹)</th>
                  <th className="p-3 font-bold w-36 sm:w-44 text-right shrink-0 whitespace-nowrap">{user.role === 'viewer' ? 'Public Dossier' : 'Administrative Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {flags.slice(0, 6).map((f: any) => (
                  <tr key={f.workId || f.work_id} className="hover:bg-[var(--surface-alt)]/50 transition">
                    <td className="p-3 font-mono font-bold text-[var(--text-primary)]">
                      #{f.workId || f.work_id}
                    </td>
                    <td className="p-3 text-[var(--text-secondary)] leading-relaxed" title={f.work_description || f.workDescription || f.description}>
                      <div className="font-medium text-[var(--text-primary)] line-clamp-2">
                        {f.work_description || f.workDescription || f.description || 'Civil Works Project'}
                      </div>
                    </td>
                    <td className="p-3 font-extrabold tabular-nums text-[var(--text-primary)] whitespace-nowrap text-right">
                      ₹{((f.cost || f.sanctionedCost || 0) / 100000).toFixed(2)} L
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedFlag(f)}
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 transition whitespace-nowrap cursor-pointer"
                      >
                        {user.role === 'viewer' ? 'View Findings' : 'Action Report'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Action Notice Alert Modal */}
      {actionNotice && typeof document !== 'undefined' && createPortal(
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setActionNotice(null) }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
        >
          <div className="lux-card max-w-md w-full p-5 sm:p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 size={22} />
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">
              Action Recorded (Demo Mode)
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
              {actionNotice}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setActionNotice(null)}
                className="px-4 py-1.5 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow cursor-pointer"
              >
                {t('btn.close')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Flag Diagnostic Dossier Drawer */}
      {selectedFlag && (
        <FlagDossierModal
          flag={selectedFlag}
          onClose={() => setSelectedFlag(null)}
        />
      )}
    </div>
  )
}
