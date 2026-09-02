"""
Production Monitoring and Automated Alerting System.
Tracks feature drift, ETL data freshness, and system anomalies.
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import AuditLog, IngestionRun

logger = logging.getLogger(__name__)


def send_alert(severity: str, message: str, action: str, alert_email: Optional[str] = None) -> dict:
    """
    Broadcasts operational alerts and logs to the immutable audit trail.

    Args:
        severity: "HIGH" | "MEDIUM" | "LOW"
        message: Human-readable alert summary
        action: Recommended operational response
        alert_email: Optional destination email address
    """
    timestamp = datetime.now(timezone.utc)
    email_dest = alert_email or os.getenv("ALERT_EMAIL", "admin@agency.gov.in")

    alert_payload = {
        "timestamp": timestamp.isoformat(),
        "severity": severity.upper(),
        "message": message,
        "recommended_action": action,
        "recipient": email_dest
    }

    # Record to immutable audit_logs
    session = SessionLocal()
    try:
        log_entry = AuditLog(
            action=f"SYSTEM_ALERT_{severity.upper()}",
            entity_type="SYSTEM_MONITORING",
            entity_id="GLOBAL",
            timestamp=timestamp,
            details_json=alert_payload
        )
        session.add(log_entry)
        session.commit()
    except Exception as e:
        logger.error(f"Failed to write alert to audit_logs: {e}")
        session.rollback()
    finally:
        session.close()

    logger.warning(f"[{severity.upper()}] ALERT: {message} | Action: {action}")
    return alert_payload


def check_data_freshness(max_stale_days: int = 7) -> Optional[dict]:
    """
    Validates data recency against the latest ingestion run.
    Alerts if data has not refreshed within the threshold.
    """
    session = SessionLocal()
    try:
        latest_run = session.query(IngestionRun).order_by(
            IngestionRun.started_at.desc()
        ).first()

        if not latest_run:
            return send_alert(
                severity="MEDIUM",
                message="No ETL ingestion runs found in database.",
                action="Execute ingestion pipeline to load current government records."
            )

        days_old = (datetime.now(timezone.utc) - latest_run.started_at.replace(tzinfo=timezone.utc)).days
        if days_old > max_stale_days:
            return send_alert(
                severity="HIGH",
                message=f"Dataset is {days_old} days old (Last ingestion: {latest_run.started_at.strftime('%Y-%m-%d')}).",
                action="Verify upstream MoSPI portal access and trigger automated ETL sync."
            )
        return None
    finally:
        session.close()


def check_feature_drift_alert(feature_name: str, psi_score: float) -> Optional[dict]:
    """
    Triggers alert if a feature's Population Stability Index (PSI) exceeds 0.25.
    """
    if psi_score >= 0.25:
        return send_alert(
            severity="HIGH",
            message=f"Severe distribution drift detected on feature '{feature_name}' (PSI={psi_score:.4f} >= 0.25).",
            action="Audit recent input batches for schema drift or regulatory rate updates."
        )
    elif psi_score >= 0.10:
        return send_alert(
            severity="MEDIUM",
            message=f"Moderate distribution shift detected on feature '{feature_name}' (PSI={psi_score:.4f} >= 0.10).",
            action="Monitor feature in next audit cycle."
        )
    return None
