"""
Detector 10: Vague Description Flag (Text Forensics)
Sole owner of text vagueness, unmeasured boilerplate entries, and fuzzy template clustering.
"""

import re
import difflib
import logging
from typing import Dict, List, Tuple, Any
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from mplads_fraud_detection.foundation.utils import safe_divide, monotonic_severity
from mplads_fraud_detection.config import SEVERITY_FLOOR

logger = logging.getLogger(__name__)

# Anchored Specificity Patterns
SPECIFICITY_MARKERS = {
    "measurements": [
        re.compile(r"\b\d+(?:\.\d+)?\s*(?:meter|metre|mtr|mters|km|sqm|sq\.?\s*m|sqft|feet|ft)\b", re.IGNORECASE),
        re.compile(r"\b(?:length|width|height|depth)[:\s]*\d+", re.IGNORECASE)
    ],
    "location_specifics": [
        re.compile(r"\b(?:village|gram|gp|panchayat|mandal|block|ward|colony|nagar|puram)\b", re.IGNORECASE),
        re.compile(r"\bfrom\s+[A-Za-z0-9\s]+\s+to\s+[A-Za-z0-9\s]+\b", re.IGNORECASE)
    ],
    "technical_specs": [
        re.compile(r"\b(?:cc|rcc|pcc|m20|m25|m30|bitumen|asphalt|tar|led|transformer|borewell|handpump)\b", re.IGNORECASE)
    ],
    "work_scope": [
        re.compile(r"\b(?:construction|erection|installation|renovation|repair|widening|strengthening|providing)\b", re.IGNORECASE)
    ],
    "beneficiary_info": [
        re.compile(r"\b(?:school|college|hospital|phc|chc|drinking\s*water|crematorium|burial|stadium|library)\b", re.IGNORECASE)
    ]
}

SPECIFICITY_WEIGHTS = {
    "measurements": 0.25,
    "location_specifics": 0.25,
    "technical_specs": 0.20,
    "work_scope": 0.15,
    "beneficiary_info": 0.15
}

GENERIC_KEYWORDS = [
    "development work", "various works", "miscellaneous", "misc work",
    "other work", "general work", "routine maintenance", "general development"
]


def score_specificity(text: str) -> Tuple[float, Dict[str, bool], List[str]]:
    """Scores text specificity from 0.0 to 1.0 based on 5 marker categories."""
    t_lower = text.lower()
    matches = {}
    missing = []
    total_score = 0.0

    for cat, patterns in SPECIFICITY_MARKERS.items():
        has_match = any(p.search(t_lower) for p in patterns)
        matches[cat] = has_match
        if has_match:
            total_score += SPECIFICITY_WEIGHTS[cat]
        else:
            missing.append(cat)

    return total_score, matches, missing


def run_detector_10_vague_description(session: Session, run_id: str) -> int:
    """
    Executes Detector 10: Vague Description Text Forensics.
    """
    logger.info("Executing Detector 10: Vague Description Text Forensics...")

    works = session.query(Work).all()
    if not works:
        return 0

    df = pd.DataFrame([{
        "work_id": w.work_id,
        "work_description": w.work_description,
        "cost": w.cost,
        "category": w.category,
        "district": w.district
    } for w in works])

    # 1. Fuzzy Template Grouping (Length-bucketed sequence matching)
    desc_counts = df["work_description"].value_counts()
    exact_template_map = desc_counts[desc_counts >= 5].to_dict()

    anomalies_to_insert = []

    for _, row in df.iterrows():
        desc = str(row["work_description"]).strip()
        cost_val = float(row["cost"])
        desc_len = len(desc)
        desc_lower = desc.lower()

        # Check Missing Description Bucket
        if not desc or desc in ["Not specified", "None", "nan", ""]:
            anomaly = Anomaly(
                work_id=int(row["work_id"]),
                detector_type="vague_description",
                severity=1.00,
                explanation="CRITICAL VAGUENESS: Project entry is completely missing any work description.",
                evidence={"missing_description": True, "length": 0, "cost": cost_val},
                run_id=run_id
            )
            anomalies_to_insert.append(anomaly)
            continue

        # Cost-Contextual Exemption: Works < ₹2 Lakh exempt from text vagueness checks
        if cost_val < 200000.0:
            continue

        signals = []
        signal_severities = []

        # Signal 1: Cost-Contextual Length-based vagueness
        if cost_val >= 500000.0 and desc_len < 50:
            signals.append("high_cost_short_description")
            signal_severities.append(0.85 if desc_len < 25 else 0.70)
        elif cost_val >= 200000.0 and desc_len < 40:
            signals.append("short_description")
            signal_severities.append(0.75 if desc_len < 20 else 0.60)

        # Signal 2: Meaningless generic keywords
        if any(kw in desc_lower for kw in GENERIC_KEYWORDS):
            signals.append("generic_boilerplate_phrase")
            signal_severities.append(0.85)

        # Signal 3: Specificity scoring (Cost-contextual for works >= ₹2L)
        spec_score, marker_matches, missing_cats = score_specificity(desc)
        if spec_score < 0.12:
            signals.append("low_specificity_score")
            signal_severities.append(0.80)
        elif spec_score < 0.20 and cost_val >= 500000.0:
            signals.append("substandard_specificity")
            signal_severities.append(0.60)

        # Signal 4: Template repetition (repeated >= 10 times across dataset)
        repeat_count = exact_template_map.get(desc, 1)
        if repeat_count >= 10:
            signals.append("template_repetition")
            signal_severities.append(min(0.85, 0.50 + 0.05 * min(7, repeat_count - 10)))

        if not signals:
            continue

        # Composite within D10
        base_sev = max(signal_severities)
        n_sigs = len(signals)
        composite_sev = min(1.0, base_sev + 0.15 * (n_sigs - 1))

        if composite_sev < SEVERITY_FLOOR:
            continue

        explanation_parts = [
            f"VAGUE DESCRIPTION ALERT: \"{desc[:60]}...\" ({desc_len} chars, specificity score: {spec_score:.2f}/1.0)"
        ]
        if missing_cats:
            explanation_parts.append(f"Missing engineering dimensions: {', '.join(missing_cats)}")
        if repeat_count >= 5:
            explanation_parts.append(f"Identical template text repeated {repeat_count} times across dataset")

        explanation = " | ".join(explanation_parts) + "."

        evidence = {
            "description_length": desc_len,
            "specificity_score": round(spec_score, 2),
            "missing_markers": missing_cats,
            "template_repeat_count": repeat_count,
            "signals_triggered": signals,
            "cost": cost_val,
            "category": str(row["category"])
        }

        anomaly = Anomaly(
            work_id=int(row["work_id"]),
            detector_type="vague_description",
            severity=round(composite_sev, 3),
            explanation=explanation,
            evidence=evidence,
            run_id=run_id
        )
        anomalies_to_insert.append(anomaly)

    session.bulk_save_objects(anomalies_to_insert)
    session.flush()
    logger.info(f"Detector 10 generated {len(anomalies_to_insert):,} vague description anomalies.")
    return len(anomalies_to_insert)
