"""
Evaluation, calibration, and fairness auditing modules for MPLADS fraud-risk prediction.
"""

from mplads_fraud_detection.evaluation.metrics import (
    compute_precision_at_k,
    compute_comprehensive_evaluation_report
)
from mplads_fraud_detection.evaluation.fairness_audit import run_stratified_fairness_audit
