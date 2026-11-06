"""
Works Router: Provides transactional work mutation and re-auditing endpoints.
Includes standard RFC 8594 Sunset and RFC 9745 Deprecation headers on legacy routes.
"""

from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from webapi.data_service import get_db
from webapi.security import get_authenticated_user, verify_work_authorization
from webapi.models import EnvelopeResponse
from webapi.cache_manager import invalidate_all_aggregates
from mplads_fraud_detection.foundation.schema import Work
from mplads_fraud_detection.auditor.lifecycle_auditor import WorkLifecycleAuditor

router = APIRouter()
auditor = WorkLifecycleAuditor()


class WorkUpdatePayload(BaseModel):
    cost: Optional[float] = Field(None, gt=0)
    status: Optional[str] = None
    completion_date: Optional[date] = None
    recommended_date: Optional[date] = None
    work_description: Optional[str] = None
    total_paid: Optional[float] = Field(None, ge=0)
    has_payments: Optional[bool] = None
    category: Optional[str] = None
    location: Optional[str] = None
    implementing_agency: Optional[str] = None


def _execute_work_update(work_id: int, payload: WorkUpdatePayload, user: dict, db: Session) -> dict:
    """
    Core mutation routine: authorizes user, mutates fields, executes auditor, and flushes caches.
    """
    work = db.query(Work).filter(Work.work_id == work_id).first()
    if not work:
        raise HTTPException(status_code=404, detail=f"Work #{work_id} not found")

    verify_work_authorization(user, work)

    mutations = payload.model_dump(exclude_unset=True)

    # If total_paid is mutated, ensure payment flags stay coherent
    if "total_paid" in mutations and "has_payments" not in mutations:
        paid_val = mutations["total_paid"]
        if paid_val is not None:
            mutations["has_payments"] = bool(paid_val > 0)
            mutations["payment_record_exists"] = True

    for field, val in mutations.items():
        setattr(work, field, val)

    work.updated_at = datetime.now(timezone.utc)

    # Re-audit within transaction
    audit_result = auditor.audit_work(db, work, commit=False)

    work_snapshot = {
        "work_id": work.work_id,
        "cost": float(work.cost or 0.0),
        "status": work.status,
        "work_description": work.work_description,
        "district": work.district,
        "state": work.state,
        "category": work.category,
        "total_paid": float(work.total_paid or 0.0),
        "last_audited_at": work.last_audited_at.isoformat() if work.last_audited_at else None,
        "audit_status": work.audit_status,
        "lifecycle_audit_version": work.lifecycle_audit_version
    }

    try:
        import os
        if not os.getenv("VERCEL"):
            db.commit()
    except Exception as e:
        db.rollback()
        if os.getenv("VERCEL"):
            import logging
            logging.getLogger(__name__).warning("Database commit skipped in read-only serverless environment: %s", e)
        else:
            raise

    # Invalidate all downstream aggregate caches
    invalidate_all_aggregates()

    return {
        "work": work_snapshot,
        "audit": audit_result
    }


@router.patch("/works/{work_id}")
def patch_work(
    work_id: int,
    payload: WorkUpdatePayload,
    user: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """
    Canonical RESTful partial update endpoint for a work record with immediate forensic re-auditing.
    """
    result = _execute_work_update(work_id, payload, user, db)
    return EnvelopeResponse(data=result, meta=None, warnings=[])


@router.post("/works/{work_id}/update")
def post_work_update_deprecated(
    work_id: int,
    payload: WorkUpdatePayload,
    response: Response,
    user: dict = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """
    Deprecated legacy alias for work update.
    Returns standard RFC 8594 Sunset and RFC 9745 Deprecation headers.
    """
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = "Sat, 01 May 2027 00:00:00 GMT"
    response.headers["Link"] = f"</api/works/{work_id}>; rel=\"successor-version\""
    result = _execute_work_update(work_id, payload, user, db)
    return EnvelopeResponse(
        data=result,
        meta=None,
        warnings=["Endpoint POST /api/works/{id}/update is deprecated. Use PATCH /api/works/{id}."]
    )
