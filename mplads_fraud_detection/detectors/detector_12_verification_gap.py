"""
Detector 12: Verification Gap Flag (Ledger Reconciliation)
Catches discrepancies between aggregate MP financial ledgers and individual completed work disbursements.
"""

import os
import logging
from typing import Dict, List, Any
import pandas as pd
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from mplads_fraud_detection.foundation.utils import safe_divide, monotonic_severity
from mplads_fraud_detection.config import SEVERITY_FLOOR, ALL_MPS_FINANCIAL_BREAKDOWN_CSV

logger = logging.getLogger(__name__)


def run_detector_12_verification_gap(session: Session, run_id: str) -> int:
    """
    Executes Detector 12: Ledger Verification Gap reconciliation.
    """
    logger.info("Executing Detector 12: Verification Gap Forensics...")

    # Load MP Financial Breakdown Ledger
    mp_ledger_map = {}
    if os.path.exists(ALL_MPS_FINANCIAL_BREAKDOWN_CSV):
        df_fin = pd.read_csv(ALL_MPS_FINANCIAL_BREAKDOWN_CSV)
        for _, r in df_fin.iterrows():
            mp_ledger_map[str(r["mp_name"])] = {
                "completed_works_value": float(r.get("completed_works_value", 0.0)),
                "allocated_amount": float(r.get("allocated_amount", 0.0)),
                "payment_gap_percentage": float(r.get("payment_gap_percentage", 0.0))
            }

    works = session.query(Work).filter(Work.status == "completed").all()
    if not works:
        return 0

    df_works = pd.DataFrame([{
        "work_id": w.work_id,
        "cost": w.cost,
        "total_paid": w.total_paid,
        "payment_gap_percentage": w.payment_gap_percentage,
        "payment_record_exists": bool(w.payment_record_exists),
        "mp_name": w.mp_name,
        "district": w.district
    } for w in works])

    # 1. MP-Level Sum of Completed Costs vs Ledger Claimed Value
    mp_completed_sums = df_works.groupby("mp_name")["cost"].sum().to_dict()

    mp_divergence_data = {}
    for mp, sum_cost in mp_completed_sums.items():
        ledger = mp_ledger_map.get(mp)
        if not ledger or ledger["completed_works_value"] <= 0:
            continue

        ledger_val = ledger["completed_works_value"]
        divergence_ratio = sum_cost / ledger_val

        if divergence_ratio > 1.15:
            sev = monotonic_severity(divergence_ratio, [1.15, 1.50, 2.50], [0.50, 0.70, 1.00])
            mp_divergence_data[mp] = {
                "sum_cost": sum_cost,
                "ledger_val": ledger_val,
                "divergence_ratio": divergence_ratio,
                "severity": sev
            }

    anomalies_to_insert = []
    for _, row in df_works.iterrows():
        mp = row["mp_name"]
        cost_val = float(row["cost"])
        paid_val = float(row["total_paid"])
        gap_pct = float(row["payment_gap_percentage"])

        signals = []
        severities = []

        # Signal 1: MP-Level Ledger Claim Divergence (Group signal attributed to constituent works)
        mp_div = mp_divergence_data.get(mp)
        if mp_div:
            signals.append("mp_ledger_claim_divergence")
            severities.append(mp_div["severity"])

        # Signal 2: Severe Work-Level Disbursement Gap (< 25% paid when MP gap >= 60%)
        # Only when a payment record genuinely exists for this work (avoid treating missing
        # payment data as verified non-disbursement).
        disb_ratio = safe_divide(paid_val, cost_val, fill=0.0)
        if bool(row["payment_record_exists"]) and disb_ratio < 0.25 and gap_pct >= 60.0:
            work_disb_sev = monotonic_severity(1.0 - disb_ratio, [0.75, 1.00], [0.50, 0.80])
            signals.append("severe_work_disbursement_deficit")
            severities.append(work_disb_sev)

        if not signals:
            continue

        composite_sev = max(severities)
        if composite_sev < SEVERITY_FLOOR:
            continue

        explanation_parts = []
        if "mp_ledger_claim_divergence" in signals:
            explanation_parts.append(
                f"MP-level ledger divergence: Sum of completed project costs (₹{mp_div['sum_cost']/1e7:.2f} Cr) "
                f"exceeds official state financial ledger completed_works_value (₹{mp_div['ledger_val']/1e7:.2f} Cr) "
                f"by {((mp_div['divergence_ratio']-1)*100):.1f}% (portfolio-level signal attributed to constituent works)"
            )
        if "severe_work_disbursement_deficit" in signals:
            explanation_parts.append(
                f"Severe work-level drawdown gap: Only {disb_ratio*100:.1f}% disbursed (₹{paid_val:,.0f} of ₹{cost_val:,.0f}) "
                f"under MP exhibiting {gap_pct:.1f}% portfolio gap"
            )

        explanation = "VERIFICATION GAP ALERT: " + " | ".join(explanation_parts) + "."

        evidence = {
            "signal_type": "mp_ledger_divergence_group_signal",
            "work_attribution": "associated_mp_work",
            "disbursement_ratio": round(disb_ratio, 3),
            "mp_payment_gap_pct": gap_pct,
            "signals_triggered": signals,
            "cost": cost_val,
            "total_paid": paid_val,
            "mp_name": str(mp)
        }
        if mp_div:
            evidence["mp_total_completed_cost_cr"] = round(mp_div["sum_cost"] / 1e7, 3)
            evidence["mp_ledger_completed_value_cr"] = round(mp_div["ledger_val"] / 1e7, 3)
            evidence["divergence_ratio"] = round(mp_div["divergence_ratio"], 2)

        anomaly = Anomaly(
            work_id=int(row["work_id"]),
            detector_type="verification_gap",
            severity=round(composite_sev, 3),
            explanation=explanation,
            evidence=evidence,
            run_id=run_id
        )
        anomalies_to_insert.append(anomaly)

    session.bulk_save_objects(anomalies_to_insert)
    session.flush()
    logger.info(f"Detector 12 generated {len(anomalies_to_insert):,} verification gap anomalies.")
    return len(anomalies_to_insert)
