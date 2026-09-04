from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List, Dict, Any
import json
import math

from webapi.models import EnvelopeResponse, MetaPagination
from webapi.data_service import get_db, load_districts_csv
from webapi.config import DETECTOR_NAMES, get_tier

router = APIRouter()

@router.get("/districts")
def list_districts(
    q: Optional[str] = Query(None, description="Search district name"),
    state: Optional[str] = Query(None, description="Filter by state"),
    sort: str = Query("total_works", description="Sort field: total_works, completion_rate, district"),
    order: str = Query("desc", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    df = load_districts_csv().copy()

    # Apply state filter
    if state and state.lower() != "all":
        df = df[df["state"].str.lower() == state.lower()]

    # Apply search filter
    if q:
        df = df[df["district_nodal"].str.contains(q, case=False, na=False) | df["state"].str.contains(q, case=False, na=False)]

    # Batch query anomalies count by district from SQLite (joined via works)
    try:
        anom_rows = db.execute(text("""
            SELECT UPPER(w.district), count(a.anomaly_id)
            FROM anomalies a
            JOIN works w ON a.work_id = w.work_id
            GROUP BY UPPER(w.district)
        """)).fetchall()
        anom_map = {row[0]: int(row[1]) for row in anom_rows if row[0]}
    except Exception:
        anom_map = {}

    # Batch query works cost by district from SQLite
    try:
        cost_rows = db.execute(text("SELECT UPPER(district), sum(cost) FROM works GROUP BY UPPER(district)")).fetchall()
        cost_map = {row[0]: float(row[1] or 0) for row in cost_rows if row[0]}
    except Exception:
        cost_map = {}

    # Batch query true works count by district from SQLite
    try:
        works_cnt_rows = db.execute(text("SELECT UPPER(district), count(*) FROM works GROUP BY UPPER(district)")).fetchall()
        works_cnt_map = {row[0]: int(row[1] or 0) for row in works_cnt_rows if row[0]}
    except Exception:
        works_cnt_map = {}

    records = []
    for _, r in df.iterrows():
        d_name = str(r.get("district_nodal", "")).strip()
        st_name = str(r.get("state", "")).strip()
        csv_tot_works = int(r.get("total_works", 0) or 0)
        completed = int(r.get("completed_works_count", 0) or 0)
        completion_pct = float(r.get("completion_rate_pct", 0.0) or 0.0)
        
        # Aggregate candidates
        consts = [c.strip().upper() for c in str(r.get("constituencies_covered", "")).split(",") if c.strip() and c.strip() != "Sitting Rajya Sabha"]
        
        # Check direct district match first
        if d_name.upper() in works_cnt_map and works_cnt_map[d_name.upper()] > 0:
            target_keys = [d_name.upper()]
        else:
            target_keys = list(set([d_name.upper()] + consts))

        # Real anomaly count
        anomaly_count = sum(anom_map.get(k, 0) for k in target_keys)

        # Portfolio value from DB or estimate
        db_cost = sum(cost_map.get(k, 0.0) for k in target_keys)
        db_works_cnt = sum(works_cnt_map.get(k, 0) for k in target_keys)
        
        effective_works = db_works_cnt if db_works_cnt > 0 else csv_tot_works
        is_estimated = (db_cost == 0.0 and effective_works > 0)
        portfolio = db_cost if db_cost > 0 else float(effective_works * 2500000.0)

        records.append({
            "district": d_name,
            "state": st_name,
            "totalWorks": effective_works,
            "completedWorks": completed,
            "recommendedWorks": int(r.get("recommended_works_count", 0) or 0),
            "completionRate": completion_pct,
            "portfolioValue": portfolio,
            "is_estimated": is_estimated,
            "isEstimated": is_estimated,
            "mpCount": int(r.get("mp_count", 0) or 1),
            "activeMps": str(r.get("mps_active", "") or ""),
            "constituencies": str(r.get("constituencies_covered", "") or ""),
            "primarySector": str(r.get("primary_sector", "Normal/Others") or "Civil Infrastructure"),
            "anomalyCount": anomaly_count
        })

    # Sort
    reverse = (order.lower() == "desc")
    if sort == "district":
        records.sort(key=lambda x: x["district"].lower(), reverse=reverse)
    elif sort == "completion_rate":
        records.sort(key=lambda x: x["completionRate"], reverse=reverse)
    elif sort == "portfolio":
        records.sort(key=lambda x: x["portfolioValue"], reverse=reverse)
    elif sort == "anomalies":
        records.sort(key=lambda x: x["anomalyCount"], reverse=reverse)
    else:
        records.sort(key=lambda x: x["totalWorks"], reverse=reverse)

    total_records = len(records)
    total_pages = math.ceil(total_records / page_size) if total_records > 0 else 1
    start_idx = (page - 1) * page_size
    paged_records = records[start_idx : start_idx + page_size]

    meta = MetaPagination(
        page=page,
        page_size=page_size,
        total=total_records,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1
    )

    return EnvelopeResponse(data=paged_records, meta=meta, warnings=[])


@router.get("/districts/{district_name}")
def get_district_detail(district_name: str, db: Session = Depends(get_db)):
    df = load_districts_csv()
    match = df[df["district_nodal"].str.lower() == district_name.lower()]

    if match.empty:
        # Check substring match in district_nodal
        match = df[df["district_nodal"].str.contains(district_name, case=False, na=False)]

    if match.empty:
        # Check if district_name is inside constituencies_covered
        match = df[df["constituencies_covered"].str.contains(district_name, case=False, na=False)]

    if not match.empty:
        row = match.iloc[0]
        d_name = str(row["district_nodal"]).strip()
        st_name = str(row["state"]).strip()
        csv_tot_works = int(row.get("total_works", 0) or 0)
        completed = int(row.get("completed_works_count", 0) or 0)
        completion_pct = float(row.get("completion_rate_pct", 0.0) or 0.0)
        consts = [c.strip().upper() for c in str(row.get("constituencies_covered", "")).split(",") if c.strip() and c.strip() != "Sitting Rajya Sabha"]
    else:
        # Check directly in SQLite works table
        st_row = db.execute(text("SELECT state, count(*) FROM works WHERE UPPER(district) = :d GROUP BY state"), {"d": district_name.upper()}).fetchone()
        if not st_row:
            raise HTTPException(status_code=404, detail=f"District '{district_name}' not found in master records.")
        d_name = district_name.upper()
        st_name = st_row[0]
        csv_tot_works = int(st_row[1])
        completed = csv_tot_works
        completion_pct = 100.0
        consts = []
        row = {}

    # Scoping: If direct district works exist in DB, scope directly to avoid over-joining neighboring constituencies
    direct_cnt_row = db.execute(text("SELECT count(*) FROM works WHERE UPPER(district) = :d"), {"d": d_name.upper()}).fetchone()
    direct_cnt = direct_cnt_row[0] if direct_cnt_row else 0

    if direct_cnt > 0:
        cands = [d_name.upper()]
        scope_note = "Direct District Records"
    else:
        cands = list(set([d_name.upper(), district_name.upper()] + consts))
        scope_note = f"Constituency Aggregation ({', '.join(consts)})" if consts else "Direct District Records"

    # Build SQL filter for all target candidates
    cand_clause = " OR ".join(["UPPER(district) = :c_" + str(i) + " OR UPPER(COALESCE(mp_constituency, '')) = :c_" + str(i) for i in range(len(cands))])
    anom_clause = " OR ".join(["UPPER(w.district) = :c_" + str(i) + " OR UPPER(COALESCE(w.mp_constituency, '')) = :c_" + str(i) for i in range(len(cands))])
    params = {"c_" + str(i): cands[i] for i in range(len(cands))}

    # True un-capped works count & portfolio cost from DB
    works_stat_row = db.execute(text(f"SELECT count(*), sum(cost) FROM works WHERE ({cand_clause})"), params).fetchone()
    true_works_count = int(works_stat_row[0] or 0)
    true_cost_db = float(works_stat_row[1] or 0.0)

    effective_total_works = true_works_count if true_works_count > 0 else csv_tot_works
    is_estimated = (true_cost_db == 0.0 and effective_total_works > 0)
    portfolio = true_cost_db if true_cost_db > 0 else float(effective_total_works * 2500000.0)

    # True un-capped anomalies count from DB
    anom_stat_row = db.execute(text(f"SELECT count(a.anomaly_id) FROM anomalies a JOIN works w ON a.work_id = w.work_id WHERE ({anom_clause})"), params).fetchone()
    true_anom_count = int(anom_stat_row[0] or 0)

    # Sample works list from SQLite for display (capped at 250 for responsive UI)
    works_query = text(f"""
        SELECT work_id, work_description, cost, category, mp_name, mp_constituency, status, completion_date
        FROM works
        WHERE ({cand_clause})
        ORDER BY cost DESC
        LIMIT 250
    """)
    works_rows = db.execute(works_query, params).fetchall()
    
    works_list = [
        {
            "workId": r[0],
            "workDescription": r[1],
            "cost": float(r[2] or 0),
            "category": r[3] or "Civil Works",
            "mpName": r[4] or "Constituency MP",
            "constituency": r[5] or d_name,
            "status": "Completed" if "completed" in str(r[6] or "").lower() else "Recommended",
            "completionDate": str(r[7]) if r[7] else None
        }
        for r in works_rows
    ]

    # Sample anomalies from SQLite (capped at 50 for display)
    anom_query = text(f"""
        SELECT a.work_id, a.detector_type, a.severity, a.explanation,
               w.work_description, w.cost, w.mp_name
        FROM anomalies a
        JOIN works w ON a.work_id = w.work_id
        WHERE ({anom_clause})
        ORDER BY a.severity DESC, w.cost DESC
        LIMIT 50
    """)
    try:
        anom_rows = db.execute(anom_query, params).fetchall()
        anomalies_list = [
            {
                "workId": r[0],
                "work_id": r[0],
                "detectorType": r[1],
                "detector": DETECTOR_NAMES.get(r[1], r[1] or "Cost Overrun Analysis"),
                "detectorName": DETECTOR_NAMES.get(r[1], r[1] or "Cost Overrun Analysis"),
                "detector_name": DETECTOR_NAMES.get(r[1], r[1] or "Cost Overrun Analysis"),
                "severity": float(r[2] or 0.7),
                "tier": get_tier(float(r[2] or 0.7)),
                "explanation": r[3] or "Cost anomaly detected",
                "workDescription": r[4],
                "work_description": r[4],
                "description": r[4],
                "cost": float(r[5] or 0),
                "sanctionedCost": float(r[5] or 0),
                "mpName": r[6],
                "mp_name": r[6]
            }
            for r in anom_rows
        ]
    except Exception as e:
        print(f"Error fetching district anomalies: {e}")
        anomalies_list = []

    # Real IDAs from entity_risks table (matching actual schema: entity_key, composite_risk, risk_tier, risk_rank, breakdown)
    all_ida_cands = list(set([d_name.upper(), district_name.upper()] + consts))
    ida_placeholders = ", ".join([f":ida_{i}" for i in range(len(all_ida_cands))])
    ida_params = {f"ida_{i}": all_ida_cands[i] for i in range(len(all_ida_cands))}
    ida_query = text(f"""
        SELECT entity_key, composite_risk, risk_tier, risk_rank, breakdown
        FROM entity_risks
        WHERE entity_type = 'ida' AND UPPER(entity_key) IN ({ida_placeholders})
        ORDER BY composite_risk DESC
        LIMIT 20
    """)
    try:
        ida_rows = db.execute(ida_query, ida_params).fetchall()
        idas_list = []
        for r in ida_rows:
            k_name = str(r[0])
            comp_risk = float(r[1] or 0.0)
            rt = str(r[2] or "Clean")
            rr = int(r[3] or 0)
            bd = json.loads(r[4]) if r[4] else {}
            det_bd = bd.get("detector_breakdown", {})
            
            conc = det_bd.get("cost_overrun", {}).get("avg_severity", 0.5)
            velo = det_bd.get("bulk_completion", {}).get("avg_severity", 0.5)
            patt = det_bd.get("plausibility_mismatch", {}).get("avg_severity", 0.5)
            
            idas_list.append({
                "entityId": k_name,
                "entity_key": k_name,
                "name": f"{k_name} Implementing Development Agency",
                "compositeRiskScore": comp_risk,
                "composite_risk": comp_risk,
                "riskTier": rt,
                "risk_tier": rt,
                "riskRank": rr,
                "breakdown": bd,
                "concentrationScore": float(conc),
                "velocityScore": float(velo),
                "patternScore": float(patt),
                "totalWorks": bd.get("total_works", 0),
                "flaggedWorks": bd.get("unique_flagged_works", 0)
            })

        # If no specific agency row matches, synthesize from district authority data
        if not idas_list and effective_total_works > 0:
            avg_sev = (sum(a["severity"] for a in anomalies_list) / len(anomalies_list)) if anomalies_list else 0.0
            tier_label = "Critical" if avg_sev > 0.8 else ("High" if avg_sev > 0.6 else ("Medium" if avg_sev > 0.3 else "Clean"))
            idas_list.append({
                "entityId": f"{d_name}_DRDA",
                "entity_key": d_name,
                "name": f"{d_name} District Rural Development Agency (DRDA)",
                "compositeRiskScore": round(avg_sev * 15.0, 2),
                "composite_risk": round(avg_sev * 15.0, 2),
                "riskTier": tier_label,
                "risk_tier": tier_label,
                "riskRank": 100,
                "breakdown": {"total_works": effective_total_works, "flagged_works": len(anomalies_list)},
                "concentrationScore": 0.5,
                "velocityScore": 0.5,
                "patternScore": 0.5,
                "totalWorks": effective_total_works,
                "flaggedWorks": len(anomalies_list)
            })
    except Exception as e:
        print(f"Error fetching district IDAs: {e}")
        idas_list = []

    summary_data = {
        "district": d_name,
        "state": st_name,
        "totalWorks": effective_total_works,
        "completedWorks": completed if completed > 0 else effective_total_works,
        "recommendedWorks": int(row.get("recommended_works_count", 0) or effective_total_works),
        "completionRate": completion_pct,
        "portfolioValue": portfolio,
        "is_estimated": is_estimated,
        "isEstimated": is_estimated,
        "mpCount": int(row.get("mp_count", 0) or 1),
        "activeMps": str(row.get("mps_active", "") or ""),
        "constituencies": str(row.get("constituencies_covered", "") or ""),
        "primarySector": str(row.get("primary_sector", "Normal/Others") or "Civil Infrastructure"),
        "worksCount": effective_total_works,
        "sampleWorksCount": len(works_list),
        "anomalyCount": true_anom_count,
        "sampleAnomaliesCount": len(anomalies_list),
        "idaCount": len(idas_list),
        "scope": scope_note
    }

    return EnvelopeResponse(
        data={
            "summary": summary_data,
            "works": works_list,
            "anomalies": anomalies_list,
            "idas": idas_list
        },
        meta=None,
        warnings=[]
    )
