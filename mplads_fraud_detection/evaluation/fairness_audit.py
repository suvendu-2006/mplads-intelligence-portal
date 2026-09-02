"""
Fairness and Disparate Impact Auditing Engine for MPLADS Fraud-Risk Screening.
Ensures False Positive Rates (FPR) and inspection prioritization remain unbiased across regions and categories.
"""

import numpy as np
import pandas as pd
from typing import Dict, Any


def run_stratified_fairness_audit(
    df_eval: pd.DataFrame,
    group_col: str,
    y_true_col: str = "actual_fraud",
    y_pred_col: str = "predicted_risk"
) -> pd.DataFrame:
    """
    Computes group-stratified performance and checks for >2x disparate impact on False Positive Rates.
    """
    results = []
    overall_fpr = 0.0

    # Calculate overall baseline FPR
    actual_negatives = df_eval[df_eval[y_true_col] == 0]
    if len(actual_negatives) > 0:
        overall_fpr = (actual_negatives[y_pred_col] >= 0.50).mean()

    for group_name, group_data in df_eval.groupby(group_col):
        n_total = len(group_data)
        negatives = group_data[group_data[y_true_col] == 0]
        positives = group_data[group_data[y_true_col] == 1]
        
        group_fpr = (negatives[y_pred_col] >= 0.50).mean() if len(negatives) > 0 else 0.0
        group_tpr = (positives[y_pred_col] >= 0.50).mean() if len(positives) > 0 else 0.0
        
        disparate_impact_flag = bool((group_fpr >= (1.5 * max(0.01, overall_fpr))) and (len(negatives) >= 10))

        results.append({
            "group": str(group_name),
            "sample_count": n_total,
            "actual_fraud_rate": float(round(group_data[y_true_col].mean(), 4)),
            "group_fpr": float(round(group_fpr, 4)),
            "group_tpr": float(round(group_tpr, 4)),
            "disparate_impact_flag": disparate_impact_flag
        })

    return pd.DataFrame(results).sort_values("sample_count", ascending=False)
