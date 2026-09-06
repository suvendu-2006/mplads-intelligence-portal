import math
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from webapi.models import EnvelopeResponse, EntityRiskItem, MetaPagination
from sqlalchemy import func, text
from mplads_fraud_detection.foundation.schema import EntityRisk, Work
from webapi.data_service import get_db, load_mps_csv

router = APIRouter()

_LOCATION_STATE_MAP = None
_MP_STATE_MAP = None

def get_location_map(db: Session):
    global _LOCATION_STATE_MAP
    if _LOCATION_STATE_MAP is None:
        _LOCATION_STATE_MAP = {}
        try:
            rows = db.execute(text("SELECT UPPER(district), UPPER(location), state FROM works GROUP BY UPPER(district), UPPER(location)")).fetchall()
            for dist, loc, st in rows:
                if loc and loc not in _LOCATION_STATE_MAP:
                    _LOCATION_STATE_MAP[loc] = (st, dist.title() if dist else "")
                if dist and dist not in _LOCATION_STATE_MAP:
                    _LOCATION_STATE_MAP[dist] = (st, dist.title() if dist else "")
        except Exception:
            pass
    return _LOCATION_STATE_MAP

def get_mp_map():
    global _MP_STATE_MAP
    if _MP_STATE_MAP is None:
        _MP_STATE_MAP = {}
        try:
            df = load_mps_csv()
            for _, r in df.iterrows():
                mp_name = str(r["mpName"]).strip().upper()
                _MP_STATE_MAP[mp_name] = (str(r.get("state", "")), str(r.get("constituency", "")))
        except Exception:
            pass
    return _MP_STATE_MAP

@router.get("/entity-risks", response_model=EnvelopeResponse[List[EntityRiskItem]])
def list_entity_risks(
    entity_type: str = Query("ida", pattern="^(ida|mp)$"),
    state: Optional[str] = None,
    tier: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(EntityRisk).filter(EntityRisk.entity_type == entity_type)

    if state and state.upper() not in ["ALL", "ALL STATES", "ALL STATES & UNION TERRITORIES"]:
        # EntityRisk has NO state column; resolve state via Work table
        if entity_type == "ida":
            subq = db.query(Work.location).filter(
                func.lower(Work.state) == state.lower()
            ).distinct().scalar_subquery()
            subq2 = db.query(Work.district).filter(
                func.lower(Work.state) == state.lower()
            ).distinct().scalar_subquery()
            query = query.filter((EntityRisk.entity_key.in_(subq)) | (EntityRisk.entity_key.in_(subq2)))
        else:
            subq = db.query(Work.mp_name).filter(
                func.lower(Work.state) == state.lower()
            ).distinct().scalar_subquery()
            query = query.filter(EntityRisk.entity_key.in_(subq))

    if tier:
        query = query.filter(EntityRisk.risk_tier.ilike(f"%{tier}%"))

    try:
        total = query.count()
        total_pages = math.ceil(total / page_size) if total > 0 else 1
        offset = (page - 1) * page_size
        records = query.order_by(EntityRisk.composite_risk.desc()).offset(offset).limit(page_size).all()
    except Exception as e:
        import logging
        logging.getLogger("webapi").warning(f"Entity risks query error: {e}")
        return EnvelopeResponse(
            data=[],
            meta=MetaPagination(total=0, page=page, pageSize=page_size, totalPages=1, hasNext=False, hasPrev=False)
        )

    loc_map = get_location_map(db)
    mp_map = get_mp_map()

    items = []
    for r in records:
        bd = r.breakdown or {}
        det_bd = bd.get("detector_breakdown", {}) if isinstance(bd, dict) else {}

        # Concentration Score (0.0 to 1.0)
        raw_conc = (
            det_bd.get("duplicate_work", {}).get("avg_severity") or
            det_bd.get("bill_splitting", {}).get("avg_severity") or
            det_bd.get("cost_overrun", {}).get("avg_severity") or
            round(min(0.95, (float(r.composite_risk) / 20.0) * 0.85 + 0.12), 2)
        )
        conc_score = round(float(raw_conc), 2)

        # Velocity Score (0.0 to 1.0)
        raw_velo = (
            det_bd.get("timing_anomaly", {}).get("avg_severity") or
            det_bd.get("bulk_completion", {}).get("avg_severity") or
            det_bd.get("delay_violation", {}).get("avg_severity") or
            round(min(0.95, (float(r.composite_risk) / 20.0) * 0.75 + 0.15), 2)
        )
        velo_score = round(float(raw_velo), 2)

        # Pattern Score (0.0 to 1.0)
        raw_patt = (
            det_bd.get("unusual_pattern", {}).get("avg_severity") or
            det_bd.get("plausibility_mismatch", {}).get("avg_severity") or
            det_bd.get("benford_anomaly", {}).get("avg_severity") or
            det_bd.get("vague_description", {}).get("avg_severity") or
            round(min(0.95, (float(r.composite_risk) / 20.0) * 0.90 + 0.08), 2)
        )
        patt_score = round(float(raw_patt), 2)

        # Resolve state & district/constituency
        key_upper = r.entity_key.strip().upper()
        if r.entity_type == "ida":
            loc_info = loc_map.get(key_upper, ("", key_upper.title()))
            res_state = loc_info[0] or state or ""
            res_dist = loc_info[1] or key_upper.title()
            entity_name = f"{r.entity_key} Implementing Development Agency"
        else:
            mp_info = mp_map.get(key_upper, ("", ""))
            res_state = mp_info[0] or state or ""
            res_dist = mp_info[1] or "Parliamentary Portfolio"
            entity_name = f"Hon. MP {r.entity_key.title()}"

        items.append(EntityRiskItem(
            entity_type=r.entity_type,
            entity_key=r.entity_key,
            composite_risk=float(r.composite_risk),
            composite_risk_score=float(r.composite_risk),
            risk_tier=r.risk_tier,
            risk_rank=int(r.risk_rank),
            breakdown=bd,
            entity_name=entity_name,
            state=res_state,
            district=res_dist,
            concentration_score=conc_score,
            velocity_score=velo_score,
            pattern_score=patt_score
        ))

    meta = MetaPagination(
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1
    )

    return EnvelopeResponse(data=items, meta=meta, warnings=[])
