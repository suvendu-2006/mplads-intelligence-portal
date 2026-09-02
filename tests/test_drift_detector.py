"""
Unit test for Population Stability Index (PSI) and Feature Drift Auditing.
"""

import numpy as np
import pandas as pd
from mplads_fraud_detection.monitoring.drift_detector import calculate_feature_psi, run_portfolio_drift_audit


def test_calculate_feature_psi():
    rng = np.random.RandomState(42)
    base = rng.normal(10.0, 2.0, 1000)
    same = rng.normal(10.0, 2.0, 1000)
    drifted = rng.normal(25.0, 5.0, 1000)

    psi_stable = calculate_feature_psi(base, same)
    psi_drifted = calculate_feature_psi(base, drifted)

    assert psi_stable < 0.10
    assert psi_drifted >= 0.20


def test_run_portfolio_drift_audit():
    df_base = pd.DataFrame({"cost": [100, 200, 300] * 50, "duration": [30, 60, 90] * 50})
    df_current = pd.DataFrame({"cost": [100, 200, 300] * 50, "duration": [500, 600, 700] * 50})

    audit = run_portfolio_drift_audit(df_base, df_current, ["cost", "duration"])
    assert audit["features"]["cost"]["status"] == "STABLE"
    assert audit["features"]["duration"]["status"] == "ALERT"
    assert audit["requires_retraining"] is True
