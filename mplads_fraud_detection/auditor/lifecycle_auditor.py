"""
WorkLifecycleAuditor: Master transactional lifecycle re-auditing engine.
Manages single-work and batch forensic evaluations with savepoint isolation,
statutory severity floor clipping, and in-place soft resolution.
"""

import logging
import os
import json
import re
from datetime import datetime, timezone, date, timedelta
from typing import Dict, List, Any, Optional, Union, Tuple
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import func

try:
    import joblib
except ImportError:
    joblib = None

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    TfidfVectorizer = None
    cosine_similarity = None

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from mplads_fraud_detection.foundation.db import get_or_create_realtime_run
from mplads_fraud_detection.foundation.utils import safe_divide, monotonic_severity
from mplads_fraud_detection.config import (
    SEVERITY_FLOOR,
    DEFAULT_SNAPSHOT_AS_OF_DATE,
    D1_MODEL_PATH,
    D1_MEDIANS_PATH,
    AP_DIFFICULT_TERRAIN_DISTRICTS,
    ALL_MPS_FINANCIAL_BREAKDOWN_CSV,
    UNIT_PRICES_MASTER_CSV
)
from mplads_fraud_detection.detectors.detector_03_cost_overruns import (
    AUTHORITATIVE_CPWD_RATES,
    load_benchmark_schedules,
    extract_physical_quantity,
    map_description_to_benchmark
)
from mplads_fraud_detection.detectors.detector_10_vague_description import (
    score_specificity,
    GENERIC_KEYWORDS
)
from mplads_fraud_detection.detectors.detector_11_plausibility_mismatch import (
    PLAUSIBILITY_BOUNDS,
    map_category_keywords,
    REGEX_COUNT
)

logger = logging.getLogger(__name__)


class WorkLifecycleAuditor:
    """
    Forensic Work Lifecycle Auditor for real-time and batch project re-evaluations.
    """

    def __init__(self, model_path: Optional[str] = None, medians_path: Optional[str] = None):
        self.d1_model = None
        self.d1_medians = None
        self.benchmark_rates = {}
        self.plausibility_bounds = dict(PLAUSIBILITY_BOUNDS)
        self.mp_ledger_map = {}
        self.current_stream_run_id = None
        self.load_artifacts(model_path, medians_path)

    def load_artifacts(self, model_path: Optional[str] = None, medians_path: Optional[str] = None):
        """Loads serialized models, CPWD benchmark schedules, and precomputed medians."""
        m_path = model_path or D1_MODEL_PATH
        med_path = medians_path or D1_MEDIANS_PATH

        # 1. Isolation Forest Model
        if joblib is not None and m_path and os.path.exists(m_path):
            try:
                self.d1_model = joblib.load(m_path)
                logger.info(f"Loaded D1 Isolation Forest model from {m_path}")
            except Exception as e:
                logger.warning(f"Failed to load D1 model from {m_path}: {e}. Entering cold-start fallback.")
                self.d1_model = None
        else:
            if joblib is None:
                logger.info("joblib not installed in runtime environment. Entering cold-start fallback.")
            else:
                logger.warning(f"D1 model artifact not found at {m_path}. Entering cold-start fallback.")
            self.d1_model = None

        # 2. Precomputed Medians
        if med_path and os.path.exists(med_path):
            try:
                with open(med_path, "r", encoding="utf-8") as f:
                    self.d1_medians = json.load(f)
                logger.info(f"Loaded D1 medians from {med_path}")
            except Exception as e:
                logger.warning(f"Failed to load D1 medians from {med_path}: {e}. Entering cold-start fallback.")
                self.d1_medians = None
        else:
            logger.warning(f"D1 medians artifact not found at {med_path}. Entering cold-start fallback.")
            self.d1_medians = None

        # 3. CPWD Benchmark Schedules
        try:
            self.benchmark_rates = load_benchmark_schedules()
        except Exception as e:
            logger.warning(f"Failed to load dynamic CPWD benchmark schedules ({e}). Using authoritative defaults.")
            self.benchmark_rates = dict(AUTHORITATIVE_CPWD_RATES)

        # 4. Plausibility Bounds
        if os.path.exists(UNIT_PRICES_MASTER_CSV):
            try:
                df_up = pd.read_csv(UNIT_PRICES_MASTER_CSV)
                for _, r in df_up.iterrows():
                    item = str(r["item_name"])
                    if item in self.plausibility_bounds and pd.notna(r.get("min_unit_price_inr")):
                        self.plausibility_bounds[item]["min_unit"] = float(r["min_unit_price_inr"])
                        self.plausibility_bounds[item]["max_unit"] = float(r["max_unit_price_inr"])
            except Exception as e:
                logger.warning(f"Failed to refine plausibility bounds from {UNIT_PRICES_MASTER_CSV}: {e}")

        # 5. MP Financial Breakdown Ledger
        if os.path.exists(ALL_MPS_FINANCIAL_BREAKDOWN_CSV):
            try:
                df_fin = pd.read_csv(ALL_MPS_FINANCIAL_BREAKDOWN_CSV)
                for _, r in df_fin.iterrows():
                    self.mp_ledger_map[str(r["mp_name"])] = {
                        "completed_works_value": float(r.get("completed_works_value", 0.0)),
                        "allocated_amount": float(r.get("allocated_amount", 0.0)),
                        "payment_gap_percentage": float(r.get("payment_gap_percentage", 0.0))
                    }
            except Exception as e:
                logger.warning(f"Failed to load MP financial ledger from {ALL_MPS_FINANCIAL_BREAKDOWN_CSV}: {e}")

    def get_evaluators(self) -> Dict[str, Any]:
        """Maps canonical detector type strings to evaluator methods."""
        return {
            "unusual_pattern": self._eval_d01_unusual_patterns,
            "duplicate_work": self._eval_d02_duplicate_works,
            "cost_overrun": self._eval_d03_cost_overruns,
            "ghost_work": self._eval_d04_ghost_works,
            "bill_splitting": self._eval_d05_bill_splitting,
            "delay_violation": self._eval_d06_delay_violation,
            "timing_anomaly": self._eval_d07_timing_anomaly,
            "bulk_completion": self._eval_d08_bulk_completion,
            "vague_description": self._eval_d10_vague_description,
            "plausibility_mismatch": self._eval_d11_plausibility_mismatch,
            "verification_gap": self._eval_d12_verification_gap,
            "copy_paste_pricing": self._eval_d15_copy_paste_pricing,
        }

    def audit_work(self, session: Session, work_or_id: Union[int, Work], commit: bool = False) -> Dict[str, Any]:
        """
        Audits a single work against all 11 work-level forensic detectors with savepoint isolation.
        """
        work = session.query(Work).filter(Work.work_id == work_or_id).first() if isinstance(work_or_id, int) else work_or_id
        if not work:
            raise ValueError(f"Work {work_or_id} not found")

        stream_run_id = get_or_create_realtime_run(session)
        self.current_stream_run_id = stream_run_id
        evaluations = {}
        failed_detectors = []

        for det_name, eval_fn in self.get_evaluators().items():
            try:
                with session.begin_nested():
                    evaluations[det_name] = eval_fn(session, work)
            except Exception as err:
                logger.error(f"Detector {det_name} failed on work {work.work_id}: {err}", exc_info=True)
                failed_detectors.append(det_name)
                evaluations[det_name] = None

        sync_summary = self._sync_anomalies(session, work.work_id, stream_run_id, evaluations)

        work.last_audited_at = datetime.now(timezone.utc)
        work.lifecycle_audit_version = "v3.0"
        work.audit_status = "PARTIALLY_AUDITED" if failed_detectors else "AUDITED"

        if commit:
            session.commit()

        return {
            "work_id": work.work_id,
            "audit_status": work.audit_status,
            "last_audited_at": work.last_audited_at.isoformat(),
            "active_anomalies": sync_summary["active_count"],
            "resolved_anomalies": sync_summary["resolved_count"],
            "newly_flagged": sync_summary["new_count"],
            "failed_detectors": failed_detectors,
            "details": sync_summary["details"]
        }

    def audit_works_batch(self, session: Session, work_ids: List[int], commit: bool = False) -> Dict[str, Any]:
        """
        Audits a batch of works sequentially within a shared transactional scope.
        """
        results = []
        total_active = 0
        total_resolved = 0
        total_new = 0

        for wid in work_ids:
            res = self.audit_work(session, wid, commit=False)
            results.append(res)
            total_active += res["active_anomalies"]
            total_resolved += res["resolved_anomalies"]
            total_new += res["newly_flagged"]

        if commit:
            session.commit()

        return {
            "total_audited": len(work_ids),
            "total_active_anomalies": total_active,
            "total_resolved_anomalies": total_resolved,
            "total_new_anomalies": total_new,
            "works": results
        }

    def _sync_anomalies(self, session: Session, work_id: int, run_id: str, evaluations: Dict[str, Any]) -> Dict[str, Any]:
        """
        Synchronizes evaluated detector findings with the anomalies table enforcing:
        1. In-place updates against unique constraint uq_work_detector_run (work_id, detector_type, run_id).
        2. Statutory severity floor: scores < 0.50 are NEVER inserted and soft-resolve any existing active findings.
        3. Transition of resolved findings with timestamp and resolution reason.
        """
        existing_records = {
            a.detector_type: a
            for a in session.query(Anomaly).filter(
                Anomaly.work_id == work_id,
                Anomaly.run_id == run_id
            ).all()
        }

        all_active_anomalies = {
            a.detector_type: a
            for a in session.query(Anomaly).filter(
                Anomaly.work_id == work_id,
                Anomaly.is_active == True
            ).all()
        }

        active_count = 0
        resolved_count = 0
        new_count = 0
        details = []

        for det_type, eval_result in evaluations.items():
            # Statutory severity floor enforcement
            is_flagged = eval_result is not None and eval_result[0] >= SEVERITY_FLOOR
            existing = existing_records.get(det_type)

            if is_flagged:
                severity, explanation, evidence = eval_result
                # Clamp severity to [0.50, 1.00] per CheckConstraint
                severity = min(1.00, max(0.50, round(float(severity), 3)))

                if existing:
                    existing.is_active = True
                    existing.severity = severity
                    existing.explanation = explanation
                    existing.evidence = evidence
                    existing.resolved_at = None
                    existing.resolution_reason = None
                    existing.detected_at = datetime.now(timezone.utc)
                    active_count += 1
                    details.append({"detector": det_type, "status": "REACTIVATED_OR_UPDATED", "severity": severity})
                else:
                    new_anomaly = Anomaly(
                        work_id=work_id,
                        detector_type=det_type,
                        severity=severity,
                        explanation=explanation,
                        evidence=evidence,
                        run_id=run_id,
                        is_active=True,
                        detected_at=datetime.now(timezone.utc)
                    )
                    session.add(new_anomaly)
                    active_count += 1
                    new_count += 1
                    details.append({"detector": det_type, "status": "NEW_ANOMALY", "severity": severity})

                # Supersede active anomalies from older runs
                other_active = all_active_anomalies.get(det_type)
                if other_active and other_active.run_id != run_id:
                    other_active.is_active = False
                    other_active.resolved_at = datetime.now(timezone.utc)
                    other_active.resolution_reason = "Superseded by real-time lifecycle re-audit"

            else:
                # Finding is cleared or below statutory floor
                if existing and existing.is_active:
                    existing.is_active = False
                    existing.resolved_at = datetime.now(timezone.utc)
                    existing.resolution_reason = (
                        "Severity dropped below statutory floor (0.50)"
                        if (eval_result and eval_result[0] < SEVERITY_FLOOR)
                        else "Condition cleared by lifecycle re-audit"
                    )
                    resolved_count += 1
                    details.append({"detector": det_type, "status": "SOFT_RESOLVED", "reason": existing.resolution_reason})

                other_active = all_active_anomalies.get(det_type)
                if other_active and other_active.is_active and other_active != existing:
                    other_active.is_active = False
                    other_active.resolved_at = datetime.now(timezone.utc)
                    other_active.resolution_reason = (
                        "Severity dropped below statutory floor (0.50)"
                        if (eval_result and eval_result[0] < SEVERITY_FLOOR)
                        else "Condition cleared by lifecycle re-audit"
                    )
                    if not (existing and existing.is_active):
                        resolved_count += 1
                        details.append({"detector": det_type, "status": "SOFT_RESOLVED", "reason": other_active.resolution_reason})

        session.flush()
        return {
            "active_count": active_count,
            "resolved_count": resolved_count,
            "new_count": new_count,
            "details": details
        }

    # =========================================================================
    # 11 Dedicated Single-Work In-Memory Detector Evaluators
    # =========================================================================

    def _eval_d01_unusual_patterns(self, session: Session, work: Work) -> Optional[Tuple[float, str, Dict[str, Any]]]:
        """D1: Multivariate Statistical Outlier Screening (Isolation Forest / Cold-Start Fallback)."""
        cost_val = float(work.cost or 0.0)

        # Cold-start fallback if model or medians missing
        if self.d1_model is None or self.d1_medians is None:
            if cost_val > 10_000_000.0:
                return (
                    0.75,
                    "Cold-start statistical outlier: Project cost exceeds ₹1 Crore baseline.",
                    {"degraded_ml_mode": True, "cost": cost_val}
                )
            return None

        # Feature preparation
        log_cost = float(np.log10(max(1.0, cost_val)))

        comp_date = work.completion_date
        rec_date = work.recommended_date
        if comp_date and rec_date:
            cd = comp_date.date() if isinstance(comp_date, datetime) else comp_date
            rd = rec_date.date() if isinstance(rec_date, datetime) else rec_date
            exec_days = float((cd - rd).days) if cd >= rd else 0.0
        else:
            exec_days = 180.0

        comp_month = int(comp_date.month) if comp_date else 6

        cat_medians = self.d1_medians.get("category_medians", {})
        global_med = float(self.d1_medians.get("global_median_cost", 299428.5))
        cat_med = float(cat_medians.get(work.category, global_med))
        cat_dev = safe_divide(cost_val - cat_med, cat_med)

        dist_medians = self.d1_medians.get("district_medians", {})
        global_dist_med = float(self.d1_medians.get("global_median_dist_cost", global_med))
        dist_med = float(dist_medians.get(work.district, global_dist_med))
        dist_dev = safe_divide(cost_val - dist_med, dist_med)

        cost_in_lakhs = max(0.1, cost_val / 100000.0)
        median_days_lakh = float(self.d1_medians.get("median_days_per_lakh", 0.0))
        days_per_lakh = safe_divide(exec_days, cost_in_lakhs, fill=median_days_lakh)

        feature_vector = np.array([[
            log_cost,
            exec_days,
            comp_month,
            cat_dev,
            dist_dev,
            days_per_lakh
        ]])

        try:
            score = float(self.d1_model.score_samples(feature_vector)[0])
        except Exception as e:
            logger.warning(f"D1 model scoring failed ({e}); falling back to heuristic.")
            if cost_val > 10_000_000.0:
                return (0.75, "Degraded statistical outlier: Project cost exceeds ₹1 Crore baseline.", {"cost": cost_val})
            return None

        threshold = float(self.d1_medians.get("threshold", -0.592))
        min_score = float(self.d1_medians.get("min_score", -0.828))

        if score < threshold:
            severity = monotonic_severity(-score, [-threshold, -min_score], [0.50, 1.00])
            if severity >= SEVERITY_FLOOR:
                explanation = (
                    f"Unusual statistical pattern detected: Project financial/temporal profile "
                    f"(₹{cost_val:,.0f}, {int(exec_days)} days) deviates significantly from peer '{work.category}' projects. "
                    f"Cost is {abs(cat_dev)*100:.1f}% {'above' if cat_dev > 0 else 'below'} category median "
                    f"with an execution rate of {days_per_lakh:.1f} days per lakh."
                )
                evidence = {
                    "log_cost": round(log_cost, 2),
                    "cost": cost_val,
                    "execution_days": int(exec_days),
                    "completion_month": comp_month,
                    "cost_vs_category_median_pct": round(cat_dev * 100, 1),
                    "cost_vs_district_median_pct": round(dist_dev * 100, 1),
                    "days_per_lakh": round(days_per_lakh, 1),
                    "category_median_cost": cat_med,
                    "anomaly_score": round(score, 4),
                    "threshold_used": round(threshold, 4),
                    "feature_importance": self.d1_medians.get("feature_importance", {})
                }
                return (severity, explanation, evidence)

        return None

    def _eval_d02_duplicate_works(self, session: Session, work: Work) -> Optional[Tuple[float, str, Dict[str, Any]]]:
        """D2: Cross-Year Duplicate Scope & Text Similarity."""
        desc = str(work.work_description or "").strip()
        if len(desc) < 20 or not work.district:
            return None

        query = session.query(Work).filter(
            Work.district == work.district,
            Work.work_id != work.work_id
        )

        if work.recommended_date:
            rec_d = work.recommended_date.date() if isinstance(work.recommended_date, datetime) else work.recommended_date
            d_start = str(rec_d - timedelta(days=365))
            d_end = str(rec_d + timedelta(days=365))
            candidates = query.filter(
                Work.recommended_date.isnot(None),
                func.date(Work.recommended_date) >= d_start,
                func.date(Work.recommended_date) <= d_end
            ).limit(200).all()
            if not candidates:
                candidates = query.filter(Work.category == work.category).limit(100).all()
        else:
            candidates = query.filter(Work.category == work.category).limit(100).all()

        valid_candidates = [c for c in candidates if c.work_description and len(c.work_description.strip()) >= 20]
        if not valid_candidates:
            return None

        cand_descs = [c.work_description.strip() for c in valid_candidates]
        all_texts = cand_descs + [desc]

        if TfidfVectorizer is not None and cosine_similarity is not None:
            tfidf = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=384)
            tfidf_mat = tfidf.fit_transform(all_texts)
            target_vec = tfidf_mat[-1:]
            cand_vecs = tfidf_mat[:-1]
            sims = cosine_similarity(target_vec, cand_vecs)[0]
            max_idx = int(np.argmax(sims))
            max_sim = float(sims[max_idx])
        else:
            # High-performance pure-Python character 3-gram Jaccard fallback
            def get_ngrams(s: str, n: int = 3) -> set:
                cleaned = re.sub(r"\s+", " ", s.lower().strip())
                return set(cleaned[i:i+n] for i in range(max(1, len(cleaned) - n + 1)))

            target_ng = get_ngrams(desc)
            best_sim = 0.0
            best_i = 0
            for i, cand_t in enumerate(cand_descs):
                cand_ng = get_ngrams(cand_t)
                union_len = len(target_ng | cand_ng)
                sim = (len(target_ng & cand_ng) / union_len) if union_len > 0 else 0.0
                if sim > best_sim:
                    best_sim = sim
                    best_i = i
            max_sim = best_sim
            max_idx = best_i

        if max_sim >= 0.85:
            best_cand = valid_candidates[max_idx]
            same_mp = (best_cand.mp_name == work.mp_name)
            base_sev = monotonic_severity(max_sim, [0.85, 1.00], [0.50, 1.00])
            final_sev = min(1.00, base_sev + (0.10 if same_mp else 0.0))

            if final_sev >= SEVERITY_FLOOR:
                explanation = (
                    f"Duplicate project detected: This project is semantically highly similar "
                    f"({max_sim*100:.1f}%) to peer work #{best_cand.work_id} in {work.district}. "
                    f"{'Both funded by the same MP (' + str(work.mp_name) + ').' if same_mp else ''}"
                )
                evidence = {
                    "peer_work_id": best_cand.work_id,
                    "similarity": round(max_sim, 3),
                    "same_mp": same_mp,
                    "peer_cost": float(best_cand.cost or 0.0),
                    "cost": float(work.cost or 0.0),
                    "district": str(work.district),
                    "peer_description_preview": best_cand.work_description[:120]
                }

                # Cascading check: ensure matching peer has reciprocal active anomaly
                if self.current_stream_run_id:
                    reciprocal = session.query(Anomaly).filter(
                        Anomaly.work_id == best_cand.work_id,
                        Anomaly.detector_type == "duplicate_work",
                        Anomaly.run_id == self.current_stream_run_id
                    ).first()
                    if reciprocal:
                        reciprocal.is_active = True
                        reciprocal.severity = round(final_sev, 3)
                        reciprocal.resolved_at = None
                        reciprocal.resolution_reason = None
                    else:
                        session.add(Anomaly(
                            work_id=best_cand.work_id,
                            detector_type="duplicate_work",
                            severity=round(final_sev, 3),
                            explanation=(
                                f"Duplicate project detected: This project is semantically highly similar "
                                f"({max_sim*100:.1f}%) to peer work #{work.work_id} in {work.district}. "
                                f"{'Both funded by the same MP (' + str(work.mp_name) + ').' if same_mp else ''}"
                            ),
                            evidence={
                                "peer_work_id": work.work_id,
                                "similarity": round(max_sim, 3),
                                "same_mp": same_mp,
                                "peer_cost": float(work.cost or 0.0),
                                "cost": float(best_cand.cost or 0.0),
                                "district": str(work.district),
                                "peer_description_preview": work.work_description[:120]
                            },
                            run_id=self.current_stream_run_id,
                            is_active=True,
                            detected_at=datetime.now(timezone.utc)
                        ))

                return (final_sev, explanation, evidence)

        return None

    def _eval_d03_cost_overruns(self, session: Session, work: Work) -> Optional[Tuple[float, str, Dict[str, Any]]]:
        """D3: CPWD Cost Overrun Benchmark Analysis."""
        desc = work.work_description or ""
        bench_key = map_description_to_benchmark(work.category, desc)
        if not bench_key or bench_key not in self.benchmark_rates:
            return None

        bench = self.benchmark_rates[bench_key]
        base_rate = float(bench["rate"])
        unit_type = str(bench["unit"])
        base_tolerance = float(bench["tolerance"])

        comp_year = work.completion_date.year if work.completion_date else 2024
        year_diff = max(0, comp_year - 2023)
        inflation_mult = (1.06) ** year_diff
        adjusted_base_rate = base_rate * inflation_mult

        is_terrain = str(work.district).upper() in AP_DIFFICULT_TERRAIN_DISTRICTS
        effective_tolerance = base_tolerance + (0.15 if is_terrain else 0.0)
        max_allowed_unit_rate = adjusted_base_rate * (1.0 + effective_tolerance)

        quantity, extracted_unit, conf = extract_physical_quantity(desc, unit_type)
        if quantity is not None and quantity > 0:
            actual_unit_price = float(work.cost or 0.0) / quantity
            if actual_unit_price <= max_allowed_unit_rate:
                return None

            excess_pct = ((actual_unit_price - max_allowed_unit_rate) / max_allowed_unit_rate) * 100.0
            absolute_excess = (actual_unit_price - max_allowed_unit_rate) * quantity

            if excess_pct < 5.0 or absolute_excess < 10000.0:
                return None

            severity = monotonic_severity(excess_pct, [5.0, 25.0, 50.0, 100.0], [0.50, 0.70, 0.85, 1.00])
            if conf == "low":
                severity = min(0.70, severity * 0.80)
            elif conf != "high" and severity >= 0.90:
                severity = 0.85

            if severity >= SEVERITY_FLOOR:
                explanation = (
                    f"CPWD Benchmark Rate Overrun: Billed rate of ₹{actual_unit_price:,.1f}/{unit_type} exceeds "
                    f"the CPWD DSR 2023 ceiling of ₹{max_allowed_unit_rate:,.1f}/{unit_type} "
                    f"(Base: ₹{base_rate:,.0f} + {year_diff*6}% inflation + {int(effective_tolerance*100)}% tolerance) "
                    f"by {excess_pct:.1f}% (+₹{absolute_excess:,.0f} estimated overcharge)."
                )
                evidence = {
                    "cpwd_benchmark_item": bench_key,
                    "base_standard_rate": base_rate,
                    "inflation_adjusted_rate": round(adjusted_base_rate, 2),
                    "max_allowed_unit_rate": round(max_allowed_unit_rate, 2),
                    "actual_unit_price": round(actual_unit_price, 2),
                    "unit": unit_type,
                    "extracted_quantity": round(quantity, 2),
                    "extraction_confidence": conf,
                    "excess_pct": round(excess_pct, 2),
                    "estimated_excess_inr": round(absolute_excess, 2),
                    "terrain_adjusted": is_terrain,
                    "cost": float(work.cost or 0.0)
                }
                return (severity, explanation, evidence)

        return None

    def _eval_d04_ghost_works(self, session: Session, work: Work) -> Optional[Tuple[float, str, Dict[str, Any]]]:
        """D4: Ghost Works (Payment Record & Disbursement Verification)."""
        if str(work.status or "").lower() != "completed":
            return None

        cost_val = float(work.cost or 0.0)
        total_paid_val = float(work.total_paid or 0.0)
        has_payments_val = bool(work.has_payments)
        gap_pct = float(work.payment_gap_percentage) if work.payment_gap_percentage else 0.0
        pay_record_exists = bool(work.payment_record_exists)

        signals_triggered = []
        signal_severities = []

        if pay_record_exists:
            if not has_payments_val or total_paid_val == 0.0:
                signals_triggered.append("no_payment")
                signal_severities.append(0.80)
            elif 0.0 < total_paid_val < (0.50 * cost_val):
                pay_ratio = total_paid_val / cost_val if cost_val > 0 else 0.0
                underpay_sev = monotonic_severity(1.0 - pay_ratio, [0.50, 1.00], [0.50, 0.80])
                signals_triggered.append("under_payment")
                signal_severities.append(underpay_sev)

        if gap_pct >= 40.0:
            gap_sev = monotonic_severity(gap_pct, [40.0, 60.0, 80.0, 100.0], [0.30, 0.60, 0.85, 1.00])
            signals_triggered.append("mp_gap_context")
            signal_severities.append(gap_sev)

        if not signals_triggered:
            return None

        base_sev = max(signal_severities)
        n_sigs = len(signals_triggered)
        composite_sev = min(1.0, base_sev + 0.10 * (n_sigs - 1))

        # Mitigation 1: Recent completion grace period (within last 30 days)
        today = date.today()
        if work.completion_date:
            comp_d = work.completion_date.date() if isinstance(work.completion_date, datetime) else work.completion_date
            days_since_comp = (today - comp_d).days
            if 0 <= days_since_comp < 30:
                composite_sev *= 0.60

        # Mitigation 2: Small projects (< ₹50,000)
        if cost_val < 50000.0:
            composite_sev *= 0.80

        if composite_sev >= SEVERITY_FLOOR:
            explanation_parts = []
            if "no_payment" in signals_triggered:
                explanation_parts.append(f"Marked 'completed' on {work.completion_date} but has ZERO recorded financial drawdowns (₹0 paid)")
            elif "under_payment" in signals_triggered:
                pct_paid = (total_paid_val / cost_val * 100.0) if cost_val > 0 else 0.0
                explanation_parts.append(f"Only {pct_paid:.1f}% of claimed cost was disbursed (₹{total_paid_val:,.0f} paid out of ₹{cost_val:,.0f})")
            if "mp_gap_context" in signals_triggered:
                explanation_parts.append(f"MP {work.mp_name} exhibits a systemic {gap_pct:.1f}% unverified payment gap across portfolio")

            explanation = "GHOST WORK ALERT: " + " | ".join(explanation_parts) + "."
            evidence = {
                "has_payments": has_payments_val,
                "total_paid": total_paid_val,
                "claimed_cost": cost_val,
                "disbursement_ratio": round(total_paid_val / cost_val, 3) if cost_val > 0 else 0.0,
                "mp_payment_gap_pct": gap_pct,
                "signals_triggered": signals_triggered,
                "completion_date": str(work.completion_date),
                "district": str(work.district),
                "mp_name": str(work.mp_name)
            }
            return (composite_sev, explanation, evidence)

        return None

    def _eval_d05_bill_splitting(self, session: Session, work: Work) -> Optional[Tuple[float, str, Dict[str, Any]]]:
        """D5: Bill Splitting / Smurfing (Threshold Evasion)."""
        cost = float(work.cost or 0.0)
        band = None
        if 450000.0 <= cost < 500000.0:
            band = "5L"
        elif 1800000.0 <= cost < 2000000.0:
            band = "20L"

        if not band or not work.recommended_date or not work.mp_name:
            return None

        rec_date = work.recommended_date.date() if isinstance(work.recommended_date, datetime) else work.recommended_date
        start_month_str = f"{rec_date.year:04d}-{rec_date.month:02d}-01"
        if rec_date.month == 12:
            end_month_str = f"{rec_date.year+1:04d}-01-01"
        else:
            end_month_str = f"{rec_date.year:04d}-{rec_date.month+1:02d}-01"

        cost_min = 450000.0 if band == "5L" else 1800000.0
        cost_max = 500000.0 if band == "5L" else 2000000.0

        peers = session.query(Work).filter(
            Work.mp_name == work.mp_name,
            func.date(Work.recommended_date) >= start_month_str,
            func.date(Work.recommended_date) < end_month_str,
            Work.cost >= cost_min,
            Work.cost < cost_max
        ).all()

        n_works = len(peers)
        total_cost = sum(float(p.cost or 0.0) for p in peers)
        unique_categories = len(set(p.category for p in peers))
        is_single_category = (unique_categories == 1)

        flagged = False
        base_sev = 0.0
        if band == "5L":
            if n_works >= 5:
                flagged = True
                base_sev = 0.80
            elif n_works >= 3:
                flagged = True
                base_sev = 0.60
        elif band == "20L":
            if n_works >= 2 and total_cost >= 2000000.0:
                flagged = True
                base_sev = 0.70

        if not flagged:
            return None

        final_sev = min(1.0, base_sev + (0.10 if is_single_category else 0.0))
        if final_sev >= SEVERITY_FLOOR:
            threshold_name = "₹5 Lakh e-tendering" if band == "5L" else "₹20 Lakh quotation"
            rec_month_str = rec_date.strftime("%Y-%m")
            explanation = (
                f"Bill Splitting / Smurfing Anomaly: Work cost (₹{cost:,.0f}) sits in the {band} threshold band "
                f"(₹{4.5 if band=='5L' else 18.0}L–₹{5.0 if band=='5L' else 20.0}L). "
                f"MP {work.mp_name} recommended {n_works} such projects in {rec_month_str} totaling ₹{total_cost:,.0f} "
                f"{'(all in the same category: ' + str(work.category) + ')' if is_single_category else ''}, "
                f"indicating structured contract fragmentation to bypass {threshold_name} limits."
            )
            evidence = {
                "smurf_band": band,
                "cluster_size": n_works,
                "cluster_total_cost": float(total_cost),
                "recommendation_month": rec_month_str,
                "threshold_evaded": threshold_name,
                "single_category": is_single_category,
                "peer_cluster_work_ids": [p.work_id for p in peers if p.work_id != work.work_id],
                "mp_name": work.mp_name,
                "cost": cost
            }
            return (final_sev, explanation, evidence)

        return None

    def _eval_d06_delay_violation(self, session: Session, work: Work) -> Optional[Tuple[float, str, Dict[str, Any]]]:
        """D6: Delays & Stalled Works past statutory guideline."""
        if not work.recommended_date:
            return None

        as_of_date = pd.to_datetime(DEFAULT_SNAPSHOT_AS_OF_DATE).date()
        rec_date = work.recommended_date.date() if isinstance(work.recommended_date, datetime) else work.recommended_date
        comp_date = None
        if work.completion_date:
            comp_date = work.completion_date.date() if isinstance(work.completion_date, datetime) else work.completion_date

        status = str(work.status or "").lower()
        desc = str(work.work_description or "").lower()
        phase_keywords = ["phase", "stage", "part", "package"]
        is_phase_work = any(kw in desc for kw in phase_keywords)

        flagged = False
        severity = 0.0
        delay_days = 0
        branch_type = ""

        if status != "completed" or comp_date is None:
            age_days = (as_of_date - rec_date).days
            if age_days > 365:
                flagged = True
                branch_type = "stalled_in_progress"
                delay_days = age_days - 365
                severity = monotonic_severity(age_days, [365, 548, 730, 1095], [0.50, 0.65, 0.80, 1.00])
        else:
            work_days = (comp_date - rec_date).days
            if work_days > 365:
                flagged = True
                branch_type = "completed_delayed"
                delay_days = work_days - 365
                severity = monotonic_severity(work_days, [365, 548, 730, 1095], [0.30, 0.45, 0.60, 0.80])

        if not flagged:
            return None

        if is_phase_work:
            severity = min(0.69, severity * 0.80)

        if severity >= SEVERITY_FLOOR:
            cost_val = float(work.cost or 0.0)
            is_critical = (severity >= 0.90)
            if branch_type == "stalled_in_progress":
                explanation = (
                    f"Statutory Delay Violation (Stalled In-Progress): Project recommended on {rec_date} "
                    f"has remained uncompleted for {age_days} days (overdue by {delay_days} days past the 1-year statutory deadline). "
                    f"Holding ₹{cost_val:,.0f} in committed public funds."
                )
            else:
                explanation = (
                    f"Statutory Delay Violation (Execution Overrun): Project took {work_days} days from recommendation "
                    f"({rec_date}) to completion ({comp_date}), exceeding the statutory 1-year guideline by {delay_days} days."
                )

            evidence = {
                "branch_type": branch_type,
                "recommended_date": str(rec_date),
                "completion_date": str(comp_date) if comp_date else None,
                "as_of_date": str(as_of_date),
                "total_duration_days": age_days if branch_type == "stalled_in_progress" else work_days,
                "statutory_limit_days": 365,
                "days_overdue": delay_days,
                "is_multi_phase": is_phase_work,
                "is_critical": is_critical,
                "cost": cost_val,
                "district": str(work.district),
                "mp_name": str(work.mp_name)
            }
            return (severity, explanation, evidence)

        return None

    def _eval_d07_timing_anomaly(self, session: Session, work: Work) -> Optional[Tuple[float, str, Dict[str, Any]]]:
        """D7: Suspicious Timing (Fiscal Year-End & Term Rush)."""
        if str(work.status or "").lower() != "completed" or not work.completion_date:
            return None

        comp_date = work.completion_date.date() if isinstance(work.completion_date, datetime) else work.completion_date
        month = comp_date.month
        is_march = (month == 3)
        fy = comp_date.year if month >= 4 else comp_date.year - 1

        term_end_date = date(2024, 5, 31)
        days_to_term_end = (term_end_date - comp_date).days
        is_term_last_6m = (0 <= days_to_term_end <= 180)

        if not is_march and not is_term_last_6m:
            return None

        signals = []
        severities = []
        march_works_pct = 0.0
        march_spend_pct = 0.0
        rush_ratio = 1.0

        if is_march and work.mp_name:
            start_fy = f"{fy}-04-01"
            end_fy = f"{fy+1}-03-31"
            start_march = f"{fy+1}-03-01"

            tot_works, tot_spend = session.query(
                func.count(Work.work_id),
                func.sum(Work.cost)
            ).filter(
                Work.mp_name == work.mp_name,
                Work.status == "completed",
                func.date(Work.completion_date) >= start_fy,
                func.date(Work.completion_date) <= end_fy
            ).first()

            tot_works = tot_works or 0
            tot_spend = tot_spend or 0.0

            m_works, m_spend = session.query(
                func.count(Work.work_id),
                func.sum(Work.cost)
            ).filter(
                Work.mp_name == work.mp_name,
                Work.status == "completed",
                func.date(Work.completion_date) >= start_march,
                func.date(Work.completion_date) <= end_fy
            ).first()

            m_works = m_works or 0
            m_spend = m_spend or 0.0

            if tot_works > 0:
                march_works_pct = (m_works / tot_works) * 100.0
                march_spend_pct = (m_spend / tot_spend * 100.0) if tot_spend > 0 else 0.0
                combined_march_index = 0.40 * march_works_pct + 0.60 * march_spend_pct
                m_sev = monotonic_severity(combined_march_index, [30.0, 45.0, 65.0, 85.0], [0.50, 0.65, 0.85, 1.00])
                if comp_date.day >= 25 and m_sev < 0.50 and march_spend_pct >= 25.0:
                    m_sev = 0.55
                if m_sev >= SEVERITY_FLOOR:
                    signals.append("march_fiscal_dumping")
                    severities.append(m_sev)

        if is_term_last_6m and work.mp_name:
            last6m_count = session.query(func.count(Work.work_id)).filter(
                Work.mp_name == work.mp_name,
                Work.status == "completed",
                func.date(Work.completion_date) >= "2023-12-01",
                func.date(Work.completion_date) <= "2024-05-31"
            ).scalar() or 0

            earlier_count = session.query(func.count(Work.work_id)).filter(
                Work.mp_name == work.mp_name,
                Work.status == "completed",
                func.date(Work.completion_date) >= "2019-06-01",
                func.date(Work.completion_date) < "2023-12-01"
            ).scalar() or 0

            if earlier_count >= 5:
                rush_ratio = (last6m_count / 6.0) / (earlier_count / 54.0)
                t_sev = monotonic_severity(rush_ratio, [2.0, 3.5, 5.0, 10.0], [0.50, 0.65, 0.80, 1.00])
                if t_sev >= SEVERITY_FLOOR:
                    signals.append("pre_election_term_rush")
                    severities.append(t_sev)

        if not signals:
            return None

        composite_sev = max(severities)
        if composite_sev >= SEVERITY_FLOOR:
            explanation_parts = []
            if "march_fiscal_dumping" in signals:
                explanation_parts.append(
                    f"Fiscal Year-End Dumping: MP {work.mp_name} completed {march_works_pct:.1f}% of FY {fy} works "
                    f"({march_spend_pct:.1f}% of annual expenditure) during the month of March"
                )
            if "pre_election_term_rush" in signals:
                explanation_parts.append(
                    f"Pre-Election Term Rush: MP completion rate in final 6 months of Lok Sabha term "
                    f"accelerated by {rush_ratio:.1f}x over earlier term baseline"
                )
            explanation = "TIMING ANOMALY: " + " | ".join(explanation_parts) + "."
            evidence = {
                "signals_triggered": signals,
                "completion_date": str(comp_date),
                "fiscal_year": int(fy),
                "is_march": bool(is_march),
                "is_term_last_6_months": bool(is_term_last_6m),
                "mp_name": str(work.mp_name),
                "cost": float(work.cost or 0.0)
            }
            return (composite_sev, explanation, evidence)

        return None

    def _eval_d08_bulk_completion(self, session: Session, work: Work) -> Optional[Tuple[float, str, Dict[str, Any]]]:
        """D8: Same-Day Bulk Completion Screening."""
        if str(work.status or "").lower() != "completed" or not work.completion_date:
            return None

        comp_date = work.completion_date.date() if isinstance(work.completion_date, datetime) else work.completion_date

        district_count = session.query(func.count(Work.work_id)).filter(
            Work.district == work.district,
            Work.status == "completed",
            func.date(Work.completion_date) == str(comp_date)
        ).scalar() or 0

        mp_count = 0
        if work.mp_name:
            mp_count = session.query(func.count(Work.work_id)).filter(
                Work.mp_name == work.mp_name,
                Work.status == "completed",
                func.date(Work.completion_date) == str(comp_date)
            ).scalar() or 0

        if district_count < 6 and mp_count < 8:
            return None

        spike_ratio = district_count / 1.5
        event_sev = monotonic_severity(spike_ratio, [5.0, 10.0, 20.0, 50.0], [0.50, 0.65, 0.85, 1.00])
        if comp_date.month == 3 and comp_date.day >= 25:
            event_sev += 0.10
        if comp_date.month == 3 and comp_date.day == 31:
            event_sev += 0.10

        final_sev = min(1.0, event_sev)
        if mp_count >= 8:
            mp_sev = monotonic_severity(float(mp_count), [8.0, 15.0, 25.0], [0.50, 0.70, 0.90])
            final_sev = max(final_sev, mp_sev)

        desc = str(work.work_description or "").lower()
        supply_keywords = ["street light", "lamp", "led", "pole", "sign board", "supply of", "providing"]
        if any(kw in desc for kw in supply_keywords):
            final_sev *= 0.70
        if comp_date.month in [6, 9, 12] and comp_date.day >= 28:
            final_sev *= 0.80

        if final_sev >= SEVERITY_FLOOR:
            is_march_31 = (comp_date.month == 3 and comp_date.day == 31)
            explanation = (
                f"Bulk Completion Anomaly: {district_count} distinct works were closed simultaneously on {comp_date} "
                f"in {work.district} district. "
                f"{'🚨 CRITICAL: Batch closure on March 31 (fiscal year-end) indicates paper completion to exhaust budget.' if is_march_31 else ''}"
            )
            evidence = {
                "completion_date": str(comp_date),
                "district": str(work.district),
                "works_on_date": int(district_count),
                "spike_ratio": round(float(spike_ratio), 1),
                "is_march_31": bool(is_march_31),
                "mp_name": str(work.mp_name),
                "cost": float(work.cost or 0.0)
            }
            return (final_sev, explanation, evidence)

        return None

    def _eval_d10_vague_description(self, session: Session, work: Work) -> Optional[Tuple[float, str, Dict[str, Any]]]:
        """D10: Vague Description & Scope Ambiguity Screen."""
        desc = str(work.work_description or "").strip()
        cost_val = float(work.cost or 0.0)

        if not desc or desc.lower() in ["not specified", "none", "nan", ""]:
            return (
                1.00,
                "CRITICAL VAGUENESS: Project entry is completely missing any work description.",
                {"missing_description": True, "length": 0, "cost": cost_val}
            )

        if cost_val < 200000.0:
            return None

        desc_len = len(desc)
        desc_lower = desc.lower()
        signals = []
        signal_severities = []

        if cost_val >= 500000.0 and desc_len < 50:
            signals.append("high_cost_short_description")
            signal_severities.append(0.85 if desc_len < 25 else 0.70)
        elif cost_val >= 200000.0 and desc_len < 40:
            signals.append("short_description")
            signal_severities.append(0.75 if desc_len < 20 else 0.60)

        if any(kw in desc_lower for kw in GENERIC_KEYWORDS):
            signals.append("generic_boilerplate_phrase")
            signal_severities.append(0.85)

        spec_score, marker_matches, missing_cats = score_specificity(desc)
        if spec_score < 0.12:
            signals.append("low_specificity_score")
            signal_severities.append(0.80)
        elif spec_score < 0.20 and cost_val >= 500000.0:
            signals.append("substandard_specificity")
            signal_severities.append(0.60)

        if not signals:
            return None

        base_sev = max(signal_severities)
        n_sigs = len(signals)
        composite_sev = min(1.0, base_sev + 0.15 * (n_sigs - 1))

        if composite_sev >= SEVERITY_FLOOR:
            explanation_parts = [
                f"VAGUE DESCRIPTION ALERT: \"{desc[:60]}...\" ({desc_len} chars, specificity score: {spec_score:.2f}/1.0)"
            ]
            if missing_cats:
                explanation_parts.append(f"Missing engineering dimensions: {', '.join(missing_cats)}")
            explanation = " | ".join(explanation_parts) + "."
            evidence = {
                "description_length": desc_len,
                "specificity_score": round(spec_score, 2),
                "missing_markers": missing_cats,
                "signals_triggered": signals,
                "cost": cost_val,
                "category": str(work.category)
            }
            return (composite_sev, explanation, evidence)

        return None

    def _eval_d11_plausibility_mismatch(self, session: Session, work: Work) -> Optional[Tuple[float, str, Dict[str, Any]]]:
        """D11: Category-Cost Engineering Plausibility Bounds."""
        desc = work.work_description or ""
        cat_key = map_category_keywords(work.category, desc)
        if not cat_key or cat_key not in self.plausibility_bounds:
            return None

        bounds = self.plausibility_bounds[cat_key]
        min_bound = bounds["min_unit"]
        max_bound = bounds["max_unit"]

        m = REGEX_COUNT.search(desc)
        qty = float(m.group(1)) if m else 1.0
        effective_min = min_bound * qty
        effective_max = max_bound * qty

        cost_val = float(work.cost or 0.0)
        is_too_low = cost_val < effective_min
        is_too_high = cost_val > effective_max

        if not (is_too_low or is_too_high):
            return None

        if is_too_low:
            ratio = safe_divide(effective_min, cost_val, fill=1.0)
            severity = monotonic_severity(ratio, [1.0, 5.0, 10.0], [0.50, 0.85, 1.00])
            mismatch_type = "IMPLAUSIBLY_LOW"
            explanation = (
                f"Engineering Plausibility Violation (Absurdly Low): Billed cost of ₹{cost_val:,.0f} for '{cat_key}' "
                f"(Qty: {qty:.0f}) is physically impossible to construct (Minimum feasible engineering threshold: ₹{effective_min:,.0f}). "
                f"Deficit factor: {ratio:.1f}x below minimum norm."
            )
        else:
            ratio = safe_divide(cost_val, effective_max, fill=1.0)
            severity = monotonic_severity(ratio, [1.0, 3.0, 5.0], [0.50, 0.80, 1.00])
            mismatch_type = "IMPLAUSIBLY_HIGH"
            explanation = (
                f"Engineering Plausibility Violation (Absurdly High): Billed cost of ₹{cost_val:,.0f} for '{cat_key}' "
                f"(Qty: {qty:.0f}) exceeds maximum feasible engineering threshold (₹{effective_max:,.0f}) by {ratio:.1f}x."
            )

        if severity >= SEVERITY_FLOOR:
            evidence = {
                "mismatch_type": mismatch_type,
                "category_norm": cat_key,
                "cost": cost_val,
                "quantity": qty,
                "effective_min_feasible": effective_min,
                "effective_max_feasible": effective_max,
                "deviation_ratio": round(ratio, 2)
            }
            return (severity, explanation, evidence)

        return None

    def _eval_d12_verification_gap(self, session: Session, work: Work) -> Optional[Tuple[float, str, Dict[str, Any]]]:
        """D12: Documentary Verification Gap & Ledger Reconciliation."""
        if str(work.status or "").lower() != "completed":
            return None

        cost_val = float(work.cost or 0.0)
        paid_val = float(work.total_paid or 0.0)
        gap_pct = float(work.payment_gap_percentage or 0.0)
        pay_rec_exists = bool(work.payment_record_exists)

        signals = []
        severities = []
        div_ratio = 1.0

        if work.mp_name and work.mp_name in self.mp_ledger_map:
            ledger = self.mp_ledger_map[work.mp_name]
            ledger_val = ledger.get("completed_works_value", 0.0)
            if ledger_val > 0:
                sum_cost = session.query(func.sum(Work.cost)).filter(
                    Work.mp_name == work.mp_name,
                    Work.status == "completed"
                ).scalar() or 0.0
                div_ratio = sum_cost / ledger_val
                if div_ratio > 1.15:
                    sev = monotonic_severity(div_ratio, [1.15, 1.50, 2.50], [0.50, 0.70, 1.00])
                    signals.append("mp_ledger_claim_divergence")
                    severities.append(sev)

        disb_ratio = safe_divide(paid_val, cost_val, fill=0.0)
        if pay_rec_exists and disb_ratio < 0.25 and gap_pct >= 60.0:
            work_disb_sev = monotonic_severity(1.0 - disb_ratio, [0.75, 1.00], [0.50, 0.80])
            signals.append("severe_work_disbursement_deficit")
            severities.append(work_disb_sev)

        if not signals and gap_pct >= 40.0:
            gap_sev = monotonic_severity(gap_pct, [40.0, 60.0, 80.0, 100.0], [0.50, 0.65, 0.85, 1.00])
            signals.append("mp_payment_gap_reconciliation")
            severities.append(gap_sev)

        if not signals:
            return None

        composite_sev = max(severities)
        if composite_sev >= SEVERITY_FLOOR:
            explanation_parts = []
            if "mp_ledger_claim_divergence" in signals:
                explanation_parts.append(
                    f"MP-level ledger divergence: Sum of completed project costs exceeds official financial ledger value by {((div_ratio-1)*100):.1f}%"
                )
            if "severe_work_disbursement_deficit" in signals:
                explanation_parts.append(
                    f"Severe work-level drawdown gap: Only {disb_ratio*100:.1f}% disbursed (₹{paid_val:,.0f} of ₹{cost_val:,.0f}) under MP exhibiting {gap_pct:.1f}% portfolio gap"
                )
            if "mp_payment_gap_reconciliation" in signals:
                explanation_parts.append(
                    f"Portfolio documentary verification gap: MP exhibits {gap_pct:.1f}% unverified ledger divergence"
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
                "mp_name": str(work.mp_name)
            }
            return (composite_sev, explanation, evidence)

        return None

    def _eval_d15_copy_paste_pricing(self, session: Session, work: Work) -> Optional[Tuple[float, str, Dict[str, Any]]]:
        """D15: Copy-Paste Pricing & Cloned Estimates."""
        if not work.mp_name or work.cost is None:
            return None

        cost_val = round(float(work.cost), 2)

        matching_works = session.query(Work).filter(
            Work.mp_name == work.mp_name,
            Work.cost == cost_val
        ).all()

        count = len(matching_works)
        n_categories = len(set(w.category for w in matching_works))
        is_cross = (n_categories > 1 and count >= 5)

        unit_type = "meter" if "Road" in str(work.category or "") else "number"
        qty, _, conf = extract_physical_quantity(str(work.work_description or ""), unit_type)
        rate_count = 0
        rate_val = None
        if conf == "high" and qty and qty > 0:
            rate = cost_val / qty
            rate_val = 100.0 * round(rate / 100.0)
            same_cat_works = session.query(Work).filter(
                Work.mp_name == work.mp_name,
                Work.category == work.category
            ).limit(100).all()
            for scw in same_cat_works:
                sqty, _, sconf = extract_physical_quantity(str(scw.work_description or ""), unit_type)
                if sconf == "high" and sqty and sqty > 0:
                    srate = 100.0 * round((float(scw.cost or 0.0) / sqty) / 100.0)
                    if srate == rate_val:
                        rate_count += 1

        if not is_cross and rate_count < 5:
            return None

        signals = []
        severities = []
        if is_cross:
            c_sev = monotonic_severity(float(count), [5.0, 10.0, 20.0], [0.75, 0.88, 0.98])
            signals.append("cross_category_cost_clone")
            severities.append(c_sev)

        if rate_count >= 5:
            r_sev = monotonic_severity(float(rate_count), [5.0, 10.0, 20.0], [0.50, 0.70, 0.90])
            signals.append("cloned_unit_rate")
            severities.append(r_sev)

        composite_sev = max(severities)
        if composite_sev >= SEVERITY_FLOOR:
            explanation_parts = []
            if is_cross:
                explanation_parts.append(
                    f"Cross-Category Cost Cloning: MP {work.mp_name} has {count} distinct works across {n_categories} different categories budgeted at identical amount of ₹{cost_val:,.0f}"
                )
            if rate_count >= 5:
                explanation_parts.append(
                    f"Cloned Unit Rate: {rate_count} '{work.category}' works share identical rounded unit rate of ₹{rate_val:,.0f} per unit"
                )

            explanation = "COPY-PASTE PRICING: " + " | ".join(explanation_parts) + "."
            evidence = {
                "attribution": "mp_level",
                "cost": float(cost_val),
                "cross_category": is_cross,
                "exact_cost_repeat_count": int(count),
                "unit_rate_rounded": float(rate_val) if rate_val else None,
                "unit_rate_repeat_count": int(rate_count),
                "mp_name": str(work.mp_name),
                "category": str(work.category)
            }
            return (composite_sev, explanation, evidence)

        return None
