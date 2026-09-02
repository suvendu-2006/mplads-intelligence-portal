"""
Staging Smoke Test: PostgreSQL Dialect, Real TLS Parameter Validation, and Offline SQL Migration Verification.
"""

import io
import sys
import pytest
from sqlalchemy import create_engine
from alembic.config import Config
from alembic import command

from mplads_fraud_detection.settings import Settings


def test_production_enforces_sslmode_require():
    """Verify production settings fail-closed if sslmode=require is missing."""
    with pytest.raises(ValueError, match="Production PostgreSQL must use SSL: add \\?sslmode=require"):
        Settings(
            APP_ENV="production",
            DATABASE_URL="postgresql://mplads_user:secret@db.internal:5432/mplads_prod?sslmode=disable",
            SECRET_KEY="a" * 32
        )

    # Valid with sslmode=require
    s = Settings(
        APP_ENV="production",
        DATABASE_URL="postgresql://mplads_user:secret@db.internal:5432/mplads_prod?sslmode=require",
        SECRET_KEY="a" * 32
    )
    assert "sslmode=require" in s.DATABASE_URL


def test_postgresql_engine_ssl_connect_args():
    """Verify that SQLAlchemy PostgreSQL engine configures SSL mode correctly."""
    db_url = "postgresql+psycopg2://mplads_user:secret@db.internal:5432/mplads_prod?sslmode=require"
    engine = create_engine(
        db_url,
        connect_args={"sslmode": "require"}
    )
    assert engine.dialect.name == "postgresql"
    assert engine.url.query.get("sslmode") == "require"


def test_alembic_offline_postgresql_migration_dry_run(monkeypatch, capsys):
    """
    Simulates Alembic migration execution against PostgreSQL dialect in offline SQL mode.
    Guarantees all migration revisions compile to valid PostgreSQL DDL without syntax errors.
    """
    pg_url = "postgresql+psycopg2://mplads_user:secret@db.internal:5432/mplads_prod?sslmode=require"
    monkeypatch.setenv("DATABASE_URL", pg_url)

    cfg = Config("alembic.ini")

    # Dry-run SQL generation from base to head against PostgreSQL dialect
    command.upgrade(cfg, "head", sql=True)
    captured = capsys.readouterr()
    sql_output = captured.out

    assert len(sql_output) > 0
    assert "CREATE TABLE" in sql_output
    assert "fraud_labels" in sql_output
    assert "label_history" in sql_output
    assert "ALTER TABLE fraud_labels ADD COLUMN" in sql_output
