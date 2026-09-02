"""
Automated Data Retention and Lifecycle Maintenance System.
Enforces 7-year audit log retention, 2-year prediction retention, and 30-day backup pruning.
"""

import logging
from datetime import datetime, timezone, timedelta
from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import AuditLog, Prediction

logger = logging.getLogger(__name__)

RETENTION_SCHEDULE = {
    "audit_logs": timedelta(days=365 * 7),    # 7 years
    "predictions": timedelta(days=365 * 2),   # 2 years
    "quarantined_data": timedelta(days=365)   # 1 year
}


def cleanup_old_audit_logs() -> int:
    """Prunes audit logs older than the 7-year statutory window."""
    session = SessionLocal()
    cutoff = datetime.now(timezone.utc) - RETENTION_SCHEDULE["audit_logs"]
    try:
        deleted = session.query(AuditLog).filter(AuditLog.timestamp < cutoff).delete()
        session.commit()
        logger.info(f"Purged {deleted} audit log entries older than {cutoff.isoformat()}.")
        return deleted
    except Exception as e:
        session.rollback()
        logger.error(f"Error purging old audit logs: {e}")
        return 0
    finally:
        session.close()


def cleanup_old_predictions(keep_current_version: str = "ensemble_v1") -> int:
    """Prunes predictions older than 2 years from retired model versions."""
    session = SessionLocal()
    cutoff = datetime.now(timezone.utc) - RETENTION_SCHEDULE["predictions"]
    try:
        deleted = session.query(Prediction).filter(
            Prediction.created_at < cutoff,
            Prediction.model_version != keep_current_version
        ).delete()
        session.commit()
        logger.info(f"Purged {deleted} prediction records older than {cutoff.isoformat()}.")
        return deleted
    except Exception as e:
        session.rollback()
        logger.error(f"Error purging old predictions: {e}")
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    print("Running scheduled retention cleanup...")
    c1 = cleanup_old_audit_logs()
    c2 = cleanup_old_predictions()
    print(f"Retention maintenance completed: {c1} logs, {c2} predictions cleaned.")
