"""
Integration test verifying that tests run cleanly against isolated temporary databases.
"""

from mplads_fraud_detection.foundation.schema import Work, Anomaly


def test_isolated_db_fixture_cleanliness(isolated_test_db):
    session, engine = isolated_test_db
    
    # Verify fresh state
    assert session.query(Work).count() == 0
    assert session.query(Anomaly).count() == 0

    # Insert test dummy record
    w = Work(
        work_id=999999,
        mp_name="Test MP",
        district="TEST DISTRICT",
        category="Roads",
        cost=500000.0,
        work_description="Test isolated road work",
        status="completed"
    )
    session.add(w)
    session.commit()

    assert session.query(Work).count() == 1
    assert session.query(Work).first().work_id == 999999
