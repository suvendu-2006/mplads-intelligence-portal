"""
Canonical Mathematical & Statistical Utilities for MPLADS Fraud Detection.
Enforces strict monotonicity, safe vectorized arithmetic, and verifiable runtime metrics.
"""

from typing import Dict, List, Tuple, Any, Optional
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from mplads_fraud_detection.config import (
    DETECTOR_GROUPS, TIER_BOUNDARIES, SEVERITY_FLOOR
)
from mplads_fraud_detection.foundation.schema import Work, Anomaly, EntityRisk, PipelineRun


def safe_divide(num: Any, den: Any, fill: float = 0.0) -> Any:
    """
    Safely divides numerator by denominator with NaN/Inf prevention.
    Supports scalars, NumPy arrays, and Pandas Series.
    """
    if isinstance(num, (pd.Series, np.ndarray)) or isinstance(den, (pd.Series, np.ndarray)):
        n = pd.to_numeric(num, errors="coerce").astype(float)
        d = pd.to_numeric(den, errors="coerce").astype(float)
        out = pd.Series(np.repeat(fill, len(d)), index=d.index if hasattr(d, "index") else None)
        valid_mask = (d != 0) & d.notna() & n.notna()
        out[valid_mask] = n[valid_mask] / d[valid_mask]
        return out
    else:
        try:
            n = float(num)
            d = float(den)
            if d == 0.0 or np.isnan(d) or np.isnan(n):
                return fill
            return n / d
        except (ValueError, TypeError, ZeroDivisionError):
            return fill


def monotonic_severity(
    value: float,
    thresholds: List[float],
    bases: List[float]
) -> float:
    """
    Evaluates strictly increasing piecewise-linear severity.
    Ensures S(x1) <= S(x2) for all x1 <= x2 with zero boundary jumps.

    Args:
        value: Input metric value
        thresholds: Ascending list of domain threshold points
        bases: Ascending list of severity output points (must satisfy bases[i+1] >= bases[i])

    Returns:
        Severity float bounded in [0.0, 1.0]
    """
    assert len(thresholds) == len(bases), "Thresholds and bases must have equal length"
    assert all(thresholds[i] <= thresholds[i+1] for i in range(len(thresholds)-1)), "Thresholds must be monotonic"
    assert all(bases[i] <= bases[i+1] for i in range(len(bases)-1)), "Bases must be monotonic"

    if value is None or np.isnan(value) or value < thresholds[0]:
        return 0.0

    if value >= thresholds[-1]:
        return float(min(1.0, bases[-1]))

    for i in range(len(thresholds) - 1):
        t_low, t_high = thresholds[i], thresholds[i+1]
        b_low, b_high = bases[i], bases[i+1]

        if value <= t_high:
            if t_high == t_low:
                return float(min(1.0, b_high))
            factor = (value - t_low) / (t_high - t_low)
            return float(min(1.0, b_low + factor * (b_high - b_low)))

    return float(min(1.0, bases[-1]))


def classify_tier(severity: float) -> str:
    """Classifies numeric severity (0.0 - 1.0) into the canonical 5-class tier."""
    if severity is None or np.isnan(severity) or severity < 0.30:
        return "Clean"
    elif severity < 0.50:
        return "Medium"
    elif severity < 0.70:
        return "High"
    elif severity < 0.90:
        return "Very High"
    else:
        return "Critical"


def classify_entity_tier(score: float) -> str:
    """Classifies entity composite risk score (0 - 100) into canonical 5-class tier."""
    if score is None or np.isnan(score) or score < 30.0:
        return "Clean"
    elif score < 50.0:
        return "Medium"
    elif score < 70.0:
        return "High"
    elif score < 90.0:
        return "Very High"
    else:
        return "Critical"


from mplads_fraud_detection.config import (
    SEVERITY_FLOOR, TIER_BOUNDARIES, DETECTOR_GROUPS,
    DETECTOR_RELIABILITY_WEIGHTS, HARD_EVIDENCE_DETECTORS
)


def calculate_triage_tier(severities_by_detector: Dict[str, float]) -> Tuple[float, str, float, List[str]]:
    """
    Computes evidence-weighted forensic risk score and assigns the 4 action triage tiers:
      - 🔴 'Audit Now': risk_score >= 0.75 OR any HARD evidence detector severity >= 0.85
      - 🟡 'Review': risk_score >= 0.55 OR (>=2 detectors with combined weight >= 1.2)
      - ⚪ 'Monitor': risk_score >= 0.40 OR any detector fired
      - 🟢 'Clean': risk_score < 0.40 and no active flags

    Returns:
        (weighted_risk_score, action_tier, total_evidence_weight, active_detectors)
    """
    active = {d: s for d, s in severities_by_detector.items() if s >= SEVERITY_FLOOR}
    if not active:
        return 0.0, "Clean", 0.0, []

    weighted_sum = sum(DETECTOR_RELIABILITY_WEIGHTS.get(d, 0.5) * s for d, s in active.items())
    total_weight = sum(DETECTOR_RELIABILITY_WEIGHTS.get(d, 0.5) for d in active.keys())
    risk_score = weighted_sum / max(1e-6, total_weight)

    # Check for hard evidence triggers (physical/engineering facts)
    has_critical_hard_evidence = any(
        d in HARD_EVIDENCE_DETECTORS and s >= 0.85 for d, s in active.items()
    )

    # Triage Tier Decision Logic
    if has_critical_hard_evidence or risk_score >= 0.75:
        tier = "Audit Now"
    elif risk_score >= 0.55 or (len(active) >= 2 and total_weight >= 1.2):
        tier = "Review"
    elif risk_score >= 0.40 or len(active) >= 1:
        tier = "Monitor"
    else:
        tier = "Clean"

    return float(round(risk_score, 3)), tier, float(round(total_weight, 2)), list(active.keys())


def calculate_composite_score(severities_by_detector: Dict[str, float]) -> Tuple[float, str, int, List[str]]:
    """
    Computes deduplicated composite severity using independent group boosting.

    Returns:
        (composite_severity, risk_tier, active_group_count, active_detectors)
    """
    active = {d: s for d, s in severities_by_detector.items() if s >= SEVERITY_FLOOR}
    if not active:
        return 0.0, "Clean", 0, []

    active_groups = {DETECTOR_GROUPS.get(d) for d in active.keys() if DETECTOR_GROUPS.get(d)}
    group_count = len(active_groups)

    group_boosts = {4: 0.25, 3: 0.20, 2: 0.10}
    boost = group_boosts.get(group_count, 0.0)

    base_severity = max(active.values())
    composite_severity = min(1.0, base_severity + boost)
    tier = classify_tier(composite_severity)

    return float(composite_severity), tier, group_count, list(active.keys())


def calculate_rank_score(severities_by_detector: Dict[str, float]) -> Tuple[float, bool, float, int, float]:
    """
    Computes Precision-First Priority Rank Score:
    rank_score = (has_hard_evidence * 1000)
               + (max_severity * 100)
               + (detector_count * 20)
               + (hard_severity * 50)

    Returns:
        (rank_score, has_hard_evidence, max_severity, detector_count, hard_severity)
    """
    active = {d: s for d, s in severities_by_detector.items() if s >= SEVERITY_FLOOR}
    if not active:
        return 0.0, False, 0.0, 0, 0.0

    hard_severities = [s for d, s in active.items() if d in HARD_EVIDENCE_DETECTORS]
    has_hard = len(hard_severities) > 0
    hard_sev = max(hard_severities) if has_hard else 0.0
    max_sev = max(active.values())
    det_count = len(active)

    score = (
        (1000.0 if has_hard else 0.0)
        + (max_sev * 100.0)
        + (det_count * 20.0)
        + (hard_sev * 50.0)
    )

    return float(round(score, 2)), has_hard, float(round(max_sev, 3)), det_count, float(round(hard_sev, 3))


def generate_verified_metrics(session: Session, run_id: str) -> Dict[str, Any]:
    """
    Extracts 100% verified, runtime-computed metrics from real execution outputs.
    Guarantees zero hardcoded numbers.
    """
    # Total works
    total_works_count = session.query(Work).count()

    # Query all anomalies for this run
    anomalies = session.query(Anomaly).filter(Anomaly.run_id == run_id).all()
    if not anomalies:
        return {
            "run_id": run_id,
            "total_works": total_works_count,
            "unique_flagged_works": 0,
            "unique_flagged_pct": 0.0,
            "total_fraud_value_cr": 0.0,
            "per_detector_counts": {},
            "per_detector_value_cr": {},
            "overlap_matrix": {},
            "risk_tier_distribution": {"Clean": total_works_count, "Audit Now": 0, "Review": 0, "Monitor": 0},
            "priority_tier_distribution": {"Clean": total_works_count, "🔴 CRITICAL (Top 500)": 0, "🟠 HIGH (Next 500)": 0, "🟡 MEDIUM (Next 1,000)": 0, "⚪ WATCHLIST": 0}
        }

    # Build DataFrame for aggregation
    records = []
    for a in anomalies:
        records.append({
            "work_id": a.work_id,
            "detector_type": a.detector_type,
            "severity": a.severity,
            "cost": a.work.cost if a.work else 0.0
        })

    df_anom = pd.DataFrame(records)

    # Unique flagged works
    unique_flagged_ids = df_anom["work_id"].unique()
    unique_flagged_count = len(unique_flagged_ids)
    unique_flagged_pct = round((unique_flagged_count / max(1, total_works_count)) * 100, 2)

    # Calculate distinct fraud value (deduplicated)
    unique_costs = df_anom.groupby("work_id")["cost"].first()
    unique_fraud_value_cr = round(unique_costs.sum() / 1e7, 2)

    # Per detector counts and values (with natural overlap)
    per_detector_counts = df_anom.groupby("detector_type")["work_id"].nunique().to_dict()
    per_detector_value_cr = {
        d: round(df_anom[df_anom["detector_type"] == d].groupby("work_id")["cost"].first().sum() / 1e7, 2)
        for d in per_detector_counts.keys()
    }

    # Overlap Matrix (co-occurrence counts between detectors)
    detector_types = sorted(df_anom["detector_type"].unique())
    overlap_matrix = {}
    for d1 in detector_types:
        overlap_matrix[d1] = {}
        ids_d1 = set(df_anom[df_anom["detector_type"] == d1]["work_id"])
        for d2 in detector_types:
            ids_d2 = set(df_anom[df_anom["detector_type"] == d2]["work_id"])
            overlap_matrix[d1][d2] = len(ids_d1.intersection(ids_d2))

    # Action Triage Tier Distributions across all works
    work_triage = df_anom.groupby("work_id").apply(
        lambda g: calculate_triage_tier(dict(zip(g["detector_type"], g["severity"])))[1]
    )
    
    triage_counts = {
        "Clean": total_works_count - unique_flagged_count,
        "Audit Now": 0,
        "Review": 0,
        "Monitor": 0
    }
    for tier in work_triage:
        triage_counts[tier] = triage_counts.get(tier, 0) + 1

    # Precision-First Ranked Priorities
    work_rank_data = []
    for wid, group in df_anom.groupby("work_id"):
        sev_dict = dict(zip(group["detector_type"], group["severity"]))
        r_score, has_h, max_s, n_det, h_s = calculate_rank_score(sev_dict)
        work_rank_data.append({
            "work_id": wid,
            "rank_score": r_score,
            "has_hard": has_h,
            "max_sev": max_s,
            "n_detectors": n_det,
            "hard_sev": h_s
        })

    df_ranks = pd.DataFrame(work_rank_data).sort_values("rank_score", ascending=False).reset_index(drop=True)
    df_ranks["rank"] = df_ranks.index + 1

    critical_count = min(500, len(df_ranks))
    high_count = max(0, min(500, len(df_ranks) - 500))
    medium_count = max(0, min(1000, len(df_ranks) - 1000))
    watchlist_count = max(0, len(df_ranks) - 2000)

    priority_counts = {
        "🔴 CRITICAL (Top 500)": critical_count,
        "🟠 HIGH (Next 500)": high_count,
        "🟡 MEDIUM (Next 1,000)": medium_count,
        "⚪ WATCHLIST": watchlist_count,
        "🟢 CLEAN": total_works_count - unique_flagged_count
    }

    return {
        "run_id": run_id,
        "total_works": total_works_count,
        "unique_flagged_works": unique_flagged_count,
        "unique_flagged_pct": unique_flagged_pct,
        "total_fraud_value_cr": unique_fraud_value_cr,
        "per_detector_counts": per_detector_counts,
        "per_detector_value_cr": per_detector_value_cr,
        "overlap_matrix": overlap_matrix,
        "risk_tier_distribution": triage_counts,
        "triage_tier_distribution": triage_counts,
        "priority_tier_distribution": priority_counts
    }


def export_stratified_audit_sample(session: Session, run_id: str, output_path: Optional[Path] = None) -> Path:
    """
    Exports a 1,000-work stratified audit sample for ground-truth empirical calibration:
      - 400 from CRITICAL (Top 500)
      - 300 from HIGH (Next 500)
      - 200 from WATCHLIST (Soft/Behavioral)
      - 100 from CLEAN (Compliant controls)
    """
    from mplads_fraud_detection.config import ARTIFACTS_DIR
    if output_path is None:
        output_path = ARTIFACTS_DIR / "audit_ground_truth_sample.csv"

    anomalies = session.query(Anomaly).filter(Anomaly.run_id == run_id).all()
    records = []
    for a in anomalies:
        records.append({
            "work_id": a.work_id,
            "detector_type": a.detector_type,
            "severity": a.severity,
            "cost": a.work.cost if a.work else 0.0,
            "mp_name": a.work.mp_name if a.work else "",
            "district": a.work.district if a.work else "",
            "category": a.work.category if a.work else "",
            "work_description": a.work.work_description if a.work else ""
        })

    df_anom = pd.DataFrame(records)
    work_rows = []
    for wid, g in df_anom.groupby("work_id"):
        sev_dict = dict(zip(g["detector_type"], g["severity"]))
        r_score, has_h, max_s, n_det, h_s = calculate_rank_score(sev_dict)
        first_row = g.iloc[0]
        work_rows.append({
            "work_id": wid,
            "mp_name": first_row["mp_name"],
            "district": first_row["district"],
            "category": first_row["category"],
            "cost": first_row["cost"],
            "work_description": first_row["work_description"],
            "rank_score": r_score,
            "has_hard_evidence": has_h,
            "detectors_triggered": ", ".join(sorted(sev_dict.keys())),
            "max_severity": max_s
        })

    df_ranked = pd.DataFrame(work_rows).sort_values("rank_score", ascending=False).reset_index(drop=True)
    df_critical = df_ranked.iloc[:500].sample(min(400, len(df_ranked.iloc[:500])), random_state=42)
    df_high = df_ranked.iloc[500:1000].sample(min(300, len(df_ranked.iloc[500:1000])), random_state=42) if len(df_ranked) > 500 else pd.DataFrame()
    df_watch = df_ranked.iloc[2000:].sample(min(200, len(df_ranked.iloc[2000:])), random_state=42) if len(df_ranked) > 2000 else pd.DataFrame()

    # Clean works sample
    flagged_ids = set(df_ranked["work_id"])
    clean_works = session.query(Work).filter(~Work.work_id.in_(flagged_ids)).all()
    clean_rows = [{
        "work_id": w.work_id,
        "mp_name": w.mp_name,
        "district": w.district,
        "category": w.category,
        "cost": w.cost,
        "work_description": w.work_description,
        "rank_score": 0.0,
        "has_hard_evidence": False,
        "detectors_triggered": "CLEAN",
        "max_severity": 0.0
    } for w in clean_works]
    df_clean_sampled = pd.DataFrame(clean_rows).sample(min(100, len(clean_rows)), random_state=42) if clean_rows else pd.DataFrame()

    df_sample = pd.concat([df_critical, df_high, df_watch, df_clean_sampled], ignore_index=True)
    df_sample["audit_label"] = ""  # For auditor manual validation: FRAUD / SUSPICIOUS / LEGITIMATE
    df_sample["auditor_notes"] = ""

    df_sample.to_csv(output_path, index=False)
    return output_path
