import pytest
from fastapi.testclient import TestClient
from webapi.main import app

client = TestClient(app)

def test_get_national():
    response = client.get("/api/national")
    assert response.status_code == 200
    json_data = response.json()
    assert "data" in json_data
    assert json_data["data"]["totalMPs"] == 774
    assert json_data["data"]["totalAllocated"] > 0

def test_list_states():
    response = client.get("/api/states")
    assert response.status_code == 200
    json_data = response.json()
    assert len(json_data["data"]) == 36
    first = json_data["data"][0]
    assert "redFlagPct" in first
    assert "totalAllocated" in first

def test_get_state_detail():
    response = client.get("/api/states/HIMACHAL%20PRADESH")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["data"]["state"].upper() == "HIMACHAL PRADESH"
    assert len(json_data["data"]["districts"]) > 0
    first_dist = json_data["data"]["districts"][0]
    assert "tier_counts" in first_dist
    assert "portfolio_value" in first_dist

def test_list_mps():
    response = client.get("/api/mps?page=1&page_size=10")
    assert response.status_code == 200
    json_data = response.json()
    assert len(json_data["data"]) == 10
    assert json_data["meta"]["total"] == 774
    assert json_data["meta"]["has_next"] is True

def test_list_flags():
    response = client.get("/api/flags?page=1&page_size=20")
    assert response.status_code == 200
    json_data = response.json()
    assert len(json_data["data"]) == 20
    first = json_data["data"][0]
    assert "detector_name" in first
    assert "severity" in first
    assert "tier" in first

def test_roles_and_rbac():
    # 1. Get roles
    r_roles = client.get("/api/roles")
    assert r_roles.status_code == 200
    assert len(r_roles.json()["data"]) >= 5

    # 2. Access my-state without token -> 403
    r_unauth = client.get("/api/my-state")
    assert r_unauth.status_code == 403

    # 3. Switch role to state_nodal_officer for Himachal Pradesh
    r_switch = client.post("/api/switch-role", json={
        "role": "state_nodal_officer",
        "state": "HIMACHAL PRADESH"
    })
    assert r_switch.status_code == 200
    token = r_switch.json()["data"]["session_token"]

    # 4. Access my-state with token -> 200
    r_mystate = client.get("/api/my-state", headers={"X-Session-Token": token})
    assert r_mystate.status_code == 200
    assert r_mystate.json()["data"]["state"].upper() == "HIMACHAL PRADESH"

def test_export_flags_csv():
    response = client.get("/api/flags/export?tier=red")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    content = response.text
    assert "work_id,work_description,cost_inr" in content

def test_spa_serving():
    # Verify root serves index.html
    r_root = client.get("/")
    assert r_root.status_code == 200
    assert "SATARK-MPLADS" in r_root.text

    # Verify deep SPA client-side route fallback
    r_spa = client.get("/states")
    assert r_spa.status_code == 200
    assert "SATARK-MPLADS" in r_spa.text

    r_spa2 = client.get("/mps/6a932b5ecd944524379ee2ca")
    assert r_spa2.status_code == 200
    assert "SATARK-MPLADS" in r_spa2.text

def test_csv_bom_handling():
    from webapi.data_service import load_districts_csv, load_states_csv, load_mps_csv
    df_dist = load_districts_csv()
    assert "state" in df_dist.columns
    assert not df_dist.columns[0].startswith("\ufeff")

    df_states = load_states_csv()
    assert "state" in df_states.columns
    assert not df_states.columns[0].startswith("\ufeff")

    df_mps = load_mps_csv()
    assert "id" in df_mps.columns
    assert not df_mps.columns[0].startswith("\ufeff")

def test_tier_counts_no_yellow_for_works():
    from webapi.data_service import get_db
    from mplads_fraud_detection.foundation.schema import Anomaly
    db = next(get_db())
    yellow_count = db.query(Anomaly).filter(
        Anomaly.severity >= 0.30,
        Anomaly.severity < 0.50
    ).count()
    assert yellow_count == 0, "DB check constraint ensures severity >= 0.50 for all anomalies"

def test_entity_risk_scale():
    from webapi.data_service import get_db
    from mplads_fraud_detection.foundation.schema import EntityRisk
    from sqlalchemy import func
    db = next(get_db())
    max_risk = db.query(func.max(EntityRisk.composite_risk)).scalar()
    min_risk = db.query(func.min(EntityRisk.composite_risk)).scalar()
    assert max_risk is not None
    assert 18.0 <= max_risk <= 20.0, f"Max risk {max_risk} should fall in 18-20 range"
    assert 0.0 <= min_risk < 10.0, f"Min risk {min_risk} should be < 10"

def test_cpwd_benchmarks_meta():
    response = client.get("/api/meta/cpwd-benchmarks")
    assert response.status_code == 200
    json_data = response.json()
    assert len(json_data["data"]) >= 15
    first = json_data["data"][0]
    assert "category" in first
    assert "standard_rate_inr" in first
    assert "tolerance_pct_upper" in first

def test_national_analytics():
    response = client.get("/api/national/analytics")
    assert response.status_code == 200
    json_data = response.json()
    assert "data" in json_data
    data = json_data["data"]
    assert "yearlyTrends" in data
    assert len(data["yearlyTrends"]) >= 3
    assert "topSectors" in data
    assert len(data["topSectors"]) >= 5
    assert data["totalExpenditure"] > 0

def test_mp_dossier_adr():
    # Test that MP details load real ADR demographics (party, criminal_cases, education, assets)
    response = client.get("/api/mps/6a932b5bcd944524379ede55")
    assert response.status_code == 200
    json_data = response.json()
    dossier = json_data["data"]["dossier"]
    assert dossier is not None
    assert dossier.get("education") == "Graduate"
    assert dossier.get("party") == "BJP"
    assert dossier.get("criminal_cases") == 45
    assert "54" in str(dossier.get("total_assets"))

def test_districts_endpoints():
    response = client.get("/api/districts?page_size=10")
    assert response.status_code == 200
    json_data = response.json()
    assert len(json_data["data"]) == 10
    first_district = json_data["data"][0]["district"]
    
    # Test single district detail
    detail_res = client.get(f"/api/districts/{first_district}")
    assert detail_res.status_code == 200
    detail_json = detail_res.json()
    assert "summary" in detail_json["data"]
    assert "works" in detail_json["data"]

