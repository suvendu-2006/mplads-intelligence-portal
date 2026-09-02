"""
Detector 14: Member of Parliament (MP) & Constituency Risk Profiler
Aggregates forensic risk across individual MP portfolios and Parliamentary Constituencies.
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


def run_detector_14_mp_risk(session: Session, run_id: str) -> int:
    """
    Executes Detector 14: MP & Constituency Forensic Risk Profiling.
    """
    logger.info("Executing Detector 14: MP & Constituency Risk Profiling...")

    works = session.query(Work).all()
    if not works:
        return 0

    df_works = pd.DataFrame([{
        "work_id": w.work_id,
        "mp_name": str(w.mp_name),
        "mp_constituency": str(w.mp_constituency) if w.mp_constituency else "UNKNOWN",
        "cost": w.cost
    } for w in works])

    anomalies = session.query(Anomaly).filter(Anomaly.run_id == run_id).all()
    df_anom = pd.DataFrame([{
        "work_id": a.work_id,
        "detector_type": a.detector_type,
        "severity": a.severity
    } for a in anomalies]) if anomalies else pd.DataFrame(columns=["work_id", "detector_type", "severity"])

    df_merged = df_works.merge(df_anom, on="work_id", how="left")

    # 1. MP-Level Risk Profiling
    mp_stats = []
    for mp, group in df_merged.groupby("mp_name"):
        total_works = group["work_id"].nunique()
        total_expenditure = group.drop_duplicates(subset=["work_id"])["cost"].sum()
        constituency = group["mp_constituency"].iloc[0]

        flagged_works_mask = group["detector_type"].notna()
        unique_flagged = group[flagged_works_mask]["work_id"].nunique()

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
                "avg_severity": round(det_avg_sev, 3)
            }

        mp_stats.append({
            "mp_name": mp,
            "mp_constituency": constituency,
            "total_works": total_works,
            "unique_flagged_works": unique_flagged,
            "total_expenditure": total_expenditure,
            "raw_risk": min(100.0, weighted_raw_score),
            "breakdown": detector_breakdown
        })

    df_mp = pd.DataFrame(mp_stats)
    if df_mp.empty:
        return 0

    # Shrinkage
    nat_mean = df_mp["raw_risk"].mean()
    m_param = 20.0
    df_mp["shrunk_risk"] = df_mp.apply(
        lambda r: (r["raw_risk"] * (r["total_works"] / (r["total_works"] + m_param))) +
                  (nat_mean * (m_param / (r["total_works"] + m_param))),
        axis=1
    )
    df_mp["risk_rank"] = df_mp["shrunk_risk"].rank(ascending=False, method="min").astype(int)

    def assign_tier(rank_val: int, n_total: int) -> str:
        pct = rank_val / max(1, n_total)
        if pct <= 0.10:
            return "Critical"
        elif pct <= 0.30:
            return "High"
        elif pct <= 0.60:
            return "Medium"
        else:
            return "Clean"

    df_mp["risk_tier"] = df_mp["risk_rank"].apply(lambda r: assign_tier(r, len(df_mp)))

    entity_risks_to_insert = []
    for _, row in df_mp.iterrows():
        entity_risk = EntityRisk(
            entity_type="mp",
            entity_key=str(row["mp_name"]),
            run_id=run_id,
            composite_risk=round(float(row["shrunk_risk"]), 2),
            risk_tier=str(row["risk_tier"]),
            risk_rank=int(row["risk_rank"]),
            breakdown={
                "mp_constituency": str(row["mp_constituency"]),
                "total_works": int(row["total_works"]),
                "unique_flagged_works": int(row["unique_flagged_works"]),
                "total_expenditure_cr": round(float(row["total_expenditure"]) / 1e7, 2),
                "detector_breakdown": row["breakdown"]
            }
        )
        entity_risks_to_insert.append(entity_risk)

    session.bulk_save_objects(entity_risks_to_insert)
    session.flush()
    logger.info(f"Detector 14 profiled {len(entity_risks_to_insert):,} Members of Parliament.")
    return len(entity_risks_to_insert)
