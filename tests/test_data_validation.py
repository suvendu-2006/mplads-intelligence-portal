"""
Unit tests for Pandera data validation schemas.
Verifies rejection of invalid costs, future dates, duplicate IDs, and invalid data origin.
"""

import pytest
import pandas as pd
import pandera as pa
from datetime import datetime, timedelta
from mplads_fraud_detection.validation.schemas import WORK_INGESTION_SCHEMA


def test_valid_work_passes():
    """Verify clean, valid records pass validation."""
    df = pd.DataFrame([{
        "work_id": 1001,
        "cost": 500000.0,
        "district": "Anantapur",
        "mp_name": "Hon. Member",
        "status": "completed",
        "completion_date": pd.Timestamp("2023-01-01"),
        "data_origin": "OFFICIAL"
    }])
    validated_df = WORK_INGESTION_SCHEMA.validate(df)
    assert len(validated_df) == 1


def test_negative_cost_fails():
    """Verify negative cost raises SchemaError."""
    df = pd.DataFrame([{
        "work_id": 1002,
        "cost": -1500.0,
        "district": "Anantapur",
        "mp_name": "Hon. Member",
        "status": "completed",
        "completion_date": pd.Timestamp("2023-01-01"),
        "data_origin": "OFFICIAL"
    }])
    with pytest.raises(pa.errors.SchemaError):
        WORK_INGESTION_SCHEMA.validate(df)


def test_future_date_fails():
    """Verify future completion date raises SchemaError."""
    future_date = datetime.now() + timedelta(days=365)
    df = pd.DataFrame([{
        "work_id": 1003,
        "cost": 500000.0,
        "district": "Anantapur",
        "mp_name": "Hon. Member",
        "status": "completed",
        "completion_date": pd.Timestamp(future_date),
        "data_origin": "OFFICIAL"
    }])
    with pytest.raises(pa.errors.SchemaError):
        WORK_INGESTION_SCHEMA.validate(df)


def test_invalid_data_origin_fails():
    """Verify unauthorized data origin flag raises SchemaError."""
    df = pd.DataFrame([{
        "work_id": 1004,
        "cost": 500000.0,
        "district": "Anantapur",
        "mp_name": "Hon. Member",
        "status": "completed",
        "completion_date": pd.Timestamp("2023-01-01"),
        "data_origin": "UNAUTHORIZED_SOURCE"
    }])
    with pytest.raises(pa.errors.SchemaError):
        WORK_INGESTION_SCHEMA.validate(df)


def test_duplicate_work_ids_fails():
    """Verify duplicate work_ids are rejected."""
    df = pd.DataFrame([
        {
            "work_id": 1005,
            "cost": 500000.0,
            "district": "Anantapur",
            "mp_name": "Hon. Member",
            "status": "completed",
            "completion_date": pd.Timestamp("2023-01-01"),
            "data_origin": "OFFICIAL"
        },
        {
            "work_id": 1005,
            "cost": 600000.0,
            "district": "Chittoor",
            "mp_name": "Hon. Member",
            "status": "completed",
            "completion_date": pd.Timestamp("2023-01-01"),
            "data_origin": "OFFICIAL"
        }
    ])
    with pytest.raises(pa.errors.SchemaError):
        WORK_INGESTION_SCHEMA.validate(df)
