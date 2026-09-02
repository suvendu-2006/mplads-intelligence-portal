"""
Unit tests for typed settings and fail-closed production validation.
"""

import pytest
from mplads_fraud_detection.settings import Settings


def test_production_requires_postgresql():
    with pytest.raises(ValueError, match="must use PostgreSQL"):
        Settings(
            APP_ENV="production",
            DATABASE_URL="sqlite:///mplads.db",
            SECRET_KEY="a" * 32
        )


def test_production_requires_ssl():
    with pytest.raises(ValueError, match="must use SSL"):
        Settings(
            APP_ENV="production",
            DATABASE_URL="postgresql://user:pass@remote.host/db",
            SECRET_KEY="a" * 32
        )


def test_secret_key_too_short():
    with pytest.raises(ValueError, match="at least 32 characters"):
        Settings(
            APP_ENV="development",
            DATABASE_URL="sqlite:///test.db",
            SECRET_KEY="tooshort"
        )


def test_ml_enabled_without_model():
    with pytest.raises(ValueError, match="requires an approved model"):
        Settings(
            APP_ENV="development",
            DATABASE_URL="sqlite:///test.db",
            SECRET_KEY="a" * 32,
            ML_PREDICTIONS_ENABLED=True
        )


def test_valid_development_settings():
    s = Settings(
        APP_ENV="development",
        DATABASE_URL="sqlite:///test.db",
        SECRET_KEY="a" * 32,
        ML_PREDICTIONS_ENABLED=False
    )
    assert s.APP_ENV == "development"
    assert s.DATABASE_URL.endswith("/test.db")
    assert s.DATABASE_URL.startswith("sqlite:////")
