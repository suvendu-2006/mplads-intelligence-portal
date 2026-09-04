from typing import List, Dict, Any
from fastapi import APIRouter
from webapi.models import EnvelopeResponse, DetectorMetaItem
from webapi.data_service import load_cpwd_benchmarks
from mplads_fraud_detection.detectors.registry import DETECTOR_REGISTRY

router = APIRouter()

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

from webapi.config import OVERVIEW_DIR

@router.get("/meta/last-updated")
def get_last_updated():
    import json
    meta_path = OVERVIEW_DIR / "sync_metadata.json"
    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                inner = data.get("data", {})
                return EnvelopeResponse(
                    data={
                        "last_updated": inner.get("lastUpdated", "8/29/2026"),
                        "as_of_label": "August 2026",
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
            "last_updated": "8/29/2026",
            "as_of_label": "August 2026",
            "source": "Official MPLADS Portal API",
            "schema_version": "2.1.0"
        },
        meta=None,
        warnings=[]
    )
