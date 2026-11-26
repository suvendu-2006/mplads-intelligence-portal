from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from webapi.models import EnvelopeResponse, DetectorMetaItem
from webapi.data_service import load_cpwd_benchmarks, get_db
from mplads_fraud_detection.detectors.registry import DETECTOR_REGISTRY
from mplads_fraud_detection.foundation.schema import Work, Anomaly

router = APIRouter()

@router.get("/meta/health", response_model=EnvelopeResponse[Dict[str, Any]])
def health_check(db: Session = Depends(get_db)):
    """Verify database connectivity and return live record counts for health probes."""
    try:
        works_count = db.query(Work).count()
        anomalies_count = db.query(Anomaly).count()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database health check failed: {exc}") from exc

    return EnvelopeResponse(
        data={
            "status": "healthy",
            "database": "ok",
            "works_count": works_count,
            "anomalies_count": anomalies_count,
        },
        meta=None,
        warnings=[],
    )

@router.get("/meta/detectors", response_model=EnvelopeResponse[List[DetectorMetaItem]])
def list_detectors_meta():
    items = []
    for key, info in DETECTOR_REGISTRY.items():
        items.append(DetectorMetaItem(
            detector_id=info.detector_id,
            name=info.name,
            status=info.status.value,
            regulatory_source=info.regulatory_source,
            assumptions="; ".join(info.assumptions),
            limitations="; ".join(info.known_limitations)
        ))
    return EnvelopeResponse(data=items, meta=None, warnings=[])

@router.get("/meta/cpwd-benchmarks", response_model=EnvelopeResponse[List[Dict[str, Any]]])
def list_cpwd_benchmarks():
    df = load_cpwd_benchmarks()
    records = df.to_dict(orient="records")
    return EnvelopeResponse(data=records, meta=None, warnings=[])

from pathlib import Path
from webapi.config import OVERVIEW_DIR, BASE_DIR

@router.get("/meta/last-updated")
def get_last_updated():
    import json
    candidates = [
        OVERVIEW_DIR / "sync_metadata.json",
        BASE_DIR / "api" / "data" / "sync_metadata.json",
        Path("/var/task/api/data/sync_metadata.json"),
    ]
    meta_path = next((p for p in candidates if p.exists() and p.is_file()), None)
    if meta_path:
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                inner = data.get("data", {})
                return EnvelopeResponse(
                    data={
                        "last_updated": inner.get("lastUpdated", "18/11/2026"),
                        "as_of_label": "November 2026",
                        "source": inner.get("source", "Official MPLADS Portal API"),
                        "data_quality": inner.get("dataQuality", 98),
                        "total_records": inner.get("totalRecords", 294155)
                    },
                    meta=None,
                    warnings=[]
                )
        except Exception:
            pass
    return EnvelopeResponse(
        data={
            "last_updated": "18/11/2026",
            "as_of_label": "November 2026",
            "source": "Official MPLADS Portal API",
            "schema_version": "2.1.0"
        },
        meta=None,
        warnings=[]
    )


@router.post("/meta/clear-cache")
def clear_backend_caches():
    import gc
    from webapi.routers import mps, flags, states, districts, constituencies, entity_risks, map as map_router, national

    cleared = []
    if hasattr(mps, "_mps_cache"):
        mps._mps_cache.clear()
        cleared.append("mps")
    if hasattr(mps, "_mp_detail_cache"):
        mps._mp_detail_cache.clear()
        cleared.append("mp_detail")
    if hasattr(flags, "_flags_cache"):
        flags._flags_cache.clear()
        cleared.append("flags")
    if hasattr(states, "_states_cache"):
        states._states_cache.clear()
        cleared.append("states")
    if hasattr(states, "_state_detail_cache"):
        states._state_detail_cache.clear()
        cleared.append("state_detail")
    if hasattr(districts, "_districts_cache"):
        districts._districts_cache.clear()
        cleared.append("districts")
    if hasattr(districts, "_district_detail_cache"):
        districts._district_detail_cache.clear()
        cleared.append("district_detail")
    if hasattr(districts, "_districts_maps_cache"):
        districts._districts_maps_cache = None
        cleared.append("district_maps")
    if hasattr(constituencies, "_constituency_cache"):
        constituencies._constituency_cache.clear()
        cleared.append("constituencies")
    if hasattr(entity_risks, "_LOCATION_STATE_MAP"):
        entity_risks._LOCATION_STATE_MAP = None
        cleared.append("location_map")
    if hasattr(entity_risks, "_MP_STATE_MAP"):
        entity_risks._MP_STATE_MAP = None
        cleared.append("mp_state_map")
    if hasattr(map_router, "_districts_geojson_cache"):
        map_router._districts_geojson_cache = None
        cleared.append("districts_geojson")
    if hasattr(map_router, "_pcs_geojson_cache"):
        map_router._pcs_geojson_cache = None
        cleared.append("pcs_geojson")
    if hasattr(national, "_cached_analytics"):
        national._cached_analytics = None
        cleared.append("national_analytics")

    gc.collect()

    return EnvelopeResponse(
        data={
            "status": "cleared",
            "caches_purged": cleared,
            "message": "All backend in-memory caches successfully purged."
        },
        meta=None,
        warnings=[]
    )
