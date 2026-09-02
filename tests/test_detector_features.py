"""
Unit test for Continuous Detector Feature Generation (Phase 5 Refactoring).
Verifies that detectors output continuous predictive features across all works.
"""

from mplads_fraud_detection.features.detector_features import extract_continuous_detector_features
from mplads_fraud_detection.foundation.schema import Work


def test_continuous_detector_feature_extraction(isolated_test_db):
    session, engine = isolated_test_db

    w1 = Work(
        work_id=1,
        work_description="Construction of CC Road 500 meters in Peddapuram",
        cost=3500000.0,
        district="EAST GODAVARI",
        mp_name="Shri MP",
        category="Roads - CC",
        status="completed"
    )
    w2 = Work(
        work_id=2,
        work_description="Borewell installation",
        cost=150000.0,
        district="EAST GODAVARI",
        mp_name="Shri MP",
        category="Drinking Water",
        status="completed"
    )
    session.add_all([w1, w2])
    session.commit()

    df_feats = extract_continuous_detector_features(session)

    assert len(df_feats) == 2
    assert "d03_cost_overrun_ratio" in df_feats.columns
    assert "d04_ghost_payment_deficit" in df_feats.columns
    assert "d10_vague_specificity" in df_feats.columns
    assert "d11_plausibility_ratio" in df_feats.columns

    # w1 is CC Road 500m with cost 35L (expected 500 * 3200 = 16L), overrun ratio ~2.18
    assert df_feats.loc[1, "d03_cost_overrun_ratio"] > 1.5
    assert 0.0 <= df_feats.loc[1, "d10_vague_specificity"] <= 1.0
