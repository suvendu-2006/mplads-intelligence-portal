import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
  Users,
  FileCheck2,
  AlertTriangle,
  Lock,
  ArrowRight,
  CheckCircle2,
  Clock,
  Landmark,
  Coins,
  Percent,
  FileText,
  Upload,
  ShieldAlert,
  X
} from 'lucide-react'
import { t } from '../lib/i18n'

export const DistrictDashboard: React.FC = () => {
  const { user, switchRole } = useStore()
  const { district } = useParams<{ district?: string }>()
  const districtName = district || (user.district && user.district !== 'ALL' && user.district !== 'ALL DISTRICTS' ? user.district : 'SHIMLA')
  const isAuthorized = ['district_authority', 'state_nodal_officer', 'admin', 'mospi'].includes(user.role)

  const [data, setData] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem(`cached_district_${districtName}`)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem(`cached_district_${districtName}`)
    } catch { return true }
  })
  const [activeTab, setActiveTab] = useState<'works' | 'mps' | 'idas' | 'compliance'>('works')
  const [selectedFlag, setSelectedFlag] = useState<FlagDossierData | null>(null)
  const [complianceToast, setComplianceToast] = useState<string | null>(null)
  const [selectedMBWork, setSelectedMBWork] = useState<any | null>(null)
  const [verifiedMBWorks, setVerifiedMBWorks] = useState<number[]>([])

  const certifyMB = (workId: number) => {
    setVerifiedMBWorks((prev) => [...prev, workId])
    handleAction(`✓ Measurement Book (MB) physically verified & certified for Work #${workId}`)
    setSelectedMBWork(null)
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    async function loadDistrict() {
      if (!sessionStorage.getItem(`cached_district_${districtName}`)) {
        setLoading(true)
      }
      try {
        const res = await fetch(`/api/districts/${encodeURIComponent(districtName)}`)
        if (res.ok) {
          const json = await res.json()
          setData(json.data)
          try { sessionStorage.setItem(`cached_district_${districtName}`, JSON.stringify(json.data)) } catch {}
        }
      } catch (err) {
        console.error('Failed to load district report:', err)
      } finally {
        setLoading(false)
      }
    }
    loadDistrict()
  }, [district, districtName])

  useEffect(() => {
    if (!isAuthorized && activeTab === 'compliance') {
      setActiveTab('works')
    }
  }, [isAuthorized, activeTab])

  if (!isAuthorized && !district) {
    return (
      <div className="lux-card p-10 max-w-lg mx-auto text-center my-12 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
          <Lock size={26} />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          District Collectorate Access Required
        </h2>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          The District Authority Command Console is reserved for District Magistrates, Collectors, and District Planning Officers (DPO).
        </p>
        <button
          onClick={() => switchRole('district_authority', 'HIMACHAL PRADESH', 'SHIMLA')}
          className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow hover:opacity-95 transition"
        >
          Switch to District Authority (Demo)
        </button>
      </div>
    )
  }

  if (loading) {
    return <LoadingSkeleton rows={6} height="h-32" />
  }

  const summary = data?.summary || {}
  const works = data?.works || []
  const anomalies = data?.anomalies || []
  const idas = data?.idas || []
  const mpsList = data?.mps || []

  const portfolioCr = Math.round((summary.portfolioValue || 0) / 10000000)
  const completionRate = summary.completionRate || 0
  const totalWorks = summary.totalWorks || works.length || 0
  const completedCount = summary.completedWorks || 0
  const pendingCount = Math.max(0, totalWorks - completedCount)

  const activeMpsList = summary.activeMps ? summary.activeMps.split(',').map((s: string) => s.trim()) : []

  const handleAction = (msg: string) => {
    setComplianceToast(msg)
    setTimeout(() => setComplianceToast(null), 3500)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Official District Collectorate Header */}
      <div className="rounded-2xl p-5 bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center font-bold shrink-0">
            <Building2 size={22} />
          </div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-primary)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>OFFICIAL DISTRICT COLLECTORATE CONSOLE</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {districtName}, {summary.state || user.state || 'India'}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Constituency: <strong className="text-[var(--text-primary)]">{summary.constituencies || districtName}</strong> &bull; {activeMpsList.length} Linked Members of Parliament
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] font-bold text-[var(--text-secondary)]">
            {user.role === 'district_authority' ? 'Role: District Authority (DM)' : 'Scope: Public Transparency View'}
          </span>
          {user.role !== 'district_authority' && (
            <Link
              to={`/states/${encodeURIComponent(summary.state || 'HIMACHAL PRADESH')}`}
              className="text-xs px-3 py-1.5 rounded-xl bg-[var(--brand-primary)] text-white font-bold hover:opacity-90 transition"
            >
              State Overview
            </Link>
          )}
        </div>
      </div>

      {/* Compliance Toast */}
      {complianceToast && (
        <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>{complianceToast}</span>
        </div>
      )}

      {/* 4-KPI Money Band (Real Data from backend) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Landmark}
          label="District Sanction Portfolio"
          value={portfolioCr}
          prefix="₹"
          unit="Cr"
          theme="gold"
          description="Cumulative sanctioned works value"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed Projects"
          value={completedCount}
          theme="emerald"
          description={`${completionRate.toFixed(1)}% realization rate`}
        />
        <StatCard
          icon={Percent}
          label="Execution Velocity"
          value={completionRate}
          unit="%"
          theme="emerald"
          gaugeValue={completionRate}
          description="Physical delivery ratio"
        />
        <StatCard
          icon={Clock}
          label="Works Under Execution"
          value={pendingCount}
          theme="amber"
          description="Active contractor tranches"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-primary)] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('works')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'works'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <FileCheck2 size={14} />
          <span>Sanctioned Works Ledger ({summary?.totalWorks ?? works.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('mps')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'mps'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Users size={14} />
          <span>MPs in District ({activeMpsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('idas')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'idas'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Building2 size={14} />
          <span>Executing Agencies / IDAs ({summary?.idaCount ?? idas.length})</span>
        </button>

        {isAuthorized && (
          <button
            onClick={() => setActiveTab('compliance')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'compliance'
                ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ShieldAlert size={14} className="text-amber-500" />
            <span>Vigilance & Verification ({summary?.anomalyCount ?? anomalies.length})</span>
          </button>
        )}
      </div>

      {/* TAB 1: WORKS LEDGER */}
      {activeTab === 'works' && (
        <div className="space-y-4">
          {works.length === 0 ? (
            <EmptyState
              title="No Works Registered in Central Ledger"
              description={`No individual civil works are currently recorded for district ${districtName}. Total aggregated summary count is ${totalWorks}.`}
            />
          ) : (
            <div className="lux-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      <th className="p-3 font-bold whitespace-nowrap">Work ID</th>
                      <th className="p-3 font-bold min-w-[260px] max-w-sm">Project Description</th>
                      <th className="p-3 font-bold whitespace-nowrap text-right">Sanction Cost</th>
                      <th className="p-3 font-bold whitespace-nowrap">Recommending MP</th>
                      <th className="p-3 font-bold whitespace-nowrap">Category</th>
                      <th className="p-3 font-bold whitespace-nowrap text-center">Status</th>
                      {isAuthorized && <th className="p-3 font-bold text-right whitespace-nowrap">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {works.map((w: any) => (
                      <tr key={w.workId} className="hover:bg-[var(--surface-alt)]/50 transition">
                        <td className="p-3 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">
                          #{w.workId}
                        </td>
                        <td className="p-3 text-[var(--text-secondary)] leading-relaxed min-w-[260px] max-w-sm break-words whitespace-normal" title={w.work_description || w.workDescription || w.description}>
                          {w.work_description || w.workDescription || w.description || 'Civil Works Project'}
                        </td>
                        <td className="p-3 font-extrabold tabular-nums numeral-gold whitespace-nowrap text-right">
                          ₹{(w.cost / 100000).toFixed(2)} L
                        </td>
                        <td className="p-3 font-medium text-[var(--text-primary)] whitespace-nowrap">
                          {w.mpName}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-[var(--surface-alt)] font-medium text-[11px] border border-[var(--border-primary)] inline-block whitespace-nowrap">
                            {w.category}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 inline-block whitespace-nowrap">
                            {w.status}
                          </span>
                        </td>
                        {isAuthorized && (
                          <td className="p-3 text-right whitespace-nowrap">
                            {verifiedMBWorks.includes(w.workId) ? (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] inline-flex items-center gap-1 whitespace-nowrap">
                                <CheckCircle2 size={13} />
                                <span>MB Certified</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => setSelectedMBWork(w)}
                                className="px-2.5 py-1 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-bold hover:bg-[var(--brand-primary)] hover:text-white transition shadow-sm whitespace-nowrap"
                              >
                                Verify MB
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-[var(--surface-alt)] border-t border-[var(--border-primary)] text-xs text-[var(--text-secondary)] flex justify-between items-center">
                <span>Showing {works.length} of {summary?.totalWorks ?? works.length} registered projects (Top-valued works by outlay)</span>
                <span className="text-[11px] font-medium text-[var(--text-tertiary)]">{summary?.scope || 'District Ledger'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MPS IN DISTRICT */}
      {activeTab === 'mps' && (
        <div className="space-y-4">
          <div className="text-xs text-[var(--text-secondary)]">
            Members of Parliament representing or allocating development tranches within {districtName}:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mpsList.length > 0 ? (
              mpsList.map((mp: any, idx: number) => {
                const targetUrl = mp.id ? `/mps/${mp.id}` : `/mps/${encodeURIComponent(mp.name)}`
                const constLabel = mp.constituency ? `${mp.constituency}${mp.house ? `, ${mp.house}` : ''}` : (summary.constituencies || districtName)
                return (
                  <div key={mp.id || idx} className="lux-card p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-center font-bold text-xs text-[var(--brand-primary)]">
                          MP
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[var(--text-primary)]">
                            {mp.name}
                          </h4>
                          <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold">
                            {constLabel}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs space-y-1.5 mb-3">
                        <div className="flex justify-between">
                          <span className="text-[var(--text-tertiary)]">District Allocations:</span>
                          <span className="font-bold text-[var(--text-primary)]">{mp.status || 'Active'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-tertiary)]">Sanction Status:</span>
                          <span className="font-bold text-emerald-600">Compliant</span>
                        </div>
                      </div>
                    </div>

                    <Link
                      to={targetUrl}
                      className="w-full py-1.5 px-3 rounded-lg bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-xs font-bold text-[var(--brand-primary)] border border-[var(--border-primary)] flex items-center justify-center gap-1 transition"
                    >
                      <span>View Parliamentary Record</span>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                )
              })
            ) : (
              activeMpsList.map((mpName: string, idx: number) => (
                <div key={idx} className="lux-card p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-center font-bold text-xs text-[var(--brand-primary)]">
                        MP
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          {mpName}
                        </h4>
                        <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold">
                          {summary.constituencies || districtName}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs space-y-1.5 mb-3">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">District Allocations:</span>
                        <span className="font-bold text-[var(--text-primary)]">Active</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">Sanction Status:</span>
                        <span className="font-bold text-emerald-600">Compliant</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/mps/${encodeURIComponent(mpName)}`}
                    className="w-full py-1.5 px-3 rounded-lg bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-xs font-bold text-[var(--brand-primary)] border border-[var(--border-primary)] flex items-center justify-center gap-1 transition"
                  >
                    <span>View Parliamentary Record</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: IDAs & CONTRACTORS */}
      {activeTab === 'idas' && (
        <div className="space-y-4">
          <div className="text-xs text-[var(--text-secondary)]">
            Implementing Development Agencies (IDAs) executing civil infrastructure in {districtName}:
          </div>

          {idas.length === 0 ? (
            <div className="lux-card p-6 text-center text-xs text-[var(--text-secondary)]">
              All agencies operating in {districtName} are currently within baseline variance tolerances.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {idas.map((ida: any) => (
                <div key={ida.entityId} className="lux-card p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-[var(--text-primary)] line-clamp-1">
                      {ida.name}
                    </h4>
                    <TierBadge tier={ida.riskTier} size="sm" />
                  </div>

                  <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Composite Risk</span>
                    <span className="font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
                      {ida.compositeRiskScore.toFixed(2)} / 20.0
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      handleAction(`Site inspection audit summons dispatched to ${ida.name}`)
                    }
                    className="w-full py-1.5 px-3 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 transition"
                  >
                    Summon Agency Inspection
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMPLIANCE & ANOMALIES */}
      {activeTab === 'compliance' && (
        <div className="space-y-4">
          {anomalies.length === 0 ? (
            <EmptyState
              title="Zero Compliance Alerts"
              description={`All verified works in ${districtName} are within statutory CPWD benchmark cost limits and single-bidder thresholds.`}
            />
          ) : (
            <div className="lux-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      <th className="p-3 font-bold whitespace-nowrap">Work ID</th>
                      <th className="p-3 font-bold min-w-[260px] max-w-sm">Description</th>
                      <th className="p-3 font-bold whitespace-nowrap text-right">Cost</th>
                      <th className="p-3 font-bold whitespace-nowrap min-w-[180px]">Triggered Model</th>
                      <th className="p-3 font-bold text-center whitespace-nowrap">Severity</th>
                      <th className="p-3 font-bold text-right whitespace-nowrap">Collectorate Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {anomalies.map((a: any) => (
                      <tr key={a.workId} className="hover:bg-[var(--surface-alt)]/50 transition">
                        <td className="p-3 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">
                          #{a.workId}
                        </td>
                        <td className="p-3 text-[var(--text-secondary)] leading-relaxed min-w-[260px] max-w-sm break-words whitespace-normal" title={a.work_description || a.workDescription || a.description}>
                          {a.work_description || a.workDescription || a.description || 'Civil Works Project'}
                        </td>
                        <td className="p-3 font-extrabold tabular-nums whitespace-nowrap text-right">
                          ₹{((a.cost || a.sanctionedCost || 0) / 100000).toFixed(2)} L
                        </td>
                        <td className="p-3 whitespace-nowrap min-w-[180px]">
                          <span className="px-2.5 py-1 rounded bg-[var(--surface-alt)] font-semibold text-[11px] border border-[var(--border-primary)] inline-block whitespace-nowrap">
                            {a.detector_name || a.detectorName || a.detector || 'Forensic Flag'}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <TierBadge tier={a.tier} count={Number(a.severity.toFixed(2))} size="sm" />
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedFlag(a)}
                            className="px-2.5 py-1 rounded-lg bg-[var(--brand-primary)] text-white font-bold text-xs hover:opacity-90 transition whitespace-nowrap"
                          >
                            Investigate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-[var(--surface-alt)] border-t border-[var(--border-primary)] text-xs text-[var(--text-secondary)] flex justify-between items-center">
                <span>Showing {anomalies.length} of {summary?.anomalyCount ?? anomalies.length} detected vigilance flags (Prioritized by risk severity)</span>
                <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Real-time Forensic Triage</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Measurement Book (MB) Verification Dialog */}
      {isAuthorized && selectedMBWork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in">
          <div className="lux-card max-w-xl w-full p-6 relative shadow-2xl space-y-4">
            <button
              onClick={() => setSelectedMBWork(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-[var(--surface-alt)]"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-[var(--border-primary)] pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-bold">
                <FileCheck2 size={22} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                  Statutory Physical Verification &bull; CPWD SOR
                </span>
                <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                  Measurement Book (MB) &bull; Work #{selectedMBWork.workId}
                </h3>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] space-y-2 text-xs">
              <div>
                <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold block">Full Project Description</span>
                <p className="font-semibold text-[var(--text-primary)] mt-0.5 leading-relaxed">
                  {selectedMBWork.work_description || selectedMBWork.workDescription || selectedMBWork.description || 'Public Infrastructure Development'}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--border-primary)]">
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block font-medium">Sanction Outlay</span>
                  <span className="font-extrabold text-[var(--text-primary)] tabular-nums">
                    ₹{((selectedMBWork.cost || 0) / 100000).toFixed(2)} Lakhs
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block font-medium">Sponsoring MP</span>
                  <span className="font-bold text-[var(--text-primary)] truncate block">
                    {selectedMBWork.mpName || 'Constituency MP'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block font-medium">Category</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {selectedMBWork.category || 'Civil Works'}
                  </span>
                </div>
              </div>
            </div>

            {/* Inspection Checklist */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Statutory Inspection Checkpoints
              </div>
              <div className="space-y-1.5">
                <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-between">
                  <span className="font-medium text-[var(--text-secondary)]">1. Geo-tagged Site Inspection (GPS Match)</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    <span>Verified 100%</span>
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-between">
                  <span className="font-medium text-[var(--text-secondary)]">2. Quantity Measurements (Bill of Quantities)</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    <span>Reconciled</span>
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border-primary)] flex items-center justify-between">
                  <span className="font-medium text-[var(--text-secondary)]">3. Executive Engineer Technical Sign-off</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    <span>Approved</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-primary)]">
              <button
                onClick={() => setSelectedMBWork(null)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-xs font-bold text-[var(--text-secondary)] transition"
              >
                Close
              </button>
              <button
                onClick={() => certifyMB(selectedMBWork.workId)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Certify MB & Record</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag Report Modal */}
      {selectedFlag && (
        <FlagDossierModal
          flag={selectedFlag}
          onClose={() => setSelectedFlag(null)}
        />
      )}
    </div>
  )
}
