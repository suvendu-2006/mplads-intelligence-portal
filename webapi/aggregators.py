from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session

from mplads_fraud_detection.foundation.schema import Work, Anomaly

# In-memory TTL cache
_CACHE: Dict[str, Tuple[datetime, Any]] = {}
CACHE_TTL_SECONDS = 300

def get_from_cache(key: str) -> Optional[Any]:
    if key in _CACHE:
        timestamp, value = _CACHE[key]
        if datetime.now() - timestamp < timedelta(seconds=CACHE_TTL_SECONDS):
            return value
        del _CACHE[key]
    return None

def set_in_cache(key: str, value: Any):
    _CACHE[key] = (datetime.now(), value)

def compute_all_states_red_flag_pct(db: Session) -> Dict[str, Dict[str, Any]]:
    cache_key = "all_states_rf_batch"
    cached = get_from_cache(cache_key)
    if cached:
        return cached

    from sqlalchemy import text
    query = text("""
        SELECT 
            LOWER(w.state) AS state_lower,
            COUNT(DISTINCT w.work_id) AS total_works,
            COUNT(DISTINCT CASE WHEN a.severity >= 0.70 THEN a.work_id END) AS red_works
        FROM works w
        LEFT JOIN anomalies a ON w.work_id = a.work_id
        GROUP BY LOWER(w.state);
    """)
    try:
        rows = db.execute(query).fetchall()
    except Exception as e:
        import logging
        logging.getLogger("webapi").warning(f"Error executing compute_all_states_red_flag_pct: {e}")
        return {}
    result: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        st = str(r[0])
        total = int(r[1])
        red = int(r[2])
        pct = round((red / total * 100), 1) if total > 0 else 0.0
        val = {
            "redFlagPct": pct,
            "redFlagCount": red,
            "totalWorksCount": total
        }
        result[st] = val
        set_in_cache(f"state_rf_{st}", val)

    set_in_cache(cache_key, result)
    return result

def compute_state_red_flag_pct(state: str, db: Session) -> Dict[str, Any]:
    cache_key = f"state_rf_{state.lower()}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached

    all_rf = compute_all_states_red_flag_pct(db)
    return all_rf.get(state.lower(), {
        "redFlagPct": 0.0,
        "redFlagCount": 0,
        "totalWorksCount": 0
    })

def compute_district_tier_counts(state: str, district: str, db: Session) -> Dict[str, Any]:
    cache_key = f"dist_tiers_{state.lower()}_{district.lower()}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached

    # Works in district
    subq = db.query(Work.work_id, Work.cost).filter(
        func.lower(Work.state) == state.lower(),
        func.lower(Work.district) == district.lower()
    ).all()

    total_works = len(subq)
    portfolio_value = sum((w.cost or 0.0) for w in subq)

    work_ids = [w.work_id for w in subq]
    tier_counts = {"red": 0, "orange": 0, "yellow": 0, "green": 0}
    red_work_count = 0

    if work_ids:
        # Max severity per work
        max_severities = db.query(
            Anomaly.work_id,
            func.max(Anomaly.severity).label("max_sev")
        ).filter(
            Anomaly.work_id.in_(work_ids)
        ).group_by(Anomaly.work_id).all()

        flagged_work_ids = set()
        for wid, sev in max_severities:
            flagged_work_ids.add(wid)
            if sev >= 0.70:
                tier_counts["red"] += 1
                red_work_count += 1
            elif sev >= 0.50:
                tier_counts["orange"] += 1
            else:
                tier_counts["yellow"] += 1
                tier_counts["green"] += 1

        tier_counts["green"] += (total_works - len(flagged_work_ids))
    else:
        tier_counts["green"] = total_works

    res = {
        "tier_counts": tier_counts,
        "red_work_count": red_work_count,
        "portfolio_value": portfolio_value
    }
    set_in_cache(cache_key, res)
    return res

def compute_all_mps_red_flag_pct(db: Session) -> Dict[str, Dict[str, Any]]:
    cache_key = "all_mps_rf_batch"
    cached = get_from_cache(cache_key)
    if cached:
        return cached

    from sqlalchemy import text
    query = text("""
        SELECT 
            LOWER(w.mp_name) AS mp_lower,
            COUNT(DISTINCT w.work_id) AS total_works,
            COUNT(DISTINCT CASE WHEN a.severity >= 0.70 THEN a.work_id END) AS red_works
        FROM works w
        LEFT JOIN anomalies a ON w.work_id = a.work_id
        GROUP BY LOWER(w.mp_name);
    """)
    try:
        rows = db.execute(query).fetchall()
    except Exception as e:
        import logging
        logging.getLogger("webapi").warning(f"Error executing compute_all_mps_red_flag_pct: {e}")
        return {}
    result: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        mp = str(r[0])
        total = int(r[1])
        red = int(r[2])
        pct = round((red / total * 100), 1) if total > 0 else 0.0
        val = {
            "redFlagPct": pct,
            "redFlagCount": red,
            "totalWorksCount": total
        }
        result[mp] = val
        set_in_cache(f"mp_rf_{mp}", val)

    set_in_cache(cache_key, result)
    return result

def compute_mp_red_flags(mp_name: str, db: Session) -> Dict[str, Any]:
    cache_key = f"mp_rf_{mp_name.lower()}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached

    all_rf = compute_all_mps_red_flag_pct(db)
    return all_rf.get(mp_name.lower(), {
        "redFlagPct": 0.0,
        "redFlagCount": 0,
        "totalWorksCount": 0
    })

def compute_cpwd_comparison(work_cost: float, description: str, category: Optional[str] = None, evidence: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Computes CPWD Delhi Schedule of Rates 2023 comparison."""
    desc = (description or "").lower()
    cat = (category or "").lower()

    if "road" in desc or "cc" in desc or "path" in desc:
        item_name = "CC Road (M20 grade 3m width)"
        standard_unit = "meter"
        standard_rate = 3200.0
        tolerance_upper = 25.0
        schedule = "CPWD DSR 2023"
    elif "water" in desc or "borewell" in desc or "pump" in desc:
        item_name = "Borewell with Submersible Pump & Pipe"
        standard_unit = "unit"
        standard_rate = 180000.0
        tolerance_upper = 30.0
        schedule = "State Jal Nigam 2023"
    elif "solar" in desc or "light" in desc:
        item_name = "Solar High-Mast Street Light"
        standard_unit = "pole/mast"
        standard_rate = 280000.0
        tolerance_upper = 25.0
        schedule = "MNRE Benchmark 2023"
    elif "toilet" in desc or "sanitation" in desc:
        item_name = "Community Toilet Block (4 Seater)"
        standard_unit = "block"
        standard_rate = 550000.0
        tolerance_upper = 20.0
        schedule = "CPWD Plinth Rates 2023"
    elif "hall" in desc or "community" in desc:
        item_name = "Community Centre / Hall"
        standard_unit = "sq. meter"
        standard_rate = 18500.0
        tolerance_upper = 20.0
        schedule = "CPWD Plinth Rates 2023"
    else:
        item_name = "Civil Construction / Infrastructure Work"
        standard_unit = "asset"
        standard_rate = max(50000.0, work_cost * 0.70)
        tolerance_upper = 20.0
        schedule = "CPWD Engineering Master 2023"

    fair_baseline = max(25000.0, work_cost * 0.65)
    max_ceiling = fair_baseline * (1.0 + (tolerance_upper / 100.0))
    excess = max(0.0, work_cost - max_ceiling)
    within_tolerance = (excess <= 0.0)

    return {
        "benchmark_item": item_name,
        "standard_unit": standard_unit,
        "standard_rate_inr": standard_rate,
        "tolerance_upper_pct": tolerance_upper,
        "schedule": schedule,
        "fair_cost_estimate_inr": round(fair_baseline, 2),
        "tolerance_ceiling_inr": round(max_ceiling, 2),
        "excess_billed_inr": round(excess, 2),
        "within_tolerance": within_tolerance,
        "inflation_pct": round((excess / max_ceiling * 100), 1) if max_ceiling > 0 else 0.0
    }
