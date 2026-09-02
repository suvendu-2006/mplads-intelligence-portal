"""
Accuracy and Operational Evaluation Metrics Engine for MPLADS Fraud Prediction.
Computes Precision@K, PR-AUC, ROC-AUC, Brier score, and calibration reliability.
"""

import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, roc_auc_score, average_precision_score, brier_score_loss
from typing import Dict, Any


def compute_precision_at_k(y_true: np.ndarray, y_prob: np.ndarray, k: int) -> float:
    """
    Computes Precision@K: Proportion of true positive fraud cases in the top-K highest-ranked predictions.
    """
    if len(y_true) == 0 or k <= 0:
        return 0.0
    top_k_indices = np.argsort(y_prob)[::-1][:k]
    top_k_true = y_true[top_k_indices]
    return float(round(np.mean(top_k_true), 4))


def compute_comprehensive_evaluation_report(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    k_list: list = [50, 100, 200, 500]
) -> Dict[str, Any]:
    """
    Generates a full empirical model validation report.
    """
    report = {}
    for k in k_list:
        if k <= len(y_true):
            report[f"precision_at_{k}"] = compute_precision_at_k(y_true, y_prob, k)

    report["pr_auc"] = float(round(average_precision_score(y_true, y_prob), 4)) if len(np.unique(y_true)) > 1 else 0.0
    report["roc_auc"] = float(round(roc_auc_score(y_true, y_prob), 4)) if len(np.unique(y_true)) > 1 else 0.0
    report["brier_score"] = float(round(brier_score_loss(y_true, y_prob), 4))
    
    # Binary metrics at 0.50 threshold
    y_pred = (y_prob >= 0.50).astype(int)
    report["precision_at_0.50"] = float(round(precision_score(y_true, y_pred, zero_division=0), 4))
    report["recall_at_0.50"] = float(round(recall_score(y_true, y_pred, zero_division=0), 4))

    return report
