"""
Feature Extraction Engine for Supervised MPLADS Fraud-Risk Models.
Converts physical infrastructure metadata, detector severity vectors, and transaction signals into ML-ready tabular features.
"""

import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Any
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from mplads_fraud_detection.config import DETECTOR_GROUPS
from mplads_fraud_detection.features.excluded_attributes import validate_feature_ethics


DETECTOR_FEATURE_COLS = [
    "unusual_pattern",
    "duplicate_work",
    "cost_overrun",
    "ghost_work",
    "bill_splitting",
    "delay_violation",
    "timing_anomaly",
    "bulk_completion",
    "benford_anomaly",
    "vague_description",
    "plausibility_mismatch",
    "verification_gap",
    "copy_paste_pricing"
]


def extract_work_features(session: Session, run_id: str) -> Tuple[pd.DataFrame, List[str]]:
    """
    Extracts high-dimensional tabular feature matrix for all works in the database for a given run_id.

    Returns:
        (feature_dataframe, feature_column_names)
    """
    works = session.query(Work).all()
    anomalies = session.query(Anomaly).filter(Anomaly.run_id == run_id).all()

    # Build work-level base records
    work_records = []
    for w in works:
        desc = w.work_description or ""
        cost_val = float(w.cost)
        
        # Temporal days
        duration_days = 0
        if w.completion_date and w.recommended_date:
            duration_days = max(0, (w.completion_date - w.recommended_date).days)
        elif w.completion_date:
            duration_days = 180  # standard median fallback

        work_records.append({
            "work_id": w.work_id,
            "cost_inr": cost_val,
            "log_cost": float(np.log1p(cost_val)),
            "desc_length": len(desc),
            "word_count": len(desc.split()),
            "duration_days": duration_days,
            "has_payments": 1.0 if w.has_payments else 0.0,
            "payment_gap_pct": float(w.payment_gap_percentage or 0.0),
            "total_paid_ratio": float(w.total_paid / max(1.0, cost_val)),
            "is_road": 1.0 if "road" in str(w.category).lower() else 0.0,
            "is_water": 1.0 if "water" in str(w.category).lower() or "bore" in desc.lower() else 0.0,
            "is_school": 1.0 if "school" in desc.lower() or "classroom" in desc.lower() else 0.0,
            "is_solar": 1.0 if "solar" in desc.lower() or "light" in desc.lower() else 0.0,
        })

    df_feats = pd.DataFrame(work_records).set_index("work_id")

    # Build detector severity feature matrix
    anom_matrix = pd.DataFrame(0.0, index=df_feats.index, columns=DETECTOR_FEATURE_COLS)
    for a in anomalies:
        if a.work_id in anom_matrix.index and a.detector_type in DETECTOR_FEATURE_COLS:
            anom_matrix.loc[a.work_id, a.detector_type] = float(a.severity)

    # Combine metadata + detector features
    df_combined = pd.concat([df_feats, anom_matrix], axis=1).reset_index()

    # Add composite multi-signal interaction features
    df_combined["num_detectors_active"] = (df_combined[DETECTOR_FEATURE_COLS] >= 0.50).sum(axis=1)
    df_combined["max_detector_severity"] = df_combined[DETECTOR_FEATURE_COLS].max(axis=1)
    df_combined["mean_detector_severity"] = df_combined[DETECTOR_FEATURE_COLS].mean(axis=1)

    feature_cols = [c for c in df_combined.columns if c not in ["work_id"]]
    validate_feature_ethics(feature_cols)

    return df_combined, feature_cols
