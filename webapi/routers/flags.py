import math
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from webapi.models import EnvelopeResponse, FlagItem, MetaPagination
from webapi.data_service import get_db
from webapi.config import DETECTOR_NAMES, get_tier, resolve_detector_type
from webapi.aggregators import compute_cpwd_comparison
from webapi.export import stream_flags_csv
from mplads_fraud_detection.foundation.schema import Work, Anomaly

router = APIRouter()

_flags_cache: dict = {}

@router.get("/flags", response_model=EnvelopeResponse[List[FlagItem]])
def list_all_flags(
    state: Optional[str] = None,
    district: Optional[str] = None,
    tier: Optional[str] = None,
    detector: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    resolved_detector = resolve_detector_type(detector)
    cache_key = f"{state}_{district}_{tier}_{resolved_detector}_{q}_{page}_{page_size}".lower()
    if cache_key in _flags_cache:
        return _flags_cache[cache_key]

    query = db.query(Anomaly, Work).join(Work, Anomaly.work_id == Work.work_id)

    if state:
        query = query.filter(func.lower(Work.state) == state.lower())
    if district:
        query = query.filter(func.lower(Work.district) == district.lower())
    if resolved_detector:
        query = query.filter(func.lower(Anomaly.detector_type) == resolved_detector.lower())
    if tier:
        tier_l = tier.lower()
        if tier_l == "red":
            query = query.filter(Anomaly.severity >= 0.70)
        elif tier_l == "orange":
            query = query.filter(Anomaly.severity >= 0.50, Anomaly.severity < 0.70)
        elif tier_l == "yellow":
            query = query.filter(Anomaly.severity >= 0.30, Anomaly.severity < 0.50)
        elif tier_l == "green":
            query = query.filter(Anomaly.severity < 0.30)
    if q:
        q_clean = q.strip()
        if q_clean.isdigit():
            query = query.filter(Work.work_id == int(q_clean))
        else:
            query = query.filter(
                Work.work_description.ilike(f"%{q_clean}%") |
                Work.mp_name.ilike(f"%{q_clean}%") |
                Work.district.ilike(f"%{q_clean}%")
            )

    try:
        total = query.count()
        total_pages = math.ceil(total / page_size) if total > 0 else 1
        offset = (page - 1) * page_size
        records = query.order_by(Anomaly.severity.desc(), Work.cost.desc(), Work.work_id.desc()).offset(offset).limit(page_size).all()
    except Exception as e:
        import logging
        logging.getLogger("webapi").warning(f"Flags query error: {e}")
        return EnvelopeResponse(
            data=[],
            meta=MetaPagination(total=0, page=page, pageSize=page_size, totalPages=1, hasNext=False, hasPrev=False)
        )

    items = []
    for anom, w in records:
        sev = float(anom.severity)
        cpwd = compute_cpwd_comparison(
            work_cost=float(w.cost or 0.0),
            description=w.work_description or "",
            category=w.category,
            evidence=anom.evidence or {}
        )
        dist_display = (w.district or "").strip()
        if not dist_display or dist_display.lower() in ["sitting rajya sabha", "rajya sabha"]:
            clean_mp = w.mp_name.split('(')[0].strip() if w.mp_name else "Rajya Sabha"
            dist_display = f"Statewide ({clean_mp})"

        items.append(FlagItem(
            work_id=w.work_id,
            work_description=w.work_description or "",
            cost=float(w.cost or 0.0),
            category=w.category or "General",
            district=dist_display,
            state=w.state or "",
            mp_name=w.mp_name or "",
            constituency=w.mp_constituency or "",
            detector_type=anom.detector_type,
            detector_name=DETECTOR_NAMES.get(anom.detector_type, anom.detector_type),
            severity=sev,
            tier=get_tier(sev),
            explanation=anom.explanation or "",
            evidence=anom.evidence or {},
            detected_at=anom.detected_at.isoformat() if anom.detected_at else "",
            cpwd_comparison=cpwd
        ))

    meta = MetaPagination(
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1
    )

    resp = EnvelopeResponse(data=items, meta=meta, warnings=[])
    _flags_cache[cache_key] = resp
    return resp

@router.get("/flags/export")
def export_flags(
    state: Optional[str] = None,
    district: Optional[str] = None,
    tier: Optional[str] = None,
    detector: Optional[str] = None,
    db: Session = Depends(get_db)
):
    resolved_detector = resolve_detector_type(detector)
    return stream_flags_csv(
        db=db,
        state=state,
        district=district,
        tier=tier,
        detector=resolved_detector
    )
