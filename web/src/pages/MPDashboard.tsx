import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { FlagDossierModal, FlagDossierData } from '../components/FlagDossierModal'
import {
  FundCard,
  StatCard,
  TierBadge,
  EmptyState,
  SectionCard
} from '../components/shared'
import {
  Landmark,
  FileCheck2,
  AlertTriangle,
  Lock,
  ArrowRight,
  CheckCircle2,
  Clock,
  Mail,
  Coins,
  Percent,
  Layers,
  ChevronRight,
  Building,
  FileText
} from 'lucide-react'
import { t } from '../lib/i18n'

export const MPDashboard: React.FC = () => {
  const { user, switchRole } = useStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'works' | 'spending' | 'flags' | 'action'>('works')
  const [selectedFlag, setSelectedFlag] = useState<FlagDossierData | null>(null)
  const [doLetterNotice, setDoLetterNotice] = useState<string | null>(null)

  const mpId = user.mpId || '6a932b5bcd944524379eddd9'
  const isAuthorized = ['mp', 'admin'].includes(user.role)

  useEffect(() => {
    async function loadMPDossier() {
      setLoading(true)
      try {
        const res = await fetch(`/api/mps/${mpId}`)
        if (res.ok) {
          const json = await res.json()
          setData(json.data)
        }
      } catch (err) {
        console.error('Failed to load MP profile:', err)
      } finally {
        setLoading(false)
      }
    }
    loadMPDossier()
  }, [mpId])

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
          onClick={() =>
            switchRole(
              'mp',
              'Himachal Pradesh',
              undefined,
              '6a932b5bcd944524379eddd9',
              'Anurag Singh Thakur'
            )
          }
          className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow hover:opacity-95 transition"
        >
          Switch to Member of Parliament (Demo)
        </button>
      </div>
    )
  }

  if (loading) {
    return <LoadingSkeleton rows={6} height="h-32" />
  }

  const summary = data?.summary || {}
  const works = data?.works || []
  const flags = data?.flags || []
  const allocCr = Math.round((summary.allocatedAmount || 0) / 10000000)
  const expCr = Math.round((summary.totalExpenditure || 0) / 10000000)
  const unspentCr = Math.round((summary.unspentAmount || 0) / 10000000)
  const util = summary.utilizationRate || 0

  const completedWorks = works.filter((w: any) => (w.status || '').toLowerCase().includes('completed')).length
  const ongoingWorks = Math.max(0, works.length - completedWorks)

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Official MP Badge Header */}
      <div className="rounded-2xl p-5 bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center font-bold shrink-0">
            <Landmark size={22} />
          </div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-primary)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>PARLIAMENTARY CONSTITUENCY COMMAND</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {summary.mpName || user.mpName}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {summary.house} &bull; <strong className="text-[var(--text-primary)]">{summary.constituency}</strong>, {summary.state} &bull; {summary.party}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] font-bold text-[var(--text-secondary)]">
            Role: Member of Parliament
          </span>
          <Link
            to={`/mps/${mpId}`}
            className="text-xs px-3 py-1.5 rounded-xl bg-[var(--brand-primary)] text-white font-bold hover:opacity-90 transition"
          >
            Public Report
          </Link>
        </div>
      </div>

      {/* Top Highlight: Real ACRU Debit-Card Style Fund Card */}
      <FundCard
        allocated={summary.allocatedAmount || 0}
        used={summary.totalExpenditure || 0}
        balance={summary.unspentAmount || 0}
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
          label="5-Year Entitlement Corpus"
          value={allocCr}
          prefix="₹"
          unit="Cr"
          theme="gold"
          description="Total central sanction"
        />
        <StatCard
          icon={Coins}
          label="Disbursed to Works"
          value={expCr}
          prefix="₹"
          unit="Cr"
          theme="gold"
          description="Liquid funds cleared"
        />
        <StatCard
          icon={Percent}
          label="Absorption Velocity"
          value={util}
          unit="%"
          theme="emerald"
          gaugeValue={util}
          description="Delivery percentage"
        />
        <StatCard
          icon={Clock}
          label="Liquid Balance Available"
          value={unspentCr}
          prefix="₹"
          unit="Cr"
          theme="amber"
          description="Ready for new recommendations"
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
          <span>Recommended Works ({works.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('spending')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'spending'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Layers size={14} />
          <span>Sector Spending Allocation</span>
        </button>

        <button
          onClick={() => setActiveTab('flags')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'flags'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <AlertTriangle size={14} className="text-amber-500" />
          <span>Compliance Alerts ({flags.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('action')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'action'
              ? 'bg-[var(--surface-primary)] text-[var(--brand-primary)] shadow-sm border border-[var(--border-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Mail size={14} className="text-[var(--brand-accent)]" />
          <span>Issue D.O. Letter to Collector</span>
        </button>
      </div>

      {/* TAB 1: RECOMMENDED WORKS */}
      {activeTab === 'works' && (
        <div className="space-y-4">
          {works.length === 0 ? (
            <EmptyState
              title="No Works Recommended Yet"
              description="You have not registered recommendations in this tenure ledger yet."
            />
          ) : (
            <div className="lux-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      <th className="p-3 font-bold">Work ID</th>
                      <th className="p-3 font-bold">Description</th>
                      <th className="p-3 font-bold">Sanction Cost</th>
                      <th className="p-3 font-bold">Executing District</th>
                      <th className="p-3 font-bold">Status</th>
                      <th className="p-3 font-bold text-right">Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {works.map((w: any) => {
                      const isDone = (w.status || '').toLowerCase().includes('completed')
                      return (
                        <tr key={w.workId || w.work_id} className="hover:bg-[var(--surface-alt)]/50 transition">
                          <td className="p-3 font-mono font-bold text-[var(--text-primary)]">
                            #{w.workId || w.work_id}
                          </td>
                          <td className="p-3 max-w-sm truncate text-[var(--text-secondary)]" title={w.work_description || w.workDescription || w.description}>
                            {w.work_description || w.workDescription || w.description || 'Civil Works Project'}
                          </td>
                          <td className="p-3 font-extrabold tabular-nums numeral-gold">
                            ₹{((w.sanctionedCost || w.cost || 0) / 100000).toFixed(2)} L
                          </td>
                          <td className="p-3 font-medium text-[var(--text-primary)]">
                            {w.district || summary.constituency}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                isDone
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {w.status || 'In Progress'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {flags.some((f: any) => f.workId === (w.workId || w.work_id)) ? (
                              <button
                                onClick={() => {
                                  const f = flags.find((f: any) => f.workId === (w.workId || w.work_id))
                                  if (f) setSelectedFlag(f)
                                }}
                                className="text-rose-600 dark:text-rose-400 font-bold hover:underline"
                              >
                                View Anomaly
                              </button>
                            ) : (
                              <span className="text-emerald-600 font-semibold">Verified</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SPENDING BREAKDOWN */}
      {activeTab === 'spending' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="lux-card p-5 space-y-4">
            <h3 className="font-bold text-sm text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-2">
              Delivery Completion Metrics
            </h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-4 rounded-xl bg-[var(--surface-alt)]">
                <span className="text-xs text-[var(--text-secondary)] block">Completed Projects</span>
                <span className="text-2xl font-extrabold text-emerald-600">{completedWorks}</span>
              </div>
              <div className="p-4 rounded-xl bg-[var(--surface-alt)]">
                <span className="text-xs text-[var(--text-secondary)] block">Active in Execution</span>
                <span className="text-2xl font-extrabold text-amber-600">{ongoingWorks}</span>
              </div>
            </div>
          </div>

          <div className="lux-card p-5 space-y-4">
            <h3 className="font-bold text-sm text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-2">
              Primary Sectors Funded
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 rounded bg-[var(--surface-alt)]">
                <span>Roads & Pathways</span>
                <strong className="text-[var(--text-primary)]">42% of Allocation</strong>
              </div>
              <div className="flex justify-between p-2 rounded bg-[var(--surface-alt)]">
                <span>Public Lighting & Energy</span>
                <strong className="text-[var(--text-primary)]">24% of Allocation</strong>
              </div>
              <div className="flex justify-between p-2 rounded bg-[var(--surface-alt)]">
                <span>School & College Classrooms</span>
                <strong className="text-[var(--text-primary)]">18% of Allocation</strong>
              </div>
              <div className="flex justify-between p-2 rounded bg-[var(--surface-alt)]">
                <span>Community Halls & Others</span>
                <strong className="text-[var(--text-primary)]">16% of Allocation</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FLAGS */}
      {activeTab === 'flags' && (
        <div className="space-y-4">
          {flags.length === 0 ? (
            <EmptyState
              title="Zero Compliance Alerts"
              description="All works recommended by your office are compliant with CPWD benchmark tolerances."
            />
          ) : (
            <div className="lux-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-primary)] text-[var(--text-secondary)]">
                      <th className="p-3 font-bold">Work ID</th>
                      <th className="p-3 font-bold">Description</th>
                      <th className="p-3 font-bold">Cost</th>
                      <th className="p-3 font-bold">Triggered Detector</th>
                      <th className="p-3 font-bold text-center">Severity</th>
                      <th className="p-3 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {flags.map((f: any) => (
                      <tr key={f.workId || f.work_id} className="hover:bg-[var(--surface-alt)]/50 transition">
                        <td className="p-3 font-mono font-bold text-[var(--text-primary)]">
                          #{f.workId || f.work_id}
                        </td>
                        <td className="p-3 max-w-xs truncate text-[var(--text-secondary)]" title={f.work_description || f.workDescription || f.description}>
                          {f.work_description || f.workDescription || f.description || 'Civil Works Project'}
                        </td>
                        <td className="p-3 font-extrabold tabular-nums">
                          ₹{((f.cost || f.sanctionedCost || 0) / 100000).toFixed(2)} L
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-[var(--surface-alt)] font-semibold text-[11px] border border-[var(--border-primary)]">
                            {f.detector_name || f.detectorName || f.detector || 'Forensic Flag'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <TierBadge tier={f.severity >= 0.7 ? 'critical' : 'high'} count={Number(f.severity?.toFixed(2) || 0)} size="sm" />
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedFlag(f)}
                            className="px-2.5 py-1 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 transition"
                          >
                            Inspect Report
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

      {/* TAB 4: ISSUE D.O. LETTER */}
      {activeTab === 'action' && (
        <div className="lux-card max-w-2xl mx-auto p-6 space-y-4">
          <div className="flex items-center gap-2 text-[var(--gold-text)] font-bold text-sm border-b border-[var(--border-primary)] pb-3">
            <Mail size={18} />
            <span>DISPATCH OFFICIAL PARLIAMENTARY DEMI-OFFICIAL (D.O.) INQUIRY LETTER</span>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            As the recommending Member of Parliament, you have statutory authority under MoSPI MPLADS Guidelines Rule 5.2 to call for physical site inspections and Measurement Book (MB) verification from the District Collector.
          </p>

          <div className="p-4 rounded-xl bg-[var(--surface-alt)] font-mono text-[11px] text-[var(--text-secondary)] leading-relaxed border border-[var(--border-primary)]">
            OFFICE OF {summary.mpName || user.mpName}<br />
            Member of Parliament ({summary.house}, {summary.constituency})<br />
            Date: {new Date().toLocaleDateString()}<br /><br />
            To: The District Collector & District Magistrate, {summary.constituency || 'District'}<br /><br />
            Subject: Review of project execution timelines and Measurement Book verification<br /><br />
            Dear District Collector,<br />
            In exercise of oversight for works sanctioned under my MPLADS 5-year entitlement envelope, please arrange a physical joint inspection for ongoing civil works in the constituency and furnish an updated Action-Taken Report (ATR) within 15 days.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() =>
                setDoLetterNotice(
                  `Parliamentary D.O. Letter recorded and dispatched to District Collectorate of ${summary.constituency || 'District'} (Simulated Demo Console).`
                )
              }
              className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow hover:opacity-90 transition"
            >
              Dispatch Parliamentary D.O. Letter
            </button>
          </div>

          {doLetterNotice && (
            <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{doLetterNotice}</span>
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
