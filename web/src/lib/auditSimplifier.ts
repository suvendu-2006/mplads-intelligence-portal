import { FlagDossierData } from '../components/FlagDossierModal'

export interface KeyEvidenceItem {
  label: string
  value: string
  hint?: string
  alert?: boolean
}

export interface InspectorChecklistItem {
  id: string
  title: string
  detail: string
}

export interface SimplifiedAuditFinding {
  plainTitle: string
  ruleCitation: string
  executiveSummary: string
  keyEvidence: KeyEvidenceItem[]
  checklist: InspectorChecklistItem[]
}

const DETECTOR_METADATA: Record<
  string,
  {
    title: string
    rule: string
    summary: string
    defaultChecklist: InspectorChecklistItem[]
  }
> = {
  unusual_pattern: {
    title: 'Multivariate Statistical Outlier Screening',
    rule: 'MoSPI Analytical Screening Norms & Statistical Quality Assurance',
    summary:
      'The project costs, durations, and payment patterns deviate significantly from normal statistical distributions across peer works in the state.',
    defaultChecklist: [
      {
        id: 'outlier_review',
        title: 'Review Peer Cost Distribution',
        detail: 'Compare expenditure rate against standard deviation benchmarks for identical asset classifications.'
      },
      {
        id: 'administrative_sanction',
        title: 'Verify Detailed Administrative Sanction',
        detail: 'Inspect the technical sanction file to ensure justifications exist for anomalous rate deviations.'
      },
      {
        id: 'site_audit',
        title: 'Field Verification Order',
        detail: 'Depute a technical verification team to audit milestone completion certificates and site measurements.'
      }
    ]
  },
  timing_anomaly: {
    title: 'Year-End Budget Rush (March Spending Surge)',
    rule: 'MoSPI MPLADS Guidelines Para 3.12 (Even Pacing of Expenditure)',
    summary:
      'The entire annual budget was sanctioned and billed in the final weeks of March. MoSPI financial guidelines mandate steady spending across all four quarters. Heavy March expenditure often indicates unverified rush approvals to prevent fund lapse before the financial year closes.',
    defaultChecklist: [
      {
        id: 'mb_check',
        title: 'Inspect Measurement Book (MB)',
        detail: 'Verify that the Junior/Assistant Engineer physically measured dimensions on site prior to approving the bill.'
      },
      {
        id: 'geotag_photo',
        title: 'Verify Geo-Tagged Site Photo',
        detail: 'Confirm physical existence and quality of the completed asset with GPS timestamp on the mobile inspection portal.'
      },
      {
        id: 'fund_hold',
        title: 'Review Final Release',
        detail: 'Ensure complete technical sanction and completion certificates are vetted before releasing final retention tranches.'
      }
    ]
  },
  cost_overrun: {
    title: 'Cost Exceeds Government Benchmark (CPWD Rate)',
    rule: 'GFR 2017 Rule 130 & MoSPI Guidelines Para 2.4 (Civil Schedule of Rates)',
    summary:
      'The billed project cost exceeds the permissible Central/State PWD Schedule of Rates (DSR) ceiling by more than the 25% statutory tolerance limit.',
    defaultChecklist: [
      {
        id: 'pwd_sor',
        title: 'Compare Against Local PWD SOR',
        detail: 'Review the executing agency’s detailed rate analysis against the official District Schedule of Rates.'
      },
      {
        id: 'variation_order',
        title: 'Audit Extra Items & Deviations',
        detail: 'Verify whether quantity deviations or non-scheduled items had prior written approval from the competent engineer.'
      },
      {
        id: 'withhold_excess',
        title: 'Withhold Unjustified Excess',
        detail: 'Retain payment for the unverified amount over the ceiling until a rate justification is formally approved.'
      }
    ]
  },
  duplicate_work: {
    title: 'Potential Duplicate Work (Double Billing Risk)',
    rule: 'GFR 2017 Rule 33 & CVC Vigilance Guidelines (Prevention of Double Accounting)',
    summary:
      'Another work with an identical or near-identical description, location, and cost was sanctioned in the same village/ward, indicating potential double billing for a single physical structure.',
    defaultChecklist: [
      {
        id: 'asset_reg',
        title: 'Reconcile Panchayat Asset Register',
        detail: 'Confirm whether one or two distinct physical assets actually exist at the specified village/location.'
      },
      {
        id: 'gps_coords',
        title: 'Compare Geo-Coordinates',
        detail: 'Cross-reference latitude/longitude of both work orders to ensure they do not map to the exact same site.'
      },
      {
        id: 'invoice_audit',
        title: 'Cross-Check Contractor Invoices',
        detail: 'Check whether the same material vouchers or labor muster rolls were submitted under both sanction IDs.'
      }
    ]
  },
  bill_splitting: {
    title: 'Tender Splitting (Bypassing E-Tender Ceiling)',
    rule: 'GFR 2017 Rule 157 & MoSPI Guidelines Para 2.3 (Prohibition of Splitting)',
    summary:
      'A large civil project appears to have been partitioned into smaller sub-works just below the ₹5.00 Lakh mandatory e-tendering threshold to bypass open competitive bidding.',
    defaultChecklist: [
      {
        id: 'combine_orders',
        title: 'Consolidate Linked Work Orders',
        detail: 'Calculate the total combined expenditure across all related sub-works sanctioned in the same location.'
      },
      {
        id: 'tender_enquiry',
        title: 'Inquire Into Splitting Rationale',
        detail: 'Direct the Implementing Agency to explain why the work was not tendered as a single composite civil package.'
      },
      {
        id: 'open_bidding',
        title: 'Enforce E-Procurement',
        detail: 'Ensure any future phases or extensions are executed strictly through the state e-procurement portal.'
      }
    ]
  },
  ghost_work: {
    title: 'High Risk of Non-Existent Asset (Ghost Work)',
    rule: 'MoSPI Guidelines Para 6.2 (Mandatory Geo-Tagging & Physical Asset Verification)',
    summary:
      'The project was marked completed and billed in official records, but lacks verifiable inspection logs, geo-tagged photography, or asset registration in the local records.',
    defaultChecklist: [
      {
        id: 'spot_inspection',
        title: 'Depute Magistrate for Spot Verification',
        detail: 'Order an immediate physical site inspection by an independent Sub-Divisional Magistrate (SDM) or DPO.'
      },
      {
        id: 'gram_sabha',
        title: 'Obtain Gram Panchayat Certificate',
        detail: 'Verify whether the Sarpanch and Panchayat Secretary have formally taken over the asset for public use.'
      },
      {
        id: 'disbursal_freeze',
        title: 'Freeze Bank Releases',
        detail: 'Pause PFMS disbursements on this work until the physical structure is confirmed and photographed.'
      }
    ]
  },
  plausibility_mismatch: {
    title: 'High Cost Relative to Asset Scope',
    rule: 'CPWD Analysis of Rates (DSR 2023) & GFR Rule 144 (Reasonableness of Rates)',
    summary:
      'The sanctioned outlay is disproportionately high for the physical nature and scale of the asset, indicating potential artificial inflation in the cost estimate.',
    defaultChecklist: [
      {
        id: 'boq_reval',
        title: 'Re-evaluate Bill of Quantities (BOQ)',
        detail: 'Have an independent civil engineer re-measure physical dimensions and material consumption.'
      },
      {
        id: 'material_receipts',
        title: 'Inspect Material Purchase Vouchers',
        detail: 'Verify GST invoices for cement, steel, and machinery billed by the executing agency.'
      },
      {
        id: 'recover_excess',
        title: 'Adjust Excess Billing',
        detail: 'Recover unverified rate inflation from the contractor’s security deposit or pending bills.'
      }
    ]
  },
  bulk_completion: {
    title: 'Unrealistic Same-Day Batch Completion',
    rule: 'MoSPI Guidelines Para 3.8 (Physical Execution Timelines)',
    summary:
      'Multiple independent civil works across the district were recorded as completed on the exact same date by the same agency, suggesting paper-only batch approvals without physical verification.',
    defaultChecklist: [
      {
        id: 'site_log',
        title: 'Examine Daily Site Inspection Logs',
        detail: 'Check the Junior Engineer’s daily diary to verify actual dates of on-site milestone inspections.'
      },
      {
        id: 'muster_rolls',
        title: 'Audit Labor & Delivery Challans',
        detail: 'Verify that material deliveries and labor deployment support genuine simultaneous execution.'
      },
      {
        id: 'staggered_audit',
        title: 'Stagger Bill Clearances',
        detail: 'Withhold final passing of the batch until each individual site is individually certified on the mobile app.'
      }
    ]
  },
  benford_anomaly: {
    title: 'Artificial Round-Figure Invoicing Anomaly',
    rule: 'CAG Financial Audit Manual (Irregular Expenditure Clustering)',
    summary:
      'Invoices show repeated clustering around artificial round figures (e.g. exactly ₹4,00,000 or ₹4,99,000) rather than itemized real-world material and labor billing.',
    defaultChecklist: [
      {
        id: 'itemized_bill',
        title: 'Demand Itemized Contractor Bill',
        detail: 'Require a detailed measurement sheet with exact item rates instead of lump-sum round billing.'
      },
      {
        id: 'gst_vouchers',
        title: 'Verify GST Return Filings',
        detail: 'Ensure supplier invoices submitted by the contractor match filings on the GST portal.'
      },
      {
        id: 'pfms_match',
        title: 'Reconcile PFMS Advice',
        detail: 'Verify that bank debits match the sanctioned sub-component allocations exactly.'
      }
    ]
  },
  vague_description: {
    title: 'Incomplete or Ambiguous Work Description',
    rule: 'MoSPI Guidelines Para 2.1 (Identification of Specific Tangible Assets)',
    summary:
      'The recorded work description lacks essential details such as specific location, asset dimensions, or beneficiary, preventing meaningful public scrutiny and audit verification.',
    defaultChecklist: [
      {
        id: 'update_portal',
        title: 'Direct Portal Description Amendment',
        detail: 'Instruct the Implementing Agency to input complete asset specifications and GPS coordinates in the portal.'
      },
      {
        id: 'admin_approval',
        title: 'Review Original Administrative Sanction',
        detail: 'Inspect the signed Administrative Approval (AS) and Financial Sanction (FS) documents from the file.'
      },
      {
        id: 'public_board',
        title: 'Confirm Citizen Information Board',
        detail: 'Ensure the mandatory MPLADS display board is erected on site showing work name, cost, and MP name.'
      }
    ]
  },
  delay_violation: {
    title: 'Severe Execution Delay Beyond Statutory Limit',
    rule: 'MoSPI Guidelines Para 3.10 (Project Time Limits & Liquidated Damages)',
    summary:
      'Work completion has stretched far beyond the statutory 12-18 month completion window without documented time-extension approvals from the District Collector.',
    defaultChecklist: [
      {
        id: 'liquidated_damages',
        title: 'Review Penalty / Liquidated Damages',
        detail: 'Assess whether contractual penalties should be levied on the agency for unjustified delays.'
      },
      {
        id: 'milestone_stage',
        title: 'Assess Current Stage of Construction',
        detail: 'Determine remaining balance of work and whether the agency has the capacity to finish promptly.'
      },
      {
        id: 're_tender',
        title: 'Evaluate Re-Tendering Option',
        detail: 'If the contractor has abandoned the work, cancel the order and re-tender the balance scope.'
      }
    ]
  },
  ida_risk: {
    title: 'Implementing Agency Under Vigilance Review',
    rule: 'CVC Circular on Implementing Agency Monitoring',
    summary:
      'This implementing agency has accumulated multiple unresolved audit flags or holds an unusually high monopoly share of civil works in the district.',
    defaultChecklist: [
      {
        id: 'restrict_allocation',
        title: 'Restrict Fresh Work Allocations',
        detail: 'Pause awarding new MPLADS contracts to this agency until existing audit queries are fully settled.'
      },
      {
        id: 'technical_audit',
        title: 'Order Comprehensive Agency Audit',
        detail: 'Commission a third-party quality and financial audit of all works executed by this agency over the past 3 years.'
      },
      {
        id: 'report_state',
        title: 'Notify State Nodal Authority',
        detail: 'Submit a formal risk assessment report to the State Nodal Department for systemic review.'
      }
    ]
  },
  mp_risk: {
    title: 'Parliamentary Portfolio Spending Concentration',
    rule: 'MoSPI Guidelines Chapter 3 (Constituency Fund Management)',
    summary:
      'Statistical analysis indicates high concentration of recommendations into specific months, single agencies, or cost clusters across this parliamentary portfolio.',
    defaultChecklist: [
      {
        id: 'portfolio_review',
        title: 'Conduct Portfolio Balance Review',
        detail: 'Ensure funds are distributed equitably across sectors (drinking water, education, health, roads).'
      },
      {
        id: 'sc_st_mandate',
        title: 'Verify SC/ST Sub-Plan Compliance',
        detail: 'Confirm that at least 15% (SC) and 7.5% (ST) of the annual allocation is dedicated to priority demographic areas.'
      },
      {
        id: 'brief_mp',
        title: 'Brief MP Office on Audit Observations',
        detail: 'Provide a constructive briefing note to the Honorable MP highlighting recommended administrative alignments.'
      }
    ]
  },
  copy_paste_pricing: {
    title: 'Identical / Repeated Estimate Pricing',
    rule: 'Competition Act 2002 & GFR Rule 173 (Bid Rigging & Cartelization)',
    summary:
      'Unrelated civil works feature identical, repeated cost figures down to the rupee, suggesting estimates were cloned without conducting actual site-specific measurements.',
    defaultChecklist: [
      {
        id: 'cross_estimate',
        title: 'Compare Detailed Estimates',
        detail: 'Place rate calculations side-by-side to check if soil type, site slope, and foundations were copied.'
      },
      {
        id: 'site_survey',
        title: 'Inquire Into Initial Site Survey',
        detail: 'Confirm whether preliminary engineering surveys were genuinely conducted before sanctioning.'
      },
      {
        id: 'competitive_check',
        title: 'Review Bidder Participation',
        detail: 'Check whether multiple bidders submitted independent price bids or coordinated identical quotations.'
      }
    ]
  },
  verification_gap: {
    title: 'Missing Completion & Inspection Documentation',
    rule: 'MoSPI Guidelines Para 6.1 (Statutory Inspection of Completed Works)',
    summary:
      'Statutory completion certificate, utilization certificate (UC), or local body handover documents are missing from the official district records.',
    defaultChecklist: [
      {
        id: 'handover_doc',
        title: 'Secure Signed Handover Certificate',
        detail: 'Ensure the completed structure is formally handed over to the Gram Panchayat or Urban Local Body.'
      },
      {
        id: 'upload_geotag',
        title: 'Upload Geo-Tagged Verification Photo',
        detail: 'Mandate the Junior Engineer to upload clear site photos with GPS coordinates to the national portal.'
      },
      {
        id: 'issue_uc',
        title: 'Finalize Utilization Certificate (UC)',
        detail: 'Submit Form GFR 12-C Utilization Certificate to the State Nodal Department to clear the audit gap.'
      }
    ]
  }
}

/**
 * Format raw numbers into Indian Lakhs/Crores
 */
export function formatIndianCurrency(amount: number): string {
  if (!amount || isNaN(amount)) return '₹0'
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} Lakhs`
  }
  return `₹${amount.toLocaleString('en-IN')}`
}

/**
 * Format date string into standard administrative format (e.g. 13 Mar 2025)
 */
export function formatAdminDate(dateStr?: string): string {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

/**
 * Turn complex academic explanation and raw evidence into crystal-clear administrative English
 */
export function simplifyAuditFinding(flag: FlagDossierData): SimplifiedAuditFinding {
  const detectorType = (flag.detector_type || flag.detector || '').toLowerCase().trim()
  const meta = DETECTOR_METADATA[detectorType] || {
    title: flag.detector_name || flag.detectorName || 'Audit Discrepancy Flag',
    rule: 'MoSPI MPLADS Guidelines & General Financial Rules (GFR 2017)',
    summary:
      flag.explanation ||
      'Work billed cost or execution schedule deviates from verified schedule rates and statutory vigilance standards.',
    defaultChecklist: [
      {
        id: 'physical_verify',
        title: 'Conduct Physical Verification',
        detail: 'Depute a technical officer to inspect the site and confirm physical completion.'
      },
      {
        id: 'mb_record',
        title: 'Verify Measurement Book Entry',
        detail: 'Check official engineering measurements recorded in the Measurement Book.'
      },
      {
        id: 'review_bill',
        title: 'Hold Tranche Release',
        detail: 'Ensure all vouchers and completion certificates are vetted before final payment.'
      }
    ]
  }

  // Refine summary based on specific evidence
  let summary = meta.summary
  const evidence = flag.evidence || {}

  // If timing anomaly, provide exact readable percentage and explanation
  if (detectorType === 'timing_anomaly') {
    const isMarch = evidence.is_march ?? true
    const mpName = flag.mp_name || flag.mpName || 'the Member of Parliament'
    const fy = evidence.fiscal_year || '2024–25'
    if (isMarch) {
      summary = `All annual expenditure (100.0%) for ${mpName} in FY ${fy} was booked during the month of March. MoSPI guidelines mandate phased spending across the year. Concentrated spending in the final weeks of the fiscal year often indicates unverified rush sanctions to exhaust funds before March 31 without thorough physical verification.`
    }
  } else if (detectorType === 'cost_overrun' || flag.cpwd_comparison) {
    const cpwd = flag.cpwd_comparison
    if (cpwd && cpwd.excess_billed_inr > 0) {
      summary = `The contractor billed ${formatIndianCurrency(flag.cost || 0)}, which is ${formatIndianCurrency(cpwd.excess_billed_inr)} (+${cpwd.inflation_pct.toFixed(1)}%) above the permissible government ceiling of ${formatIndianCurrency(cpwd.tolerance_ceiling_inr)}. A detailed rate justification from the Executive Engineer is required.`
    }
  } else if (detectorType === 'bill_splitting') {
    summary = `Multiple works were sanctioned in the same area just below the mandatory ₹5.00 Lakh e-tendering limit. In public civil procurement, splitting large works into sub-packages to avoid open competitive bidding violates GFR Rule 157.`
  }

  // Construct structured Key Evidence Items (clean, balanced 4-card layout)
  const keyEvidence: KeyEvidenceItem[] = []

  const cost = flag.cost || flag.sanctionedCost || 0
  const cpwd = flag.cpwd_comparison
  const fairCost = cpwd?.fair_cost_estimate_inr || Math.max(50000, cost * 0.72)
  const ceilingCost = cpwd?.tolerance_ceiling_inr || fairCost * 1.25
  const excess = cpwd?.excess_billed_inr || Math.max(0, cost - ceilingCost)
  const excessPct = ceilingCost > 0 ? ((cost - ceilingCost) / ceilingCost) * 100 : 0

  // Card 1: Billed Claim
  keyEvidence.push({
    label: 'Billed Claim',
    value: formatIndianCurrency(cost),
    hint: 'Contractor Invoice Amount'
  })

  // Card 2: Government Benchmark Ceiling
  keyEvidence.push({
    label: 'Govt Ceiling',
    value: formatIndianCurrency(ceilingCost),
    hint: 'CPWD Schedule + 25% Buffer'
  })

  // Card 3: Audit Discrepancy / Overrun
  if (excess > 0) {
    keyEvidence.push({
      label: 'Audit Discrepancy',
      value: `+${formatIndianCurrency(excess)} (+${excessPct.toFixed(1)}%)`,
      hint: 'Exceeds Statutory Ceiling',
      alert: true
    })
  } else {
    keyEvidence.push({
      label: 'Statutory Tolerance',
      value: 'Within Benchmark',
      hint: 'Compliant with CPWD Limit'
    })
  }

  // Card 4: Date or Implementing Agency
  const completionDate = evidence.completion_date || (flag as any).completionDate || (flag as any).sanctionDate
  if (detectorType === 'timing_anomaly' && completionDate) {
    keyEvidence.push({
      label: 'Sanction Period',
      value: `${formatAdminDate(completionDate)}`,
      hint: evidence.is_march ? 'March Year-End Surge' : `FY ${evidence.fiscal_year || '2024–25'}`,
      alert: Boolean(evidence.is_march)
    })
  } else {
    const contractor = evidence.contractor || evidence.executing_agency || 'District Implementing Agency'
    keyEvidence.push({
      label: 'Implementing Agency',
      value: String(contractor),
      hint: 'Assigned Executing Authority'
    })
  }

  return {
    plainTitle: meta.title,
    ruleCitation: meta.rule,
    executiveSummary: summary,
    keyEvidence,
    checklist: meta.defaultChecklist
  }
}
