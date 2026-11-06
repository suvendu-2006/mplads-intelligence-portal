"""
Export Trained Isolation Forest Model & Statistical Medians for Real-Time Re-Auditing.
Generates serializable parameters used by Detector 1 in sub-25ms event evaluations.
"""

import json
import logging
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from mplads_fraud_detection.config import (
    MODELS_DIR,
    D1_MODEL_PATH,
    D1_MEDIANS_PATH,
    WORKS_COMPLETED_DETAILED_CSV,
    WORKS_COMPLETED_CSV,
)
from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import Work
from mplads_fraud_detection.foundation.utils import safe_divide

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("export_detector_models")


def load_canonical_works_df() -> pd.DataFrame:
    """Load canonical completed works from the operational database or verified CSV."""
    session = SessionLocal()
    try:
        works = session.query(Work).all()
        if works and len(works) >= 50:
            logger.info(f"Loaded {len(works):,} works from database.")
            return pd.DataFrame([{
                "work_id": w.work_id,
                "cost": w.cost,
                "category": w.category,
                "district": w.district,
                "completion_date": w.completion_date,
                "recommended_date": w.recommended_date,
                "mp_constituency": w.mp_constituency
            } for w in works])
    except Exception as e:
        logger.warning(f"Could not load works from DB ({e}), falling back to CSV.")
    finally:
        session.close()

    csv_path = WORKS_COMPLETED_CSV if WORKS_COMPLETED_CSV.exists() else WORKS_COMPLETED_DETAILED_CSV
    logger.info(f"Loading works from CSV fallback: {csv_path}")
    df = pd.read_csv(csv_path)

    # Normalize column names if needed
    col_mapping = {
        "workId": "work_id",
        "work_cost": "cost",
        "recommended_amount": "cost",
        "workCategory": "category",
        "work_category": "category",
        "completedDate": "completion_date",
        "recommendedDate": "recommended_date",
        "recommendation_date": "recommended_date",
        "constituency": "mp_constituency",
    }
    df = df.rename(columns={k: v for k, v in col_mapping.items() if k in df.columns})
    if "recommended_date" not in df.columns:
        df["recommended_date"] = pd.NaT
    if "completion_date" not in df.columns:
        df["completion_date"] = pd.NaT
    return df


def export_models():
    """Fits IsolationForest on canonical works and exports model & median artifacts."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    df = load_canonical_works_df()
    if df.empty:
        raise RuntimeError("No works available to train Detector 1 Isolation Forest.")

    # Convert dates
    df["completion_date"] = pd.to_datetime(df["completion_date"], errors="coerce")
    df["recommended_date"] = pd.to_datetime(df["recommended_date"], errors="coerce")

    # Feature 1: log_cost
    df["log_cost"] = np.log10(np.maximum(1.0, df["cost"]))

    # Feature 2: execution_days
    df["execution_days"] = (df["completion_date"] - df["recommended_date"]).dt.days

    # Feature 3: completion_month
    df["completion_month"] = df["completion_date"].dt.month.fillna(6).astype(int)

    # Feature 4: cost_vs_category_median
    global_median_cost = float(df["cost"].median())
    cat_counts = df["category"].value_counts()
    valid_cats = cat_counts[cat_counts >= 5].index
    cat_medians = {
        str(k): float(v)
        for k, v in df[df["category"].isin(valid_cats)].groupby("category")["cost"].median().items()
    }
    df["cat_median_cost"] = df["category"].map(cat_medians).fillna(global_median_cost)
    df["cost_vs_category_median"] = safe_divide(df["cost"] - df["cat_median_cost"], df["cat_median_cost"])

    # Feature 5: cost_vs_district_median
    global_median_dist_cost = float(df["cost"].median())
    dist_medians = {
        str(k): float(v)
        for k, v in df.groupby("district")["cost"].median().items()
    }
    df["dist_median_cost"] = df["district"].map(dist_medians).fillna(global_median_dist_cost)
    df["cost_vs_district_median"] = safe_divide(df["cost"] - df["dist_median_cost"], df["dist_median_cost"])

    # Feature 6: days_per_lakh
    cost_in_lakhs = np.maximum(0.1, df["cost"] / 100000.0)
    raw_days_per_lakh = safe_divide(df["execution_days"], cost_in_lakhs, fill=np.nan)
    median_days_lakh = float(np.nanmedian(raw_days_per_lakh)) if not np.isnan(raw_days_per_lakh).all() else 30.0
    df["days_per_lakh"] = raw_days_per_lakh.fillna(median_days_lakh)

    valid_mask = df["execution_days"].notna() & (df["execution_days"] >= 0)
    df_valid = df[valid_mask].copy()

    if len(df_valid) < 50:
        raise RuntimeError(f"Insufficient completed works with valid dates ({len(df_valid)}) for Isolation Forest.")

    feature_cols = [
        "log_cost",
        "execution_days",
        "completion_month",
        "cost_vs_category_median",
        "cost_vs_district_median",
        "days_per_lakh",
    ]

    X = df_valid[feature_cols].values

    logger.info(f"Fitting IsolationForest on {len(df_valid):,} samples across 6 features...")
    model = IsolationForest(
        n_estimators=200,
        contamination="auto",
        max_samples="auto",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X)

    scores = model.score_samples(X)
    threshold = float(scores.mean() - 2.0 * scores.std())
    if (scores < threshold).sum() < 5:
        threshold = float(np.quantile(scores, 0.01))
    min_score = float(scores.min())

    logger.info(f"Isolation Forest fitted. Anomaly threshold: {threshold:.4f}, Min score: {min_score:.4f}")

    # Serialize Model Artifact
    joblib.dump(model, D1_MODEL_PATH)
    logger.info(f"Model saved to: {D1_MODEL_PATH}")

    # Serialize Reference Medians Artifact
    medians_payload = {
        "global_median_cost": global_median_cost,
        "global_median_dist_cost": global_median_dist_cost,
        "category_medians": cat_medians,
        "district_medians": dist_medians,
        "median_days_per_lakh": median_days_lakh,
        "threshold": threshold,
        "min_score": min_score,
        "feature_cols": feature_cols,
        "sample_size": int(len(df_valid)),
    }
    with open(D1_MEDIANS_PATH, "w", encoding="utf-8") as f:
        json.dump(medians_payload, f, indent=2)
    logger.info(f"Reference medians saved to: {D1_MEDIANS_PATH}")
    print("SUCCESS: Model and reference medians exported cleanly.")


if __name__ == "__main__":
    export_models()
