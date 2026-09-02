"""
Unit tests for Feature Extraction and Ethical Exclusion Engine.
"""

import pytest
import pandas as pd
from mplads_fraud_detection.features.feature_extractor import extract_work_features, DETECTOR_FEATURE_COLS
from mplads_fraud_detection.features.excluded_attributes import validate_feature_ethics, EXCLUDED_PREDICTIVE_ATTRIBUTES
from mplads_fraud_detection.foundation.schema import Work, Anomaly, PipelineRun


def test_ethical_exclusion_guard():
    """Verify ethical guard strictly catches prohibited political or demographic attributes."""
    valid_features = ["cost_inr", "duration_days", "cost_overrun", "log_cost"]
    assert validate_feature_ethics(valid_features) is True

    for prohibited in EXCLUDED_PREDICTIVE_ATTRIBUTES:
        invalid_set = valid_features + [prohibited]
        with pytest.raises(ValueError, match="ETHICAL COMPLIANCE VIOLATION"):
            validate_feature_ethics(invalid_set)


def test_feature_extraction_pipeline(isolated_test_db):
    """Verify feature extractor builds clean tabular matrix from isolated test database."""
    session, engine = isolated_test_db

    # Create dummy run and works
    run = PipelineRun(run_id="test_feat_run", run_key="feat_key", status="COMPLETED")
    w1 = Work(
        work_id=101,
        work_description="Construction of CC Road in Ward 5",
        cost=850000.0,
        district="GUNTUR",
        mp_name="Test MP",
        category="Roads",
        status="completed"
    )
    a1 = Anomaly(
        work_id=101,
        detector_type="cost_overrun",
        severity=0.85,
        explanation="CPWD benchmark overrun",
        evidence={},
        run_id="test_feat_run"
    )

    session.add_all([run, w1, a1])
    session.commit()

    df_feats, feature_cols = extract_work_features(session, "test_feat_run")

    assert len(df_feats) == 1
    assert "log_cost" in feature_cols
    assert "cost_overrun" in feature_cols
    assert df_feats.loc[0, "cost_overrun"] == 0.85
    assert df_feats.loc[0, "is_road"] == 1.0
