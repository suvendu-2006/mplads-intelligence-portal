"""
Registry of all 15 Fraud Detectors for MPLADS.
"""

try:
    from mplads_fraud_detection.detectors.detector_01_unusual_patterns import run_detector_01_unusual_patterns
    from mplads_fraud_detection.detectors.detector_02_duplicate_works import run_detector_02_duplicate_works
    from mplads_fraud_detection.detectors.detector_03_cost_overruns import run_detector_03_cost_overruns
    from mplads_fraud_detection.detectors.detector_04_ghost_works import run_detector_04_ghost_works
    from mplads_fraud_detection.detectors.detector_05_bill_splitting import run_detector_05_bill_splitting
    from mplads_fraud_detection.detectors.detector_06_delay_violation import run_detector_06_delay_violation
    from mplads_fraud_detection.detectors.detector_07_timing_anomaly import run_detector_07_timing_anomaly
    from mplads_fraud_detection.detectors.detector_08_bulk_completion import run_detector_08_bulk_completion
    from mplads_fraud_detection.detectors.detector_09_benford_anomaly import run_detector_09_benford_anomaly
    from mplads_fraud_detection.detectors.detector_10_vague_description import run_detector_10_vague_description
    from mplads_fraud_detection.detectors.detector_11_plausibility_mismatch import run_detector_11_plausibility_mismatch
    from mplads_fraud_detection.detectors.detector_12_verification_gap import run_detector_12_verification_gap
    from mplads_fraud_detection.detectors.detector_13_ida_risk import run_detector_13_ida_risk
    from mplads_fraud_detection.detectors.detector_14_mp_risk import run_detector_14_mp_risk
    from mplads_fraud_detection.detectors.detector_15_copy_paste_pricing import run_detector_15_copy_paste_pricing

    __all__ = [
        "run_detector_01_unusual_patterns",
        "run_detector_02_duplicate_works",
        "run_detector_03_cost_overruns",
        "run_detector_04_ghost_works",
        "run_detector_05_bill_splitting",
        "run_detector_06_delay_violation",
        "run_detector_07_timing_anomaly",
        "run_detector_08_bulk_completion",
        "run_detector_09_benford_anomaly",
        "run_detector_10_vague_description",
        "run_detector_11_plausibility_mismatch",
        "run_detector_12_verification_gap",
        "run_detector_13_ida_risk",
        "run_detector_14_mp_risk",
        "run_detector_15_copy_paste_pricing",
    ]
except ImportError:
    # In lightweight serverless/deployment environments where offline detector training libraries
    # (such as scikit-learn or sentence-transformers) are excluded, allow registry to load cleanly.
    pass
