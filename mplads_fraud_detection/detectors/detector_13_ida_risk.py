"""
Detector 13: Implementing District Authority (IDA) Risk Profiler
Aggregates all 13 work-level detector rates with Empirical Bayes shrinkage into composite agency forensic risk.
"""

import logging
from typing import Dict, List, Any
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly, EntityRisk
from mplads_fraud_detection.foundation.utils import classify_entity_tier
from mplads_fraud_detection.config import ENTITY_RISK_WEIGHTS

logger = logging.getLogger(__name__)


def run_detector_13_ida_risk(session: Session, run_id: str) -> int:
    """
    Executes Detector 13: IDA Forensic Risk Profiling.
    """
    logger.info("Executing Detector 13: IDA Agency Risk Profiling...")

    works = session.query(Work).all()
    if not works:
        return 0

    df_works = pd.DataFrame([{
        "work_id": w.work_id,
        "district": str(w.district).upper(),
        "cost": w.cost
    } for w in works])

    anomalies = session.query(Anomaly).filter(Anomaly.run_id == run_id).all()
    df_anom = pd.DataFrame([{
        "work_id": a.work_id,
        "detector_type": a.detector_type,
        "severity": a.severity
    } for a in anomalies]) if anomalies else pd.DataFrame(columns=["work_id", "detector_type", "severity"])

    df_merged = df_works.merge(df_anom, on="work_id", how="left")

    # Aggregate per District (IDA)
    dist_stats = []
    total_districts = df_works["district"].nunique()

    for dist, group in df_merged.groupby("district"):
        total_works = group["work_id"].nunique()
        total_expenditure = group.drop_duplicates(subset=["work_id"])["cost"].sum()

        flagged_works_mask = group["detector_type"].notna()
        unique_flagged = group[flagged_works_mask]["work_id"].nunique()
        flagged_rate = unique_flagged / max(1, total_works)

        # Compute per-detector violation rates
        detector_breakdown = {}
        weighted_raw_score = 0.0

        for det_type, weight in ENTITY_RISK_WEIGHTS.items():
            det_sub = group[group["detector_type"] == det_type]
            det_flagged_count = det_sub["work_id"].nunique()
            det_rate = det_flagged_count / max(1, total_works)
            det_avg_sev = float(det_sub["severity"].mean()) if det_flagged_count > 0 else 0.0

            det_contrib = det_rate * 100.0 * (det_avg_sev if det_avg_sev > 0 else 1.0)
            weighted_raw_score += weight * det_contrib

            detector_breakdown[det_type] = {
                "flagged_count": det_flagged_count,
                "violation_rate_pct": round(det_rate * 100, 1),
                "avg_severity": round(det_avg_sev, 3),
                "weight": weight
            }

        dist_stats.append({
            "district": dist,
            "total_works": total_works,
            "unique_flagged_works": unique_flagged,
            "total_expenditure": total_expenditure,
            "raw_risk": min(100.0, weighted_raw_score),
            "breakdown": detector_breakdown
        })

    df_dist = pd.DataFrame(dist_stats)
    if df_dist.empty:
        return 0

    # Empirical Bayes Shrinkage (Shrink towards national mean for small sample sizes)
    national_mean_risk = df_dist["raw_risk"].mean()
    m_param = 30.0  # Shrinkage prior weight

    df_dist["shrunk_risk"] = df_dist.apply(
        lambda r: (r["raw_risk"] * (r["total_works"] / (r["total_works"] + m_param))) +
                  (national_mean_risk * (m_param / (r["total_works"] + m_param))),
        axis=1
    )

    # Risk Rank (1 = Highest Risk)
    df_dist["risk_rank"] = df_dist["shrunk_risk"].rank(ascending=False, method="min").astype(int)

    # Forced Percentile Risk Tiers (Top 10% Critical, Next 20% High, Next 30% Medium, Rest Low/Clean)
    def assign_percentile_tier(rank_val: int, n_total: int) -> str:
        pct = rank_val / max(1, n_total)
        if pct <= 0.10:
            return "Critical"
        elif pct <= 0.30:
            return "High"
        elif pct <= 0.60:
            return "Medium"
        else:
            return "Clean"

    df_dist["risk_tier"] = df_dist["risk_rank"].apply(lambda r: assign_percentile_tier(r, len(df_dist)))

    entity_risks_to_insert = []
    for _, row in df_dist.iterrows():
        entity_risk = EntityRisk(
            entity_type="ida",
            entity_key=str(row["district"]),
            run_id=run_id,
            composite_risk=round(float(row["shrunk_risk"]), 2),
            risk_tier=str(row["risk_tier"]),
            risk_rank=int(row["risk_rank"]),
            breakdown={
                "total_works": int(row["total_works"]),
                "unique_flagged_works": int(row["unique_flagged_works"]),
                "total_expenditure_cr": round(float(row["total_expenditure"]) / 1e7, 2),
                "raw_risk_score": round(float(row["raw_risk"]), 2),
                "shrunk_risk_score": round(float(row["shrunk_risk"]), 2),
                "detector_breakdown": row["breakdown"]
            }
        )
        entity_risks_to_insert.append(entity_risk)

    session.bulk_save_objects(entity_risks_to_insert)
    session.flush()
    logger.info(f"Detector 13 profiled {len(entity_risks_to_insert):,} Implementing District Authorities.")
    return len(entity_risks_to_insert)
