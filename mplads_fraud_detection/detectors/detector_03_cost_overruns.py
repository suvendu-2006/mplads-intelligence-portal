"""
Detector 3: Cost Overruns (CPWD DSR 2023 Benchmarking)
Catches projects whose unit costs or total costs deviate abnormally above official CPWD DSR 2023 standards.
"""

import os
import re
import logging
from typing import Dict, List, Tuple, Optional
import pandas as pd
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from mplads_fraud_detection.foundation.utils import safe_divide, monotonic_severity
from mplads_fraud_detection.config import (
    SEVERITY_FLOOR, CPWD_BENCHMARK_RATES_CSV, AP_DIFFICULT_TERRAIN_DISTRICTS
)

logger = logging.getLogger(__name__)

# Authoritative Baseline Rates matching cpwd_benchmark_rates.csv & unit_prices_master.csv
AUTHORITATIVE_CPWD_RATES = {
    "Roads - CC": {"rate": 3200.0, "unit": "meter", "tolerance": 0.25},
    "Roads - Paver": {"rate": 950.0, "unit": "sq_m", "tolerance": 0.20},
    "Drinking Water - Handpump": {"rate": 75000.0, "unit": "number", "tolerance": 0.25},
    "Drinking Water - Borewell": {"rate": 180000.0, "unit": "number", "tolerance": 0.30},
    "Drinking Water - RO Plant": {"rate": 300000.0, "unit": "number", "tolerance": 0.25},
    "School Classroom": {"rate": 850000.0, "unit": "number", "tolerance": 0.20},
    "Community Hall": {"rate": 1850.0, "unit": "sq_ft", "tolerance": 0.20},
    "Solar Street Light": {"rate": 24000.0, "unit": "number", "tolerance": 0.25},
    "High Mast Light": {"rate": 280000.0, "unit": "number", "tolerance": 0.25},
    "Boundary Wall": {"rate": 3800.0, "unit": "meter", "tolerance": 0.25},
}

# Compiled Regexes for Physical Dimension Extraction
REGEX_PATTERNS = {
    "length_m": [
        re.compile(r"(\d+(?:\.\d+)?)\s*(?:meter|metre|mtr|m\b)", re.IGNORECASE),
        re.compile(r"length[:\s]*(\d+(?:\.\d+)?)", re.IGNORECASE)
    ],
    "length_km": [
        re.compile(r"(\d+(?:\.\d+)?)\s*(?:km|kilometer|kilometre)", re.IGNORECASE)
    ],
    "area_sqm": [
        re.compile(r"(\d+(?:\.\d+)?)\s*(?:sq\.?\s*m|square\s*meter|sqm)", re.IGNORECASE),
        re.compile(r"(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|square\s*feet|sqft)", re.IGNORECASE)
    ],
    "count": [
        re.compile(r"(\d+)\s*(?:nos|no|numbers|units|handpumps|lights|lamps|wells|tanks|sheds|classrooms)", re.IGNORECASE),
        re.compile(r"(?:providing|installation|erection|construction)\s+of\s+(\d+)\b", re.IGNORECASE)
    ]
}


def extract_physical_quantity(description: str, category_unit: str) -> Tuple[Optional[float], str, str]:
    """
    Extracts physical dimensions from work description text.

    Returns:
        (quantity, unit_type, confidence)
    """
    text = description.lower()

    if category_unit in ["meter", "km"]:
        for pat in REGEX_PATTERNS["length_km"]:
            m = pat.search(text)
            if m:
                return float(m.group(1)) * 1000.0, "meter", "high"

        for pat in REGEX_PATTERNS["length_m"]:
            m = pat.search(text)
            if m:
                val = float(m.group(1))
                if val > 5.0:
                    return val, "meter", "high"

        return None, "meter", "none"

    elif category_unit in ["sq_m", "sq_ft"]:
        for pat in REGEX_PATTERNS["area_sqm"]:
            m = pat.search(text)
            if m:
                val = float(m.group(1))
                if "ft" in pat.pattern and category_unit == "sq_m":
                    val = val * 0.092903
                return val, category_unit, "high"

        return None, category_unit, "none"

    elif category_unit == "number":
        for pat in REGEX_PATTERNS["count"]:
            m = pat.search(text)
            if m:
                return float(m.group(1)), "number", "high"

        return 1.0, "number", "medium"

    return None, "unknown", "none"


# Granular -> CPWD CSV benchmark row alignment (the real csv uses coarse categories)
BENCHMARK_ALIASES = {
    "Roads - CC":             {"category": "Roads & Pathways",       "unit": "per meter"},
    "Roads - Paver":          {"category": "Roads & Pathways",       "unit": "per sq. meter"},
    "Drinking Water - Handpump":{"category": "Drinking Water",         "unit": "per unit", "rate": 75000.0},
    "Drinking Water - Borewell":{"category": "Drinking Water",         "unit": "per unit", "rate": 180000.0},
    "Drinking Water - RO Plant":{"category": "Drinking Water",         "unit": "per plant"},
    "Solar Street Light":      {"category": "Electricity & Energy",   "unit": "per pole"},
    "High Mast Light":         {"category": "Electricity & Energy",   "unit": "per mast"},
    "School Classroom":        {"category": "Education & Community",  "unit": "per classroom"},
    "Community Hall":          {"category": "Education & Community",  "unit": "per sq. feet"},
    "Boundary Wall":           {"category": "Electricity & Energy",   "unit": "per pole"},  # no direct CSV row; falls back to hardcoded
}

def _normalize_unit(unit_raw: str) -> str:
    u = str(unit_raw).strip().lower()
    if "sq. meter" in u or "sqm" in u:
        return "sq_m"
    if "sq. feet" in u or "sqft" in u:
        return "sq_ft"
    if "per meter" in u or u == "meter":
        return "meter"
    if "km" in u:
        return "km"
    return "number"


def build_benchmark_rates() -> Dict[str, Dict]:
    """
    Builds the CPWD benchmark lookup used by detector 3.

    Precedence:
      1. Exact granular-key rows mapped through BENCHMARK_ALIASES from the CS (if present)
      2. Hard-coded AUTHORITATIVE_CPWD_RATES fallback for keys without a CSV row.
    """
    rows_by_key = {}
    if os.path.exists(CPWD_BENCHMARK_RATES_CSV):
        df_bench = pd.read_csv(CPWD_BENCHMARK_RATES_CSV)
        for _, r in df_bench.iterrows():
            rate_val = float(r["standard_rate_inr"])
            unit_raw = str(r["standard_unit"])
            tolerance_val = float(r["tolerance_pct_upper"]) / 100.0
            year_val = int(r.get("rate_year", 2023))
            # key by (category, standard_unit, rounded rate) to disitnguish rows
            key3 = (str(r["category"]).strip(), unit_raw.strip().lower(), round(rate_val))
            rows_by_key[key3] = {"rate": rate_val, "unit_raw": unit_raw, "tolerance": tolerance_val, "rate_year": year_val}

    benchmark_rates = {}
    for granular_key, alias in BENCHMARK_ALIASES.items():
        cat = alias["category"]
        unit_target = alias["unit"]
        rate_target = alias.get("rate")
        found = None
        for (c, u, r), rec in rows_by_key.items():
            if c == cat and u == unit_target:
                if rate_target is None or abs(r - rate_target) <= 50:
                    found = rec
                    break
        if found:
            benchmark_rates[granular_key] = {
                "rate": found["rate"],
                "unit": _normalize_unit(found["unit_raw"]),
                "tolerance": found["tolerance"],
                "rate_year": found["rate_year"],
            }
        else:
            # fallback to hardcoded baseline (csv row missing for this granular type)
            if granular_key in AUTHORITATIVE_CPWD_RATES:
                benchmark_rates[granular_key] = dict(AUTHORITATIVE_CPWD_RATES[granular_key])
                benchmark_rates[granular_key]["tolerance"] = AUTHORITATIVE_CPWD_RATES[granular_key]["tolerance"]
    return benchmark_rates


def map_description_to_benchmark(category: str, description: str) -> Optional[str]:
    """Maps project category/description to standard CPWD rate keys."""
    text = (str(category) + " " + str(description)).lower()

    if "cc road" in text or ("road" in text and "cc" in text):
        return "Roads - CC"
    elif "paver" in text or "interlocking" in text:
        return "Roads - Paver"
    elif "handpump" in text or "hand pump" in text:
        return "Drinking Water - Handpump"
    elif "borewell" in text or "bore well" in text:
        return "Drinking Water - Borewell"
    elif "ro plant" in text or "purification plant" in text:
        return "Drinking Water - RO Plant"
    elif "high mast" in text:
        return "High Mast Light"
    elif "solar street light" in text or "street light" in text or "led light" in text:
        return "Solar Street Light"
    elif "boundary wall" in text or "compound wall" in text:
        return "Boundary Wall"
    elif "school" in text or "classroom" in text:
        return "School Classroom"
    elif "community hall" in text or "kalyana mandapam" in text or "samudaya bhavan" in text:
        return "Community Hall"

    return None


def load_benchmark_schedules() -> Dict[str, Dict[str, Any]]:
    """Loads authoritative CPWD rate schedules."""
    rates = AUTHORITATIVE_CPWD_RATES.copy()
    if os.path.exists(CPWD_BENCHMARK_RATES_CSV):
        df_bench = pd.read_csv(CPWD_BENCHMARK_RATES_CSV)
        for _, r in df_bench.iterrows():
            wt = str(r["work_type"]).lower()
            std_rate = float(r["standard_rate_inr"])
            tol = float(r["tolerance_pct_upper"]) / 100.0
            r_year = int(r.get("rate_year", 2023))
            if "cc road" in wt:
                rates["Roads - CC"] = {"rate": std_rate, "unit": "meter", "tolerance": tol, "rate_year": r_year}
            elif "paver" in wt:
                rates["Roads - Paver"] = {"rate": std_rate, "unit": "sq_m", "tolerance": tol, "rate_year": r_year}
            elif "handpump" in wt:
                rates["Drinking Water - Handpump"] = {"rate": std_rate, "unit": "number", "tolerance": tol, "rate_year": r_year}
            elif "borewell" in wt:
                rates["Drinking Water - Borewell"] = {"rate": std_rate, "unit": "number", "tolerance": tol, "rate_year": r_year}
            elif "classroom" in wt:
                rates["School Classroom"] = {"rate": std_rate, "unit": "number", "tolerance": tol, "rate_year": r_year}
            elif "community hall" in wt:
                rates["Community Hall"] = {"rate": std_rate, "unit": "sq_ft", "tolerance": tol, "rate_year": r_year}
            elif "solar street light" in wt or "street light" in wt:
                rates["Solar Street Light"] = {"rate": std_rate, "unit": "number", "tolerance": tol, "rate_year": r_year}
            elif "high-mast" in wt or "high mast" in wt:
                rates["High Mast Light"] = {"rate": std_rate, "unit": "number", "tolerance": tol, "rate_year": r_year}
    return rates


def run_detector_03_cost_overruns(session: Session, run_id: str) -> int:
    """
    Executes Detector 3: Cost Overruns against CPWD DSR 2023 Benchmarks.
    """
    logger.info("Executing Detector 3: Cost Overruns (CPWD Benchmarking)...")

    benchmark_rates = load_benchmark_schedules()

    works = session.query(Work).all()
    anomalies_to_insert = []

    for w in works:
        desc = w.work_description or ""
        bench_key = map_description_to_benchmark(w.category, desc)
        if not bench_key or bench_key not in benchmark_rates:
            continue

        bench = benchmark_rates[bench_key]
        base_rate = bench["rate"]
        unit_type = bench["unit"]
        base_tolerance = bench["tolerance"]

        # Inflation adjustment (6% annual compounding post-2023)
        comp_year = w.completion_date.year if w.completion_date else 2024
        year_diff = max(0, comp_year - 2023)
        inflation_mult = (1.06) ** year_diff
        adjusted_base_rate = base_rate * inflation_mult

        # Terrain Adjustment (+15% for AP difficult terrain districts)
        is_terrain = str(w.district).upper() in AP_DIFFICULT_TERRAIN_DISTRICTS
        effective_tolerance = base_tolerance + (0.15 if is_terrain else 0.0)

        # Max allowed rate
        max_allowed_unit_rate = adjusted_base_rate * (1.0 + effective_tolerance)

        # Extract Physical Quantity
        quantity, extracted_unit, conf = extract_physical_quantity(desc, unit_type)

        if quantity is not None and quantity > 0:
            actual_unit_price = w.cost / quantity
            if actual_unit_price <= max_allowed_unit_rate:
                continue

            excess_pct = ((actual_unit_price - max_allowed_unit_rate) / max_allowed_unit_rate) * 100.0
            absolute_excess = (actual_unit_price - max_allowed_unit_rate) * quantity

            # Pre-flag guard: >= 5% excess and >= ₹10,000 absolute overcharge
            if excess_pct < 5.0 or absolute_excess < 10000.0:
                continue

            # Monotonic Severity Mapping (Requires high extraction confidence for severity >= 0.90)
            severity = monotonic_severity(excess_pct, [5.0, 25.0, 50.0, 100.0], [0.50, 0.70, 0.85, 1.00])
            if conf == "low":
                severity = min(0.70, severity * 0.80)
            elif conf != "high" and severity >= 0.90:
                severity = 0.85

            if severity < SEVERITY_FLOOR:
                continue

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
                "cost": float(w.cost)
            }

            anomaly = Anomaly(
                work_id=w.work_id,
                detector_type="cost_overrun",
                severity=round(severity, 3),
                explanation=explanation,
                evidence=evidence,
                run_id=run_id
            )
            anomalies_to_insert.append(anomaly)

    session.bulk_save_objects(anomalies_to_insert)
    session.flush()
    logger.info(f"Detector 3 generated {len(anomalies_to_insert):,} cost overrun anomalies.")
    return len(anomalies_to_insert)
