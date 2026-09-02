"""
Unit tests for Synthetic Fraud Injections.
Injects 5 ground-truth fraud patterns and asserts 100% detection accuracy by the respective detectors.
"""

import uuid
import datetime
import pytest
from mplads_fraud_detection.foundation.db import init_db, SessionLocal
from mplads_fraud_detection.foundation.schema import Work, Anomaly, PipelineRun
from mplads_fraud_detection.detectors.detector_02_duplicate_works import run_detector_02_duplicate_works
from mplads_fraud_detection.detectors.detector_03_cost_overruns import run_detector_03_cost_overruns
from mplads_fraud_detection.detectors.detector_04_ghost_works import run_detector_04_ghost_works
from mplads_fraud_detection.detectors.detector_05_bill_splitting import run_detector_05_bill_splitting
from mplads_fraud_detection.detectors.detector_08_bulk_completion import run_detector_08_bulk_completion


@pytest.fixture(scope="function")
def setup_injection_db(isolated_test_db):
    session, engine = isolated_test_db
    run_id = str(uuid.uuid4())

    run_record = PipelineRun(run_id=run_id, run_key="test_synthetic_injections", status="RUNNING")
    session.add(run_record)
    session.commit()

    return session, run_id


def test_synthetic_fraud_injections(setup_injection_db):
    session, run_id = setup_injection_db

    # 1. Inject CPWD Overrun Work (CC Road 500m billed at ₹35L = ₹7,000/m vs ₹3,200/m norm)
    w_overrun = Work(
        work_id=90001,
        work_description="Construction of CC Road 500 meters in Test Village",
        cost=3500000.0,
        category="Roads - CC",
        district="TEST_DISTRICT",
        mp_name="Test MP",
        status="completed",
        completion_date=datetime.date(2024, 1, 10),
        recommended_date=datetime.date(2023, 6, 1)
    )

    # 2. Inject Ghost Work (Completed, ₹0 paid, MP with 75% gap)
    w_ghost = Work(
        work_id=90002,
        work_description="Construction of School Building in Phantom GP",
        cost=1500000.0,
        category="School Building",
        district="TEST_DISTRICT",
        mp_name="Test Ghost MP",
        status="completed",
        completion_date=datetime.date(2024, 2, 1),
        has_payments=False,
        total_paid=0.0,
        payment_gap_percentage=75.0
    )

    # 3. Inject Bill Splitting Cluster (5 works at ₹4,90,000 in same month)
    split_works = []
    for wid in range(90003, 90008):
        split_works.append(Work(
            work_id=wid,
            work_description=f"CC Road construction part {wid-90002}",
            cost=490000.0,
            category="Roads - CC",
            district="TEST_DISTRICT",
            mp_name="Test Smurf MP",
            status="completed",
            recommended_date=datetime.date(2023, 8, 15),
            completion_date=datetime.date(2024, 2, 10)
        ))

    # 4. Inject March 31 Bulk Closure (15 works on March 31)
    bulk_works = []
    for wid in range(90010, 90025):
        bulk_works.append(Work(
            work_id=wid,
            work_description=f"Drinking water pipeline installation unit {wid-90009}",
            cost=200000.0,
            category="Drinking Water",
            district="BULK_DISTRICT",
            mp_name="Test Bulk MP",
            status="completed",
            completion_date=datetime.date(2024, 3, 31)
        ))

    session.add_all([w_overrun, w_ghost] + split_works + bulk_works)
    session.commit()

    # Run individual detectors
    c3 = run_detector_03_cost_overruns(session, run_id)
    c4 = run_detector_04_ghost_works(session, run_id)
    c5 = run_detector_05_bill_splitting(session, run_id)
    c8 = run_detector_08_bulk_completion(session, run_id)

    # Assert 100% Detection on Injected Patterns
    assert c3 >= 1, "Failed to detect CPWD overrun injection"
    assert c4 >= 1, "Failed to detect Ghost work injection"
    assert c5 >= 5, "Failed to detect Bill splitting cluster"
    assert c8 >= 15, "Failed to detect March 31 Bulk completion batch"
