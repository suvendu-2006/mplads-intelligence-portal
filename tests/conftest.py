"""
Pytest configuration and shared test fixtures.
Guarantees tests execute against an isolated temporary database to prevent modifying operational data.
Uses SQLite native atomic backup API to ensure 100% crash-safe, clean database cloning.
"""

import os
import sqlite3
import tempfile
from pathlib import Path

# Set up isolated test database BEFORE any application modules are imported
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEV_DB_PATH = PROJECT_ROOT / "mplads_dev.db"
if not DEV_DB_PATH.exists() and (PROJECT_ROOT / "api" / "mplads_dev.db").exists():
    DEV_DB_PATH = PROJECT_ROOT / "api" / "mplads_dev.db"

TEST_DB_PATH = Path(tempfile.gettempdir()) / "test_mplads_isolated.db"

# Ensure fresh, clean, atomic copy for the test session
if TEST_DB_PATH.exists():
    try:
        TEST_DB_PATH.unlink()
    except OSError:
        pass

if DEV_DB_PATH.exists():
    with sqlite3.connect(str(DEV_DB_PATH)) as src, sqlite3.connect(str(TEST_DB_PATH)) as dst:
        src.backup(dst)

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from mplads_fraud_detection.foundation.schema import Base


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_database():
    """Yield during test execution, then clean up test database file."""
    yield
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except OSError:
            pass


@pytest.fixture(scope="function")
def isolated_test_db(tmp_path):
    """Provides a fresh, isolated temporary SQLite database for each individual test function."""
    db_file = tmp_path / "test_isolated_func.db"
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
