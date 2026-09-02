"""
Detector 4: Ghost Works (Phantom Project Detection)
Catches projects marked completed on paper but lacking financial disbursements or physical verification.
"""

import logging
from datetime import datetime, date
from typing import Dict, List, Any
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from mplads_fraud_detection.foundation.utils import safe_divide, monotonic_severity
from mplads_fraud_detection.config import SEVERITY_FLOOR

logger = logging.getLogger(__name__)


def run_detector_04_ghost_works(session: Session, run_id: str) -> int:
    """
    Executes Detector 4: Ghost Works using payment drawdowns and MP gap context.
    """
    logger.info("Executing Detector 4: Ghost Works (Payment Forensics)...")

    # D4 operates strictly on completed works
    works = session.query(Work).filter(Work.status == "completed").all()
    anomalies_to_insert = []
    today = date.today()

    for w in works:
        cost_val = float(w.cost)
        total_paid_val = float(w.total_paid)
        has_payments_val = bool(w.has_payments)
        gap_pct = float(w.payment_gap_percentage) if w.payment_gap_percentage else 0.0
        pay_record_exists = bool(w.payment_record_exists)

        signals_triggered = []
        signal_severities = []

        # Payment signals require an actual payment record (payment_record_exists).
        # If the ledger carries NO payment row for this work, we treat the payment
        # status as UNKNOWN (missing data), not as verified zero payment.
        if pay_record_exists:
            # Signal 1: Zero Payment Record
            if not has_payments_val or total_paid_val == 0.0:
                signals_triggered.append("no_payment")
                signal_severities.append(0.80)

            # Signal 2: Severe Underpayment (< 50% of claimed cost)
            elif 0.0 < total_paid_val < (0.50 * cost_val):
                pay_ratio = total_paid_val / cost_val
                underpay_sev = monotonic_severity(1.0 - pay_ratio, [0.50, 1.00], [0.50, 0.80])
                signals_triggered.append("under_payment")
                signal_severities.append(underpay_sev)

        # Signal 3: MP-Level Systematic Payment Gap Boost (works even without work-level records)
        if gap_pct >= 40.0:
            gap_sev = monotonic_severity(gap_pct, [40.0, 60.0, 80.0, 100.0], [0.30, 0.60, 0.85, 1.00])
            signals_triggered.append("mp_gap_context")
            signal_severities.append(gap_sev)

        if not signals_triggered:
            continue

        # Composite calculation within D4
        base_sev = max(signal_severities)
        n_sigs = len(signals_triggered)
        composite_sev = min(1.0, base_sev + 0.10 * (n_sigs - 1))

        # False Positive Mitigation 1: Recent completion grace period (within last 30 days)
        if w.completion_date:
            days_since_comp = (today - w.completion_date).days
            if 0 <= days_since_comp < 30:
                composite_sev *= 0.60

        # False Positive Mitigation 2: Small projects (< ₹50,000)
        if cost_val < 50000.0:
            composite_sev *= 0.80

        if composite_sev < SEVERITY_FLOOR:
            continue

        # Formulate Explanation
        explanation_parts = []
        if "no_payment" in signals_triggered:
            explanation_parts.append(f"Marked 'completed' on {w.completion_date} but has ZERO recorded financial drawdowns (₹0 paid)")
        elif "under_payment" in signals_triggered:
            pct_paid = (total_paid_val / cost_val) * 100.0
            explanation_parts.append(f"Only {pct_paid:.1f}% of claimed cost was disbursed (₹{total_paid_val:,.0f} paid out of ₹{cost_val:,.0f})")

        if "mp_gap_context" in signals_triggered:
            explanation_parts.append(f"MP {w.mp_name} exhibits a systemic {gap_pct:.1f}% unverified payment gap across portfolio")

        explanation = "GHOST WORK ALERT: " + " | ".join(explanation_parts) + "."

        evidence = {
            "has_payments": has_payments_val,
            "total_paid": total_paid_val,
            "claimed_cost": cost_val,
            "disbursement_ratio": round(total_paid_val / cost_val, 3),
            "mp_payment_gap_pct": gap_pct,
            "signals_triggered": signals_triggered,
            "completion_date": str(w.completion_date),
            "district": str(w.district),
            "mp_name": str(w.mp_name)
        }

        anomaly = Anomaly(
            work_id=w.work_id,
            detector_type="ghost_work",
            severity=round(composite_sev, 3),
            explanation=explanation,
            evidence=evidence,
            run_id=run_id
        )
        anomalies_to_insert.append(anomaly)

    session.bulk_save_objects(anomalies_to_insert)
    session.flush()
    logger.info(f"Detector 4 generated {len(anomalies_to_insert):,} ghost work anomalies.")
    return len(anomalies_to_insert)
