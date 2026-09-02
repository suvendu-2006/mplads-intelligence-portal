"""
Detector 1: Unusual Patterns (Isolation Forest)
Catches multi-dimensional statistical outliers across financial and execution timeline distributions.
"""

import logging
from typing import Dict, List, Any
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.inspection import permutation_importance
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from mplads_fraud_detection.foundation.utils import safe_divide, monotonic_severity
from mplads_fraud_detection.config import SEVERITY_FLOOR

logger = logging.getLogger(__name__)


def run_detector_01_unusual_patterns(session: Session, run_id: str) -> int:
    """
    Executes Detector 1: Unusual Patterns using Isolation Forest.
    """
    logger.info("Executing Detector 1: Unusual Patterns (Isolation Forest)...")

    works = session.query(Work).all()
    if not works:
        return 0

    df = pd.DataFrame([{
        "work_id": w.work_id,
        "cost": w.cost,
        "category": w.category,
        "district": w.district,
        "completion_date": w.completion_date,
        "recommended_date": w.recommended_date,
        "mp_constituency": w.mp_constituency
    } for w in works])

    # Convert dates
    df["completion_date"] = pd.to_datetime(df["completion_date"], errors="coerce")
    df["recommended_date"] = pd.to_datetime(df["recommended_date"], errors="coerce")

    # Feature 1: log_cost
    df["log_cost"] = np.log10(np.maximum(1.0, df["cost"]))

    # Feature 2: execution_days
    df["execution_days"] = (df["completion_date"] - df["recommended_date"]).dt.days

    # Feature 3: completion_month
    df["completion_month"] = df["completion_date"].dt.month.fillna(6).astype(int)

    # Feature 4: cost_vs_category_median (guarded: fallback to global median if category < 5)
    global_median_cost = df["cost"].median()
    cat_counts = df["category"].value_counts()
    valid_cats = cat_counts[cat_counts >= 5].index
    cat_medians = df[df["category"].isin(valid_cats)].groupby("category")["cost"].median().to_dict()
    df["cat_median_cost"] = df["category"].map(cat_medians).fillna(global_median_cost)
    df["cost_vs_category_median"] = safe_divide(df["cost"] - df["cat_median_cost"], df["cat_median_cost"])

    # Feature 5: cost_vs_district_median
    global_median_dist_cost = df["cost"].median()
    dist_medians = df.groupby("district")["cost"].median().to_dict()
    df["dist_median_cost"] = df["district"].map(dist_medians).fillna(global_median_dist_cost)
    df["cost_vs_district_median"] = safe_divide(df["cost"] - df["dist_median_cost"], df["dist_median_cost"])

    # Feature 6: days_per_lakh
    cost_in_lakhs = np.maximum(0.1, df["cost"] / 100000.0)
    raw_days_per_lakh = safe_divide(df["execution_days"], cost_in_lakhs, fill=np.nan)
    median_days_lakh = np.nanmedian(raw_days_per_lakh) if not np.isnan(raw_days_per_lakh).all() else 30.0
    df["days_per_lakh"] = raw_days_per_lakh.fillna(median_days_lakh)

    # Filter rows with valid dates for model training and prediction
    valid_mask = df["execution_days"].notna() & (df["execution_days"] >= 0)
    df_valid = df[valid_mask].copy()

    if len(df_valid) < 50:
        logger.warning("Insufficient completed works with recommendation dates for Isolation Forest.")
        return 0

    feature_cols = [
        "log_cost",
        "execution_days",
        "completion_month",
        "cost_vs_category_median",
        "cost_vs_district_median",
        "days_per_lakh"
    ]

    X = df_valid[feature_cols].values

    # Fit Isolation Forest
    model = IsolationForest(
        n_estimators=200,
        contamination="auto",
        max_samples="auto",
        random_state=42,
        n_jobs=-1
    )
    model.fit(X)

    # Decision function (lower = more anomalous)
    scores = model.score_samples(X)
    threshold = scores.mean() - 2.0 * scores.std()

    # Degeneracy guard (ensure at least top 1% evaluated)
    flagged_mask = scores < threshold
    if flagged_mask.sum() < 5:
        threshold = np.quantile(scores, 0.01)
        flagged_mask = scores < threshold

    min_score = scores.min()

    # Permutation importance for evidence
    try:
        y_pseudo = np.where(scores < threshold, 1, 0)
        perm = permutation_importance(model, X, y_pseudo, n_repeats=5, random_state=42, n_jobs=-1)
        importance_dict = {feature_cols[i]: round(float(perm.importances_mean[i]), 4) for i in range(len(feature_cols))}
    except Exception:
        importance_dict = {col: 0.16 for col in feature_cols}

    anomalies_to_insert = []
    for idx, is_anom in enumerate(flagged_mask):
        if not is_anom:
            continue

        row = df_valid.iloc[idx]
        score_val = scores[idx]

        # Calculate monotonic severity
        severity = monotonic_severity(-score_val, [-threshold, -min_score], [0.50, 1.00])
        if severity < SEVERITY_FLOOR:
            continue

        cost_val = float(row["cost"])
        exec_days = int(row["execution_days"])
        cat_dev = float(row["cost_vs_category_median"])
        days_lakh = float(row["days_per_lakh"])
        cat_name = str(row["category"])

        explanation = (
            f"Unusual statistical pattern detected: Project financial/temporal profile "
            f"(₹{cost_val:,.0f}, {exec_days} days) deviates significantly from peer '{cat_name}' projects. "
            f"Cost is {abs(cat_dev)*100:.1f}% {'above' if cat_dev > 0 else 'below'} category median "
            f"with an execution rate of {days_lakh:.1f} days per lakh."
        )

        evidence = {
            "log_cost": round(float(row["log_cost"]), 2),
            "cost": cost_val,
            "execution_days": exec_days,
            "completion_month": int(row["completion_month"]),
            "cost_vs_category_median_pct": round(cat_dev * 100, 1),
            "cost_vs_district_median_pct": round(float(row["cost_vs_district_median"]) * 100, 1),
            "days_per_lakh": round(days_lakh, 1),
            "category_median_cost": float(row["cat_median_cost"]),
            "anomaly_score": round(float(score_val), 4),
            "threshold_used": round(float(threshold), 4),
            "feature_importance": importance_dict
        }

        anomaly = Anomaly(
            work_id=int(row["work_id"]),
            detector_type="unusual_pattern",
            severity=round(severity, 3),
            explanation=explanation,
            evidence=evidence,
            run_id=run_id
        )
        anomalies_to_insert.append(anomaly)

    session.bulk_save_objects(anomalies_to_insert)
    session.flush()
    logger.info(f"Detector 1 generated {len(anomalies_to_insert):,} unusual pattern anomalies.")
    return len(anomalies_to_insert)
