"""
Authentication and Authorization Module for MPLADS Fraud Detection Platform.
"""

from mplads_fraud_detection.auth.rbac import require_role

__all__ = ["require_role"]
