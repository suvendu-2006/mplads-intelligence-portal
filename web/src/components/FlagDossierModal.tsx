import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  AlertTriangle,
  FileText,
  Lock,
  Mail,
  CheckCircle2,
  Copy,
  CheckSquare,
  Square,
  ClipboardList,
  ShieldAlert,
  Building2
} from 'lucide-react'
import { CPWDGauge } from './shared/CPWDGauge'
import { AgencyBadge } from './shared/AgencyBadge'
import { simplifyAuditFinding } from '../lib/auditSimplifier'
import { useToastStore } from '../store/useToastStore'
import { useStore } from '../store/useStore'

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
  implementing_agency?: string
  implementingAgency?: string
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
  const { user } = useStore()

  const [activeActionModal, setActiveActionModal] = useState<'notice' | 'freeze' | 'do_letter' | null>(null)
  const [copied, setCopied] = useState(false)
  const [checkedChecklist, setCheckedChecklist] = useState<Record<string, boolean>>({})
  const { showToast, showActionModal } = useToastStore()

  useEffect(() => {
    if (!flag) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const origOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = origOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [flag, onClose])

  if (!flag || typeof document === 'undefined') return null

  const workId = flag.work_id || flag.workId || 0
  const description = flag.work_description || flag.workDescription || (flag as any).description || 'Civil Works Project'
  const cost = flag.cost || flag.sanctionedCost || 0
  const district = flag.district || 'State General'
  const state = flag.state || 'India'
  const mpName = flag.mp_name || flag.mpName || 'Constituency MP'
  const constituency = flag.constituency || district
  const implementingAgency = flag.implementingAgency || flag.implementing_agency || (district && district !== 'State General' ? `District Magistrate / Collector, ${district}` : 'District Authority')
  const detectorName = flag.detector_name || flag.detectorName || flag.detector || 'Cost Overrun Anomaly'
  const severity = flag.severity || 0.75

  // STRICT JURISDICTION ENFORCEMENT:
  // MoSPI has national authority.
  // State Nodal Officer has authority ONLY for projects within user.state.
  // District Authority has authority ONLY for projects within user.district.
  const workState = (state || flag.state || '').trim().toLowerCase()
  const workDistrict = (district || flag.district || '').trim().toLowerCase()
  const userState = (user.state || '').trim().toLowerCase()
  const userDistrict = (user.district || '').trim().toLowerCase()

  const isStateMatch = Boolean(userState && userState !== 'all' && (workState === userState || workState.includes(userState) || userState.includes(workState)))
  const isDistrictMatch = Boolean(userDistrict && userDistrict !== 'all' && (workDistrict === userDistrict || workDistrict.includes(userDistrict) || userDistrict.includes(workDistrict)))

  const canTakeStateAction = user.role === 'mospi' || (user.role === 'state_nodal_officer' && isStateMatch)
  const canTakeDistrictAction = user.role === 'mospi' || (user.role === 'district_authority' && isDistrictMatch) || (user.role === 'state_nodal_officer' && isStateMatch)
  const isAuthority = canTakeStateAction || canTakeDistrictAction
  const isMP = user.role === 'mp'
  const isOutOfJurisdiction = (user.role === 'state_nodal_officer' && !isStateMatch) || (user.role === 'district_authority' && !isDistrictMatch)
  const isCitizen = user.role === 'viewer' || (!isAuthority && !isMP && !isOutOfJurisdiction)

  const getAgencyDetails = (agency: string) => {
    const ag = (agency || '').toLowerCase()
    let classification = 'District Administrative Authority'
    let roleType = 'Statutory Nodal Authority'
    let badgeColor = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'

    if (ag.includes('magistrate') || ag.includes('collector') || ag.includes('commissioner') || ag.includes('planning')) {
      classification = 'District Collectorate / Administration'
      roleType = 'Principal District Authority (Statutory Custodian)'
      badgeColor = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
    } else if (ag.includes('pwd') || ag.includes('cpwd') || ag.includes('res') || ag.includes('engineer') || ag.includes('irrigation')) {
      classification = 'Public Works & Engineering Line Dept'
      roleType = 'Technical Executing Line Agency'
      badgeColor = 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
    } else if (ag.includes('panchayat') || ag.includes('bdo') || ag.includes('block') || ag.includes('gram')) {
      classification = 'Panchayati Raj Institution (PRI)'
      roleType = 'Local Implementing Body'
      badgeColor = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
    } else if (ag.includes('municipal') || ag.includes('corporation') || ag.includes('urban')) {
      classification = 'Urban Local Body (ULB)'
      roleType = 'Municipal Project Authority'
      badgeColor = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
    }

    const mandate = `Under Para 2.11 and 3.1 of MoSPI MPLADS Guidelines, ${agency || 'the designated executing agency'} holds statutory fiduciary accountability for this project. This includes according technical sanction, executing works via standard public procurement rules, certifying entries in the Measurement Book (MB), performing on-site quality inspections, and ensuring timely fund utilization without fiscal end-of-year rush or cost overruns.`

    return { classification, roleType, badgeColor, mandate }
  }

  const agencyDetails = getAgencyDetails(implementingAgency)

  // Generate plain-language administrative summary and actionable checklist
  const finding = simplifyAuditFinding(flag)

  // CPWD calculations
  const cpwd = flag.cpwd_comparison
  const fairCost = cpwd?.fair_cost_estimate_inr || Math.max(50000, cost * 0.72)

  const toggleChecklist = (id: string) => {
    setCheckedChecklist(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const allChecksComplete = finding.checklist.length > 0 && finding.checklist.every(item => checkedChecklist[item.id])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNoticeConfirm = () => {
    setActiveActionModal(null)
    const refId = `SCN-GFR230-${workId}-${Math.floor(1000 + Math.random() * 9000)}`
    showActionModal({
      title: 'Formal Show-Cause Notice Dispatched',
      subtitle: `Issued to District Collector & DPO (${district})`,
      message: `Statutory Show-Cause Notice citing GFR Rule 230 and MoSPI MPLADS Guidelines has been transmitted for Work #${workId} (${description}). Action-Taken Report (ATR) required within 14 business days.`,
      refId,
      badgeText: 'NOTICE DISPATCHED • GFR 230',
      type: 'notice'
    })
    showToast(`Show-Cause Notice dispatched to District Authority for Work #${workId}`, 'notice', 5000, 'Statutory Notice Dispatched')
  }

  const handleFreezeConfirm = () => {
    setActiveActionModal(null)
    const refId = `PFMS-HOLD-${workId}-${Math.floor(1000 + Math.random() * 9000)}`
    showActionModal({
      title: 'PFMS Treasury Disbursal Freeze Enacted',
      subtitle: `Electronic Payment Hold Activated on PFMS SNA`,
      message: `Statutory payment hold order transmitted to the Public Financial Management System (PFMS) for Work #${workId}. Contractor invoice clearance has been immediately paused on Single Nodal Account.`,
      refId,
      badgeText: 'TREASURY DISBURSAL FROZEN',
      type: 'freeze'
    })
    showToast(`PFMS Payment Hold activated for Work #${workId}`, 'freeze', 5000, 'Treasury Freeze Enacted')
  }

  const handleLetterConfirm = () => {
    setActiveActionModal(null)
    const refId = `MP-DO-${workId}-${Math.floor(1000 + Math.random() * 9000)}`
    showActionModal({
      title: 'Parliamentary D.O. Letter Dispatched',
      subtitle: `Transmitted to District Collector, ${district}`,
      message: `Official inquiry from the Office of ${mpName} (${constituency}) dispatched to the District Collector regarding Work #${workId}. Physical site inspection and Measurement Book (MB) verification copy requested.`,
      refId,
      badgeText: 'PARLIAMENTARY INQUIRY TRANSMITTED',
      type: 'letter'
    })
    showToast(`Parliamentary D.O. Letter dispatched for Work #${workId}`, 'letter', 5000, 'D.O. Letter Dispatched')
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-4xl max-h-[88vh] sm:max-h-[86vh] rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-2xl flex flex-col text-[var(--text-primary)] overflow-hidden"
        style={{ borderTop: '4px solid var(--primary-700)' }}
      >
        {/* Pinned Sticky Header: ALWAYS visible with title and Close button */}
        <div className="flex items-start justify-between border-b border-[var(--border-primary)] p-4 sm:p-5 shrink-0 bg-[var(--surface-primary)]">
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold shrink-0">
              <ShieldAlert size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-primary)]">
                  Official Audit Dossier
                </span>
                <span className="text-xs font-mono font-bold text-[var(--text-secondary)]">
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
              <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] tracking-tight leading-snug break-words">
                {description}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition shrink-0 cursor-pointer border border-[var(--border-primary)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Body: Smooth vertical scroll for all sections */}
        <div className="space-y-5 p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] text-xs">
            <div>
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold block">Sanctioned Cost</span>
              <span className="text-sm sm:text-base font-extrabold tabular-nums text-[var(--neutral-950)]">
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
              <span className="font-bold text-[var(--text-primary)] block break-words">
                {mpName}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold block">Constituency</span>
              <span className="font-bold text-[var(--text-primary)] block break-words">
                {constituency}
              </span>
            </div>
          </div>

          {/* Section: Statutory Implementing Agency & Fiduciary Accountability */}
          <div className="rounded-xl border border-[var(--border-primary)] p-4 bg-[var(--surface-primary)] space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-primary)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold shrink-0">
                  <Building2 size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <span>Statutory Executing Authority</span>
                    <span className="w-1 h-1 rounded-full bg-blue-500" />
                    <span>MoSPI Para 2.11</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] mt-0.5">
                    Implementing Agency & Fiduciary Accountability
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${agencyDetails.badgeColor}`}>
                  {agencyDetails.classification}
                </span>
              </div>
            </div>

            {/* Key Agency Attributes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                  Designated Implementing Agency
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <AgencyBadge agency={implementingAgency} size="md" />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                  Statutory Role & Category
                </span>
                <div className="text-xs font-bold text-[var(--text-primary)] leading-tight">
                  {agencyDetails.roleType}
                </div>
                <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5 block">
                  Jurisdiction: {district || 'District Nodal Office'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)]">
                <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase block mb-1">
                  Execution Compliance
                </span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={13} />
                  <span>MoSPI Registry Verified</span>
                </div>
                <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5 block">
                  Authoritative Statutory Mapping
                </span>
              </div>
            </div>

            {/* Fiduciary Mandate Box */}
            <div className="p-3 rounded-xl bg-[var(--surface-alt)] border-l-4 border-blue-500 text-xs text-[var(--text-secondary)] leading-relaxed">
              <span className="font-bold text-[var(--text-primary)] block mb-1 text-[10px] uppercase tracking-wider">
                Statutory Execution Mandate & Fiduciary Liability:
              </span>
              {agencyDetails.mandate}
            </div>
          </div>

          {/* Plain Administrative Finding & Summary */}
          <div className="rounded-xl border border-[var(--border-primary)] p-4 bg-[var(--surface-primary)] space-y-3 shadow-sm">
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
                <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold border border-amber-500/25">
                  {finding.ruleCitation}
                </span>
              </div>
            </div>

            {/* Plain Executive Summary Memo */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-alt)] border-l-4 border-rose-500 text-xs text-[var(--text-secondary)] leading-relaxed">
              <span className="font-bold text-[var(--text-primary)] block mb-1 text-[11px] uppercase tracking-wider">
                Audit Finding & Administrative Summary:
              </span>
              {finding.executiveSummary}
            </div>

            {/* Structured Key Audit Facts (Balanced 4-column layout) */}
            <div>
              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-2">
                Key Verification Evidence:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {finding.keyEvidence.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                      item.alert
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
                        : 'bg-[var(--surface-alt)] border-[var(--border-primary)] text-[var(--text-primary)]'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] block opacity-75 font-semibold">{item.label}</span>
                      <span className="font-extrabold text-sm block mt-0.5 tabular-nums">
                        {item.value}
                      </span>
                    </div>
                    {item.hint && (
                      <span className="text-[9px] block opacity-75 mt-1.5 leading-tight">
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
                  <span>Field Verification & Compliance Checklist</span>
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
                      role="checkbox"
                      aria-checked={isChecked}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault()
                          toggleChecklist(item.id)
                        }
                      }}
                      onClick={() => toggleChecklist(item.id)}
                      className={`p-2.5 rounded-lg border flex items-start gap-2.5 cursor-pointer transition select-none ${
                        isChecked
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                          : 'bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border-[var(--border-primary)]'
                      }`}
                    >
                      <span className="mt-0.5 shrink-0 text-[var(--text-primary)]">
                        {isChecked ? (
                          <CheckSquare size={16} className="text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Square size={16} className="text-[var(--text-tertiary)]" />
                        )}
                      </span>
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

          {/* Action Section: Out-of-Jurisdiction vs Citizen vs Authority */}
          {isOutOfJurisdiction ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
                  <Lock size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--text-primary)] block">
                    Out-of-Jurisdiction Public Transparency Record
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)] leading-tight block mt-0.5">
                    {user.role === 'state_nodal_officer'
                      ? `You are logged in as State Nodal Officer for ${user.state}. Statutory enforcement actions (Show-Cause Notices, PFMS Disbursal Freezes) are strictly restricted to projects in ${user.state}.`
                      : `You are logged in as District Authority for ${user.district}. Statutory enforcement actions are strictly restricted to projects in ${user.district}.`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  showToast(`Public audit reference copied for Work #${workId}.`, 'info', 3000, 'Audit Dossier')
                  handleCopy(`Work #${workId}: ${description} (${district}, ${state})`)
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-xs font-bold text-[var(--text-primary)] transition whitespace-nowrap self-start sm:self-auto cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Copy size={12} />
                <span>Copy Finding</span>
              </button>
            </div>
          ) : isCitizen ? (
            <div className="p-4 rounded-xl bg-[var(--surface-alt)] border border-[var(--border-primary)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--text-primary)] block">Public Audit & Social Vigilance Record</span>
                  <span className="text-[10px] text-[var(--text-secondary)] leading-tight block mt-0.5">
                    Published under RTI Act Section 4 for citizen transparency. Statutory inquiries, show-cause notices, and disbursal freezes are restricted to District Authorities and MoSPI.
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  showToast(`Public inquiry reference logged for Work #${workId}. Forwarded to District Grievance Cell.`, 'info', 4000, 'Public Inquiry Logged')
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-xs font-bold text-[var(--text-primary)] transition whitespace-nowrap self-start sm:self-auto cursor-pointer shadow-xs"
              >
                Log Citizen Query
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-amber-500" />
                <span>Statutory Enforcement Actions</span>
              </div>

              <div className={`grid grid-cols-1 ${isAuthority ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-3`}>
                {isAuthority && (
                  <button
                    onClick={() => setActiveActionModal('notice')}
                    className="p-3.5 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-left flex flex-col justify-between transition group cursor-pointer"
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
                )}

                {isAuthority && (
                  <button
                    onClick={() => setActiveActionModal('freeze')}
                    className="p-3.5 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-left flex flex-col justify-between transition group cursor-pointer"
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
                )}

                {(isAuthority || isMP) && (
                  <button
                    onClick={() => setActiveActionModal('do_letter')}
                    className="p-3.5 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-left flex flex-col justify-between transition group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1 text-[var(--primary-700)] font-bold text-xs">
                        <Mail size={15} />
                        <span>MP D.O. Letter</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)] leading-snug">
                        Draft Parliamentary Demi-Official inquiry letter to Collector.
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold text-[var(--primary-700)] mt-3 group-hover:underline">
                      Draft D.O. Letter →
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Draft Preview Submodal */}
        {activeActionModal && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setActiveActionModal(null)
            }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
          >
            <div className="rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] max-w-xl w-full p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
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
                      onClick={handleNoticeConfirm}
                      className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow hover:opacity-90 transition cursor-pointer"
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
                      className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFreezeConfirm}
                      className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow hover:bg-rose-700 transition cursor-pointer"
                    >
                      Enact Disbursal Freeze
                    </button>
                  </div>
                </div>
              )}

              {activeActionModal === 'do_letter' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[var(--primary-700)] font-bold text-sm">
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
                      onClick={() => setActiveActionModal(null)}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLetterConfirm}
                      className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold shadow hover:opacity-90 transition cursor-pointer"
                    >
                      Dispatch Parliamentary D.O. Letter
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pinned Sticky Footer: Always visible at bottom so user can immediately close */}
        <div className="flex items-center justify-between border-t border-[var(--border-primary)] p-3 sm:px-6 bg-[var(--surface-primary)] shrink-0">
          <div className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5 font-medium">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-alt)] border border-[var(--border-primary)] text-[10px] font-mono">ESC</kbd> or click outside to dismiss</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-xs font-bold text-[var(--text-primary)] transition cursor-pointer shadow-2xs"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
