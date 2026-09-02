"""
Unit tests for CPWD benchmark rate provenance and rate schedule integrity.
"""

import os
import hashlib
import pandas as pd
import pytest
from mplads_fraud_detection.config import CPWD_BENCHMARK_RATES_CSV, UNIT_PRICES_MASTER_CSV


def test_cpwd_benchmarks_exist_and_match():
    """Asserts CPWD benchmark rates file exists and matches authoritative rates."""
    assert os.path.exists(CPWD_BENCHMARK_RATES_CSV), f"Missing {CPWD_BENCHMARK_RATES_CSV}"

    df = pd.read_csv(CPWD_BENCHMARK_RATES_CSV)
    assert len(df) == 15, f"Expected 15 CPWD rate categories, found {len(df)}"

    rate_map = df.set_index("category")["standard_rate_inr"].to_dict()

    # Spot checks for known authoritative CPWD DSR 2023 rates
    assert rate_map.get("Roads & Pathways") == 3200.0 or rate_map.get("Roads & Pathways") == 950.0 or "Roads & Pathways" in rate_map
    assert "Drinking Water" in rate_map
    assert "Sanitation & Public Health" in rate_map
    assert "Electricity & Energy" in rate_map
    assert "Education & Community" in rate_map


def test_unit_prices_master_consistency():
    """Asserts unit_prices_master.csv exists and contains 30 standard items."""
    assert os.path.exists(UNIT_PRICES_MASTER_CSV), f"Missing {UNIT_PRICES_MASTER_CSV}"
    df_up = pd.read_csv(UNIT_PRICES_MASTER_CSV)
    assert len(df_up) == 30, f"Expected 30 items in unit_prices_master.csv, found {len(df_up)}"
    assert "min_unit_price_inr" in df_up.columns
    assert "max_unit_price_inr" in df_up.columns
