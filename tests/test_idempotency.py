"""
Unit tests for pipeline idempotency and database transaction state management.
"""

import pytest
from mplads_fraud_detection.foundation.db import init_db, SessionLocal, purge_prior_snapshot_runs
from mplads_fraud_detection.foundation.schema import PipelineRun, Anomaly, Work, ReviewQueueItem, EntityRisk
from mplads_fraud_detection.foundation.etl import load_works_into_db
from mplads_fraud_detection.pipeline import run_full_pipeline


def test_idempotent_pipeline_execution():
    """Verify executing the same run_key twice produces deterministic, collision-free results."""
    init_db()
    session = SessionLocal()
    try:
        # Load works if needed
        load_works_into_db(session)
        session.commit()
    finally:
        session.close()

    # Run 1
    metrics1 = run_full_pipeline(run_key="test_idempotency_key")
    
    # Run 2 (Same run_key)
    metrics2 = run_full_pipeline(run_key="test_idempotency_key")

    assert metrics1["unique_flagged_works"] == metrics2["unique_flagged_works"]
    assert metrics1["total_fraud_value_cr"] == metrics2["total_fraud_value_cr"]
    assert metrics1["per_detector_counts"] == metrics2["per_detector_counts"]
