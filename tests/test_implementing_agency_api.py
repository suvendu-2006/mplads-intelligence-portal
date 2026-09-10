import time
import pytest
from fastapi.testclient import TestClient
from webapi.main import app

client = TestClient(app)


def test_district_endpoint_implementing_agency():
    start = time.time()
    response = client.get("/api/districts/PATNA")
    elapsed = time.time() - start
    assert response.status_code == 200
    assert elapsed < 0.5, f"Response took {elapsed:.2f}s, expected < 0.5s"

    json_data = response.json()
    assert "data" in json_data
    works = json_data["data"].get("works", [])
    assert len(works) > 0, "Expected works in district detail"
    for w in works[:20]:
        assert "implementingAgency" in w, "Work item missing implementingAgency field"
        assert "implementing_agency" in w, "Work item missing implementing_agency field"
        assert w["implementingAgency"] is not None
        assert len(str(w["implementingAgency"]).strip()) > 0

    anomalies = json_data["data"].get("anomalies", [])
    for a in anomalies[:10]:
        assert "implementingAgency" in a
        assert a["implementingAgency"] is not None


def test_state_works_endpoint_implementing_agency():
    start = time.time()
    response = client.get("/api/states/BIHAR/works?page=1&page_size=20")
    elapsed = time.time() - start
    assert response.status_code == 200
    assert elapsed < 0.5, f"Response took {elapsed:.2f}s, expected < 0.5s"

    json_data = response.json()
    assert "data" in json_data
    records = json_data["data"]
    assert len(records) > 0
    for w in records:
        assert "implementingAgency" in w
        assert "implementing_agency" in w
        assert w["implementingAgency"] is not None


def test_state_flags_endpoint_implementing_agency():
    start = time.time()
    response = client.get("/api/states/BIHAR/flags?page=1&page_size=20")
    elapsed = time.time() - start
    assert response.status_code == 200
    assert elapsed < 0.5, f"Response took {elapsed:.2f}s, expected < 0.5s"

    json_data = response.json()
    assert "data" in json_data
    flags = json_data["data"]
    if len(flags) > 0:
        for f in flags:
            assert "implementingAgency" in f
            assert f["implementingAgency"] is not None


def test_flags_endpoint_agency_filter():
    start = time.time()
    response = client.get("/api/flags?limit=20")
    elapsed = time.time() - start
    assert response.status_code == 200
    assert elapsed < 0.5, f"Response took {elapsed:.2f}s, expected < 0.5s"

    json_data = response.json()
    assert "data" in json_data
    flags = json_data["data"]
    if len(flags) > 0:
        for f in flags:
            assert "implementingAgency" in f
            assert "implementing_agency" in f
            assert f["implementingAgency"] is not None


def test_mp_detail_endpoint_implementing_agency():
    # First get an MP id
    res_mps = client.get("/api/mps?page=1&page_size=5")
    assert res_mps.status_code == 200
    mps = res_mps.json()["data"]
    assert len(mps) > 0
    mp_id = mps[0]["id"]

    start = time.time()
    response = client.get(f"/api/mps/{mp_id}")
    elapsed = time.time() - start
    assert response.status_code == 200
    assert elapsed < 0.5, f"Response took {elapsed:.2f}s, expected < 0.5s"

    json_data = response.json()["data"]
    works = json_data.get("works", [])
    if len(works) > 0:
        for w in works[:10]:
            assert "implementingAgency" in w
            assert "implementing_agency" in w
            assert w["implementingAgency"] is not None
