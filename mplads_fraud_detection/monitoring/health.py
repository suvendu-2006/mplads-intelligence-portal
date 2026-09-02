"""
Health & Readiness Monitoring Endpoints for MPLADS Forensic Audit Platform.
"""

from datetime import datetime, timezone
from sqlalchemy import text
from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import Work, IngestionRun
from mplads_fraud_detection.settings import settings


def get_health_status() -> dict:
    """Comprehensive system health and readiness check."""
    session = SessionLocal()
    try:
        # Database connectivity check
        session.execute(text("SELECT 1"))

        # Data freshness
        latest_ingestion = session.query(IngestionRun).order_by(
            IngestionRun.started_at.desc()
        ).first()

        work_count = session.query(Work).count()

        return {
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "app_env": settings.APP_ENV,
            "database": {
                "connected": True,
                "dialect": session.bind.dialect.name,
                "work_count": work_count
            },
            "ml_enabled": settings.ML_PREDICTIONS_ENABLED,
            "last_ingestion": latest_ingestion.started_at.isoformat() if latest_ingestion else None
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    finally:
        session.close()


if __name__ == "__main__":
    import json
    print(json.dumps(get_health_status(), indent=2))
