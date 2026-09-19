import os
import re
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from webapi.models import EnvelopeResponse
from webapi.data_service import load_mps_csv, get_db
from webapi.aggregators import compute_mp_red_flags
from webapi.config import DETECTOR_NAMES, get_tier
from mplads_fraud_detection.foundation.schema import Work, Anomaly

router = APIRouter()

_constituency_cache: Dict[str, Any] = {}

@router.get("/constituencies/{name}", response_model=EnvelopeResponse[Dict[str, Any]])
def get_constituency_detail(name: str, db: Session = Depends(get_db)):
    """
    Returns comprehensive intelligence and developmental details for a specific
    Parliamentary (or matched Assembly) Constituency.
    """
    clean_name = name.strip()
    cache_key = clean_name.lower()
    if cache_key in _constituency_cache:
        return EnvelopeResponse(data=_constituency_cache[cache_key], meta=None, warnings=[])

    df_mps = load_mps_csv()
    matched_via_ac = None

    # 1. Exact match in Parliamentary Constituency
    match = df_mps[df_mps["constituency"].astype(str).str.strip().str.lower() == clean_name.lower()]

    # 2. Match via Assembly Constituency
    if match.empty:
        from webapi.services.assembly_service import get_mp_by_assembly_name, search_assembly_constituencies
        ac_info = get_mp_by_assembly_name(clean_name)
        if not ac_info:
            acs = search_assembly_constituencies(clean_name, limit=1)
            if acs:
                ac_info = acs[0]
        if ac_info:
            target_pc = ac_info.get("pc_name", "").strip().upper()
            if target_pc:
                match = df_mps[df_mps["constituency"].astype(str).str.strip().str.upper() == target_pc]
                if not match.empty:
                    matched_via_ac = ac_info

    # 3. Partial match in Parliamentary Constituency
    if match.empty:
        match = df_mps[df_mps["constituency"].astype(str).str.contains(re.escape(clean_name), case=False, na=False)]

    # 4. Fallback search via Works table
    if match.empty:
        try:
            q_wild = f"%{clean_name.lower()}%"
            work_pc = db.query(Work.mp_constituency).filter(
                func.lower(Work.mp_constituency).like(q_wild)
            ).first()
            if work_pc and work_pc[0]:
                match = df_mps[df_mps["constituency"].astype(str).str.strip().str.upper() == work_pc[0].strip().upper()]
        except Exception:
            pass

    if match.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Constituency '{clean_name}' not found. Please verify the name or spelling."
        )

    row = match.iloc[0]
    pc_name = str(row.get("constituency", "")).strip().upper()
    state_name = str(row.get("state", "")).strip()
    mp_name = str(row.get("mpName", "")).strip()
    mp_id = str(row.get("id", "")).strip()

    # Basic stats
    alloc = float(row.get("allocatedAmount", 0.0))
    exp = float(row.get("totalExpenditure", 0.0))
    util = float(row.get("utilizationPercentage", 0.0))
    completed_count = int(row.get("completedWorksCount", 0))
    recommended_count = int(row.get("recommendedWorksCount", 0))
    unspent = float(row.get("unspentAmount", 0.0))

    # Total works reconciliation
    total_works = completed_count + recommended_count if (completed_count + recommended_count) > 0 else 0
    remained_count = max(0, total_works - completed_count)
    completion_rate = round((completed_count / total_works * 100), 1) if total_works > 0 else 0.0

    # Retrieve assembly segments
    from webapi.services.assembly_service import get_assemblies_by_pc
    assemblies = get_assemblies_by_pc(pc_name)

    # Query works from SQLite
    works_query = db.query(Work).filter(
        (func.lower(Work.mp_constituency) == pc_name.lower()) |
        (func.lower(Work.mp_name) == mp_name.lower())
    )
    db_works = works_query.limit(300).all()

    # Calculate categories & agencies
    sector_map: Dict[str, Dict[str, Any]] = {}
    agency_map: Dict[str, Dict[str, Any]] = {}
    work_ids = []

    works_list = []
    for w in db_works:
        work_ids.append(w.work_id)
        cat = (w.category or "General Community Works").strip().title()
        c_cost = float(w.cost or 0.0)

        if cat not in sector_map:
            sector_map[cat] = {"category": cat, "count": 0, "amount": 0.0}
        sector_map[cat]["count"] += 1
        sector_map[cat]["amount"] += c_cost

        agency = (w.implementing_agency or "Authorized State Engineering Wing").strip()
        if agency not in agency_map:
            agency_map[agency] = {"agency": agency, "count": 0, "amount": 0.0}
        agency_map[agency]["count"] += 1
        agency_map[agency]["amount"] += c_cost

        works_list.append({
            "work_id": w.work_id,
            "description": w.work_description,
            "cost": c_cost,
            "category": cat,
            "location": w.location or pc_name,
            "district": w.district or state_name,
            "status": w.status or "Completed",
            "implementing_agency": agency,
            "completion_date": str(w.completion_date) if w.completion_date else None,
            "recommended_date": str(w.recommended_date) if w.recommended_date else None,
        })

    # Red flags & anomalies
    flags_list = []
    if work_ids:
        anomalies = db.query(Anomaly).filter(Anomaly.work_id.in_(work_ids)).all()
        for a in anomalies:
            det_type = a.detector_type
            det_name = DETECTOR_NAMES.get(det_type, det_type.replace("_", " ").title())
            flags_list.append({
                "anomaly_id": a.anomaly_id,
                "work_id": a.work_id,
                "detector_type": det_type,
                "detector_name": det_name,
                "severity": float(a.severity or 0.5),
                "explanation": a.explanation,
                "tier": get_tier(float(a.severity or 0.5))
            })

    # Summary
    red_flag_count = len(flags_list)
    red_flag_pct = round((red_flag_count / max(1, len(works_list))) * 100, 1)

    # Sort breakdowns
    sector_breakdown = sorted(list(sector_map.values()), key=lambda x: x["amount"], reverse=True)
    agency_breakdown = sorted(list(agency_map.values()), key=lambda x: x["amount"], reverse=True)[:10]

    warnings = []
    if matched_via_ac:
        ac_name = matched_via_ac.get("ac_name", clean_name)
        warnings.append(
            f"You searched for '{ac_name}' (Assembly Segment). Showing parent Parliamentary Constituency '{pc_name}'."
        )

    response_data = {
        "summary": {
            "name": pc_name,
            "state": state_name,
            "house": str(row.get("house", "Lok Sabha")),
            "allocatedAmount": alloc,
            "totalExpenditure": exp,
            "utilizationPercentage": util,
            "unspentAmount": unspent,
            "totalWorks": total_works,
            "completedWorksCount": completed_count,
            "recommendedWorksCount": recommended_count,
            "remainedWorksCount": remained_count,
            "completionRate": completion_rate,
            "redFlagCount": red_flag_count,
            "redFlagPct": red_flag_pct,
            "matched_assembly_constituency": matched_via_ac.get("ac_name") if matched_via_ac else None,
            "mp": {
                "id": mp_id,
                "name": mp_name,
                "party": str(row.get("party", "")),
                "house": str(row.get("house", "Lok Sabha"))
            },
            "assemblies": assemblies
        },
        "sectorBreakdown": sector_breakdown,
        "agencyBreakdown": agency_breakdown,
        "works": works_list,
        "flags": flags_list
    }

    _constituency_cache[cache_key] = response_data
    return EnvelopeResponse(data=response_data, meta=None, warnings=warnings)
