import csv
import json
from io import StringIO
from typing import Optional, Generator
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from mplads_fraud_detection.foundation.schema import Work, Anomaly
from webapi.config import DETECTOR_NAMES, get_tier, resolve_detector_type

def stream_flags_csv(
    db: Session,
    state: Optional[str] = None,
    district: Optional[str] = None,
    tier: Optional[str] = None,
    detector: Optional[str] = None
) -> StreamingResponse:
    def generate() -> Generator[str, None, None]:
        yield "\ufeff"
        output = StringIO()
        fieldnames = [
            "work_id", "work_description", "cost_inr", "district", "state",
            "mp_name", "constituency", "detector_type", "detector_name",
            "severity", "tier", "explanation", "evidence_json", "detected_at"
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        query = db.query(Anomaly, Work).join(Work, Anomaly.work_id == Work.work_id)

        if state:
            query = query.filter(func.lower(Work.state) == state.lower())
        if district:
            query = query.filter(func.lower(Work.district) == district.lower())
        resolved_detector = resolve_detector_type(detector)
        if resolved_detector:
            query = query.filter(func.lower(Anomaly.detector_type) == resolved_detector.lower())
        if tier:
            tier_lower = tier.lower()
            if tier_lower == "red":
                query = query.filter(Anomaly.severity >= 0.70)
            elif tier_lower == "orange":
                query = query.filter(Anomaly.severity >= 0.50, Anomaly.severity < 0.70)
            elif tier_lower == "yellow":
                query = query.filter(Anomaly.severity >= 0.30, Anomaly.severity < 0.50)
            elif tier_lower == "green":
                query = query.filter(Anomaly.severity < 0.30)

        query = query.order_by(Anomaly.severity.desc())

        # Process in batches of 200
        batch_size = 200
        offset = 0
        while True:
            batch = query.offset(offset).limit(batch_size).all()
            if not batch:
                break
            for anomaly, work in batch:
                sev = float(anomaly.severity)
                row_data = {
                    "work_id": work.work_id,
                    "work_description": work.work_description or "",
                    "cost_inr": work.cost or 0.0,
                    "district": work.district or "",
                    "state": work.state or "",
                    "mp_name": work.mp_name or "",
                    "constituency": work.mp_constituency or "",
                    "detector_type": anomaly.detector_type,
                    "detector_name": DETECTOR_NAMES.get(anomaly.detector_type, anomaly.detector_type),
                    "severity": sev,
                    "tier": get_tier(sev).upper(),
                    "explanation": anomaly.explanation or "",
                    "evidence_json": json.dumps(anomaly.evidence or {}),
                    "detected_at": anomaly.detected_at.isoformat() if anomaly.detected_at else ""
                }
                writer.writerow(row_data)
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)
            offset += batch_size

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=mplads_forensic_flags.csv"}
    )
