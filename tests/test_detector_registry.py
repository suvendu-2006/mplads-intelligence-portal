"""
Unit tests for detector registry and capacity-based triage tiers.
"""

from mplads_fraud_detection.detectors.registry import DETECTOR_REGISTRY, DetectorStatus, get_capacity_tier


def test_detector_registry_completeness():
    assert len(DETECTOR_REGISTRY) == 15
    for key, info in DETECTOR_REGISTRY.items():
        assert info.detector_id.startswith("D")
        assert info.status in [DetectorStatus.ACTIVE_VERIFIED, DetectorStatus.ADVISORY, DetectorStatus.INACTIVE_MISSING_DATA]
        assert len(info.regulatory_source) > 5
        assert len(info.assumptions) > 0
        assert len(info.known_limitations) > 0


def test_capacity_tier_assignment():
    assert get_capacity_tier(0.92, 99.5) == "TIER_1_IMMEDIATE"
    assert get_capacity_tier(0.75, 96.0) == "TIER_2_HIGH_PRIORITY"
    assert get_capacity_tier(0.55, 82.0) == "TIER_3_STANDARD_REVIEW"
    assert get_capacity_tier(0.20, 40.0) == "COMPLIANT"
