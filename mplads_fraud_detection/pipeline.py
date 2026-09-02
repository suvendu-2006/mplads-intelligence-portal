"""
Master Pipeline Orchestrator for MPLADS Fraud Detection System.
Coordinates ETL ingestion, 15 forensic detectors, transaction management, and metric exports.
"""

import os
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from mplads_fraud_detection.foundation.schema import PipelineRun
from mplads_fraud_detection.foundation.db import init_db, SessionLocal, purge_prior_snapshot_runs
from mplads_fraud_detection.foundation.etl import load_works_into_db
from mplads_fraud_detection.foundation.utils import generate_verified_metrics
from mplads_fraud_detection.config import ARTIFACTS_DIR

from mplads_fraud_detection.detectors import (
    run_detector_01_unusual_patterns,
    run_detector_02_duplicate_works,
    run_detector_03_cost_overruns,
    run_detector_04_ghost_works,
    run_detector_05_bill_splitting,
    run_detector_06_delay_violation,
    run_detector_07_timing_anomaly,
    run_detector_08_bulk_completion,
    run_detector_09_benford_anomaly,
    run_detector_10_vague_description,
    run_detector_11_plausibility_mismatch,
    run_detector_12_verification_gap,
    run_detector_13_ida_risk,
    run_detector_14_mp_risk,
    run_detector_15_copy_paste_pricing
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("mplads_pipeline")


def update_pipeline_run_status(
    run_id: str,
    status: str,
    error_msg: Optional[str] = None
):
    """Updates pipeline run status in an independent, atomic transaction."""
    session = SessionLocal()
    try:
        run_record = session.query(PipelineRun).filter(PipelineRun.run_id == run_id).first()
        if run_record:
            run_record.status = status
            if status == "COMPLETED":
                run_record.completed_at = datetime.now(timezone.utc)
            elif status == "FAILED":
                run_record.error_message = error_msg
            session.commit()
    finally:
        session.close()


def run_full_pipeline(
    run_key: str = "master_snapshot_v1",
    force_reload_etl: bool = False
) -> Dict[str, Any]:
    """
    Executes the complete, end-to-end 15-detector forensic pipeline.

    Args:
        run_key: Idempotent key identifying this snapshot configuration.
        force_reload_etl: Whether to reload works dataset from raw CSV files.

    Returns:
        Dict containing 100% verified, runtime-computed metrics.
    """
    logger.info(f"============================================================")
    logger.info(f"STARTING MPLADS FRAUD DETECTION PIPELINE [run_key={run_key}]")
    logger.info(f"============================================================")

    # 1. Initialize Database Schema
    init_db()

    # 2. Register Pipeline Run
    run_id = str(uuid.uuid4())
    init_session = SessionLocal()
    try:
        pipeline_run = PipelineRun(
            run_id=run_id,
            run_key=run_key,
            started_at=datetime.now(timezone.utc),
            status="RUNNING"
        )
        init_session.add(pipeline_run)
        init_session.commit()
    finally:
        init_session.close()

    # 3. Main Transactional Execution Block
    session = SessionLocal()
    try:
        # Purge any previous results for this run_key to maintain strict idempotency
        purge_prior_snapshot_runs(session, run_key, run_id)

        # ETL Ingestion
        load_works_into_db(session)

        # Execute 13 Work-Level Detectors in Logical Dependency Order
        logger.info("Executing Batch 1: Core Financial & Temporal Forensics...")
        run_detector_03_cost_overruns(session, run_id)
        run_detector_04_ghost_works(session, run_id)
        run_detector_06_delay_violation(session, run_id)
        run_detector_08_bulk_completion(session, run_id)

        logger.info("Executing Batch 2: Statistical & Structural Anomaly Screens...")
        run_detector_01_unusual_patterns(session, run_id)
        run_detector_05_bill_splitting(session, run_id)
        run_detector_07_timing_anomaly(session, run_id)
        run_detector_09_benford_anomaly(session, run_id)

        logger.info("Executing Batch 3: Content Forensics & Boundary Reconciliation...")
        run_detector_02_duplicate_works(session, run_id)
        run_detector_10_vague_description(session, run_id)
        run_detector_11_plausibility_mismatch(session, run_id)
        run_detector_12_verification_gap(session, run_id)
        run_detector_15_copy_paste_pricing(session, run_id)

        # Execute Entity-Level Risk Profilers (D13 & D14)
        logger.info("Executing Meta Batch: Entity-Level Forensic Profilers...")
        run_detector_13_ida_risk(session, run_id)
        run_detector_14_mp_risk(session, run_id)

        # Generate Verified Metrics
        logger.info("Computing Deduplicated Runtime Metrics & Precision Ranks...")
        metrics = generate_verified_metrics(session, run_id)

        # Export Ground-Truth Stratified Audit Sample (Phase 2)
        logger.info("Exporting 1,000-work Stratified Ground-Truth Audit Sample...")
        from mplads_fraud_detection.foundation.utils import export_stratified_audit_sample
        sample_path = export_stratified_audit_sample(session, run_id)
        logger.info(f"Saved stratified audit ground-truth sample to {sample_path}")

        # Update PipelineRun status directly within active transaction
        active_run = session.query(PipelineRun).filter(PipelineRun.run_id == run_id).first()
        if active_run:
            active_run.status = "COMPLETED"
            active_run.completed_at = datetime.now(timezone.utc)

        # Commit All Detector Records and Status Atomically
        session.commit()
        logger.info("Pipeline Transaction Committed Successfully!")

    except Exception as e:
        session.rollback()
        logger.error(f"Pipeline Execution Failed: {e}", exc_info=True)
        try:
            fail_run = session.query(PipelineRun).filter(PipelineRun.run_id == run_id).first()
            if fail_run:
                fail_run.status = "FAILED"
                fail_run.error_message = str(e)
                fail_run.completed_at = datetime.now(timezone.utc)
                session.commit()
        except Exception:
            pass
        raise e
    finally:
        session.close()

    # 4. Save Verified Metrics Artifact
    metrics_path = ARTIFACTS_DIR / f"metrics_{run_key}.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    logger.info(f"Saved verified metrics to {metrics_path}")

    # Print Summary Report
    print("\n" + "="*70)
    print(f" MPLADS FORENSIC PIPELINE EXECUTION SUMMARY [{run_key}]")
    print("="*70)
    print(f"Total Works Audited:          {metrics['total_works']:,}")
    print(f"Unique Flagged Works:         {metrics['unique_flagged_works']:,} ({metrics['unique_flagged_pct']}%)")
    print(f"Deduplicated Fraud Value:     ₹{metrics['total_fraud_value_cr']:,.2f} Crore")
    print("\nPer-Detector Anomaly Breakdown (Natural Overlap):")
    for d, count in metrics["per_detector_counts"].items():
        val = metrics["per_detector_value_cr"].get(d, 0.0)
        print(f"  • {d:<25}: {count:>5,} works | ₹{val:>8.2f} Cr")
    print("\nRisk Tier Distribution (Works):")
    for tier, count in metrics["risk_tier_distribution"].items():
        pct = (count / metrics['total_works']) * 100
        print(f"  • {tier:<15}: {count:>6,} works ({pct:>5.1f}%)")
    print("="*70 + "\n")

    return metrics


if __name__ == "__main__":
    run_full_pipeline()
