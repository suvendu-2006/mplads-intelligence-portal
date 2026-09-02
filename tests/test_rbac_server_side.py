"""
Unit tests for server-side Role-Based Access Control (RBAC) enforcement.
Verifies that privilege escalation is blocked at the backend function layer.
"""

import pytest
import streamlit as st
from mplads_fraud_detection.auth.rbac import require_role


def test_viewer_cannot_run_pipeline():
    """Verify Viewer role is blocked from pipeline execution."""
    st.session_state["role"] = "Viewer"
    st.session_state["user_id"] = "test_viewer"

    @require_role("Admin")
    def run_pipeline_action():
        return "pipeline_executed"

    with pytest.raises(Exception):
        run_pipeline_action()


def test_admin_can_run_pipeline():
    """Verify Admin role can execute pipeline."""
    st.session_state["role"] = "Admin"
    st.session_state["user_id"] = "test_admin"

    @require_role("Admin")
    def run_pipeline_action():
        return "pipeline_executed"

    result = run_pipeline_action()
    assert result == "pipeline_executed"


def test_auditor_can_submit_field_finding():
    """Verify Auditor role can submit field findings."""
    st.session_state["role"] = "Auditor"
    st.session_state["user_id"] = "test_auditor"

    @require_role("Auditor", "SeniorReviewer", "Admin")
    def submit_field_inspection():
        return "inspection_saved"

    result = submit_field_inspection()
    assert result == "inspection_saved"


def test_auditor_cannot_approve_final_training_labels():
    """Verify Auditor cannot approve training labels (requires SeniorReviewer or Admin)."""
    st.session_state["role"] = "Auditor"
    st.session_state["user_id"] = "test_auditor"

    @require_role("SeniorReviewer", "Admin")
    def approve_training_label():
        return "label_approved"

    with pytest.raises(Exception):
        approve_training_label()


def test_analyst_cannot_submit_field_inspection():
    """Verify Analyst role cannot submit certified field inspections."""
    st.session_state["role"] = "Analyst"
    st.session_state["user_id"] = "test_analyst"

    @require_role("Auditor", "SeniorReviewer", "Admin")
    def submit_field_inspection():
        return "inspection_saved"

    with pytest.raises(Exception):
        submit_field_inspection()
