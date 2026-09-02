"""
Unit test for Streamlit dashboard data loading and return signatures.
"""

from app import load_dashboard_data


def test_dashboard_data_loading_signature():
    """Verify load_dashboard_data returns all 7 components cleanly."""
    res = load_dashboard_data()
    metrics, df_anom, df_ent, df_works, df_rq, df_preds, last_run_time = res

    assert metrics is not None
    assert df_anom is not None
    assert df_ent is not None
    assert df_works is not None
    assert df_rq is not None
    assert df_preds is not None
    assert isinstance(last_run_time, str)
    assert len(df_works) == 8512
    assert len(df_preds) == 8512
