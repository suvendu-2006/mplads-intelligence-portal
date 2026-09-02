"""
Detector 7: Suspicious Timing (Fiscal Year-End & Term Rush)
Catches artificial expenditure dumping in March, end-of-term surges, and pre-election rushes.
"""

import logging
from typing import Dict, List, Any
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from mplads_fraud_detection.foundation.utils import safe_divide, monotonic_severity
from mplads_fraud_detection.config import SEVERITY_FLOOR

logger = logging.getLogger(__name__)


def run_detector_07_timing_anomaly(session: Session, run_id: str) -> int:
    """
    Executes Detector 7: Suspicious Timing across March fiscal dumping and term rushes.
    """
    logger.info("Executing Detector 7: Suspicious Timing...")

    works = session.query(Work).filter(Work.status == "completed").all()
    if not works:
        return 0

    df = pd.DataFrame([{
        "work_id": w.work_id,
        "cost": w.cost,
        "mp_name": w.mp_name,
        "district": w.district,
        "category": w.category,
        "completion_date": w.completion_date
    } for w in works])

    df["completion_date"] = pd.to_datetime(df["completion_date"], errors="coerce")
    df_valid = df[df["completion_date"].notna()].copy()
    if df_valid.empty:
        return 0

    # Temporal features
    df_valid["month"] = df_valid["completion_date"].dt.month
    df_valid["is_march"] = (df_valid["month"] == 3)
    df_valid["fiscal_year"] = df_valid["completion_date"].apply(
        lambda x: x.year if x.month >= 4 else x.year - 1
    )

    # 17th Lok Sabha Term End Reference: May 31, 2024
    term_end_date = pd.to_datetime("2024-05-31")
    df_valid["days_to_term_end"] = (term_end_date - df_valid["completion_date"]).dt.days
    df_valid["is_term_last_6m"] = (df_valid["days_to_term_end"] >= 0) & (df_valid["days_to_term_end"] <= 180)

    # 1. MP x Fiscal Year March Dumping Analysis
    mp_fy_totals = df_valid.groupby(["mp_name", "fiscal_year"]).agg(
        total_works=("work_id", "count"),
        total_spend=("cost", "sum")
    ).reset_index()

    mp_fy_march = df_valid[df_valid["is_march"]].groupby(["mp_name", "fiscal_year"]).agg(
        march_works=("work_id", "count"),
        march_spend=("cost", "sum")
    ).reset_index()

    mp_fy_stats = mp_fy_totals.merge(mp_fy_march, on=["mp_name", "fiscal_year"], how="left").fillna(0.0)
    mp_fy_stats["march_works_pct"] = (mp_fy_stats["march_works"] / mp_fy_stats["total_works"]) * 100.0
    mp_fy_stats["march_spend_pct"] = (mp_fy_stats["march_spend"] / mp_fy_stats["total_spend"]) * 100.0

    # Continuous Monotonic March Index
    mp_fy_stats["combined_march_index"] = (
        0.40 * mp_fy_stats["march_works_pct"] + 0.60 * mp_fy_stats["march_spend_pct"]
    )
    mp_fy_stats["march_severity"] = mp_fy_stats["combined_march_index"].apply(
        lambda idx: monotonic_severity(idx, [30.0, 45.0, 65.0, 85.0], [0.50, 0.65, 0.85, 1.00])
    )

    march_sev_map = mp_fy_stats.set_index(["mp_name", "fiscal_year"])["march_severity"].to_dict()
    march_idx_map = mp_fy_stats.set_index(["mp_name", "fiscal_year"])["combined_march_index"].to_dict()
    march_works_pct_map = mp_fy_stats.set_index(["mp_name", "fiscal_year"])["march_works_pct"].to_dict()
    march_spend_pct_map = mp_fy_stats.set_index(["mp_name", "fiscal_year"])["march_spend_pct"].to_dict()

    # 2. Pre-Election Term Rush Analysis
    mp_last6m = df_valid[df_valid["is_term_last_6m"]].groupby("mp_name")["work_id"].count()
    mp_earlier = df_valid[~df_valid["is_term_last_6m"]].groupby("mp_name")["work_id"].count()

    mp_term_rush = pd.DataFrame({
        "last6m_count": mp_last6m,
        "earlier_count": mp_earlier
    }).fillna(0)

    # Monthly rates (6 months in last period, 54 months in prior period)
    mp_term_rush["last6m_rate"] = mp_term_rush["last6m_count"] / 6.0
    mp_term_rush["earlier_rate"] = mp_term_rush["earlier_count"] / 54.0
    mp_term_rush["rush_ratio"] = safe_divide(mp_term_rush["last6m_rate"], mp_term_rush["earlier_rate"], fill=1.0)

    # Guard: Require >= 5 works in earlier period
    valid_rush_mask = mp_term_rush["earlier_count"] >= 5
    mp_term_rush["term_rush_severity"] = 0.0
    mp_term_rush.loc[valid_rush_mask, "term_rush_severity"] = mp_term_rush.loc[valid_rush_mask, "rush_ratio"].apply(
        lambda r: monotonic_severity(r, [2.0, 3.5, 5.0, 10.0], [0.50, 0.65, 0.80, 1.00])
    )

    term_rush_sev_map = mp_term_rush["term_rush_severity"].to_dict()
    term_rush_ratio_map = mp_term_rush["rush_ratio"].to_dict()

    anomalies_to_insert = []
    for _, row in df_valid.iterrows():
        mp_name = row["mp_name"]
        fy = row["fiscal_year"]
        is_march = row["is_march"]
        is_term_last6m = row["is_term_last_6m"]

        signals = []
        severities = []

        # Signal 1: March Dumping
        if is_march:
            m_sev = march_sev_map.get((mp_name, fy), 0.0)
            if m_sev >= SEVERITY_FLOOR:
                signals.append("march_fiscal_dumping")
                severities.append(m_sev)

        # Signal 2: Term Rush
        if is_term_last6m:
            t_sev = term_rush_sev_map.get(mp_name, 0.0)
            if t_sev >= SEVERITY_FLOOR:
                signals.append("pre_election_term_rush")
                severities.append(t_sev)

        if not signals:
            continue

        composite_sev = max(severities)
        if composite_sev < SEVERITY_FLOOR:
            continue

        explanation_parts = []
        if "march_fiscal_dumping" in signals:
            w_pct = march_works_pct_map.get((mp_name, fy), 0.0)
            s_pct = march_spend_pct_map.get((mp_name, fy), 0.0)
            explanation_parts.append(
                f"Fiscal Year-End Dumping: MP {mp_name} completed {w_pct:.1f}% of FY {fy} works "
                f"({s_pct:.1f}% of annual expenditure) during the month of March (vs expected ~8.3% monthly baseline)"
            )

        if "pre_election_term_rush" in signals:
            ratio = term_rush_ratio_map.get(mp_name, 1.0)
            explanation_parts.append(
                f"Pre-Election Term Rush: MP completion rate in final 6 months of Lok Sabha term "
                f"accelerated by {ratio:.1f}x over earlier term baseline"
            )

        explanation = "TIMING ANOMALY: " + " | ".join(explanation_parts) + "."

        evidence = {
            "signals_triggered": signals,
            "completion_date": str(row["completion_date"].date()),
            "fiscal_year": int(fy),
            "is_march": bool(is_march),
            "is_term_last_6_months": bool(is_term_last6m),
            "mp_name": str(mp_name),
            "cost": float(row["cost"])
        }

        anomaly = Anomaly(
            work_id=int(row["work_id"]),
            detector_type="timing_anomaly",
            severity=round(composite_sev, 3),
            explanation=explanation,
            evidence=evidence,
            run_id=run_id
        )
        anomalies_to_insert.append(anomaly)

    session.bulk_save_objects(anomalies_to_insert)
    session.flush()
    logger.info(f"Detector 7 generated {len(anomalies_to_insert):,} timing anomalies.")
    return len(anomalies_to_insert)
