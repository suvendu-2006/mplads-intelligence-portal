"""
Unit tests for Dual-Review Label Approval Workflow & Evidence Verification.
"""

import os
import pytest
from datetime import datetime, timezone
import streamlit as st

from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import Work, FraudLabel, LabelHistory, AuditLog
from mplads_fraud_detection.review_queue.priority_router import (
    record_human_audit_feedback,
    approve_audit_label,
    reject_audit_label
)


@pytest.fixture
def clean_test_work():
    session = SessionLocal()
    work = session.query(Work).first()
    if not work:
        work = Work(
            work_id=999999,
            work_description="Test Dual Review Project",
            cost=500000.0,
            district="VISAKHAPATNAM",
            mp_name="Test MP",
            status="Completed"
        )
        session.add(work)
        session.commit()
    work_id = work.work_id
    session.close()
    return work_id


def test_auditor_submits_pending_review_label(clean_test_work):
    session = SessionLocal()
    try:
        from mplads_fraud_detection.foundation.schema import User
        u = session.query(User).filter_by(user_id="auditor_01").first()
        if not u:
            session.add(User(user_id="auditor_01", username="auditor_01", password_hash="dummy_hash", role="Auditor"))
            session.commit()

        label = record_human_audit_feedback(
            session=session,
            work_id=clean_test_work,
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
    finally:
        session.close()


def test_confirmed_fraud_requires_evidence_and_checksum(clean_test_work):
    session = SessionLocal()
    try:
        # Should raise ValueError without evidence
        with pytest.raises(ValueError, match="CONFIRMED_FRAUD requires evidence_document_path and SHA-256 checksum"):
            record_human_audit_feedback(
                session=session,
                work_id=clean_test_work,
                label_class="CONFIRMED_FRAUD",
                auditor_id="auditor_02",
                auditor_name="Auditor Two",
                audit_notes="Non-existent site"
            )

        # Should succeed with evidence
        label = record_human_audit_feedback(
            session=session,
            work_id=clean_test_work,
            label_class="CONFIRMED_FRAUD",
            auditor_id="auditor_02",
            auditor_name="Auditor Two",
            audit_notes="Non-existent site confirmed by physical audit",
            evidence_document_path="/evidence/cag_report_2026.pdf",
            evidence_checksum="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        )
        assert label.review_status == "PENDING_REVIEW"
        assert label.evidence_checksum_sha256 == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    finally:
        session.close()


def test_viewer_cannot_approve_label(clean_test_work):
    session = SessionLocal()
    try:
        label = record_human_audit_feedback(
            session=session,
            work_id=clean_test_work,
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
    finally:
        session.close()


def test_senior_reviewer_can_approve_label(clean_test_work):
    session = SessionLocal()
    try:
        label = record_human_audit_feedback(
            session=session,
            work_id=clean_test_work,
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
    finally:
        session.close()


def test_senior_reviewer_can_reject_label(clean_test_work):
    session = SessionLocal()
    try:
        label = record_human_audit_feedback(
            session=session,
            work_id=clean_test_work,
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
    finally:
        session.close()
