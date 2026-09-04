"""
Unit test for Streamlit dashboard data loading and return signatures.
"""

import pandas as pd
from unittest.mock import patch
from app import load_dashboard_data, DashboardData


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
    assert len(df_works) >= 8512
    assert isinstance(df_preds, pd.DataFrame)


def test_dashboard_data_loading_empty_database(isolated_test_db):
    """Verify load_dashboard_data returns 7-tuple DashboardData with None when no runs exist."""
    session, engine = isolated_test_db
    func = getattr(load_dashboard_data, "__wrapped__", load_dashboard_data)

    with patch("app.SessionLocal", return_value=session):
        data = func()
        assert isinstance(data, DashboardData)
        metrics, df_anom, df_ent, df_works, df_rq, df_preds, last_run_time = data
        assert metrics is None
        assert df_anom is None
        assert df_ent is None
        assert df_works is None
        assert df_rq is None
        assert df_preds is None
        assert last_run_time is None
