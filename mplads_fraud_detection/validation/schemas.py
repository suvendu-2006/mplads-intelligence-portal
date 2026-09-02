"""
Pandera Schemas for Ingested Works and Financial Records.
Guarantees physical plausibility, valid dates, and strict data origin attribution.
"""

from datetime import datetime
import pandera as pa
from pandera import Column, Check, DataFrameSchema

WORK_INGESTION_SCHEMA = DataFrameSchema({
    "work_id": Column(
        int,
        Check.greater_than(0),
        nullable=False,
        unique=True,
        description="Unique work identifier"
    ),
    "cost": Column(
        float,
        Check.in_range(min_value=0.0, max_value=5e8),  # Up to ₹50 crore
        nullable=False,
        description="Total work cost in rupees"
    ),
    "district": Column(
        str,
        Check.str_length(min_value=2, max_value=100),
        nullable=False,
        description="District name"
    ),
    "mp_name": Column(
        str,
        Check.str_length(min_value=2, max_value=200),
        nullable=False,
        description="Member of Parliament name"
    ),
    "status": Column(
        str,
        Check.isin(["completed", "Recommended", "stalled", "ongoing", "In Progress"]),
        nullable=False
    ),
    "completion_date": Column(
        pa.DateTime,
        Check.less_than_or_equal_to(datetime.now()),
        nullable=True,
        description="Must not be a future date"
    ),
    "data_origin": Column(
        str,
        Check.isin(["OFFICIAL", "VERIFIED_AUDIT", "SYNTHETIC_DEMO"]),
        nullable=False,
        description="Must be officially sourced or explicitly designated"
    )
}, strict=False)
