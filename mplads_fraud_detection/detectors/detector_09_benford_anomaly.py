"""
Detector 9: Round-Number Screen & Benford's Law
Catches synthetic and fabricated cost estimates using first-digit/second-digit Benford distribution tests and roundness tiers.
"""

import logging
from typing import Dict, List, Any
import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.stats.multitest import multipletests
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from mplads_fraud_detection.foundation.utils import safe_divide, monotonic_severity
from mplads_fraud_detection.config import SEVERITY_FLOOR

logger = logging.getLogger(__name__)

# Benford's Law Theoretical Probabilities
BENFORD_FIRST_DIGIT = {
    1: 0.3010, 2: 0.1761, 3: 0.1249, 4: 0.0969, 5: 0.0792,
    6: 0.0669, 7: 0.0580, 8: 0.0512, 9: 0.0458
}

BENFORD_SECOND_DIGIT = {
    0: 0.1197, 1: 0.1139, 2: 0.1088, 3: 0.1043, 4: 0.1003,
    5: 0.0967, 6: 0.0934, 7: 0.0904, 8: 0.0876, 9: 0.0850
}


def get_first_digit(val: float) -> int:
    """Extract leading significant digit (1-9)."""
    val = abs(val)
    if val == 0:
        return 1
    log_val = np.floor(np.log10(val))
    d = int(np.floor(val / (10 ** log_val)))
    return min(9, max(1, d))


def get_second_digit(val: float) -> int:
    """Extract second significant digit (0-9)."""
    val = abs(val)
    if val == 0:
        return 0
    while val < 10:
        val *= 10
    while val >= 100:
        val /= 10
    return int(val) % 10


def detect_round_level(cost: float) -> int:
    """
    Classifies roundness level:
    0: Not round (e.g. ₹3,78,420)
    1: Nearest 10K (e.g. ₹3,80,000)
    2: Nearest 50K (e.g. ₹3,50,000)
    3: Exact 1 Lakh multiple (e.g. ₹4,00,000)
    4: Exact 5 Lakh multiple (e.g. ₹5,00,000)
    5: Exact 10 Lakh multiple (e.g. ₹10,00,000)
    """
    cost_int = int(round(cost))
    if cost_int % 1000000 == 0:
        return 5
    elif cost_int % 500000 == 0:
        return 4
    elif cost_int % 100000 == 0:
        return 3
    elif cost_int % 50000 == 0:
        return 2
    elif cost_int % 10000 == 0:
        return 1
    return 0


def run_detector_09_benford_anomaly(session: Session, run_id: str) -> int:
    """
    Executes Detector 9: Benford's Law and Round-Number Screen.
    """
    logger.info("Executing Detector 9: Benford's Law & Round-Number Screen...")

    works = session.query(Work).all()
    if not works:
        return 0

    df = pd.DataFrame([{
        "work_id": w.work_id,
        "cost": w.cost,
        "mp_name": w.mp_name,
        "district": w.district
    } for w in works])

    df = df[df["cost"] > 0].copy()
    df["first_digit"] = df["cost"].apply(get_first_digit)
    df["second_digit"] = df["cost"].apply(get_second_digit)
    df["round_level"] = df["cost"].apply(detect_round_level)

    # 1. MP-Level Benford First & Second Digit Tests
    mp_benford_results = {}
    p1_values = []
    p2_values = []
    mp_keys = []

    for mp, group in df.groupby("mp_name"):
        n_samples = len(group)
        if n_samples < 45:
            continue

        # 1st Digit Chi-Square
        obs_1 = group["first_digit"].value_counts().reindex(range(1, 10), fill_value=0)
        exp_1 = np.array([BENFORD_FIRST_DIGIT[d] * n_samples for d in range(1, 10)])
        exp_1 = exp_1 * (obs_1.values.sum() / exp_1.sum())  # Exact sum alignment
        chi1, p1 = stats.chisquare(f_obs=obs_1.values, f_exp=exp_1)
        dev1 = float(np.abs(obs_1.values / n_samples - [BENFORD_FIRST_DIGIT[d] for d in range(1, 10)]).sum())

        # 2nd Digit Chi-Square (Require N >= 60 or pooled tail bins)
        if n_samples >= 60:
            obs_2 = group["second_digit"].value_counts().reindex(range(0, 10), fill_value=0)
            exp_2 = np.array([BENFORD_SECOND_DIGIT[d] * n_samples for d in range(0, 10)])
            exp_2 = exp_2 * (obs_2.values.sum() / exp_2.sum())  # Exact sum alignment
            chi2, p2 = stats.chisquare(f_obs=obs_2.values, f_exp=exp_2)
        else:
            chi2, p2 = 0.0, 1.0

        mp_keys.append(mp)
        p1_values.append(p1)
        p2_values.append(p2)

        # Round number concentration
        pct_exact_lakhs = (group["round_level"] >= 3).sum() / n_samples
        round_sev = monotonic_severity(pct_exact_lakhs, [0.20, 0.35, 0.50], [0.50, 0.70, 0.90])

        mp_benford_results[mp] = {
            "n_samples": n_samples,
            "chi1": chi1,
            "p1_raw": p1,
            "dev1": dev1,
            "chi2": chi2,
            "p2_raw": p2,
            "pct_exact_lakhs": pct_exact_lakhs,
            "mp_round_sev": round_sev
        }

    # Family-Wise Bonferroni Correction
    if p1_values:
        _, p1_adj, _, _ = multipletests(p1_values, method="bonferroni")
        _, p2_adj, _, _ = multipletests(p2_values, method="bonferroni")
        for i, mp in enumerate(mp_keys):
            mp_benford_results[mp]["p1_adj"] = float(p1_adj[i])
            mp_benford_results[mp]["p2_adj"] = float(p2_adj[i])
            mp_benford_results[mp]["benford_violation"] = (
                (p1_adj[i] < 0.05 and mp_benford_results[mp]["dev1"] > 0.15) or (p2_adj[i] < 0.05)
            )

    anomalies_to_insert = []
    for _, row in df.iterrows():
        mp = row["mp_name"]
        cost_val = float(row["cost"])
        r_level = int(row["round_level"])
        mp_data = mp_benford_results.get(mp)

        if not mp_data:
            continue

        is_benford_viol = mp_data.get("benford_violation", False)
        mp_round_sev = mp_data.get("mp_round_sev", 0.0)

        # Work is evaluated if it is a round figure (Level >= 4) AND MP portfolio violates Benford distribution
        if r_level < 4 or (not is_benford_viol and mp_data.get("pct_exact_lakhs", 0.0) < 0.30):
            continue

        signals = []
        if is_benford_viol:
            signals.append("benford_law_violation")

        signals.append(f"round_cost_level_{r_level}")
        round_indiv_sev = 0.50 + (0.20 if r_level >= 5 else 0.0) + (0.30 * mp_round_sev)
        base_sev = max(SEVERITY_FLOOR, min(1.0, round_indiv_sev))

        benford_viol_str = ""
        if is_benford_viol:
            chi_val = mp_data["chi1"]
            p_val = mp_data.get("p1_adj", 1.0)
            benford_viol_str = f"MP portfolio violates Benford's Law (χ²={chi_val:.1f}, adjusted p={p_val:.4f}) with "

        explanation = (
            f"Fabricated Cost / Round Number Anomaly: Project cost ₹{cost_val:,.0f} is an exact ₹{'10' if r_level>=5 else '5'} Lakh round figure. "
            f"{benford_viol_str}"
            f"{mp_data['pct_exact_lakhs']*100:.1f}% of MP's works at round figures (vs natural ~5% baseline)."
        )

        evidence = {
            "first_digit": int(row["first_digit"]),
            "second_digit": int(row["second_digit"]),
            "round_level": r_level,
            "cost": cost_val,
            "mp_name": mp,
            "mp_round_concentration_pct": round(mp_data["pct_exact_lakhs"] * 100, 1),
            "benford_chi_square": round(float(mp_data["chi1"]), 2),
            "benford_p_value_adjusted": round(float(mp_data.get("p1_adj", 1.0)), 4),
            "signals": signals
        }

        anomaly = Anomaly(
            work_id=int(row["work_id"]),
            detector_type="benford_anomaly",
            severity=round(base_sev, 3),
            explanation=explanation,
            evidence=evidence,
            run_id=run_id
        )
        anomalies_to_insert.append(anomaly)

    session.bulk_save_objects(anomalies_to_insert)
    session.flush()
    logger.info(f"Detector 9 generated {len(anomalies_to_insert):,} Benford & roundness anomalies.")
    return len(anomalies_to_insert)
