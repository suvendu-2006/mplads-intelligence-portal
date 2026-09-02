"""
Unit tests for Machine Learning Models, Calibration, and Ensemble Predictions.
"""

import pytest
import numpy as np
import pandas as pd
from mplads_fraud_detection.models.baseline_model import train_baseline_model
from mplads_fraud_detection.models.gradient_boosting import train_gradient_boosting_model
from mplads_fraud_detection.models.calibration import calculate_expected_calibration_error
from quarantine.ml_system_phase7_blocked.ensemble import CalibratedFraudEnsemble
import subprocess
import sys


def test_ml_training_script_is_gated():
    res = subprocess.run([sys.executable, "scripts/train_model.py"], capture_output=True, text=True)
    assert res.returncode == 1
    assert "ML system gated until 300+ verified labels collected" in res.stdout


@pytest.fixture
def synthetic_training_data():
    """Generates synthetic tabular training dataset for ML validation."""
    rng = np.random.RandomState(42)
    n_samples = 200
    
    cost_overrun = rng.uniform(0.0, 1.0, n_samples)
    log_cost = rng.uniform(10.0, 16.0, n_samples)
    duplicate_sim = rng.uniform(0.0, 1.0, n_samples)
    
    # Ground truth: high cost overrun + high cost increases fraud probability
    logits = -3.0 + (4.0 * cost_overrun) + (0.3 * (log_cost - 12.0))
    prob = 1.0 / (1.0 + np.exp(-logits))
    y = (rng.uniform(0.0, 1.0, n_samples) < prob).astype(int)

    X = pd.DataFrame({
        "cost_overrun": cost_overrun,
        "log_cost": log_cost,
        "duplicate_work": duplicate_sim
    })
    return X, pd.Series(y)


def test_baseline_and_gradient_boosting(synthetic_training_data):
    X, y = synthetic_training_data

    lr_pipe = train_baseline_model(X, y)
    probs_lr = lr_pipe.predict_proba(X)[:, 1]
    assert len(probs_lr) == len(X)
    assert np.all((probs_lr >= 0.0) & (probs_lr <= 1.0))

    gb_model = train_gradient_boosting_model(X, y)
    probs_gb = gb_model.predict_proba(X)[:, 1]
    assert len(probs_gb) == len(X)


def test_calibration_and_ensemble(synthetic_training_data):
    X, y = synthetic_training_data

    ensemble = CalibratedFraudEnsemble(gb_weight=0.6, lr_weight=0.4)
    ensemble.fit(X, y)

    probs, lower, upper, uncert = ensemble.predict_with_uncertainty(X)

    assert len(probs) == len(X)
    assert np.all(probs >= 0.0) and np.all(probs <= 1.0)
    assert np.all(lower <= upper)
    assert np.all(uncert >= 0.0)

    # Test ECE calculation
    ece, p_true, p_pred = calculate_expected_calibration_error(y.values, probs)
    assert 0.0 <= ece <= 1.0
