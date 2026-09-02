"""
Formal Forensic Detector Registry & Capacity Triage System.
Maintains regulatory grounding, assumptions, data requirements, and audit limitations
for all 15 automated screening detectors.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Dict


class DetectorStatus(Enum):
    ACTIVE_VERIFIED = "Active with verified input data"
    ADVISORY = "Advisory only - requires manual review"
    INACTIVE_MISSING_DATA = "Inactive due to missing source data"


@dataclass
class DetectorInfo:
    detector_id: str
    name: str
    status: DetectorStatus
    regulatory_source: str
    assumptions: List[str]
    version: str
    known_limitations: List[str]


DETECTOR_REGISTRY: Dict[str, DetectorInfo] = {
    "detector_01_unusual_patterns": DetectorInfo(
        detector_id="D1",
        name="Multivariate Statistical Outlier Screening",
        status=DetectorStatus.ACTIVE_VERIFIED,
        regulatory_source="Isolation Forest Multivariate Statistical Distribution Modeling",
        assumptions=["Numerical features (cost, duration, payment ratios) follow continuous spatial distributions"],
        version="v2.1",
        known_limitations=["Unsupervised statistical anomaly does not establish mens rea or intent"]
    ),
    "detector_02_duplicate_works": DetectorInfo(
        detector_id="D2",
        name="Cross-Year Duplicate Scope & Text Similarity",
        status=DetectorStatus.ACTIVE_VERIFIED,
        regulatory_source="MPLADS Guidelines 2023 (Prohibition of Duplicate Funding, Clause 3.4)",
        assumptions=["Standardized TF-IDF n-gram vectorization with cosine similarity > 0.85 indicates scope redundancy"],
        version="v3.2",
        known_limitations=["Standard repetitive work names (e.g. 'CC Road') require manual GPS and site coordinate cross-check"]
    ),
    "detector_03_cost_overruns": DetectorInfo(
        detector_id="D3",
        name="CPWD Cost Overrun Benchmark Analysis",
        status=DetectorStatus.ACTIVE_VERIFIED,
        regulatory_source="Central Public Works Department Schedule of Rates 2023",
        assumptions=[
            "Unit rates extracted from work descriptions match standard engineering asset types",
            "Andhra Pradesh regional terrain coefficient adjustment: 1.15x"
        ],
        version="v2.1",
        known_limitations=["Cannot parse vague descriptions lacking physical dimensions or unit quantities"]
    ),
    "detector_04_ghost_works": DetectorInfo(
        detector_id="D4",
        name="Payment Record & Disbursement Verification",
        status=DetectorStatus.ADVISORY,
        regulatory_source="MPLADS Guidelines 2016 (Clause 8.3 - Accounting and Audit)",
        assumptions=["Expenditure tracked from official portal records; completed works require non-zero disbursement records"],
        version="v3.0",
        known_limitations=["Disbursement lag or delayed portal entry can mimic missing payment records"]
    ),
    "detector_05_bill_splitting": DetectorInfo(
        detector_id="D5",
        name="Tender Splitting & Threshold Smurfing",
        status=DetectorStatus.ACTIVE_VERIFIED,
        regulatory_source="General Financial Rules (GFR 2017) Rule 157 (Prohibition of Tender Splitting)",
        assumptions=["Same-day or 7-day clustering of identical works just below ₹50 Lakh / ₹10 Lakh statutory approval limits"],
        version="v2.0",
        known_limitations=["Phased legitimate municipal construction packages must be reviewed against administrative sanction"]
    ),
    "detector_06_delay_violation": DetectorInfo(
        detector_id="D6",
        name="Statutory Execution Duration & Stalled Works",
        status=DetectorStatus.ACTIVE_VERIFIED,
        regulatory_source="MPLADS Operational Guidelines (Mandatory 365-day execution norm)",
        assumptions=["Duration between recommendation/sanction and completion exceeding 365 days indicates execution default"],
        version="v2.0",
        known_limitations=["Court stay orders or statutory land acquisition disputes not captured in basic tabular data"]
    ),
    "detector_07_timing_anomaly": DetectorInfo(
        detector_id="D7",
        name="Fiscal Year-End March Rush & Dumping",
        status=DetectorStatus.ACTIVE_VERIFIED,
        regulatory_source="Public Accounts Committee (PAC) Reports on March Expenditure Rushes",
        assumptions=["Expenditure or completion concentrated between March 25 and March 31 carries high verification risk"],
        version="v2.0",
        known_limitations=["Budget lapse deadlines routinely cause legitimate administrative batch processing"]
    ),
    "detector_08_bulk_completion": DetectorInfo(
        detector_id="D8",
        name="Same-Day Batch Completion Screening",
        status=DetectorStatus.ACTIVE_VERIFIED,
        regulatory_source="State Vigilance Inspection Manuals (Anti-Batch Certification Norms)",
        assumptions=["More than 5 major infrastructure works certified completed on the identical date by an IDA suggests paper signoffs"],
        version="v2.0",
        known_limitations=["Clerical staff frequently batch upload historical completion entries on a single afternoon"]
    ),
    "detector_09_benford_anomaly": DetectorInfo(
        detector_id="D9",
        name="Benford's Law & Round-Number Forensic Screen",
        status=DetectorStatus.ACTIVE_VERIFIED,
        regulatory_source="Forensic Accounting First-Digit Analysis (Nigrini Standards)",
        assumptions=["Unconstrained economic expenditure digits conform to logarithmic distribution; excess round numbers flag arbitrary estimates"],
        version="v2.0",
        known_limitations=["Normative lump-sum budget allocations (e.g. ₹5,00,000 grants) are common in MPLADS recommendations"]
    ),
    "detector_10_vague_description": DetectorInfo(
        detector_id="D10",
        name="Vague Description & Scope Ambiguity Screen",
        status=DetectorStatus.ACTIVE_VERIFIED,
        regulatory_source="CAG Performance Audit Standards (Definite Scope Specification Norms)",
        assumptions=["Descriptions under 15 characters or lacking location, quantity, and asset type prevent physical verification"],
        version="v2.0",
        known_limitations=["Clerical abbreviations (e.g. 'CC RD DIV-4') may conceal legitimate engineering works"]
    ),
    "detector_11_plausibility_mismatch": DetectorInfo(
        detector_id="D11",
        name="Category-Cost Engineering Plausibility Bounds",
        status=DetectorStatus.ACTIVE_VERIFIED,
        regulatory_source="CPWD Infrastructure Cost Estimates & MoSPI Category Limits",
        assumptions=["Physical assets have strict engineering cost bounds (e.g. Borewell: ₹25K–₹5L; School: ₹5L–₹5Cr)"],
        version="v2.1",
        known_limitations=["Complex compound projects misclassified under a simple category tag can trigger false positive bounds"]
    ),
    "detector_12_verification_gap": DetectorInfo(
        detector_id="D12",
        name="Documentary Verification Gap Forensics",
        status=DetectorStatus.ADVISORY,
        regulatory_source="MPLADS e-SAKSHI Portal Audit Mandate",
        assumptions=["Works lacking measurement books or geotagged photos require high audit scrutiny"],
        version="v2.0",
        known_limitations=["Field documentation is uploaded to state portals that are not fully consolidated in national exports"]
    ),
    "detector_13_ida_risk": DetectorInfo(
        detector_id="D13",
        name="Implementing District Authority (IDA) Portfolio Profiling",
        status=DetectorStatus.ACTIVE_VERIFIED,
        regulatory_source="District Administrative Governance Benchmarks",
        assumptions=["Statistical aggregation of anomaly density, delay frequency, and over-budget rate by district authority"],
        version="v2.0",
        known_limitations=["Does not replace institutional administrative review of district collectorate capacity"]
    ),
    "detector_14_mp_risk": DetectorInfo(
        detector_id="D14",
        name="Member of Parliament Portfolio Concentration Analysis",
        status=DetectorStatus.ACTIVE_VERIFIED,
        regulatory_source="Public Governance & Allocation Guidelines",
        assumptions=["Portfolio expenditure distribution, sector diversification, and completion velocity by representative"],
        version="v2.0",
        known_limitations=["Sensitive attributes and MP demographics are strictly excluded from all scoring logic"]
    ),
    "detector_15_copy_paste_pricing": DetectorInfo(
        detector_id="D15",
        name="Identical Repetitive Cost Matching (Copy-Paste Estimates)",
        status=DetectorStatus.ACTIVE_VERIFIED,
        regulatory_source="CAG Report on Non-Estimate Formulaic Project Approvals",
        assumptions=["Large clusters of works sanctioned at the exact same anomalous rupee value indicate non-site-specific estimates"],
        version="v2.0",
        known_limitations=["Standardized public utilities (e.g., standard solar street lights) legitimately share identical pricing"]
    )
}


def get_capacity_tier(severity: float, rank_percentile: float) -> str:
    """
    Assigns a work to a capacity-based audit triage tier to eliminate alert fatigue.

    - TIER_1_IMMEDIATE: Top 1% (Highest priority, multiple hard corroborating signals)
    - TIER_2_HIGH_PRIORITY: Top 5% (Strong anomaly concentration requiring field inspection)
    - TIER_3_STANDARD_REVIEW: Top 20% (Routine audit sample verification)
    - COMPLIANT: Remainder of portfolio
    """
    if rank_percentile >= 99.0 or severity >= 0.85:
        return "TIER_1_IMMEDIATE"
    elif rank_percentile >= 95.0 or severity >= 0.70:
        return "TIER_2_HIGH_PRIORITY"
    elif rank_percentile >= 80.0 or severity >= 0.50:
        return "TIER_3_STANDARD_REVIEW"
    else:
        return "COMPLIANT"
