"""
Unit test for Streamlit dashboard data loading and return signatures.
"""

import pandas as pd
from app import load_dashboard_data


def test_dashboard_data_loading_signature():
    """Verify load_dashboard_data returns all 7 components cleanly."""
    func = getattr(load_dashboard_data, "__wrapped__", load_dashboard_data)
    res = func()
    metrics, df_anom, df_ent, df_works, df_rq, df_preds, last_run_time = res

    assert metrics is not None
    assert df_anom is not None
    assert df_ent is not None
    assert df_works is not None
    assert df_rq is not None
    assert df_preds is not None
    assert len(df_works) == 8512
    assert isinstance(df_preds, pd.DataFrame)
