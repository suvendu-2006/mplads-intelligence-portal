import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { FlagDossierModal, FlagDossierData } from '../components/FlagDossierModal'
import {
  StatCard,
  TierBadge,
  EmptyState,
  SectionCard
} from '../components/shared'
import {
  Building2,
  ShieldCheck,
  AlertTriangle,
  Lock,
  ArrowRight,
  CheckCircle2,
  FileText,
  MapPin,
  Users,
  Coins,
  Percent,
  Clock,
  Landmark,
  FileCheck
} from 'lucide-react'
import { apiFetch } from '../lib/api'
import { t } from '../lib/i18n'
import { fmtCrore } from '../lib/currency'

export const MyState: React.FC = () => {
  const { user, switchRole } = useStore()
  const [data, setData] = useState<any>(null)
  const [nationalMeta, setNationalMeta] = useState<any>(null)
  const [flags, setFlags] = useState<any[]>([])
  const [idas, setIdas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFlag, setSelectedFlag] = useState<FlagDossierData | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  const isAuthorized = ['state_nodal_officer', 'admin', 'mospi'].includes(user.role)

  useEffect(() => {
    fetch('/api/national')
      .then(r => r.json())
      .then(j => { if (j?.data) setNationalMeta(j.data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    async function loadMyState() {
      if (!isAuthorized) {
        setLoading(false)
        return
      }
      setLoading(true)
      const targetState = (!user.state || user.state === 'ALL' || user.state === 'ALL STATES & UNION TERRITORIES') ? 'BIHAR' : user.state
      try {
        let stateData: any = null
        try {
          const json = await apiFetch(`/api/my-state?state=${encodeURIComponent(targetState)}`)
          if (json?.data) stateData = json.data
        } catch (e) {
          console.warn('apiFetch /api/my-state failed, trying direct state endpoint:', e)
        }

        if (!stateData) {
          const res = await fetch(`/api/states/${encodeURIComponent(targetState)}`)
          if (res.ok) {
            const fallbackJson = await res.json()
            stateData = fallbackJson.data
          }
        }

        setData(stateData)

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
  }, [user.role, user.state, user.sessionToken])

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
          onClick={() => switchRole('state_nodal_officer', 'HIMACHAL PRADESH')}
          className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow hover:opacity-95 transition"
        >
          Switch to State Nodal Officer (Demo)
        </button>
      </div>
    )
  }

  if (loading) {
    return <LoadingSkeleton rows={6} height="h-32" />
  }

  const stateName = data?.state || user.state || 'HIMACHAL PRADESH'
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
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold">
            <Building2 size={20} />
          </div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>OFFICIAL STATE NODAL JURISDICTION</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {stateName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] font-bold text-[var(--text-secondary)]">
            Role: State Nodal Officer
          </span>
          <Link
            to={`/states/${encodeURIComponent(stateName)}`}
            className="text-xs px-3 py-1.5 rounded-xl bg-[var(--brand-primary)] text-white font-bold hover:opacity-90 transition"
          >
            Public View
          </Link>
        </div>
      </div>

      {/* National Mini KPIs (Context Only, 4 small cards) */}
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 px-1">
          National Scheme Context (Macro Baseline)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]">
            <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] block">National Corpus</span>
            <span className="text-base font-extrabold tabular-nums text-[var(--text-primary)]">
              ₹{fmtCrore(nationalMeta?.totalAllocated ?? 116819035627.53)} Cr
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]">
            <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] block">National Disbursed</span>
            <span className="text-base font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
              ₹{fmtCrore(nationalMeta?.totalExpenditure ?? 39642944289.14)} Cr
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]">
            <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] block">National Realization</span>
            <span className="text-base font-extrabold tabular-nums text-[var(--text-primary)]">
              {nationalMeta?.utilizationPercentage != null ? `${nationalMeta.utilizationPercentage.toFixed(1)}%` : '33.9%'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)]">
            <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] block">Total Monitored MPs</span>
            <span className="text-base font-extrabold tabular-nums text-[var(--text-primary)]">
              {nationalMeta?.totalMPs ?? 774}
            </span>
          </div>
        </div>
      </div>

      {/* State Focus (4 KPIs, large) */}
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 px-1">
          State Operational Outlay ({stateName})
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Landmark}
            label="State Sanctioned"
            value={allocCr}
            prefix="₹"
            unit="Cr"
            theme="gold"
            description="Total state envelope"
          />
          <StatCard
            icon={Coins}
            label="Used / Disbursed"
            value={expCr}
            prefix="₹"
            unit="Cr"
            theme="gold"
            description="Funds released to IDAs"
          />
          <StatCard
            icon={Percent}
            label="Utilization Velocity"
            value={util}
            unit="%"
            theme="emerald"
            gaugeValue={util}
            description="Tranche absorption rate"
          />
          <StatCard
            icon={Clock}
            label="Unspent Payment Gap"
            value={paymentGap}
            unit="%"
            theme="amber"
            description="Committed balance in queue"
          />
        </div>
      </div>

      {/* District Performance Table (All Districts, No Pagination) */}
      <SectionCard
        title="District Performance & Liability Ledger"
        subtitle={`Complete census across all ${districts.length} administrative districts in ${stateName}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                <th className="p-3 font-bold whitespace-nowrap">District Name</th>
                <th className="p-3 font-bold whitespace-nowrap text-right">Amount Allocated</th>
                <th className="p-3 font-bold whitespace-nowrap text-right">Amount Spent</th>
                <th className="p-3 font-bold whitespace-nowrap text-center">Total Works</th>
                <th className="p-3 font-bold whitespace-nowrap">Members of Parliament</th>
                <th className="p-3 font-bold text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {districts.map((d: any) => {
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

                return (
                  <tr key={distName} className="hover:bg-[var(--surface-alt)]/50 transition">
                    <td className="p-3 font-bold text-[var(--text-primary)] whitespace-nowrap">
                      {distName}
                    </td>
                    <td className="p-3 font-black tabular-nums text-[var(--brand-primary)] dark:text-blue-400 whitespace-nowrap text-right">
                      ₹{allocatedCr} Cr
                    </td>
                    <td className="p-3 font-black tabular-nums text-[var(--gold-text)] whitespace-nowrap text-right">
                      ₹{spentCr} Cr
                    </td>
                    <td className="p-3 text-[var(--text-secondary)] font-medium whitespace-nowrap text-center">
                      {totWorks} works
                    </td>
                    <td className="p-3 text-[var(--text-secondary)] font-semibold whitespace-nowrap">
                      {mpCount} {mpCount === 1 ? 'MP' : 'MPs'}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Link
                        to={`/districts/${encodeURIComponent(distName)}`}
                        className="px-2.5 py-1 rounded bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] font-bold text-[var(--brand-primary)] border border-[var(--border-primary)] whitespace-nowrap inline-block"
                      >
                        Explore
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Elevated IDA Entity Risks (Top High-Risk Districts) */}
      {idas.length > 0 && (
        <SectionCard
          title="Implementing Development Agency (IDA) Risk Profiles"
          subtitle="Top agencies and contractors operating in the state flagged for cost deviation or high concentration"
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
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                  <th className="p-3 font-bold whitespace-nowrap">Work ID</th>
                  <th className="p-3 font-bold min-w-[260px] max-w-sm">Description</th>
                  <th className="p-3 font-bold whitespace-nowrap text-right">Cost (₹)</th>
                  <th className="p-3 font-bold whitespace-nowrap min-w-[180px]">Triggered Detector</th>
                  <th className="p-3 font-bold text-right whitespace-nowrap">Administrative Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {flags.slice(0, 6).map((f: any) => (
                  <tr key={f.workId || f.work_id} className="hover:bg-[var(--surface-alt)]/50 transition">
                    <td className="p-3 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">
                      #{f.workId || f.work_id}
                    </td>
                    <td className="p-3 text-[var(--text-secondary)] leading-relaxed min-w-[260px] max-w-sm break-words whitespace-normal" title={f.work_description || f.workDescription || f.description}>
                      {f.work_description || f.workDescription || f.description || 'Civil Works Project'}
                    </td>
                    <td className="p-3 font-extrabold tabular-nums text-[var(--text-primary)] whitespace-nowrap text-right">
                      ₹{((f.cost || f.sanctionedCost || 0) / 100000).toFixed(2)} L
                    </td>
                    <td className="p-3 whitespace-nowrap min-w-[180px]">
                      <span className="px-2.5 py-1 rounded bg-[var(--surface-alt)] font-semibold text-[11px] border border-[var(--border-primary)] inline-block whitespace-nowrap">
                        {f.detector_name || f.detectorName || f.detector || 'Forensic Flag'}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedFlag(f)}
                        className="px-2.5 py-1 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 transition whitespace-nowrap"
                      >
                        Action Report
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
      {actionNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="lux-card max-w-md w-full p-6 relative shadow-2xl">
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
                className="px-4 py-1.5 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow"
              >
                {t('btn.close')}
              </button>
            </div>
          </div>
        </div>
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
