"""
Probability Calibration and Reliability Metrics Engine.
Ensures predicted risk scores correspond directly to true empirical fraud probabilities.
"""

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from typing import Tuple, Dict, Any


def calculate_expected_calibration_error(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    n_bins: int = 10
) -> Tuple[float, np.ndarray, np.ndarray]:
    """
    Computes Expected Calibration Error (ECE) and reliability curve data.

    ECE = sum_b (|B_b| / N) * |acc(B_b) - conf(B_b)|
    """
    prob_true, prob_pred = calibration_curve(y_true, y_prob, n_bins=n_bins, strategy="uniform")
    
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    bin_assignments = np.digitize(y_prob, bin_edges) - 1
    bin_assignments = np.clip(bin_assignments, 0, n_bins - 1)

    ece = 0.0
    n_samples = len(y_true)
    for b in range(n_bins):
        mask = bin_assignments == b
        if np.any(mask):
            bin_size = np.sum(mask)
            bin_acc = np.mean(y_true[mask])
            bin_conf = np.mean(y_prob[mask])
            ece += (bin_size / n_samples) * abs(bin_acc - bin_conf)

    return float(round(ece, 4)), prob_true, prob_pred
