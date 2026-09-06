import os
from pathlib import Path
from typing import Dict

BASE_DIR = Path(__file__).resolve().parent.parent

def find_database_path() -> Path:
    env_path = os.getenv("DATABASE_PATH")
    if env_path and Path(env_path).exists():
        return Path(env_path)
    
    candidates = [
        BASE_DIR / "api" / "mplads_dev.db",
        BASE_DIR / "mplads_dev.db",
        Path("/var/task/api/mplads_dev.db"),
        Path("/var/task/mplads_dev.db"),
        Path("/tmp/mplads_dev.db"),
    ]
    for p in candidates:
        if p.exists() and p.is_file():
            return p
    return BASE_DIR / "mplads_dev.db"

def get_database_url() -> str:
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url
    
    db_file = find_database_path()
    return f"sqlite:///file:{db_file.resolve()}?mode=ro&immutable=1&uri=true"

DB_PATH = find_database_path()
DB_URL = get_database_url()

DATA_DIR = BASE_DIR / "data"
OVERVIEW_DIR = BASE_DIR / "01_Overview_and_National_Summary"
STATES_DIR = BASE_DIR / "02_States_and_UTs"
MPS_DIR = BASE_DIR / "03_MPs_Data"
ANALYTICS_DIR = BASE_DIR / "05_Analytics_and_Trends"
BOUNDARIES_DIR = BASE_DIR / "08_Spatial_Boundaries"
DEMOGRAPHICS_DIR = BASE_DIR / "09_MP_Demographics_ADR"

# 15 Detector Friendly Names Map (Administrative Vigilance Terminology)
DETECTOR_NAMES: Dict[str, str] = {
    "unusual_pattern": "Unusual Spending Pattern",
    "duplicate_work": "Potential Duplicate Work (Double Billing)",
    "cost_overrun": "Cost Exceeds CPWD Benchmark",
    "ghost_work": "High Risk of Non-Existent Asset (Ghost Work)",
    "bill_splitting": "Tender Splitting (Avoiding E-Tender Ceiling)",
    "delay_violation": "Severe Project Delay Violation",
    "timing_anomaly": "Year-End Budget Rush (March Surge)",
    "bulk_completion": "Unrealistic Same-Day Batch Completion",
    "benford_anomaly": "Artificial Round-Figure Billing Anomaly",
    "vague_description": "Incomplete Work Description",
    "plausibility_mismatch": "High Cost Relative to Asset Scope",
    "verification_gap": "Documentary Verification & Disbursement Gap",
    "ida_risk": "Implementing Agency (IDA) Risk Profiling",
    "mp_risk": "MP Portfolio Concentration & Allocation Anomaly",
    "copy_paste_pricing": "Identical Estimate / Copy-Paste Pricing"
}

# Universal Normalization Mapping for all 15 Detectors (D1 - D15)
DETECTOR_ID_TO_TYPE: Dict[str, str] = {
    # D1: Unusual Spending Patterns
    "d1": "unusual_pattern",
    "d01": "unusual_pattern",
    "unusual_pattern": "unusual_pattern",
    "unusual_patterns": "unusual_pattern",
    "detector_01_unusual_patterns": "unusual_pattern",

    # D2: Duplicate Works
    "d2": "duplicate_work",
    "d02": "duplicate_work",
    "duplicate_work": "duplicate_work",
    "duplicate_works": "duplicate_work",
    "detector_02_duplicate_works": "duplicate_work",

    # D3: Cost Overruns
    "d3": "cost_overrun",
    "d03": "cost_overrun",
    "cost_overrun": "cost_overrun",
    "cost_overruns": "cost_overrun",
    "detector_03_cost_overruns": "cost_overrun",

    # D4: Ghost Works
    "d4": "ghost_work",
    "d04": "ghost_work",
    "ghost_work": "ghost_work",
    "ghost_works": "ghost_work",
    "detector_04_ghost_works": "ghost_work",

    # D5: Bill Splitting
    "d5": "bill_splitting",
    "d05": "bill_splitting",
    "bill_splitting": "bill_splitting",
    "detector_05_bill_splitting": "bill_splitting",

    # D6: Delay Violation
    "d6": "delay_violation",
    "d06": "delay_violation",
    "delay_violation": "delay_violation",
    "detector_06_delay_violation": "delay_violation",

    # D7: Timing Anomaly
    "d7": "timing_anomaly",
    "d07": "timing_anomaly",
    "timing_anomaly": "timing_anomaly",
    "detector_07_timing_anomaly": "timing_anomaly",

    # D8: Bulk Completion
    "d8": "bulk_completion",
    "d08": "bulk_completion",
    "bulk_completion": "bulk_completion",
    "detector_08_bulk_completion": "bulk_completion",

    # D9: Benford's Law
    "d9": "benford_anomaly",
    "d09": "benford_anomaly",
    "benford_anomaly": "benford_anomaly",
    "detector_09_benford_anomaly": "benford_anomaly",

    # D10: Vague Description
    "d10": "vague_description",
    "vague_description": "vague_description",
    "detector_10_vague_description": "vague_description",

    # D11: Plausibility Mismatch
    "d11": "plausibility_mismatch",
    "plausibility_mismatch": "plausibility_mismatch",
    "detector_11_plausibility_mismatch": "plausibility_mismatch",

    # D12: Verification Gap
    "d12": "verification_gap",
    "verification_gap": "verification_gap",
    "detector_12_verification_gap": "verification_gap",

    # D13: IDA Risk
    "d13": "ida_risk",
    "ida_risk": "ida_risk",
    "detector_13_ida_risk": "ida_risk",

    # D14: MP Risk
    "d14": "mp_risk",
    "mp_risk": "mp_risk",
    "detector_14_mp_risk": "mp_risk",

    # D15: Copy-Paste Pricing
    "d15": "copy_paste_pricing",
    "copy_paste_pricing": "copy_paste_pricing",
    "detector_15_copy_paste_pricing": "copy_paste_pricing",
}

def resolve_detector_type(detector: Optional[str]) -> Optional[str]:
    """
    Normalizes any client detector string (e.g. 'D1', 'd09', 'benford_anomaly')
    to the canonical database detector_type string.
    """
    if not detector:
        return None
    cleaned = detector.strip().lower()
    return DETECTOR_ID_TO_TYPE.get(cleaned, cleaned)

def get_tier(severity: float) -> str:
    """
    Work-level anomaly tier:
    - red: severity >= 0.70 (Critical)
    - orange: 0.50 <= severity < 0.70 (High)
    - green: unflagged (< 0.50)
    Note: DB constraint chk_anomaly_severity_range enforces severity >= 0.50 in anomalies table.
    """
    if severity >= 0.70:
        return "red"
    elif severity >= 0.50:
        return "orange"
    return "green"

def get_entity_tier(composite_risk: float) -> str:
    """
    Entity-level risk tier on 0-20 scale (Empirical Bayes):
    - CRITICAL: >= 18.0
    - HIGH: 15.0 - 17.99
    - MEDIUM: 10.0 - 14.99
    - LOW: < 10.0
    """
    if composite_risk >= 18.0:
        return "CRITICAL"
    elif composite_risk >= 15.0:
        return "HIGH"
    elif composite_risk >= 10.0:
        return "MEDIUM"
    return "LOW"
