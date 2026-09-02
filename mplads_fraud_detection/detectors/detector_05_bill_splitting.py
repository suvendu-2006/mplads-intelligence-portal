"""
Detector 5: Bill Splitting / Smurfing (Threshold Evasion)
Catches projects fractured into multiple tenders just below statutory e-tendering (₹5L) and quotation (₹20L) limits.
"""

import logging
from typing import Dict, List, Any
import pandas as pd
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from mplads_fraud_detection.foundation.utils import safe_divide, monotonic_severity
from mplads_fraud_detection.config import SEVERITY_FLOOR

logger = logging.getLogger(__name__)


def run_detector_05_bill_splitting(session: Session, run_id: str) -> int:
    """
    Executes Detector 5: Bill Splitting across statutory procurement bands.
    """
    logger.info("Executing Detector 5: Bill Splitting / Smurfing...")

    works = session.query(Work).all()
    if not works:
        return 0

    df = pd.DataFrame([{
        "work_id": w.work_id,
        "cost": w.cost,
        "mp_name": w.mp_name,
        "category": w.category,
        "recommended_date": w.recommended_date,
        "work_description": w.work_description,
        "district": w.district
    } for w in works])

    df["recommended_date"] = pd.to_datetime(df["recommended_date"], errors="coerce")
    df_valid = df[df["recommended_date"].notna()].copy()

    # Extract recommendation month
    df_valid["rec_month"] = df_valid["recommended_date"].dt.to_period("M").astype(str)

    # Define Smurfing Threshold Bands
    # Band 5L: ₹4,50,000 to ₹4,99,999 (just below ₹5 Lakh e-tendering limit)
    # Band 20L: ₹18,00,000 to ₹19,99,999 (just below ₹20 Lakh quotation limit)
    mask_5l = (df_valid["cost"] >= 450000.0) & (df_valid["cost"] < 500000.0)
    mask_20l = (df_valid["cost"] >= 1800000.0) & (df_valid["cost"] < 2000000.0)

    df_valid["smurf_band"] = None
    df_valid.loc[mask_5l, "smurf_band"] = "5L"
    df_valid.loc[mask_20l, "smurf_band"] = "20L"

    df_smurf = df_valid[df_valid["smurf_band"].notna()].copy()
    if df_smurf.empty:
        return 0

    anomalies_to_insert = []

    # Group by (mp_name, rec_month, smurf_band)
    grouped = df_smurf.groupby(["mp_name", "rec_month", "smurf_band"])

    for (mp_name, rec_month, band), group in grouped:
        n_works = len(group)
        total_cost = group["cost"].sum()
        unique_categories = group["category"].nunique()
        is_single_category = (unique_categories == 1)

        flagged = False
        base_severity = 0.0

        if band == "5L":
            # Rule 1: >= 3 works in 5L band in same month
            if n_works >= 5:
                flagged = True
                base_severity = 0.80
            elif n_works >= 3:
                flagged = True
                base_severity = 0.60
        elif band == "20L":
            # Rule 2: >= 2 works in 20L band in same month summing >= ₹20 Lakh
            if n_works >= 2 and total_cost >= 2000000.0:
                flagged = True
                base_severity = 0.70

        if not flagged:
            continue

        # Category Homogeneity Boost (+0.10)
        final_severity = min(1.0, base_severity + (0.10 if is_single_category else 0.0))
        if final_severity < SEVERITY_FLOOR:
            continue

        work_ids = group["work_id"].tolist()
        threshold_name = "₹5 Lakh e-tendering" if band == "5L" else "₹20 Lakh quotation"

        for _, row in group.iterrows():
            explanation = (
                f"Bill Splitting / Smurfing Anomaly: Work cost (₹{row['cost']:,.0f}) sits in the {band} threshold band "
                f"(₹{4.5 if band=='5L' else 18.0}L–₹{5.0 if band=='5L' else 20.0}L). "
                f"MP {mp_name} recommended {n_works} such projects in {rec_month} totaling ₹{total_cost:,.0f} "
                f"{'(all in the same category: ' + str(row['category']) + ')' if is_single_category else ''}, "
                f"indicating structured contract fragmentation to bypass {threshold_name} limits."
            )

            evidence = {
                "smurf_band": band,
                "cluster_size": n_works,
                "cluster_total_cost": float(total_cost),
                "recommendation_month": rec_month,
                "threshold_evaded": threshold_name,
                "single_category": is_single_category,
                "peer_cluster_work_ids": [wid for wid in work_ids if wid != row["work_id"]],
                "mp_name": mp_name,
                "cost": float(row["cost"])
            }

            anomaly = Anomaly(
                work_id=int(row["work_id"]),
                detector_type="bill_splitting",
                severity=round(final_severity, 3),
                explanation=explanation,
                evidence=evidence,
                run_id=run_id
            )
            anomalies_to_insert.append(anomaly)

    session.bulk_save_objects(anomalies_to_insert)
    session.flush()
    logger.info(f"Detector 5 generated {len(anomalies_to_insert):,} bill splitting anomalies.")
    return len(anomalies_to_insert)
