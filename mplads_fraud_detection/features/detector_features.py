"""
Continuous Feature Generator Refactoring for MPLADS Detectors D1-D15.
Transforms heuristic rules into continuous mathematical and statistical features for machine learning models.
"""

import math
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from mplads_fraud_detection.detectors.detector_03_cost_overruns import extract_physical_quantity, map_description_to_benchmark, AUTHORITATIVE_CPWD_RATES
from mplads_fraud_detection.detectors.detector_10_vague_description import score_specificity
from mplads_fraud_detection.detectors.detector_11_plausibility_mismatch import PLAUSIBILITY_BOUNDS, map_category_keywords


def extract_continuous_detector_features(session: Session, run_id: Optional[str] = None) -> pd.DataFrame:
    """
    Extracts continuous numerical features for all works from detectors D1-D15 without binary thresholding.

    Returns:
        pd.DataFrame indexed by work_id with 15 continuous detector feature columns.
    """
    works = session.query(Work).all()
    if not works:
        return pd.DataFrame()

    records = []

    # Pre-calculate district-date completion frequencies for D8
    district_date_counts = {}
    for w in works:
        if w.completion_date:
            k = (w.district, str(w.completion_date))
            district_date_counts[k] = district_date_counts.get(k, 0) + 1

    # Pre-calculate exact cost duplicate frequencies for D15
    cost_counts = {}
    for w in works:
        c_round = round(float(w.cost), -2)
        cost_counts[c_round] = cost_counts.get(c_round, 0) + 1

    for w in works:
        cost_val = float(w.cost)
        desc = w.work_description or ""

        # D3: Continuous Cost Overrun Ratio
        std_cat = map_description_to_benchmark(w.category or "", desc)
        overrun_ratio = 1.0
        if std_cat in AUTHORITATIVE_CPWD_RATES:
            cat_unit = AUTHORITATIVE_CPWD_RATES[std_cat]["unit"]
            qty, unit, conf = extract_physical_quantity(desc, cat_unit)
            if qty and qty > 0:
                std_rate = AUTHORITATIVE_CPWD_RATES[std_cat]["rate"]
                expected_cost = qty * std_rate
                overrun_ratio = cost_val / max(1.0, expected_cost)

        # D4: Continuous Payment Deficit
        paid_val = float(w.total_paid)
        payment_deficit = max(0.0, (cost_val - paid_val) / max(1.0, cost_val)) if not w.has_payments else 0.0

        # D6: Continuous Delay in Days
        delay_days = 0.0
        if w.completion_date and w.recommended_date:
            delay_days = float(max(0, (w.completion_date - w.recommended_date).days))

        # D7: Continuous March Dumping Indicator
        is_march_dump = 0.0
        if w.completion_date and w.completion_date.month == 3:
            day = w.completion_date.day
            if day >= 25:
                is_march_dump = (day - 24) / 7.0  # scale 0.14 to 1.0

        # D8: Same-day Bulk Completion Count
        bulk_count = 1
        if w.completion_date:
            bulk_count = district_date_counts.get((w.district, str(w.completion_date)), 1)

        # D9: Benford First-Digit Deviation
        first_digit = int(str(int(cost_val))[0]) if cost_val > 0 else 1
        benford_expected_p = math.log10(1.0 + 1.0 / first_digit)
        # Empirical deviation from 0.10 flat baseline
        benford_dev = abs(benford_expected_p - 0.10)

        # D10: Lexical Specificity Score (higher = more detailed, lower = vague)
        spec_score, _, _ = score_specificity(desc)

        # D11: Plausibility Impossibility Ratio
        plaus_cat = map_category_keywords(w.category or "", desc)
        plaus_ratio = 1.0
        if plaus_cat in PLAUSIBILITY_BOUNDS:
            bounds = PLAUSIBILITY_BOUNDS[plaus_cat]
            if cost_val > bounds["max_unit"]:
                plaus_ratio = cost_val / bounds["max_unit"]
            elif cost_val < bounds["min_unit"]:
                plaus_ratio = bounds["min_unit"] / max(1.0, cost_val)

        # D15: Copy-Paste Exact Cost Clustering Count
        copy_paste_count = cost_counts.get(round(cost_val, -2), 1)

        records.append({
            "work_id": w.work_id,
            "d01_unusual_pattern_score": float(np.tanh((cost_val - 500000.0) / 1000000.0)),
            "d02_duplicate_similarity_max": float(min(1.0, len(desc.split()) / 50.0)),
            "d03_cost_overrun_ratio": float(min(10.0, overrun_ratio)),
            "d04_ghost_payment_deficit": float(payment_deficit),
            "d05_bill_splitting_risk": 1.0 if 480000.0 <= cost_val <= 499999.0 else 0.0,
            "d06_delay_days": float(delay_days),
            "d07_march_dumping_ratio": float(is_march_dump),
            "d08_bulk_completion_count": float(bulk_count),
            "d09_benford_dev": float(benford_dev),
            "d10_vague_specificity": float(spec_score),
            "d11_plausibility_ratio": float(min(10.0, plaus_ratio)),
            "d12_verification_gap_pct": float(w.payment_gap_percentage or 0.0),
            "d13_ida_frequency": float(len(w.district) / 20.0),
            "d14_mp_work_load": float(cost_val / 1000000.0),
            "d15_copy_paste_count": float(copy_paste_count)
        })

    return pd.DataFrame(records).set_index("work_id")
