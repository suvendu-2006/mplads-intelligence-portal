"""
Pytest configuration and shared test fixtures.
Guarantees tests execute against an isolated temporary in-memory database to prevent modifying real data.
"""

import os
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from mplads_fraud_detection.foundation.schema import Base


@pytest.fixture(scope="function")
def isolated_test_db(tmp_path):
    """Provides a fresh, isolated temporary SQLite database for each test function."""
    db_file = tmp_path / "test_isolated_mplads.db"
    test_db_url = f"sqlite:///{db_file}"
    
    test_engine = create_engine(
        test_db_url,
        connect_args={"check_same_thread": False, "timeout": 15.0}
    )

    @event.listens_for(test_engine, "connect")
    def set_test_pragmas(dbapi_conn, conn_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    Base.metadata.create_all(bind=test_engine)
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    
    session = TestSessionLocal()
    try:
        yield session, test_engine
    finally:
        session.close()
        test_engine.dispose()
