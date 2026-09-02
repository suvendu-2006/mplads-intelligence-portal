"""
Unit tests for Machine Learning Models, Calibration, and Ensemble Predictions.
All quarantined ML code is strictly isolated; tests respect quarantine boundary.
"""

import subprocess
import sys
import pytest
import numpy as np
import pandas as pd
from mplads_fraud_detection.models.baseline_model import train_baseline_model
from mplads_fraud_detection.models.gradient_boosting import train_gradient_boosting_model
from mplads_fraud_detection.models.calibration import calculate_expected_calibration_error


def test_ml_training_script_is_gated():
    """Verify that training script exits with code 1 and gating error."""
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
    """Verify baseline and gradient boosting models train and predict probabilities."""
    X, y = synthetic_training_data

    lr_pipe = train_baseline_model(X, y)
    probs_lr = lr_pipe.predict_proba(X)[:, 1]
    assert len(probs_lr) == len(X)
    assert np.all((probs_lr >= 0.0) & (probs_lr <= 1.0))

    gb_model = train_gradient_boosting_model(X, y)
    probs_gb = gb_model.predict_proba(X)[:, 1]
    assert len(probs_gb) == len(X)


def test_calibration_ece_calculation(synthetic_training_data):
    """Verify Expected Calibration Error (ECE) metric computation."""
    X, y = synthetic_training_data
    lr_pipe = train_baseline_model(X, y)
    probs_lr = lr_pipe.predict_proba(X)[:, 1]

    ece, p_true, p_pred = calculate_expected_calibration_error(y.values, probs_lr)
    assert 0.0 <= ece <= 1.0
    assert len(p_true) == len(p_pred)


@pytest.mark.skip(reason="ML ensemble quarantined until 300+ verified labels collected in Phase 7")
def test_calibration_and_ensemble(synthetic_training_data):
    """Test will be re-enabled when ML quarantine is lifted in Phase 7."""
    pass
