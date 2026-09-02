"""
Human-in-the-Loop Review Queue and Feedback Label Recorder.
Routes predictions to field audit priority tiers and persists human audit outcomes into fraud_labels.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import FraudLabel, Work, Prediction


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
    confidence: str = "HIGH",
    evidence_summary: Optional[str] = None
) -> FraudLabel:
    """
    Records a human ground-truth audit finding (CONFIRMED_FRAUD, SUSPICIOUS_UNCONFIRMED, CLEARED_OR_LEGITIMATE).
    """
    if label_class not in ["CONFIRMED_FRAUD", "SUSPICIOUS_UNCONFIRMED", "CLEARED_OR_LEGITIMATE", "UNKNOWN"]:
        raise ValueError(f"Invalid label class: {label_class}")

    label_record = FraudLabel(
        label_id=str(uuid.uuid4()),
        work_id=work_id,
        label_class=label_class,
        label_date=datetime.now(timezone.utc).date(),
        labeler_id=auditor_id,
        confidence=confidence,
        evidence_summary=evidence_summary or f"Recorded during manual audit review by {auditor_id}",
        review_status="VERIFIED"
    )
    session.add(label_record)
    session.commit()
    return label_record
