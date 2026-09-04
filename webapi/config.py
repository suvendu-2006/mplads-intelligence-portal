import os
from pathlib import Path
from typing import Dict

BASE_DIR = Path(__file__).resolve().parent.parent

def find_database_path() -> Path:
    candidates = [
        Path("/tmp/mplads_dev.db"),
        BASE_DIR / "mplads_dev.db",
        BASE_DIR / "api" / "mplads_dev.db",
        Path("/var/task/mplads_dev.db"),
        Path("/var/task/api/mplads_dev.db"),
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
    
    # In Vercel serverless environment, copy to RAM-backed /tmp for maximum read speed & zero locks
    if os.getenv("VERCEL") and db_file.exists() and db_file != Path("/tmp/mplads_dev.db"):
        tmp_db = Path("/tmp/mplads_dev.db")
        if not tmp_db.exists():
            try:
                import shutil
                shutil.copyfile(db_file, tmp_db)
                db_file = tmp_db
            except Exception:
                pass
                
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
    "verification_gap": "Missing Inspection Documentation",
    "ida_risk": "Implementing Agency Vigilance Review",
    "mp_risk": "MP Portfolio Spending Anomaly",
    "copy_paste_pricing": "Identical Estimate / Copy-Paste Pricing"
}

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
