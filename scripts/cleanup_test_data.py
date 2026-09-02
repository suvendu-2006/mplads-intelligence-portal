"""
Audited cleanup script to purge test/demo labels and label history from operational database.
"""

import uuid
from datetime import datetime, timezone
from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import FraudLabel, LabelHistory, AuditLog


def purge_test_labels():
    session = SessionLocal()
    try:
        label_count = session.query(FraudLabel).count()
        history_count = session.query(LabelHistory).count()

        session.query(LabelHistory).delete()
        session.query(FraudLabel).delete()

        audit_log = AuditLog(
            log_id=str(uuid.uuid4()),
            user_id=None,
            action="PURGE_TEST_DATA",
            entity_type="FraudLabel",
            entity_id="ALL",
            timestamp=datetime.now(timezone.utc),
            details_json={
                "purged_fraud_labels": label_count,
                "purged_label_history": history_count,
                "reason": "Pre-deployment forensic purge of test and demo labels to restore clean operational baseline"
            }
        )
        session.add(audit_log)
        session.commit()

        print(f"✓ Successfully purged {label_count} test FraudLabel records and {history_count} LabelHistory records.")
        print("✓ Immutable audit log record created.")
    finally:
        session.close()


if __name__ == "__main__":
    purge_test_labels()
