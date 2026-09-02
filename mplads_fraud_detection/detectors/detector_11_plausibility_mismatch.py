"""
Detector 11: Category-Amount Mismatch (Plausibility Bounds)
Sole owner of physical engineering impossibility bounds (e.g. ₹45K schools or ₹28L handpumps).
"""

import os
import re
import logging
from typing import Dict, List, Tuple, Optional
import pandas as pd
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from mplads_fraud_detection.foundation.utils import safe_divide, monotonic_severity
from mplads_fraud_detection.config import SEVERITY_FLOOR, UNIT_PRICES_MASTER_CSV

logger = logging.getLogger(__name__)

# Engineering Physical Plausibility Bounds (Absolute Minimum & Maximum for 1 Unit)
PLAUSIBILITY_BOUNDS = {
    "School Building": {"min_unit": 500000.0, "max_unit": 20000000.0, "standard_unit": "sq_m"},
    "Community Hall": {"min_unit": 300000.0, "max_unit": 15000000.0, "standard_unit": "sq_m"},
    "Drinking Water - Handpump": {"min_unit": 25000.0, "max_unit": 100000.0, "standard_unit": "number"},
    "Drinking Water - Overhead Tank": {"min_unit": 400000.0, "max_unit": 3000000.0, "standard_unit": "number"},
    "Compound Wall": {"min_unit": 50000.0, "max_unit": 5000000.0, "standard_unit": "meter"},
    "Street Lights": {"min_unit": 3000.0, "max_unit": 35000.0, "standard_unit": "number"},
    "Roads - CC": {"min_unit": 50000.0, "max_unit": 25000000.0, "standard_unit": "meter"}
}

REGEX_COUNT = re.compile(r"(\d+)\s*(?:nos|no|numbers|units|handpumps|lights|tanks|sheds)", re.IGNORECASE)


def map_category_keywords(category: str, description: str) -> Optional[str]:
    """Resolves category even if category is Normal/Others by inspecting description."""
    text = (str(category) + " " + str(description)).lower()

    if "school" in text or "classroom" in text:
        return "School Building"
    elif "community hall" in text or "kalyana mandapam" in text or "samudaya bhavan" in text:
        return "Community Hall"
    elif "handpump" in text or "hand pump" in text or "borewell" in text:
        return "Drinking Water - Handpump"
    elif "overhead tank" in text or "oht" in text or "water tank" in text:
        return "Drinking Water - Overhead Tank"
    elif "compound wall" in text or "boundary wall" in text:
        return "Compound Wall"
    elif "street light" in text or "led light" in text or "high mast" in text:
        return "Street Lights"
    elif "cc road" in text:
        return "Roads - CC"

    return None


def run_detector_11_plausibility_mismatch(session: Session, run_id: str) -> int:
    """
    Executes Detector 11: Physical Engineering Plausibility Bounds.
    """
    logger.info("Executing Detector 11: Category-Amount Plausibility Bounds...")

    # Load Unit Prices Master for dynamic threshold refinement
    bounds_map = PLAUSIBILITY_BOUNDS.copy()
    if os.path.exists(UNIT_PRICES_MASTER_CSV):
        df_up = pd.read_csv(UNIT_PRICES_MASTER_CSV)
        for _, r in df_up.iterrows():
            item = str(r["item_name"])
            if item in bounds_map and pd.notna(r.get("min_unit_price_inr")):
                bounds_map[item]["min_unit"] = float(r["min_unit_price_inr"])
                bounds_map[item]["max_unit"] = float(r["max_unit_price_inr"])

    works = session.query(Work).all()
    anomalies_to_insert = []

    for w in works:
        desc = w.work_description or ""
        cat_key = map_category_keywords(w.category, desc)
        if not cat_key or cat_key not in bounds_map:
            continue

        bounds = bounds_map[cat_key]
        min_bound = bounds["min_unit"]
        max_bound = bounds["max_unit"]

        # Extract quantity if present
        m = REGEX_COUNT.search(desc)
        qty = float(m.group(1)) if m else 1.0
        effective_min = min_bound * qty
        effective_max = max_bound * qty

        cost_val = float(w.cost)
        is_too_low = cost_val < effective_min
        is_too_high = cost_val > effective_max

        if not (is_too_low or is_too_high):
            continue

        if is_too_low:
            ratio = safe_divide(effective_min, cost_val, fill=1.0)
            severity = monotonic_severity(ratio, [1.0, 5.0, 10.0], [0.50, 0.85, 1.00])
            mismatch_type = "IMPLAUSIBLY_LOW"
            explanation = (
                f"Engineering Plausibility Violation (Absurdly Low): Billed cost of ₹{cost_val:,.0f} for '{cat_key}' "
                f"(Qty: {qty:.0f}) is physically impossible to construct (Minimum feasible engineering threshold: ₹{effective_min:,.0f}). "
                f"Deficit factor: {ratio:.1f}x below minimum norm."
            )
        else:
            ratio = safe_divide(cost_val, effective_max, fill=1.0)
            severity = monotonic_severity(ratio, [1.0, 3.0, 5.0], [0.50, 0.80, 1.00])
            mismatch_type = "IMPLAUSIBLY_HIGH"
            explanation = (
                f"Engineering Plausibility Violation (Absurdly High): Billed cost of ₹{cost_val:,.0f} for '{cat_key}' "
                f"(Qty: {qty:.0f}) exceeds maximum feasible engineering threshold (₹{effective_max:,.0f}) by {ratio:.1f}x."
            )

        if severity < SEVERITY_FLOOR:
            continue

        evidence = {
            "mismatch_type": mismatch_type,
            "category_norm": cat_key,
            "cost": cost_val,
            "quantity": qty,
            "effective_min_feasible": effective_min,
            "effective_max_feasible": effective_max,
            "deviation_ratio": round(ratio, 2)
        }

        anomaly = Anomaly(
            work_id=w.work_id,
            detector_type="plausibility_mismatch",
            severity=round(severity, 3),
            explanation=explanation,
            evidence=evidence,
            run_id=run_id
        )
        anomalies_to_insert.append(anomaly)

    session.bulk_save_objects(anomalies_to_insert)
    session.flush()
    logger.info(f"Detector 11 generated {len(anomalies_to_insert):,} plausibility mismatch anomalies.")
    return len(anomalies_to_insert)
