"""
Production Drift Detection and Population Stability Index (PSI) Engine.
Monitors feature distributions and fraud probability drift to trigger automated retraining alerts.
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List


def calculate_feature_psi(expected: np.ndarray, actual: np.ndarray, num_buckets: int = 10) -> float:
    """
    Computes Population Stability Index (PSI) between baseline and production monitoring data:
      PSI = sum( (actual% - expected%) * ln(actual% / expected%) )
      - PSI < 0.10: No significant distribution change
      - 0.10 <= PSI < 0.20: Moderate drift; warning
      - PSI >= 0.20: Significant drift; trigger retraining alert
    """
    if len(expected) == 0 or len(actual) == 0:
        return 0.0

    # Determine quantile bins based on expected
    percentiles = np.linspace(0, 100, num_buckets + 1)
    bins = np.percentile(expected, percentiles)
    bins[0] -= 1e-5
    bins[-1] += 1e-5

    expected_counts, _ = np.histogram(expected, bins=bins)
    actual_counts, _ = np.histogram(actual, bins=bins)

    expected_pct = (expected_counts + 1e-4) / (len(expected) + 1e-4 * num_buckets)
    actual_pct = (actual_counts + 1e-4) / (len(actual) + 1e-4 * num_buckets)

    psi_val = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))
    return float(round(psi_val, 4))


def run_portfolio_drift_audit(
    baseline_df: pd.DataFrame,
    current_df: pd.DataFrame,
    features: List[str]
) -> Dict[str, Any]:
    """
    Audits feature drift and flags features exhibiting PSI >= 0.20.
    """
    drift_report = {}
    high_drift_features = []

    for feat in features:
        if feat in baseline_df.columns and feat in current_df.columns:
            psi = calculate_feature_psi(baseline_df[feat].values, current_df[feat].values)
            drift_report[feat] = {
                "psi": psi,
                "status": "ALERT" if psi >= 0.20 else ("WARNING" if psi >= 0.10 else "STABLE")
            }
            if psi >= 0.20:
                high_drift_features.append(feat)

    return {
        "features": drift_report,
        "high_drift_count": len(high_drift_features),
        "requires_retraining": len(high_drift_features) > 0,
        "high_drift_features": high_drift_features
    }
