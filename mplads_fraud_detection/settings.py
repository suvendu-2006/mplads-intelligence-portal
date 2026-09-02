"""
Canonical Typed Settings for MPLADS Fraud Detection Platform.
Enforces fail-closed configuration in production environments.
"""

import os
import logging
from typing import Literal, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator, model_validator

from pathlib import Path

logger = logging.getLogger("mplads_settings")
PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application runtime configuration with fail-closed security gates."""
    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_ROOT / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_ENV: Literal["development", "staging", "production"] = "development"
    DATABASE_URL: str = "sqlite:///mplads_dev.db"
    SECRET_KEY: str = Field(default="", min_length=32)
    LOG_LEVEL: str = "INFO"
    ML_PREDICTIONS_ENABLED: bool = False
    DEMO_MODE: bool = False

    # Alert settings
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASS: Optional[str] = None
    ALERT_EMAIL: str = "admin@agency.gov.in"

    @field_validator("DATABASE_URL")
    @classmethod
    def ensure_absolute_db_path(cls, v: str) -> str:
        from mplads_fraud_detection.config import get_absolute_db_path
        return get_absolute_db_path(v)

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if v in ["<generate_with_secrets_token_hex_32>", "changeme", ""]:
            raise ValueError(
                "SECRET_KEY must be generated with: "
                "python -c 'import secrets; print(secrets.token_hex(32))'"
            )
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    @model_validator(mode="after")
    def validate_environment_consistency(self) -> "Settings":
        if self.APP_ENV == "production":
            if not self.DATABASE_URL.startswith(("postgresql://", "postgresql+psycopg2://")):
                raise ValueError(
                    "Production DATABASE_URL must use PostgreSQL "
                    f"(got: {self.DATABASE_URL[:20]}...)"
                )
            if "sslmode=require" not in self.DATABASE_URL and "localhost" not in self.DATABASE_URL:
                raise ValueError(
                    "Production PostgreSQL must use SSL: "
                    "add ?sslmode=require to DATABASE_URL"
                )
            if self.DEMO_MODE:
                raise ValueError("DEMO_MODE cannot be enabled in production")

        if self.ML_PREDICTIONS_ENABLED is True:
            model_path = "artifacts/approved_fraud_model_v1.pkl"
            if not os.path.exists(model_path):
                raise ValueError(
                    "ML_PREDICTIONS_ENABLED=true requires an approved model. "
                    f"Model not found: {model_path}"
                )
        return self


# Global singleton
settings = Settings()

if settings.APP_ENV == "production":
    logger.info("✓ Production configuration validated:")
    logger.info("  - Database: PostgreSQL with SSL")
    logger.info(f"  - ML Predictions: {settings.ML_PREDICTIONS_ENABLED}")
    logger.info(f"  - Demo Mode: {settings.DEMO_MODE}")
