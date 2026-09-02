"""
Unit tests for Evaluation Metrics, Precision@K, and Stratified Fairness Auditing.
"""

import numpy as np
import pandas as pd
from mplads_fraud_detection.evaluation.metrics import compute_precision_at_k, compute_comprehensive_evaluation_report
from mplads_fraud_detection.evaluation.fairness_audit import run_stratified_fairness_audit


def test_precision_at_k():
    y_true = np.array([1, 1, 1, 0, 0, 0, 0, 0, 0, 0])
    y_prob = np.array([0.95, 0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.60, 0.55, 0.50])

    p_at_3 = compute_precision_at_k(y_true, y_prob, 3)
    p_at_5 = compute_precision_at_k(y_true, y_prob, 5)

    assert p_at_3 == 1.0  # Top 3 are all 1s
    assert p_at_5 == 0.6  # 3 of 5 are 1s

    report = compute_comprehensive_evaluation_report(y_true, y_prob, k_list=[3, 5])
    assert report["precision_at_3"] == 1.0
    assert report["precision_at_5"] == 0.6
    assert 0.0 <= report["pr_auc"] <= 1.0


def test_fairness_audit_disparate_impact():
    df_eval = pd.DataFrame({
        "district": ["DIST_A"] * 50 + ["DIST_B"] * 50,
        "actual_fraud": [0] * 100,
        "predicted_risk": [0.10] * 50 + [0.80] * 50  # DIST_B has extreme false positive rate
    })

    df_fairness = run_stratified_fairness_audit(df_eval, group_col="district")
    assert len(df_fairness) == 2
    
    # DIST_B should have disparate impact flagged
    dist_b_row = df_fairness[df_fairness["group"] == "DIST_B"].iloc[0]
    assert float(dist_b_row["group_fpr"]) == 1.0
    assert bool(dist_b_row["disparate_impact_flag"]) is True
