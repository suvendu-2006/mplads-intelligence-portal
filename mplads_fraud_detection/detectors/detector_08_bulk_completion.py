"""
Detector 8: Same-Day Bulk Completion
Catches Implementing District Authorities (IDAs) batch-closing large numbers of works on the exact same date.
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


def run_detector_08_bulk_completion(session: Session, run_id: str) -> int:
    """
    Executes Detector 8: Same-Day Bulk Completion using outlier-trimmed dynamic baselines.
    """
    logger.info("Executing Detector 8: Same-Day Bulk Completion...")

    works = session.query(Work).filter(Work.status == "completed").all()
    if not works:
        return 0

    df = pd.DataFrame([{
        "work_id": w.work_id,
        "cost": w.cost,
        "district": w.district,
        "mp_name": w.mp_name,
        "category": w.category,
        "completion_date": w.completion_date,
        "work_description": w.work_description
    } for w in works])

    df["completion_date"] = pd.to_datetime(df["completion_date"], errors="coerce")
    df_valid = df[df["completion_date"].notna()].copy()
    if df_valid.empty:
        return 0

    # 1. Calculate Outlier-Trimmed Baseline per District
    district_baselines = {}
    for dist in df_valid["district"].unique():
        dist_df = df_valid[df_valid["district"] == dist]
        daily_counts = dist_df["completion_date"].value_counts()

        # Trim top 5% daily spikes for true baseline
        q95 = daily_counts.quantile(0.95)
        normal_days = daily_counts[daily_counts <= q95]

        if len(normal_days) < 3:
            avg_daily = float(daily_counts.mean()) if len(daily_counts) > 0 else 1.0
            thresh = 10.0
        else:
            avg_daily = float(normal_days.mean())
            std_daily = float(normal_days.std())
            if np.isnan(std_daily) or std_daily == 0.0:
                thresh = max(10.0, avg_daily * 2.0)
            else:
                thresh = max(10.0, avg_daily + 3.0 * std_daily)

        district_baselines[dist] = {
            "avg_daily": max(0.1, avg_daily),
            "threshold": thresh
        }

    # 2. Detect District Bulk Events
    bulk_events = df_valid.groupby(["district", "completion_date"]).agg(
        works_on_date=("work_id", "count"),
        total_cost=("cost", "sum"),
        unique_mps=("mp_name", "nunique"),
        unique_categories=("category", "nunique")
    ).reset_index()

    bulk_events["avg_daily"] = bulk_events["district"].map(lambda d: district_baselines[d]["avg_daily"])
    bulk_events["threshold"] = bulk_events["district"].map(lambda d: district_baselines[d]["threshold"])
    bulk_events["spike_ratio"] = bulk_events["works_on_date"] / bulk_events["avg_daily"]

    # Filter to bulk events
    flagged_events = bulk_events[bulk_events["works_on_date"] >= bulk_events["threshold"]].copy()

    # Calculate Event Severity
    def calculate_event_severity(row):
        spike = row["spike_ratio"]
        base_sev = monotonic_severity(spike, [10.0, 20.0, 50.0, 100.0], [0.40, 0.60, 0.85, 1.00])
        
        c_date = row["completion_date"]
        # Fiscal year-end boosts
        if c_date.month == 3 and c_date.day >= 25:
            base_sev += 0.10
        if c_date.month == 3 and c_date.day == 31:
            base_sev += 0.10

        # Category diversity penalty (< 20% distinct categories indicates template closure)
        cat_ratio = row["unique_categories"] / max(1, row["works_on_date"])
        if cat_ratio < 0.20:
            base_sev += 0.15

        return min(1.0, base_sev)

    flagged_events["event_severity"] = flagged_events.apply(calculate_event_severity, axis=1)

    event_sev_map = flagged_events.set_index(["district", "completion_date"])["event_severity"].to_dict()
    event_spike_map = flagged_events.set_index(["district", "completion_date"])["spike_ratio"].to_dict()
    event_count_map = flagged_events.set_index(["district", "completion_date"])["works_on_date"].to_dict()
    event_mps_map = flagged_events.set_index(["district", "completion_date"])["unique_mps"].to_dict()

    # 3. MP Same-Day Batch Pattern
    mp_same_day = df_valid.groupby(["mp_name", "completion_date"]).size().reset_index(name="mp_works_same_day")
    mp_same_day_flagged = mp_same_day[mp_same_day["mp_works_same_day"] >= 8]
    mp_same_day_map = mp_same_day_flagged.set_index(["mp_name", "completion_date"])["mp_works_same_day"].to_dict()

    anomalies_to_insert = []
    supply_keywords = ["street light", "lamp", "led", "pole", "sign board", "supply of", "providing"]

    for _, row in df_valid.iterrows():
        dist = row["district"]
        c_date = row["completion_date"]
        mp = row["mp_name"]
        desc = str(row["work_description"]).lower()

        event_sev = event_sev_map.get((dist, c_date), 0.0)
        mp_count = mp_same_day_map.get((mp, c_date), 0)

        if event_sev < SEVERITY_FLOOR and mp_count < 8:
            continue

        # Composite bulk severity
        final_sev = event_sev
        if mp_count >= 8:
            mp_sev = monotonic_severity(float(mp_count), [8.0, 15.0, 25.0], [0.50, 0.70, 0.90])
            final_sev = max(final_sev, mp_sev)

        # Mitigations
        # 1. Supply / street light works
        if any(kw in desc for kw in supply_keywords):
            final_sev *= 0.70

        # 2. Regular non-March quarter ends (June 30, Sept 30, Dec 31)
        if c_date.month in [6, 9, 12] and c_date.day >= 28:
            final_sev *= 0.80

        if final_sev < SEVERITY_FLOOR:
            continue

        works_count = event_count_map.get((dist, c_date), mp_count)
        spike_val = event_spike_map.get((dist, c_date), 10.0)
        is_march_31 = (c_date.month == 3 and c_date.day == 31)

        explanation = (
            f"Bulk Completion Anomaly: {works_count} distinct works were closed simultaneously on {c_date.date()} "
            f"in {dist} district ({spike_val:.1f}x normal daily rate). "
            f"{'🚨 CRITICAL: Batch closure on March 31 (fiscal year-end) indicates paper completion to exhaust budget.' if is_march_31 else ''}"
        )

        evidence = {
            "completion_date": str(c_date.date()),
            "district": str(dist),
            "works_on_date": int(works_count),
            "spike_ratio": round(float(spike_val), 1),
            "is_march_31": bool(is_march_31),
            "unique_mps_involved": int(event_mps_map.get((dist, c_date), 1)),
            "mp_name": str(mp),
            "cost": float(row["cost"])
        }

        anomaly = Anomaly(
            work_id=int(row["work_id"]),
            detector_type="bulk_completion",
            severity=round(final_sev, 3),
            explanation=explanation,
            evidence=evidence,
            run_id=run_id
        )
        anomalies_to_insert.append(anomaly)

    session.bulk_save_objects(anomalies_to_insert)
    session.flush()
    logger.info(f"Detector 8 generated {len(anomalies_to_insert):,} bulk completion anomalies.")
    return len(anomalies_to_insert)
