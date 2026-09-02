"""
Human-in-the-Loop Review Queue and Dual-Review Label Adjudication Protocol.
Routes predictions to field audit priority tiers and enforces dual-review approval
(PENDING_REVIEW -> VERIFIED / REJECTED) with mandatory evidence requirements.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import FraudLabel, Work, Prediction, AuditLog, LabelHistory
from mplads_fraud_detection.auth.rbac import require_role


def route_prediction_to_action_tier(fraud_probability: float, has_hard_evidence: bool = False) -> str:
    """
    Routes a predicted fraud probability to an operational auditor action tier:
      - 🔴 AUDIT_NOW: fraud_prob >= 0.70 OR (has_hard_evidence and fraud_prob >= 0.50)
      - 🟡 REVIEW: 0.45 <= fraud_prob < 0.70
      - ⚪ MONITOR: 0.25 <= fraud_prob < 0.45
      - 🟢 CLEAN: fraud_prob < 0.25
    """
    if fraud_probability >= 0.70 or (has_hard_evidence and fraud_probability >= 0.50):
        return "AUDIT_NOW"
    elif fraud_probability >= 0.45:
        return "REVIEW"
    elif fraud_probability >= 0.25:
        return "MONITOR"
    else:
        return "CLEAN"


def record_human_audit_feedback(
    session: Session,
    work_id: int,
    label_class: str,
    auditor_id: str = "Auditor_Field_Team",
    auditor_name: str = "Auditor_Field_Team",
    audit_notes: str = "",
    evidence_document_path: Optional[str] = None,
    evidence_checksum: Optional[str] = None,
    confidence: str = "HIGH",
    evidence_summary: Optional[str] = None
) -> FraudLabel:
    """
    Records field audit finding as DRAFT label requiring Senior Reviewer approval.

    Workflow:
    1. Auditor submits finding -> review_status = "PENDING_REVIEW"
    2. Senior Reviewer approves -> review_status = "VERIFIED"
    3. Only VERIFIED labels can be used for ML training
    """
    if label_class not in ["CONFIRMED_FRAUD", "SUSPICIOUS_UNCONFIRMED", "CLEARED_OR_LEGITIMATE", "UNKNOWN"]:
        raise ValueError(f"Invalid label class: {label_class}")

    # Validate evidence requirements
    if label_class == "CONFIRMED_FRAUD":
        if not evidence_document_path or not evidence_checksum:
            raise ValueError(
                "CONFIRMED_FRAUD requires evidence_document_path and SHA-256 checksum"
            )

    label_id = str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc)

    # Check if auditor_id maps to a registered User row
    from mplads_fraud_detection.foundation.schema import User
    user_match = session.query(User).filter((User.user_id == auditor_id) | (User.username == auditor_id)).first()
    valid_user_id = user_match.user_id if user_match else None

    # Create DRAFT label (not yet verified)
    fraud_label = FraudLabel(
        label_id=label_id,
        work_id=work_id,
        label_class=label_class,
        label_date=now_utc.date(),
        labeler_id=auditor_name,
        auditor_user_id=valid_user_id,
        confidence=confidence,
        confidence_score=None,  # Assigned by Senior Reviewer
        evidence_summary=evidence_summary or audit_notes or f"Recorded by auditor {auditor_name}",
        evidence_document_path=evidence_document_path,
        evidence_checksum_sha256=evidence_checksum,
        review_status="PENDING_REVIEW",  # Dual-review draft state
        submitted_at=now_utc,
        verified_by=None,
        verified_by_user_id=None,
        verified_at=None,
        created_at=now_utc
    )
    session.add(fraud_label)

    # Log initial status in LabelHistory
    history = LabelHistory(
        history_id=str(uuid.uuid4()),
        label_id=label_id,
        previous_status=None,
        new_status="PENDING_REVIEW",
        changed_by=valid_user_id,
        changed_at=now_utc,
        reason=f"Draft audit finding submitted by {auditor_name}"
    )
    session.add(history)

    # Log submission to audit trail
    log = AuditLog(
        user_id=valid_user_id,
        action="LABEL_SUBMITTED_FOR_REVIEW",
        entity_type="FraudLabel",
        entity_id=str(work_id),
        timestamp=now_utc,
        details_json={
            "label_id": label_id,
            "work_id": work_id,
            "verdict": label_class,
            "auditor": auditor_name,
            "has_evidence": bool(evidence_document_path)
        }
    )
    session.add(log)
    session.commit()

    return fraud_label


@require_role("SeniorReviewer", "Admin")
def approve_audit_label(
    session: Session,
    label_id: str,
    reviewer_id: str,
    reviewer_name: str,
    confidence_score: float = 0.95
) -> FraudLabel:
    """
    Senior Reviewer approves draft label, marking it VERIFIED for ML training.
    """
    label = session.query(FraudLabel).filter(FraudLabel.label_id == label_id).first()
    if not label:
        raise ValueError(f"Label {label_id} not found")

    if label.review_status == "VERIFIED":
        raise ValueError("Label already verified")

    if label.review_status != "PENDING_REVIEW":
        raise ValueError(f"Invalid transition from {label.review_status} to VERIFIED")

    now_utc = datetime.now(timezone.utc)
    prev_status = label.review_status

    from mplads_fraud_detection.foundation.schema import User
    user_match = session.query(User).filter((User.user_id == reviewer_id) | (User.username == reviewer_id)).first()
    valid_reviewer_id = user_match.user_id if user_match else None

    # Mark as verified
    label.review_status = "VERIFIED"
    label.confidence_score = confidence_score
    label.verified_by = reviewer_name
    label.verified_by_user_id = valid_reviewer_id
    label.verified_at = now_utc

    # Log history
    history = LabelHistory(
        history_id=str(uuid.uuid4()),
        label_id=label_id,
        previous_status=prev_status,
        new_status="VERIFIED",
        changed_by=valid_reviewer_id,
        changed_at=now_utc,
        reason=f"Approved by {reviewer_name} with confidence score {confidence_score}"
    )
    session.add(history)

    # Log approval to immutable audit logs
    log = AuditLog(
        user_id=valid_reviewer_id,
        action="LABEL_APPROVED",
        entity_type="FraudLabel",
        entity_id=str(label.label_id),
        timestamp=now_utc,
        details_json={
            "label_id": label.label_id,
            "work_id": label.work_id,
            "verdict": label.label_class,
            "confidence": confidence_score,
            "reviewer": reviewer_name
        }
    )
    session.add(log)
    session.commit()

    return label


@require_role("SeniorReviewer", "Admin")
def reject_audit_label(
    session: Session,
    label_id: str,
    reviewer_id: str,
    reviewer_name: str,
    rejection_reason: str
) -> FraudLabel:
    """
    Senior Reviewer rejects draft label for inadequate evidence or procedural defect.
    """
    label = session.query(FraudLabel).filter(FraudLabel.label_id == label_id).first()
    if not label:
        raise ValueError(f"Label {label_id} not found")

    if label.review_status != "PENDING_REVIEW":
        raise ValueError(f"Invalid transition from {label.review_status} to REJECTED")

    now_utc = datetime.now(timezone.utc)
    prev_status = label.review_status

    from mplads_fraud_detection.foundation.schema import User
    user_match = session.query(User).filter((User.user_id == reviewer_id) | (User.username == reviewer_id)).first()
    valid_reviewer_id = user_match.user_id if user_match else None

    # Mark as rejected
    label.review_status = "REJECTED"
    label.rejection_reason = rejection_reason
    label.rejected_by = reviewer_name
    label.rejected_by_user_id = valid_reviewer_id
    label.rejected_at = now_utc

    # Log history
    history = LabelHistory(
        history_id=str(uuid.uuid4()),
        label_id=label_id,
        previous_status=prev_status,
        new_status="REJECTED",
        changed_by=valid_reviewer_id,
        changed_at=now_utc,
        reason=rejection_reason
    )
    session.add(history)

    # Log rejection to audit trail
    log = AuditLog(
        user_id=valid_reviewer_id,
        action="LABEL_REJECTED",
        entity_type="FraudLabel",
        entity_id=str(label.label_id),
        timestamp=now_utc,
        details_json={
            "label_id": label.label_id,
            "work_id": label.work_id,
            "rejection_reason": rejection_reason,
            "reviewer": reviewer_name
        }
    )
    session.add(log)
    session.commit()

    return label
