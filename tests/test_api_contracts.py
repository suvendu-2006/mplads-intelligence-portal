from fastapi.testclient import TestClient
from webapi.main import app

client = TestClient(app)


def test_states_sorting_and_validation():
    """Verify state list sorting options and invalid query parameter rejection."""
    res_desc = client.get("/api/states?sort=utilization&order=desc")
    assert res_desc.status_code == 200
    utils_desc = [item["utilizationPercentage"] for item in res_desc.json()["data"]]
    assert utils_desc == sorted(utils_desc, reverse=True)

    res_asc = client.get("/api/states?sort=red_pct&order=asc")
    assert res_asc.status_code == 200
    red_asc = [item["redFlagPct"] for item in res_asc.json()["data"]]
    assert red_asc == sorted(red_asc)

    res_invalid = client.get("/api/states?sort=invalid_field")
    assert res_invalid.status_code == 422


def test_state_code_resolution_and_not_found():
    """Verify two-letter postal/ISO state code resolution and 404 on unknown states."""
    for code, expected_name in [("OR", "Odisha"), ("OD", "Odisha"), ("TS", "Telangana")]:
        res = client.get(f"/api/states/{code}")
        assert res.status_code == 200
        assert res.json()["data"]["state"] == expected_name

    res_missing = client.get("/api/states/NONEXISTENT_STATE_XYZ")
    assert res_missing.status_code == 404


def test_state_flags_and_works_pagination():
    """Verify state-scoped flags and works endpoints honor pagination and tier filters."""
    res_flags = client.get("/api/states/HIMACHAL%20PRADESH/flags?tier=red&page=1&page_size=5")
    assert res_flags.status_code == 200
    body = res_flags.json()
    assert len(body["data"]) <= 5
    assert body["meta"]["page"] == 1
    assert body["meta"]["page_size"] == 5
    for flag in body["data"]:
        assert flag["severity"] >= 0.70

    res_works = client.get("/api/states/HIMACHAL%20PRADESH/works?page=1&page_size=5")
    assert res_works.status_code == 200
    assert len(res_works.json()["data"]) <= 5


def test_flags_search_filters_and_bounds():
    """Verify flags search (numeric ID vs keyword) and page_size upper bound."""
    res_list = client.get("/api/flags?page=1&page_size=1")
    assert res_list.status_code == 200
    sample_id = res_list.json()["data"][0]["work_id"]

    res_by_id = client.get(f"/api/flags?q={sample_id}")
    assert res_by_id.status_code == 200
    assert any(item["work_id"] == sample_id for item in res_by_id.json()["data"])

    res_too_large = client.get("/api/flags?page_size=500")
    assert res_too_large.status_code == 422


def test_entity_risks_contracts():
    """Verify entity-risks supports both ida and mp types with state filtering and validation."""
    for entity_type in ("ida", "mp"):
        res = client.get(f"/api/entity-risks?entity_type={entity_type}&page=1&page_size=5")
        assert res.status_code == 200
        items = res.json()["data"]
        assert len(items) <= 5

    res_bad = client.get("/api/entity-risks?entity_type=contractor")
    assert res_bad.status_code == 422


def test_unknown_district_and_constituency_return_404():
    """Verify 404 responses with informative details for unknown geographical entities."""
    res_dist = client.get("/api/districts/NONEXISTENT_DISTRICT_999")
    assert res_dist.status_code == 404

    res_const = client.get("/api/constituencies/NONEXISTENT_CONSTITUENCY_999")
    assert res_const.status_code == 404


def test_my_state_denies_citizen_viewer_role():
    """Verify switching to viewer role fails authorization on /api/my-state."""
    r_switch = client.post("/api/switch-role", json={"role": "viewer"})
    assert r_switch.status_code == 200
    token = r_switch.json()["data"]["session_token"]

    r_denied = client.get("/api/my-state", headers={"X-Session-Token": token})
    assert r_denied.status_code == 403


def test_flags_csv_export_bom_and_columns():
    """Verify streamed flags CSV includes UTF-8 BOM and full forensic column header."""
    res = client.get("/api/flags/export?tier=red&state=Goa")
    assert res.status_code == 200
    assert res.text.startswith("\ufeff")
    first_line = res.text.lstrip("\ufeff").splitlines()[0]
    for col in ("work_id", "detector_type", "severity", "evidence_json"):
        assert col in first_line
