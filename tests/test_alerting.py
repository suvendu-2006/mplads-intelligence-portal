"""
Unit tests for monitoring and alerting system.
"""

from mplads_fraud_detection.monitoring.alerting import send_alert, check_feature_drift_alert
from mplads_fraud_detection.foundation.schema import AuditLog


def test_send_alert(isolated_test_db):
    session, engine = isolated_test_db

    alert = send_alert(
        severity="HIGH",
        message="Test alert message",
        action="Review test logs"
    )

    assert alert["severity"] == "HIGH"
    assert alert["message"] == "Test alert message"
    assert alert["recommended_action"] == "Review test logs"


def test_check_feature_drift_alert():
    alert_high = check_feature_drift_alert("cost_overrun", 0.32)
    assert alert_high is not None
    assert alert_high["severity"] == "HIGH"

    alert_low = check_feature_drift_alert("cost_overrun", 0.04)
    assert alert_low is None
