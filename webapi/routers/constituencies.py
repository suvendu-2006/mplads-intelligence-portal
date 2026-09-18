import math
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from webapi.models import EnvelopeResponse, MetaPagination
from webapi.data_service import load_mps_csv, get_db
from webapi.aggregators import compute_mp_red_flags
from webapi.services.assembly_service import (
    get_mp_by_assembly_name,
    search_assembly_constituencies,
    get_assemblies_by_pc
)
from mplads_fraud_detection.foundation.schema import Work, Anomaly

router = APIRouter()

_constituency_cache: Dict[str, Any] = {}

@router.get("/constituencies/{name}")
def get_constituency_detail(
    name: str,
    ac: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Returns complete constituency-first intelligence for a Parliamentary
    or Assembly Constituency, including representative MP, fund envelope,
    assembly segments, and local development works.
    """
    c_key = f"{name}_{ac}".strip().lower()
    if c_key in _constituency_cache:
        return EnvelopeResponse(data=_constituency_cache[c_key], meta=None, warnings=[])

    clean_query = name.strip()
    df_mps = load_mps_csv()

    is_ac_view = bool(ac and ac.strip())
    active_ac_name = ac.strip() if ac and ac.strip() else None
    matched_pc = None
    ac_district = None
    ac_number = None

    # Check 1: Check if 'name' is an exact Parliamentary Constituency (e.g. BARGARH, VARANASI)
    exact_pc_match = df_mps[df_mps["constituency"].astype(str).str.strip().str.lower() == clean_query.lower()]
    if not exact_pc_match.empty:
        match = exact_pc_match
        matched_pc = str(exact_pc_match.iloc[0]["constituency"]).strip().upper()
    else:
        # Check 2: Check if 'name' is an Assembly Constituency (e.g. BIJEPUR, PADAMPUR)
        ac_lookup = get_mp_by_assembly_name(clean_query)
        if ac_lookup:
            is_ac_view = True
            if not active_ac_name:
                active_ac_name = ac_lookup.get("ac_name", clean_query)
            matched_pc = ac_lookup.get("pc_name", "").strip().upper()
            ac_district = ac_lookup.get("district")
            ac_number = ac_lookup.get("ac_no")
            match = df_mps[df_mps["constituency"].astype(str).str.strip().str.upper() == matched_pc]
        else:
            # Check 3: Partial PC match
            match = df_mps[df_mps["constituency"].astype(str).str.contains(clean_query, case=False, na=False)]
        
        # If still empty, try partial AC search
        if match.empty:
            ac_results = search_assembly_constituencies(clean_query, limit=5)
            if ac_results:
                is_ac_view = True
                first_ac = ac_results[0]
                active_ac_name = first_ac.get("ac_name", clean_query)
                matched_pc = first_ac.get("pc_name", "").strip().upper()
                ac_district = first_ac.get("district")
                ac_number = first_ac.get("ac_no")
                if matched_pc:
                    match = df_mps[df_mps["constituency"].astype(str).str.strip().str.upper() == matched_pc]

    if match.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Constituency '{name}' not found. Please verify the Parliamentary or Assembly Constituency spelling."
        )

    row = match.iloc[0]
    mp_id = str(row["id"])
    mp_name = str(row["mpName"])
    pc_name = str(row.get("constituency", "")).strip().upper()
    state = str(row.get("state", ""))
    house = str(row.get("house", "Lok Sabha"))
    party = str(row.get("party", "")) if "party" in row else ""

    # Fetch all assembly segments in this PC
    all_acs = get_assemblies_by_pc(pc_name)
    if not all_acs and state:
        from webapi.services.assembly_service import get_assemblies_by_state
        state_acs = get_assemblies_by_state(state)
        all_acs = [a for a in state_acs if a.get("pc_name", "").strip().upper() == pc_name]

    # If ac query param was passed, set active_ac_name
    if ac and not active_ac_name:
        active_ac_name = ac.strip()

    # Query works for this constituency
    q_works = db.query(Work).filter(
        (func.upper(Work.mp_constituency) == pc_name) |
        (func.lower(Work.mp_name) == mp_name.lower())
    )

    db_works = q_works.limit(300).all()

    # If we have an active AC name, tag works that match the AC in location/description/district
    works_list = []
    ac_match_lower = active_ac_name.lower() if active_ac_name else None

    sector_counts = {}
    completed_count = 0
    ongoing_count = 0
    total_expenditure = 0.0

    for w in db_works:
        loc = (w.location or "").strip()
        desc = (w.work_description or "").strip()
        cat = (w.category or "Other").strip()
        status = (w.status or "Ongoing").strip()
        cost = float(w.cost or 0.0)
        exp = float(w.total_paid or 0.0)
        total_expenditure += exp

        is_ac_match = False
        if ac_match_lower:
            if ac_match_lower in loc.lower() or ac_match_lower in desc.lower():
                is_ac_match = True

        if "complete" in status.lower():
            completed_count += 1
        else:
            ongoing_count += 1

        sector_counts[cat] = sector_counts.get(cat, 0) + 1

        works_list.append({
            "work_id": str(w.work_id),
            "description": desc,
            "category": cat,
            "sanction_amount": cost,
            "expenditure": exp,
            "status": status,
            "location": loc or (w.district or pc_name),
            "district": w.district or ac_district or "",
            "implementing_agency": w.implementing_agency or "District Authority",
            "matches_active_ac": is_ac_match
        })

    # Red flag stats
    rf = compute_mp_red_flags(mp_name, db)

    # Prepare financial metrics
    allocated = float(row.get("allocatedAmount", 147000000.0))
    used = float(row.get("totalExpenditure", total_expenditure or 0.0))
    util_rate = round(float(row.get("utilizationPercentage", (used / allocated * 100) if allocated > 0 else 0)), 1)
    unspent = float(row.get("unspentAmount", max(0.0, allocated - used)))
    comp_works = int(row.get("completedWorksCount", completed_count))
    recom_works = int(row.get("recommendedWorksCount", len(db_works)))
    comp_rate = round(float(row.get("completionRate", (comp_works / recom_works * 100) if recom_works > 0 else 0)), 1)

    result_data = {
        "constituency_type": "assembly" if (is_ac_view or active_ac_name) else "parliamentary",
        "display_name": active_ac_name if active_ac_name else pc_name,
        "parliamentary_constituency": pc_name,
        "assembly_constituency": active_ac_name,
        "state": state,
        "district": ac_district or str(row.get("district", "")) or pc_name.title(),
        "ac_number": ac_number,
        "representative_mp": {
            "id": mp_id,
            "name": mp_name,
            "house": house,
            "party": party,
            "state": state,
            "constituency": pc_name,
            "term": str(row.get("term", "18th Lok Sabha" if house == "Lok Sabha" else "Rajya Sabha")),
        },
        "financials": {
            "allocated_amount": allocated,
            "total_expenditure": used,
            "unspent_balance": unspent,
            "utilization_percentage": util_rate,
            "completed_works_count": comp_works,
            "recommended_works_count": recom_works,
            "completion_rate": comp_rate,
            "red_flag_percentage": rf.get("redFlagPct", 0.0),
            "red_flag_count": rf.get("redFlagCount", 0)
        },
        "assemblies": [
            {
                "ac_name": a.get("ac_name", ""),
                "ac_no": a.get("ac_no", ""),
                "district": a.get("district", ""),
                "is_active": (a.get("ac_name", "").lower() == (active_ac_name or "").lower())
            }
            for a in all_acs
        ],
        "sector_breakdown": [
            {"category": k, "count": v}
            for k, v in sorted(sector_counts.items(), key=lambda x: x[1], reverse=True)
        ],
        "works": works_list,
        "works_count": len(works_list)
    }

    _constituency_cache[c_key] = result_data
    return EnvelopeResponse(data=result_data, meta=None, warnings=[])
