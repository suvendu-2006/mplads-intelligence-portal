import React, { useState } from 'react'
import {
  X,
  AlertTriangle,
  FileText,
  Lock,
  Mail,
  CheckCircle2,
  Building2,
  User,
  MapPin,
  Calendar,
  Layers,
  Copy,
  Download,
  CheckSquare,
  Square,
  ClipboardList,
  ShieldAlert
} from 'lucide-react'
import { CPWDGauge } from './shared/CPWDGauge'
import { TierBadge } from './shared/TierBadge'
import { t } from '../lib/i18n'
import { simplifyAuditFinding } from '../lib/auditSimplifier'

export interface FlagDossierData {
  work_id?: number
  workId?: number
  work_description?: string
  workDescription?: string
  description?: string
  cost?: number
  sanctionedCost?: number
  category?: string
  district?: string
  state?: string
  mp_name?: string
  mpName?: string
  constituency?: string
  detector_type?: string
  detector?: string
  detector_name?: string
  detectorName?: string
  severity?: number
  tier?: string
  explanation?: string
  evidence?: Record<string, any>
  detected_at?: string
  cpwd_comparison?: {
    benchmark_item: string
    standard_unit: string
    standard_rate_inr: number
    tolerance_upper_pct: number
    schedule: string
    fair_cost_estimate_inr: number
    tolerance_ceiling_inr: number
    excess_billed_inr: number
    within_tolerance: boolean
    inflation_pct: number
  }
}

interface Props {
  flag: FlagDossierData | null
  onClose: () => void
}

export const FlagDossierModal: React.FC<Props> = ({ flag, onClose }) => {
  const [activeActionModal, setActiveActionModal] = useState<'notice' | 'freeze' | 'do_letter' | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [checkedChecklist, setCheckedChecklist] = useState<Record<string, boolean>>({})

  if (!flag) return null

  const workId = flag.work_id || flag.workId || 0
  const description = flag.work_description || flag.workDescription || (flag as any).description || 'Civil Works Project'
  const cost = flag.cost || flag.sanctionedCost || 0
  const district = flag.district || 'State General'
  const state = flag.state || 'India'
  const mpName = flag.mp_name || flag.mpName || 'Constituency MP'
  const constituency = flag.constituency || district
  const detectorName = flag.detector_name || flag.detectorName || flag.detector || 'Cost Overrun Anomaly'
  const severity = flag.severity || 0.75

  // Generate plain-language administrative summary and actionable checklist
  const finding = simplifyAuditFinding(flag)

  // CPWD calculations
  const cpwd = flag.cpwd_comparison
  const fairCost = cpwd?.fair_cost_estimate_inr || Math.max(50000, cost * 0.72)
  const toleranceBuffer = fairCost * 0.25

  const toggleChecklist = (id: string) => {
    setCheckedChecklist(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const allChecksComplete = finding.checklist.length > 0 && finding.checklist.every(item => checkedChecklist[item.id])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const triggerAction = (actionName: string) => {
    setActionSuccess(`✓ ${actionName} logged in sovereign audit ledger (Demo Mode: UI-only).`)
    setTimeout(() => {
      setActionSuccess(null)
      setActiveActionModal(null)
    }, 3000)
  }

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-2xl p-6 sm:p-8 my-8 text-[var(--text-primary)]"
        style={{ borderTop: '4px solid var(--brand-accent)' }}
      >
        {/* Header with Gold accent line */}
        <div className="flex items-start justify-between border-b border-[var(--border-primary)] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-500 border border-rose-500/30 flex items-center justify-center font-bold shrink-0">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-primary)]">
                  District Vigilance &bull; Audit Verification Report
                </span>
                <span className="text-xs font-mono font-bold text-[var(--brand-primary)]">
                  WORK #{workId}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  severity >= 0.70
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/35'
                    : severity >= 0.40
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/35'
                }`}>
                  {severity >= 0.70 ? 'Immediate Action Required' : severity >= 0.40 ? 'Priority Review' : 'Standard Check'}
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-[var(--text-primary)] tracking-tight line-clamp-1 mt-0.5">
                {description}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success Toast */}
        {actionSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} />
            <span>{actionSuccess}</span>
          </div>
        )}

        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs">
            <div>
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold block">Sanctioned Outlay</span>
              <span className="text-base font-extrabold tabular-nums numeral-gold">
                ₹{(cost / 100000).toFixed(2)} Lakhs
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold block">Location</span>
              <span className="font-bold text-[var(--text-primary)] block">
                {district}, {state}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold block">Recommending MP</span>
              <span className="font-bold text-[var(--text-primary)] truncate block">
                {mpName}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold block">Constituency</span>
              <span className="font-bold text-[var(--text-primary)] truncate block">
                {constituency}
              </span>
            </div>
          </div>

          {/* Plain Administrative Finding & Summary */}
          <div className="rounded-xl border border-rose-500/25 p-4 bg-gradient-to-br from-rose-500/5 via-[var(--surface-primary)] to-[var(--surface-primary)] space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-primary)] pb-3">
              <div>
                <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={13} />
                  <span>Audit Observation</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] mt-0.5">
                  {finding.plainTitle}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold border border-amber-500/25">
                  {finding.ruleCitation}
                </span>
              </div>
            </div>

            {/* Plain Executive Summary Memo */}
            <div className="p-3 rounded-lg bg-[var(--surface-alt)] border-l-4 border-rose-500 text-xs text-[var(--text-secondary)] leading-relaxed">
              <span className="font-bold text-[var(--text-primary)] block mb-1 text-[11px] uppercase tracking-wider">
                Executive Briefing for District Collector / Admin:
              </span>
              {finding.executiveSummary}
            </div>

            {/* Structured Key Audit Facts */}
            <div>
              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-2">
                Key Audit Evidence:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {finding.keyEvidence.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-xs ${
                      item.alert
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                        : 'bg-[var(--surface-alt)] border-[var(--border-primary)] text-[var(--text-primary)]'
                    }`}
                  >
                    <span className="text-[10px] block opacity-75 font-semibold">{item.label}</span>
                    <span className="font-extrabold text-sm block mt-0.5 tabular-nums">
                      {item.value}
                    </span>
                    {item.hint && (
                      <span className="text-[9px] block opacity-70 mt-0.5 leading-tight">
                        {item.hint}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Inspector Field Verification Checklist */}
            <div className="mt-4 pt-3 border-t border-[var(--border-primary)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardList size={14} className="text-[var(--brand-primary)]" />
                  <span>Field Inspection Action Checklist (District Collector / DM)</span>
                </span>
                {allChecksComplete && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    <span>All Checks Satisfied</span>
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {finding.checklist.map((item) => {
                  const isChecked = Boolean(checkedChecklist[item.id])
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleChecklist(item.id)}
                      className={`p-2.5 rounded-lg border flex items-start gap-2.5 cursor-pointer transition select-none ${
                        isChecked
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                          : 'bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border-[var(--border-primary)]'
                      }`}
                    >
                      <button
                        type="button"
                        className="mt-0.5 shrink-0 text-[var(--text-primary)]"
                        aria-label={isChecked ? 'Mark incomplete' : 'Mark verified'}
                      >
                        {isChecked ? (
                          <CheckSquare size={16} className="text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Square size={16} className="text-[var(--text-tertiary)]" />
                        )}
                      </button>
                      <div className="flex-1 text-xs">
                        <span className={`font-bold block ${isChecked ? 'line-through opacity-75' : 'text-[var(--text-primary)]'}`}>
                          {item.title}
                        </span>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* CPWD Comparison Gauge */}
          <CPWDGauge
            fairCost={fairCost}
            billedCost={cost}
            tolerancePct={25}
            category={flag.category || 'Civil Work'}
            unitRate={cpwd?.standard_rate_inr ? `₹${cpwd.standard_rate_inr}/${cpwd.standard_unit}` : undefined}
          />

          {/* Statutory Administrative Actions (3 Interactive Buttons) */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
              <span>STATUTORY ACTIONS & ENFORCEMENT (PUBLIC MP / COLLECTORATE)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setActiveActionModal('notice')}
                className="p-3.5 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-left flex flex-col justify-between transition group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1 text-[var(--brand-primary)] font-bold text-xs">
                    <FileText size={15} />
                    <span>Show-Cause Notice</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-snug">
                    Issue formal notice to District Magistrate citing GFR Rule 230.
                  </p>
                </div>
                <span className="text-[10px] font-extrabold text-[var(--brand-primary)] mt-3 group-hover:underline">
                  Draft Notice →
                </span>
              </button>

              <button
                onClick={() => setActiveActionModal('freeze')}
                className="p-3.5 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-left flex flex-col justify-between transition group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1 text-rose-600 dark:text-rose-400 font-bold text-xs">
                    <Lock size={15} />
                    <span>Freeze PFMS Disbursal</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-snug">
                    Place statutory payment hold on treasury releases for this work.
                  </p>
                </div>
                <span className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 mt-3 group-hover:underline">
                  Initiate Hold →
                </span>
              </button>

              <button
                onClick={() => setActiveActionModal('do_letter')}
                className="p-3.5 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-left flex flex-col justify-between transition group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1 text-[var(--brand-accent)] font-bold text-xs">
                    <Mail size={15} />
                    <span>MP D.O. Letter</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-snug">
                    Draft Parliamentary Demi-Official inquiry letter to Collector.
                  </p>
                </div>
                <span className="text-[10px] font-extrabold text-[var(--gold-text)] mt-3 group-hover:underline">
                  Draft D.O. Letter →
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Draft Preview Submodal */}
        {activeActionModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in">
            <div className="rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] max-w-xl w-full p-6 shadow-2xl relative">
              <button
                onClick={() => setActiveActionModal(null)}
                className="absolute top-4 right-4 p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X size={18} />
              </button>

              {activeActionModal === 'notice' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                    <FileText size={18} />
                    <span>FORMAL SHOW-CAUSE NOTICE DRAFT</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] font-mono text-[11px] text-[var(--text-secondary)] leading-relaxed border border-[var(--border-primary)] max-h-56 overflow-y-auto">
                    MEMORANDUM<br />
                    To: District Collector & District Planning Officer, {district}<br />
                    Subject: Discrepancy & Statutory Inquiry into Work #{workId} ({description})<br /><br />
                    Pursuant to General Financial Rules (GFR) 2017 Rule 230 and MoSPI MPLADS Guidelines (2023 Revision), you are hereby directed to provide an Action-Taken Report (ATR) regarding the deviation of ₹{(cost / 100000).toFixed(2)} Lakhs detected by model {detectorName} within 14 business days.
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => handleCopy(`MEMORANDUM: Work #${workId} inquiry to ${district}`)}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-xs font-bold flex items-center gap-1.5"
                    >
                      <Copy size={13} />
                      <span>{copied ? 'Copied!' : 'Copy Notice Text'}</span>
                    </button>
                    <button
                      onClick={() => triggerAction('Show-Cause Notice dispatched to District Authority')}
                      className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow"
                    >
                      Confirm & Dispatch Notice
                    </button>
                  </div>
                </div>
              )}

              {activeActionModal === 'freeze' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                    <Lock size={18} />
                    <span>PFMS TREASURY DISBURSAL FREEZE</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    This order transmits an electronic hold to the Public Financial Management System (PFMS) for Work #{workId}. No further treasury disbursements will be processed until the State Nodal Authority clears the audit query.
                  </p>
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 font-semibold">
                    Statutory Notice: Payment hold will immediately pause contractor invoice clearance on PFMS Single Nodal Account.
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setActiveActionModal(null)}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => triggerAction('PFMS Payment Hold activated for Work #' + workId)}
                      className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow"
                    >
                      Enact Disbursal Freeze
                    </button>
                  </div>
                </div>
              )}

              {activeActionModal === 'do_letter' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[var(--gold-text)] font-bold text-sm">
                    <Mail size={18} />
                    <span>PARLIAMENTARY DEMI-OFFICIAL (D.O.) LETTER</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] font-mono text-[11px] text-[var(--text-secondary)] leading-relaxed border border-[var(--border-primary)] max-h-56 overflow-y-auto">
                    OFFICE OF {mpName.toUpperCase()}<br />
                    Member of Parliament ({constituency})<br />
                    Date: {new Date().toLocaleDateString()}<br /><br />
                    Dear District Collector,<br />
                    I am writing in reference to the civil infrastructure work recommended from my MPLADS allocation: "{description}" (ID: #{workId}). The central telemetry portal has highlighted an anomaly with detector {detectorName}. Please arrange a physical site inspection and submit the Measurement Book (MB) verification copy to my office.
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => triggerAction('D.O. Letter sent from MP to District Collector')}
                      className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow"
                    >
                      Dispatch Parliamentary D.O. Letter
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
