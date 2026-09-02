"""
Unit tests for Metrics Integrity, Zero Discrepancy enforcement, and NaN/Inf guards.
"""

import math
import pytest
from mplads_fraud_detection.foundation.db import init_db, SessionLocal
from mplads_fraud_detection.foundation.schema import Work, Anomaly, EntityRisk
from mplads_fraud_detection.pipeline import run_full_pipeline


def test_metrics_mathematical_integrity():
    """Verify runtime metrics satisfy all conservation and consistency laws."""
    metrics = run_full_pipeline(run_key="test_metrics_integrity_key")

    total_works = metrics["total_works"]
    unique_flagged = metrics["unique_flagged_works"]
    total_fraud_cr = metrics["total_fraud_value_cr"]
    per_det_counts = metrics["per_detector_counts"]
    per_det_cr = metrics["per_detector_value_cr"]
    tier_dist = metrics["risk_tier_distribution"]

    # 1. Conservation of Works Count
    assert sum(tier_dist.values()) == total_works, "Tier counts do not sum to total works"
    assert tier_dist["Clean"] == (total_works - unique_flagged), "Clean tier count mismatch"

    # 2. Deduplication Conservation
    sum_individual_counts = sum(per_det_counts.values())
    assert unique_flagged <= sum_individual_counts, "Unique flagged count exceeds individual sum"

    sum_individual_cr = sum(per_det_cr.values())
    assert total_fraud_cr <= round(sum_individual_cr + 0.01, 2), "Deduplicated fraud value exceeds individual sum"

    # 3. Database Anomaly Record Verification
    session = SessionLocal()
    try:
        anomalies = session.query(Anomaly).all()
        for a in anomalies:
            assert 0.50 <= a.severity <= 1.00, f"Anomaly {a.anomaly_id} severity {a.severity} out of bounds"
            assert not math.isnan(a.severity), f"Anomaly {a.anomaly_id} severity is NaN"
            assert a.explanation and len(a.explanation) > 10, "Explanation empty or truncated"

        entity_risks = session.query(EntityRisk).all()
        for er in entity_risks:
            assert 0.0 <= er.composite_risk <= 100.0, f"Entity {er.entity_key} risk {er.composite_risk} out of bounds"
            assert er.risk_rank >= 1, "Entity risk rank invalid"
            assert er.risk_tier in ["Clean", "Medium", "High", "Very High", "Critical"]
    finally:
        session.close()
