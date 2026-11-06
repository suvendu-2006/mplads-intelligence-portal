"""
Automated Verification Suite for Real-time Work Lifecycle Re-Auditing (Rev-4.1)
Covers all 12 Operational Test Gates.
"""

import pytest
import time
from datetime import datetime, timezone, date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from webapi.main import app
from webapi.security import create_jwt_token, decode_jwt_token, verify_work_authorization
from webapi.cache_manager import invalidate_all_aggregates
from mplads_fraud_detection.foundation.db import SessionLocal, get_or_create_realtime_run, REALTIME_RUN_KEY
from mplads_fraud_detection.foundation.schema import Work, Anomaly, PipelineRun
from mplads_fraud_detection.auditor.lifecycle_auditor import WorkLifecycleAuditor
from mplads_fraud_detection.settings import settings


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def test_gate_01_schema_integrity(db):
    """Gate 1: Verifies schema completeness and presence of new lifecycle columns & indexes."""
    inspector = inspect(db.bind)

    work_columns = {c["name"]: c for c in inspector.get_columns("works")}
    assert "updated_at" in work_columns
    assert "last_audited_at" in work_columns
    assert "lifecycle_audit_version" in work_columns
    assert "audit_status" in work_columns

    anomaly_columns = {c["name"]: c for c in inspector.get_columns("anomalies")}
    assert "is_active" in anomaly_columns
    assert "resolved_at" in anomaly_columns
    assert "resolution_reason" in anomaly_columns

    work_indexes = {idx["name"]: idx for idx in inspector.get_indexes("works")}
    assert "idx_works_district_rec_date" in work_indexes

    anomaly_indexes = {idx["name"]: idx for idx in inspector.get_indexes("anomalies")}
    assert "idx_anomalies_work_active_detector" in anomaly_indexes


def test_gate_02_singleton_pipeline_run(db):
    """Gate 2: Verifies singleton PipelineRun persistence and idempotency."""
    run_id_1 = get_or_create_realtime_run(db)
    assert run_id_1 is not None

    run_id_2 = get_or_create_realtime_run(db)
    assert run_id_1 == run_id_2

    # Verify only one singleton record exists in DB
    runs = db.query(PipelineRun).filter(PipelineRun.run_key == REALTIME_RUN_KEY).all()
    assert len(runs) == 1
    assert runs[0].run_id == run_id_1


def test_gate_03_work_update_and_audit_status(db):
    """Gate 3: Verifies auditing a work records last_audited_at, audit_status, and version."""
    auditor = WorkLifecycleAuditor()
    work = db.query(Work).first()
    assert work is not None

    result = auditor.audit_work(db, work.work_id, commit=False)
    assert result["work_id"] == work.work_id
    assert result["audit_status"] in ("AUDITED", "PARTIALLY_AUDITED")
    assert work.last_audited_at is not None
    assert work.lifecycle_audit_version == "v3.0"
    assert work.audit_status == result["audit_status"]


def test_gate_04_in_place_soft_resolution(db):
    """Gate 4: Verifies curing a finding soft-resolves the anomaly record in-place."""
    auditor = WorkLifecycleAuditor()
    stream_run = get_or_create_realtime_run(db)

    # Invertible test work: initially vague description triggering D10
    test_work = Work(
        work_id=999901,
        work_description="Various works",
        cost=600000.0,
        district="PATNA",
        state="BIHAR",
        mp_name="Test MP 1",
        category="Normal/Others",
        status="completed",
        updated_at=datetime.now(timezone.utc)
    )
    db.add(test_work)
    db.flush()

    res1 = auditor.audit_work(db, test_work, commit=False)
    d10 = db.query(Anomaly).filter(
        Anomaly.work_id == test_work.work_id,
        Anomaly.detector_type == "vague_description",
        Anomaly.run_id == stream_run
    ).first()
    assert d10 is not None
    assert d10.is_active is True

    # Mutate to clear the condition
    test_work.work_description = "Construction of 500 meter CC road with M25 concrete in Ward 4 Patna"
    test_work.cost = 300000.0
    db.flush()

    res2 = auditor.audit_work(db, test_work, commit=False)
    db.refresh(d10)
    assert d10.is_active is False
    assert d10.resolved_at is not None
    assert d10.resolution_reason == "Condition cleared by lifecycle re-audit"

    # Cleanup
    db.delete(d10)
    db.delete(test_work)
    db.flush()


def test_gate_05_severity_floor_enforcement(db):
    """Gate 5: Verifies scores < 0.50 are never inserted into the anomalies table."""
    auditor = WorkLifecycleAuditor()
    stream_run = get_or_create_realtime_run(db)

    # Work that complies with all bounds
    compliant_work = Work(
        work_id=999902,
        work_description="Installation of 10 solar street lights with standard poles and fittings in village",
        cost=240000.0,
        district="PATNA",
        state="BIHAR",
        mp_name="Test MP 2",
        category="Solar & Public Lighting",
        status="completed",
        has_payments=True,
        total_paid=240000.0,
        payment_record_exists=True,
        updated_at=datetime.now(timezone.utc)
    )
    db.add(compliant_work)
    db.flush()

    res = auditor.audit_work(db, compliant_work, commit=False)
    anomalies = db.query(Anomaly).filter(
        Anomaly.work_id == compliant_work.work_id,
        Anomaly.run_id == stream_run
    ).all()

    # None should have severity < 0.50
    for a in anomalies:
        assert a.severity >= 0.50, f"Found anomaly below statutory floor: {a.severity}"

    for a in anomalies:
        db.delete(a)
    db.delete(compliant_work)
    db.flush()


def test_gate_06_d2_cascading_candidate_window(db):
    """Gate 6: Twin projects with matching scope in same district are flagged as duplicates."""
    auditor = WorkLifecycleAuditor()
    stream_run = get_or_create_realtime_run(db)

    now = datetime.now(timezone.utc)
    w1 = Work(
        work_id=999903,
        work_description="Construction of 500 meter CC Road in GP-4 near community center",
        cost=400000.0,
        district="PATNA",
        state="BIHAR",
        mp_name="Duplicate MP",
        category="Roads & Pathways",
        recommended_date=now.date(),
        updated_at=now
    )
    w2 = Work(
        work_id=999904,
        work_description="Construction of 500 meter CC Road in GP-4 near community center",
        cost=400000.0,
        district="PATNA",
        state="BIHAR",
        mp_name="Duplicate MP",
        category="Roads & Pathways",
        recommended_date=now.date(),
        updated_at=now
    )
    db.add_all([w1, w2])
    db.flush()

    # Audit w2 -> should match w1 and cascade
    res = auditor.audit_work(db, w2, commit=False)
    a2 = db.query(Anomaly).filter(
        Anomaly.work_id == w2.work_id,
        Anomaly.detector_type == "duplicate_work",
        Anomaly.run_id == stream_run
    ).first()
    assert a2 is not None
    assert a2.is_active is True
    assert a2.severity >= 0.50

    # Reciprocal on w1
    a1 = db.query(Anomaly).filter(
        Anomaly.work_id == w1.work_id,
        Anomaly.detector_type == "duplicate_work",
        Anomaly.run_id == stream_run
    ).first()
    assert a1 is not None
    assert a1.is_active is True

    # Cleanup
    if a1: db.delete(a1)
    if a2: db.delete(a2)
    db.delete(w1)
    db.delete(w2)
    db.flush()


def test_gate_07_cold_start_ml_degradation_fallback(db):
    """Gate 7: Missing model artifact evaluates safely without raising FileNotFoundError."""
    cs_auditor = WorkLifecycleAuditor(model_path="/nonexistent/model.joblib", medians_path="/nonexistent/medians.json")
    assert cs_auditor.d1_model is None
    assert cs_auditor.d1_medians is None

    work = db.query(Work).first()
    res = cs_auditor.audit_work(db, work.work_id, commit=False)
    assert res["audit_status"] in ("AUDITED", "PARTIALLY_AUDITED")
    assert "unusual_pattern" not in res["failed_detectors"]


def test_gate_08_rfc_9110_bearer_jwt_auth(client, db):
    """Gate 8: RFC 9110 Bearer JWT Authentication (valid token 200, invalid/expired 401 with WWW-Authenticate)."""
    work = db.query(Work).first()
    assert work is not None

    valid_token = create_jwt_token({"sub": "admin_user", "role": "admin"}, settings.SECRET_KEY)
    resp = client.patch(
        f"/api/works/{work.work_id}",
        json={"work_description": work.work_description},
        headers={"Authorization": f"Bearer {valid_token}"}
    )
    assert resp.status_code == 200

    # Expired token
    exp_token = create_jwt_token({"sub": "admin_user", "role": "admin"}, settings.SECRET_KEY, expires_in=-10)
    resp_exp = client.patch(
        f"/api/works/{work.work_id}",
        json={"work_description": work.work_description},
        headers={"Authorization": f"Bearer {exp_token}"}
    )
    assert resp_exp.status_code == 401
    assert resp_exp.headers.get("www-authenticate") == "Bearer"
    assert resp_exp.json()["detail"] == "Invalid or expired Bearer token"

    # Bad signature
    resp_bad = client.patch(
        f"/api/works/{work.work_id}",
        json={"work_description": work.work_description},
        headers={"Authorization": f"Bearer {valid_token}tampered"}
    )
    assert resp_bad.status_code == 401
    assert resp_bad.headers.get("www-authenticate") == "Bearer"


def test_gate_09_backward_compatible_demo_headers(client, db):
    """Gate 9: Backward-compatible demo headers allow access when Authorization is omitted."""
    work = db.query(Work).first()
    resp = client.patch(
        f"/api/works/{work.work_id}",
        json={"work_description": work.work_description},
        headers={"x-role": "admin"}
    )
    assert resp.status_code == 200


def test_gate_10_multi_district_scoping_and_rbac():
    """Gate 10: Multi-district scoping & truthy boundary enforcement."""
    work = Work(work_id=1, state="ANDHRA PRADESH", district="VISAKHAPATNAM")

    # Allowed in assigned district
    user_visakha = {"role": "district_authority", "assigned_districts": ["VISAKHAPATNAM"]}
    verify_work_authorization(user_visakha, work)

    # Denied in different district
    user_guntur = {"role": "district_authority", "assigned_districts": ["GUNTUR"]}
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        verify_work_authorization(user_guntur, work)
    assert exc_info.value.status_code == 403

    # Denied with empty/null district
    with pytest.raises(HTTPException) as exc_info_none:
        verify_work_authorization({"role": "district_authority", "assigned_districts": []}, Work(state=None, district=None))
    assert exc_info_none.value.status_code == 403


def test_gate_11_deprecation_and_sunset_headers(client, db):
    """Gate 11: Deprecated POST endpoint returns RFC 9745 Deprecation, Sunset, and Link headers."""
    work = db.query(Work).first()
    resp = client.post(
        f"/api/works/{work.work_id}/update",
        json={"cost": float(work.cost or 100000.0)},
        headers={"x-role": "admin"}
    )
    assert resp.status_code == 200
    assert resp.headers.get("deprecation") == "true"
    assert "2027" in resp.headers.get("sunset", "")
    assert f"</api/works/{work.work_id}>; rel=\"successor-version\"" in resp.headers.get("link", "")
    assert any("deprecated" in w.lower() for w in resp.json().get("warnings", []))


def test_gate_12_aggregate_cache_invalidation(client, db):
    """Gate 12: Work mutation purges all 9 cache registries."""
    from webapi.routers import flags, states, mps, districts, constituencies, entity_risks
    from webapi import aggregators

    flags._flags_cache["test_k"] = "dummy"
    states._states_cache["test_k"] = "dummy"
    mps._mps_cache["test_k"] = "dummy"
    mps._mp_detail_cache["test_k"] = "dummy"
    districts._districts_cache["test_k"] = "dummy"
    districts._district_detail_cache["test_k"] = "dummy"
    districts._districts_maps_cache = "dummy"
    constituencies._constituency_cache["test_k"] = "dummy"
    entity_risks._LOCATION_STATE_MAP = {"dummy": "data"}
    entity_risks._MP_STATE_MAP = {"dummy": "data"}
    aggregators._CACHE["test_k"] = (datetime.now(), "dummy")

    invalidate_all_aggregates()

    assert len(flags._flags_cache) == 0
    assert len(states._states_cache) == 0
    assert len(mps._mps_cache) == 0
    assert len(mps._mp_detail_cache) == 0
    assert len(districts._districts_cache) == 0
    assert len(districts._district_detail_cache) == 0
    assert districts._districts_maps_cache is None
    assert len(constituencies._constituency_cache) == 0
    assert entity_risks._LOCATION_STATE_MAP is None
    assert entity_risks._MP_STATE_MAP is None
    assert len(aggregators._CACHE) == 0
