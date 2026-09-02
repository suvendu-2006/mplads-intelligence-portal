"""
Database Session and Lifecycle Manager for MPLADS Fraud Detection System.
Provides connection pooling, SQLite foreign key enforcement, and atomic snapshot purging.
"""

from contextlib import contextmanager
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from mplads_fraud_detection.config import DATABASE_URL
from mplads_fraud_detection.foundation.schema import Base, PipelineRun, Anomaly, ReviewQueueItem, EntityRisk

# Create Engine with connection arguments
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    connect_args["timeout"] = 30.0

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
    pool_pre_ping=True
)

# Enable Foreign Key Constraints, WAL Mode, and Busy Timeout for SQLite
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """
    Ensures database schema is initialized and verifies schema completeness.
    In staging and production, schema MUST be managed via Alembic migrations.
    Direct create_all() is permitted only in local development/isolated testing.
    """
    import logging
    from sqlalchemy import inspect
    from mplads_fraud_detection.settings import settings
    logger = logging.getLogger("mplads_db")

    if settings.APP_ENV not in ("production", "staging"):
        Base.metadata.create_all(bind=engine)

    # Verify critical tables exist
    inspector = inspect(engine)
    required_tables = [
        'works', 'fraud_labels', 'label_history',
        'anomalies', 'pipeline_runs', 'users', 'audit_logs'
    ]

    existing_tables = inspector.get_table_names()
    missing_tables = [t for t in required_tables if t not in existing_tables]

    if missing_tables and settings.APP_ENV in ("staging", "production"):
        raise RuntimeError(
            f"Database schema incomplete. Missing tables: {missing_tables}. "
            f"Run 'alembic upgrade head' to initialize schema."
        )

    if missing_tables:
        logger.warning(f"Missing tables in development database: {missing_tables}")


@contextmanager
def get_db():
    """Provide a transactional database session."""
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def purge_prior_snapshot_runs(session: Session, run_key: str, current_run_id: str):
    """
    Purge previous runs sharing the same run_key to guarantee strict idempotency.
    Deletes related anomalies, review queue items, and entity risks before re-running.
    """
    stale_runs = session.query(PipelineRun).filter(
        PipelineRun.run_key == run_key,
        PipelineRun.run_id != current_run_id
    ).all()

    for stale_run in stale_runs:
        stale_id = stale_run.run_id
        session.query(Anomaly).filter(Anomaly.run_id == stale_id).delete(synchronize_session=False)
        session.query(ReviewQueueItem).filter(ReviewQueueItem.run_id == stale_id).delete(synchronize_session=False)
        session.query(EntityRisk).filter(EntityRisk.run_id == stale_id).delete(synchronize_session=False)
        session.delete(stale_run)

    session.flush()
