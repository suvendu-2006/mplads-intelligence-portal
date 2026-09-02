"""
Unit tests for monotonic severity functions across all detectors.
Asserts S(x1) <= S(x2) for all x1 <= x2 over 1,000 synthetic sample points.
"""

import pytest
import numpy as np
from mplads_fraud_detection.foundation.utils import (
    monotonic_severity, calculate_composite_score, classify_tier
)


def test_cpwd_excess_monotonicity():
    """Verify D3 CPWD cost overrun severity is strictly monotonic."""
    thresholds = [5.0, 25.0, 50.0, 100.0]
    bases = [0.50, 0.70, 0.85, 1.00]

    xs = np.linspace(0.0, 150.0, 1000)
    sevs = [monotonic_severity(x, thresholds, bases) for x in xs]

    # Monotonicity check
    for i in range(len(sevs) - 1):
        assert sevs[i] <= sevs[i+1], f"Monotonicity violation at x={xs[i]}: {sevs[i]} > {sevs[i+1]}"

    # Spot checks
    assert monotonic_severity(0.0, thresholds, bases) == 0.0
    assert monotonic_severity(5.0, thresholds, bases) == 0.50
    assert abs(monotonic_severity(34.74, thresholds, bases) - 0.758) < 0.01
    assert abs(monotonic_severity(68.42, thresholds, bases) - 0.905) < 0.01
    assert monotonic_severity(100.0, thresholds, bases) == 1.00
    assert monotonic_severity(200.0, thresholds, bases) == 1.00


def test_march_dumping_monotonicity():
    """Verify D7 March dumping continuous index is strictly monotonic."""
    thresholds = [30.0, 45.0, 65.0, 85.0]
    bases = [0.50, 0.65, 0.85, 1.00]

    xs = np.linspace(0.0, 100.0, 1000)
    sevs = [monotonic_severity(x, thresholds, bases) for x in xs]

    for i in range(len(sevs) - 1):
        assert sevs[i] <= sevs[i+1], f"Monotonicity violation at x={xs[i]}: {sevs[i]} > {sevs[i+1]}"

    assert monotonic_severity(29.9, thresholds, bases) == 0.0
    assert monotonic_severity(30.0, thresholds, bases) == 0.50
    assert monotonic_severity(45.0, thresholds, bases) == 0.65
    assert monotonic_severity(85.0, thresholds, bases) == 1.00


def test_delay_monotonicity():
    """Verify D6 Delay violation severity is strictly monotonic."""
    thresholds = [365, 548, 730, 1095]
    bases = [0.50, 0.65, 0.80, 1.00]

    xs = np.linspace(0, 1500, 1000)
    sevs = [monotonic_severity(x, thresholds, bases) for x in xs]

    for i in range(len(sevs) - 1):
        assert sevs[i] <= sevs[i+1], f"Monotonicity violation at x={xs[i]}: {sevs[i]} > {sevs[i+1]}"


def test_composite_group_boosting():
    """Verify composite group boosting calculation and tier classification."""
    # 1 group active (financial only)
    sev1, tier1, g_count1, active1 = calculate_composite_score({"ghost_work": 0.80})
    assert sev1 == 0.80
    assert g_count1 == 1
    assert tier1 == "Very High"

    # 2 groups active (financial + temporal) -> +0.10 boost
    sev2, tier2, g_count2, active2 = calculate_composite_score({
        "ghost_work": 0.80,
        "bulk_completion": 0.70
    })
    assert abs(sev2 - 0.90) < 1e-4
    assert g_count2 == 2
    assert tier2 == "Critical"

    # 3 groups active (financial + temporal + content) -> +0.20 boost
    sev3, tier3, g_count3, active3 = calculate_composite_score({
        "ghost_work": 0.75,
        "bulk_completion": 0.70,
        "duplicate_work": 0.70
    })
    assert abs(sev3 - 0.95) < 1e-4
    assert g_count3 == 3
    assert tier3 == "Critical"

    # 4 groups active -> +0.25 boost, capped at 1.00
    sev4, tier4, g_count4, active4 = calculate_composite_score({
        "ghost_work": 0.80,
        "bulk_completion": 0.70,
        "duplicate_work": 0.70,
        "unusual_pattern": 0.70
    })
    assert sev4 == 1.00
    assert g_count4 == 4
    assert tier4 == "Critical"
