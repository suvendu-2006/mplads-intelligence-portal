"""
Unit tests for Human Review Queue and Label Feedback Logging.
"""

from mplads_fraud_detection.review_queue.priority_router import (
    route_prediction_to_action_tier,
    record_human_audit_feedback
)
from mplads_fraud_detection.foundation.schema import Work, FraudLabel


def test_priority_routing():
    assert route_prediction_to_action_tier(0.85, has_hard_evidence=True) == "AUDIT_NOW"
    assert route_prediction_to_action_tier(0.55, has_hard_evidence=True) == "AUDIT_NOW"
    assert route_prediction_to_action_tier(0.55, has_hard_evidence=False) == "REVIEW"
    assert route_prediction_to_action_tier(0.35, has_hard_evidence=False) == "MONITOR"
    assert route_prediction_to_action_tier(0.15, has_hard_evidence=False) == "CLEAN"


def test_record_human_audit_feedback(isolated_test_db):
    session, engine = isolated_test_db

    w = Work(
        work_id=5001,
        work_description="Community hall construction",
        cost=1200000.0,
        district="KRISHNA",
        mp_name="Test MP",
        category="Public Buildings"
    )
    session.add(w)
    session.commit()

    label = record_human_audit_feedback(
        session=session,
        work_id=5001,
        label_class="CONFIRMED_FRAUD",
        auditor_id="CAG_Team_01",
        confidence="HIGH",
        evidence_summary="Physical inspection confirmed non-existent foundation.",
        evidence_document_path="/evidence/cag_audit_krishna_2026.pdf",
        evidence_checksum="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )

    assert label.work_id == 5001
    assert label.label_class == "CONFIRMED_FRAUD"
    assert label.review_status == "PENDING_REVIEW"
    assert session.query(FraudLabel).count() == 1
