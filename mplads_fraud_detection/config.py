"""
Global Configuration for MPLADS Fraud Detection System.
Defines constants, dataset paths, database settings, and tuning parameters.
"""

import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
ARTIFACTS_DIR = BASE_DIR / "artifacts"
MODELS_DIR = BASE_DIR / "models"

os.makedirs(ARTIFACTS_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

# Dataset Paths
WORKS_COMPLETED_DETAILED_CSV = DATA_DIR / "works_completed_detailed.csv"
WORKS_COMPLETED_CSV = DATA_DIR / "works_completed.csv"
WORKS_RECOMMENDED_CSV = DATA_DIR / "works_recommended.csv"
CPWD_BENCHMARK_RATES_CSV = DATA_DIR / "cpwd_benchmark_rates.csv"
UNIT_PRICES_MASTER_CSV = DATA_DIR / "unit_prices_master.csv"
ALL_MPS_FINANCIAL_BREAKDOWN_CSV = DATA_DIR / "all_mps_financial_breakdown.csv"
ALL_MPS_SUMMARY_CSV = DATA_DIR / "all_mps_summary.csv"
ALL_DISTRICTS_MPLADS_SUMMARY_CSV = DATA_DIR / "all_districts_mplads_summary.csv"
EXPENDITURES_CSV = DATA_DIR / "expenditures.csv"

# Fallback paths (if data/ subfolder is accessed relative to parent)
if not WORKS_COMPLETED_DETAILED_CSV.exists():
    WORKS_COMPLETED_DETAILED_CSV = BASE_DIR / "06_Works" / "works_completed_detailed.csv"
    WORKS_COMPLETED_CSV = BASE_DIR / "06_Works" / "works_completed.csv"
    WORKS_RECOMMENDED_CSV = BASE_DIR / "06_Works" / "works_recommended.csv"
    CPWD_BENCHMARK_RATES_CSV = BASE_DIR / "06_Works" / "cpwd_benchmark_rates.csv"
    UNIT_PRICES_MASTER_CSV = BASE_DIR / "06_Works" / "unit_prices_master.csv"
    ALL_MPS_FINANCIAL_BREAKDOWN_CSV = BASE_DIR / "07_Expenditures" / "all_mps_financial_breakdown.csv"
    ALL_MPS_SUMMARY_CSV = BASE_DIR / "03_MPs_Data" / "all_mps_summary.csv"
    ALL_DISTRICTS_MPLADS_SUMMARY_CSV = BASE_DIR / "10_District_Level_Data" / "all_districts_mplads_summary.csv"

if not EXPENDITURES_CSV.exists():
    fallback_exp = BASE_DIR / "07_Expenditures" / "expenditures.csv"
    if fallback_exp.exists():
        EXPENDITURES_CSV = fallback_exp


def get_absolute_db_path(url: str) -> str:
    """Convert relative SQLite path to absolute based on BASE_DIR."""
    if url.startswith("sqlite:///"):
        path_part = url[len("sqlite:///"):]
        if path_part != ":memory:":
            p = Path(path_part)
            if not p.is_absolute():
                return f"sqlite:///{BASE_DIR / p}"
    return url


from dotenv import load_dotenv
load_dotenv()

# Application Environment: development | staging | production
APP_ENV = os.environ.get("APP_ENV", "development")
DATABASE_URL = get_absolute_db_path(os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR}/mplads_dev.db"))

# Production validation check
if APP_ENV == "production":
    assert DATABASE_URL.startswith("postgresql://"), "Production MUST use PostgreSQL, not SQLite"
    assert "mplads_fraud.db" not in DATABASE_URL, "Production cannot use local dev database file"

# Global Severity Thresholds (Canonical 5-class system)
SEVERITY_FLOOR = 0.50  # Global minimum threshold to insert into anomalies table

TIER_BOUNDARIES = {
    "Clean": (0.00, 0.299),
    "Medium": (0.30, 0.499),
    "High": (0.50, 0.699),
    "Very High": (0.70, 0.899),
    "Critical": (0.90, 1.000)
}

# Group Membership for Deduplicated Composite Scoring
DETECTOR_GROUPS = {
    "unusual_pattern": "statistical",
    "benford_anomaly": "statistical",
    "duplicate_work": "content",
    "vague_description": "content",
    "cost_overrun": "financial",
    "ghost_work": "financial",
    "bill_splitting": "financial",
    "plausibility_mismatch": "financial",
    "verification_gap": "financial",
    "copy_paste_pricing": "financial",
    "delay_violation": "temporal",
    "timing_anomaly": "temporal",
    "bulk_completion": "temporal"
}

# Detector Evidence Reliability Weights (Weighted Forensic Triage)
DETECTOR_RELIABILITY_WEIGHTS = {
    # Hard Evidence (Verifiable engineering & physical constants)
    "cost_overrun": 1.0,
    "plausibility_mismatch": 1.0,
    "bill_splitting": 1.0,
    "delay_violation": 1.0,
    # Statistical Patterns (Mathematical distribution anomalies)
    "unusual_pattern": 0.8,
    "benford_anomaly": 0.8,
    # Behavioral Patterns (Administrative temporal & payment patterns)
    "ghost_work": 0.7,
    "timing_anomaly": 0.7,
    "bulk_completion": 0.7,
    "verification_gap": 0.7,
    # Content Interpretation (Text heuristics & administrative lumpsums)
    "duplicate_work": 0.5,
    "vague_description": 0.5,
    "copy_paste_pricing": 0.5,
}

HARD_EVIDENCE_DETECTORS = {
    "cost_overrun", "plausibility_mismatch", "bill_splitting", "delay_violation"
}

ACTION_TRIAGE_TIERS = {
    "Audit Now": "🔴 Immediate field verification & forensic audit",
    "Review": "🟡 Desk review & tender document check",
    "Monitor": "⚪ Monitored in forensic audit cycles",
    "Clean": "🟢 Verified clean project"
}

# 13 Work-Level Detector Weights for D13 & D14 (Sum to exactly 1.00)
ENTITY_RISK_WEIGHTS = {
    "ghost_work": 0.16,
    "cost_overrun": 0.13,
    "verification_gap": 0.11,
    "bulk_completion": 0.11,
    "benford_anomaly": 0.09,
    "duplicate_work": 0.07,
    "vague_description": 0.06,
    "plausibility_mismatch": 0.06,
    "bill_splitting": 0.05,
    "unusual_pattern": 0.05,
    "copy_paste_pricing": 0.05,
    "delay_violation": 0.03,
    "timing_anomaly": 0.03
}

# Difficult Terrain Districts in Andhra Pradesh (+15% CPWD tolerance)
AP_DIFFICULT_TERRAIN_DISTRICTS = {
    "VISAKHAPATNAM",
    "VIZIANAGARAM",
    "EAST GODAVARI",
    "WEST GODAVARI",
    "ALLURI SITHARAMA RAJU",
    "PARVATHIPURAM MANYAM",
    "SRIKAKULAM"
}

# Statutory Policy Thresholds
POLICY_CEILINGS = {
    "e_tender_limit": 500000.0,      # ₹5 Lakh
    "quotation_limit": 2000000.0,    # ₹20 Lakh
    "major_project_limit": 5000000.0 # ₹50 Lakh
}

# As-Of Snapshot Reference Date for Stalled Works
DEFAULT_SNAPSHOT_AS_OF_DATE = "2026-03-31"

# Embedding Model Cache
EMBEDDINGS_CACHE_FILE = ARTIFACTS_DIR / "embeddings_cache.pkl"
SENTENCE_TRANSFORMER_MODEL = "intfloat/multilingual-e5-small"
FALLBACK_TRANSFORMER_MODEL = "all-MiniLM-L6-v2"
