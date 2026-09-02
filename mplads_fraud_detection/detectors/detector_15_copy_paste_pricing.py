"""
Detector 15: Copy-Paste Pricing (Cloned Estimates)
Sole owner of exact duplicate costs and cloned unit rates indicating administrative boilerplate budgeting.
"""

import logging
from typing import Dict, List, Any
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from mplads_fraud_detection.foundation.utils import safe_divide, monotonic_severity
from mplads_fraud_detection.config import SEVERITY_FLOOR
from mplads_fraud_detection.detectors.detector_03_cost_overruns import (
    extract_physical_quantity, map_description_to_benchmark
)

logger = logging.getLogger(__name__)


def run_detector_15_copy_paste_pricing(session: Session, run_id: str) -> int:
    """
    Executes Detector 15: Copy-Paste Pricing & Cloned Estimates.
    """
    logger.info("Executing Detector 15: Copy-Paste Pricing...")

    works = session.query(Work).all()
    if not works:
        return 0

    df = pd.DataFrame([{
        "work_id": w.work_id,
        "cost": round(float(w.cost), 2),
        "mp_name": w.mp_name,
        "district": w.district,
        "category": w.category,
        "work_description": w.work_description
    } for w in works])

    # 1. Exact Cost Clones by MP (Cross-Category Suspicion Only)
    cost_summary = df.groupby(["mp_name", "cost"]).agg(
        total_count=("work_id", "count"),
        n_categories=("category", "nunique")
    ).reset_index()

    # Cross-Category Clones: count >= 5 across multiple different categories (High suspicion)
    cross_cat = cost_summary[(cost_summary["n_categories"] > 1) & (cost_summary["total_count"] >= 5)]
    cross_cat_map = cross_cat.set_index(["mp_name", "cost"])[["total_count", "n_categories"]].to_dict("index")

    # 2. Extract Unit Rates and Round to Nearest ₹100
    df["quantity"] = None
    df["unit_rate_rounded"] = None

    for idx, row in df.iterrows():
        bench_key = map_description_to_benchmark(row["category"], row["work_description"])
        unit_type = "meter" if "Road" in str(row["category"]) else "number"
        qty, _, conf = extract_physical_quantity(str(row["work_description"]), unit_type)
        if conf == "high" and qty and qty > 0:
            rate = row["cost"] / qty
            df.at[idx, "quantity"] = qty
            df.at[idx, "unit_rate_rounded"] = 100.0 * round(rate / 100.0)

    # Unit-rate clones by MP (count >= 5 identical rounded unit rates with high extraction confidence)
    valid_rates_df = df[df["unit_rate_rounded"].notna()].copy()
    rate_clusters = valid_rates_df.groupby(["mp_name", "category", "unit_rate_rounded"]).size().reset_index(name="rate_repeat_count")
    rate_clusters_flagged = rate_clusters[rate_clusters["rate_repeat_count"] >= 5]
    unit_rate_map = rate_clusters_flagged.set_index(["mp_name", "category", "unit_rate_rounded"])["rate_repeat_count"].to_dict()

    anomalies_to_insert = []
    for _, row in df.iterrows():
        mp = row["mp_name"]
        cost_val = row["cost"]
        rate_val = row["unit_rate_rounded"]
        cat_val = row["category"]

        is_cross = (mp, cost_val) in cross_cat_map
        rate_count = unit_rate_map.get((mp, cat_val, rate_val), 0) if rate_val else 0

        if not is_cross and rate_count < 5:
            continue

        signals = []
        severities = []

        if is_cross:
            info = cross_cat_map[(mp, cost_val)]
            c_sev = monotonic_severity(float(info["total_count"]), [5.0, 10.0, 20.0], [0.75, 0.88, 0.98])
            signals.append("cross_category_cost_clone")
            severities.append(c_sev)

        if rate_count >= 5:
            r_sev = monotonic_severity(float(rate_count), [5.0, 10.0, 20.0], [0.50, 0.70, 0.90])
            signals.append("cloned_unit_rate")
            severities.append(r_sev)

        composite_sev = max(severities)
        if composite_sev < SEVERITY_FLOOR:
            continue

        explanation_parts = []
        if is_cross:
            info = cross_cat_map[(mp, cost_val)]
            explanation_parts.append(
                f"Cross-Category Cost Cloning: MP {mp} has {info['total_count']} distinct works across {info['n_categories']} different categories budgeted at identical amount of ₹{cost_val:,.0f}"
            )
        if rate_count >= 5:
            explanation_parts.append(
                f"Cloned Unit Rate: {rate_count} '{cat_val}' works share identical rounded unit rate of ₹{rate_val:,.0f} per unit"
            )

        explanation = "COPY-PASTE PRICING: " + " | ".join(explanation_parts) + "."

        evidence = {
            "attribution": "mp_level",
            "cost": float(cost_val),
            "cross_category": is_cross,
            "exact_cost_repeat_count": int(cross_cat_map.get((mp, cost_val), {}).get("total_count", 0)),
            "unit_rate_rounded": float(rate_val) if rate_val else None,
            "unit_rate_repeat_count": int(rate_count),
            "quantity_unknown": (row["quantity"] is None),
            "mp_name": str(mp),
            "category": str(cat_val)
        }

        anomaly = Anomaly(
            work_id=int(row["work_id"]),
            detector_type="copy_paste_pricing",
            severity=round(composite_sev, 3),
            explanation=explanation,
            evidence=evidence,
            run_id=run_id
        )
        anomalies_to_insert.append(anomaly)

    session.bulk_save_objects(anomalies_to_insert)
    session.flush()
    logger.info(f"Detector 15 generated {len(anomalies_to_insert):,} copy-paste pricing anomalies.")
    return len(anomalies_to_insert)
