"""
Detector 6: Delays & Stalled Works (Timeline Forensics)
Catches ongoing works stalling past statutory completion deadlines and completed works with severe delay violations.
"""

import logging
from datetime import datetime, date
from typing import Dict, List, Any
import pandas as pd
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from mplads_fraud_detection.foundation.utils import safe_divide, monotonic_severity
from mplads_fraud_detection.config import SEVERITY_FLOOR, DEFAULT_SNAPSHOT_AS_OF_DATE

logger = logging.getLogger(__name__)


def run_detector_06_delay_violation(
    session: Session,
    run_id: str,
    as_of_date_str: str = DEFAULT_SNAPSHOT_AS_OF_DATE
) -> int:
    """
    Executes Detector 6: Delays & Stalled Works past 365-day statutory guideline.
    """
    logger.info("Executing Detector 6: Delays & Stalled Works...")

    as_of_date = pd.to_datetime(as_of_date_str).date()
    works = session.query(Work).all()
    if not works:
        return 0

    df = pd.DataFrame([{
        "work_id": w.work_id,
        "cost": w.cost,
        "status": w.status,
        "category": w.category,
        "district": w.district,
        "mp_name": w.mp_name,
        "recommended_date": w.recommended_date,
        "completion_date": w.completion_date,
        "work_description": w.work_description
    } for w in works])

    df["recommended_date"] = pd.to_datetime(df["recommended_date"], errors="coerce").dt.date
    df["completion_date"] = pd.to_datetime(df["completion_date"], errors="coerce").dt.date

    # Filter rows with valid recommendation dates
    df_valid = df[df["recommended_date"].notna()].copy()
    if df_valid.empty:
        return 0

    anomalies_to_insert = []
    phase_keywords = ["phase", "stage", "part", "package"]

    for _, row in df_valid.iterrows():
        rec_date = row["recommended_date"]
        comp_date = row["completion_date"]
        status = str(row["status"]).lower()
        desc = str(row["work_description"]).lower()
        is_phase_work = any(kw in desc for kw in phase_keywords)

        flagged = False
        severity = 0.0
        delay_days = 0
        branch_type = ""

        # Branch 1: In-Progress Stalled Works (status != 'completed')
        if status != "completed" or comp_date is None:
            age_days = (as_of_date - rec_date).days
            if age_days > 365:
                flagged = True
                branch_type = "stalled_in_progress"
                delay_days = age_days - 365
                severity = monotonic_severity(age_days, [365, 548, 730, 1095], [0.50, 0.65, 0.80, 1.00])

        # Branch 2: Completed Over-Delayed Works
        else:
            work_days = (comp_date - rec_date).days
            if work_days > 365:
                flagged = True
                branch_type = "completed_delayed"
                delay_days = work_days - 365
                severity = monotonic_severity(work_days, [365, 548, 730, 1095], [0.30, 0.45, 0.60, 0.80])

        if not flagged:
            continue

        # False Positive Mitigation: Multi-Phase Scheme Adjustment
        if is_phase_work:
            severity = min(0.69, severity * 0.80)  # Excluded from Critical tier

        if severity < SEVERITY_FLOOR:
            continue

        cost_val = float(row["cost"])
        is_critical = (severity >= 0.90)

        if branch_type == "stalled_in_progress":
            explanation = (
                f"Statutory Delay Violation (Stalled In-Progress): Project recommended on {rec_date} "
                f"has remained uncompleted for {age_days} days (overdue by {delay_days} days past the 1-year statutory deadline). "
                f"Holding ₹{cost_val:,.0f} in committed public funds."
            )
        else:
            explanation = (
                f"Statutory Delay Violation (Execution Overrun): Project took {work_days} days from recommendation "
                f"({rec_date}) to completion ({comp_date}), exceeding the statutory 1-year guideline by {delay_days} days."
            )

        evidence = {
            "branch_type": branch_type,
            "recommended_date": str(rec_date),
            "completion_date": str(comp_date) if comp_date else None,
            "as_of_date": str(as_of_date),
            "total_duration_days": age_days if branch_type == "stalled_in_progress" else work_days,
            "statutory_limit_days": 365,
            "days_overdue": delay_days,
            "is_multi_phase": is_phase_work,
            "is_critical": is_critical,
            "cost": cost_val,
            "district": str(row["district"]),
            "mp_name": str(row["mp_name"])
        }

        anomaly = Anomaly(
            work_id=int(row["work_id"]),
            detector_type="delay_violation",
            severity=round(severity, 3),
            explanation=explanation,
            evidence=evidence,
            run_id=run_id
        )
        anomalies_to_insert.append(anomaly)

    session.bulk_save_objects(anomalies_to_insert)
    session.flush()
    logger.info(f"Detector 6 generated {len(anomalies_to_insert):,} delay violation anomalies.")
    return len(anomalies_to_insert)
