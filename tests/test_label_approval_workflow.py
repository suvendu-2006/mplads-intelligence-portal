"""
Unit tests for Dual-Review Label Approval Workflow & Cryptographic Evidence Verification.
Guaranteed to run against isolated_test_db fixture to prevent contaminating operational database.
"""

import os
import pytest
from datetime import datetime, timezone
import streamlit as st

from mplads_fraud_detection.foundation.schema import Work, FraudLabel, LabelHistory, AuditLog, User
from mplads_fraud_detection.foundation.evidence_store import (
    EMPTY_FILE_SHA256,
    store_evidence_document,
    validate_evidence
)
from mplads_fraud_detection.review_queue.priority_router import (
    record_human_audit_feedback,
    approve_audit_label,
    reject_audit_label
)


@pytest.fixture
def setup_isolated_env(isolated_test_db):
    session, engine = isolated_test_db
    work = Work(
        work_id=999999,
        work_description="Test Dual Review Project",
        cost=500000.0,
        district="VISAKHAPATNAM",
        mp_name="Test MP",
        status="Completed"
    )
    session.add(work)

    # Pre-populate test users
    for uid, role in [("auditor_01", "Auditor"), ("auditor_02", "Auditor"), ("auditor_03", "Auditor"),
                      ("auditor_04", "Auditor"), ("auditor_05", "Auditor"),
                      ("viewer_user", "Viewer"), ("sr_rev_01", "SeniorReviewer"), ("sr_rev_02", "SeniorReviewer")]:
        session.add(User(user_id=uid, username=uid, password_hash="dummy_hash", role=role))
    session.commit()
    return session, work.work_id


def test_auditor_submits_pending_review_label(setup_isolated_env):
    session, work_id = setup_isolated_env
    label = record_human_audit_feedback(
        session=session,
        work_id=work_id,
        label_class="CLEARED_OR_LEGITIMATE",
        auditor_id="auditor_01",
        auditor_name="Auditor One",
        audit_notes="Physical site inspection verified asset exists."
    )

    assert label.review_status == "PENDING_REVIEW"
    assert label.auditor_user_id == "auditor_01"
    assert label.verified_by is None

    # Check history recorded
    history = session.query(LabelHistory).filter_by(label_id=label.label_id).first()
    assert history is not None
    assert history.new_status == "PENDING_REVIEW"

    # Check audit log recorded
    log = session.query(AuditLog).filter_by(action="LABEL_SUBMITTED_FOR_REVIEW").first()
    assert log is not None


def test_confirmed_fraud_requires_evidence_and_checksum(setup_isolated_env):
    session, work_id = setup_isolated_env
    # Should raise ValueError without evidence
    with pytest.raises(ValueError, match="CONFIRMED_FRAUD requires a valid evidence_document_path"):
        record_human_audit_feedback(
            session=session,
            work_id=work_id,
            label_class="CONFIRMED_FRAUD",
            auditor_id="auditor_02",
            auditor_name="Auditor Two",
            audit_notes="Non-existent site"
        )


def test_confirmed_fraud_rejects_empty_file_hash(setup_isolated_env):
    session, work_id = setup_isolated_env
    with pytest.raises(ValueError, match="empty file"):
        record_human_audit_feedback(
            session=session,
            work_id=work_id,
            label_class="CONFIRMED_FRAUD",
            auditor_id="auditor_02",
            auditor_name="Auditor Two",
            audit_notes="Fake empty evidence test",
            evidence_document_path="https://cag.gov.in/report.pdf",
            evidence_checksum=EMPTY_FILE_SHA256
        )


def test_confirmed_fraud_rejects_mismatched_checksum(setup_isolated_env, tmp_path):
    session, work_id = setup_isolated_env
    # Create real file with specific content
    test_file = tmp_path / "actual_inspection.pdf"
    test_file.write_bytes(b"Genuine site inspection report content for testing.")

    # Pass an incorrect 64-hex checksum
    wrong_hash = "1" * 64
    with pytest.raises(ValueError, match="Cryptographic evidence mismatch"):
        record_human_audit_feedback(
            session=session,
            work_id=work_id,
            label_class="CONFIRMED_FRAUD",
            auditor_id="auditor_02",
            auditor_name="Auditor Two",
            audit_notes="Mismatched evidence test",
            evidence_document_path=str(test_file),
            evidence_checksum=wrong_hash
        )


def test_confirmed_fraud_rejects_unbacked_placeholders(setup_isolated_env):
    session, work_id = setup_isolated_env
    with pytest.raises(ValueError, match="unbacked placeholder path"):
        record_human_audit_feedback(
            session=session,
            work_id=work_id,
            label_class="CONFIRMED_FRAUD",
            auditor_id="auditor_02",
            auditor_name="Auditor Two",
            evidence_document_path="/evidence/cag_inspection_2026.pdf",
            evidence_checksum="a" * 64
        )


def test_confirmed_fraud_with_stored_authentic_document(setup_isolated_env, tmp_path):
    session, work_id = setup_isolated_env
    # Store real non-empty evidence in test tmp_path
    content = b"%PDF-1.4 Official CAG Audit Findings - Site 999999 non-existent."
    saved_path, checksum = store_evidence_document("cag_audit_999999.pdf", content, target_dir=tmp_path)

    label = record_human_audit_feedback(
        session=session,
        work_id=work_id,
        label_class="CONFIRMED_FRAUD",
        auditor_id="auditor_02",
        auditor_name="Auditor Two",
        audit_notes="Non-existent site confirmed by physical CAG audit",
        evidence_document_path=saved_path,
        evidence_checksum=checksum
    )
    assert label.review_status == "PENDING_REVIEW"
    assert label.evidence_checksum_sha256 == checksum
    assert label.evidence_document_path == saved_path


def test_viewer_cannot_approve_label(setup_isolated_env):
    session, work_id = setup_isolated_env
    label = record_human_audit_feedback(
        session=session,
        work_id=work_id,
        label_class="SUSPICIOUS_UNCONFIRMED",
        auditor_id="auditor_03",
        auditor_name="Auditor Three"
    )

    st.session_state["role"] = "Viewer"
    st.session_state["user_id"] = "viewer_user"

    with pytest.raises(PermissionError):
        approve_audit_label(
            session=session,
            label_id=label.label_id,
            reviewer_id="viewer_user",
            reviewer_name="Viewer Person",
            confidence_score=0.9
        )


def test_senior_reviewer_can_approve_label(setup_isolated_env):
    session, work_id = setup_isolated_env
    label = record_human_audit_feedback(
        session=session,
        work_id=work_id,
        label_class="SUSPICIOUS_UNCONFIRMED",
        auditor_id="auditor_04",
        auditor_name="Auditor Four"
    )

    st.session_state["role"] = "SeniorReviewer"
    st.session_state["user_id"] = "sr_rev_01"

    approved = approve_audit_label(
        session=session,
        label_id=label.label_id,
        reviewer_id="sr_rev_01",
        reviewer_name="Senior Reviewer Principal",
        confidence_score=0.98
    )

    assert approved.review_status == "VERIFIED"
    assert approved.confidence_score == 0.98
    assert approved.verified_by == "Senior Reviewer Principal"
    assert approved.verified_at is not None

    # Cannot approve again
    with pytest.raises(ValueError, match="Label already verified"):
        approve_audit_label(
            session=session,
            label_id=label.label_id,
            reviewer_id="sr_rev_01",
            reviewer_name="Senior Reviewer Principal"
        )


def test_senior_reviewer_can_reject_label(setup_isolated_env):
    session, work_id = setup_isolated_env
    label = record_human_audit_feedback(
        session=session,
        work_id=work_id,
        label_class="SUSPICIOUS_UNCONFIRMED",
        auditor_id="auditor_05",
        auditor_name="Auditor Five"
    )

    st.session_state["role"] = "SeniorReviewer"
    st.session_state["user_id"] = "sr_rev_02"

    rejected = reject_audit_label(
        session=session,
        label_id=label.label_id,
        reviewer_id="sr_rev_02",
        reviewer_name="Senior Reviewer Second",
        rejection_reason="Insufficient site photographs provided."
    )

    assert rejected.review_status == "REJECTED"
    assert rejected.rejection_reason == "Insufficient site photographs provided."
    assert rejected.rejected_by == "Senior Reviewer Second"
