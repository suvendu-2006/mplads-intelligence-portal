from fastapi.testclient import TestClient
from webapi.main import app

client = TestClient(app)


def test_bidirectional_renamed_district_parity():
    """Old and new Indian district names must resolve to the same canonical district summary and work set."""
    alias_pairs = [
        ("PRAYAGRAJ", "ALLAHABAD", "Uttar Pradesh"),
        ("AYODHYA", "FAIZABAD", "Uttar Pradesh"),
        ("BELAGAVI", "BELGAUM", "Karnataka"),
        ("GURUGRAM", "GURGAON", "Haryana"),
        ("NARMADAPURAM", "HOSHANGABAD", "Madhya Pradesh"),
    ]
    for canonical, legacy, expected_state in alias_pairs:
        res_new = client.get(f"/api/districts/{canonical}")
        res_old = client.get(f"/api/districts/{legacy}")
        assert res_new.status_code == 200
        assert res_old.status_code == 200

        sum_new = res_new.json()["data"]["summary"]
        sum_old = res_old.json()["data"]["summary"]
        assert sum_new["district"] == canonical
        assert sum_old["district"] == canonical
        assert sum_new["state"] == expected_state
        assert sum_old["state"] == expected_state
        assert sum_new["totalWorks"] == sum_old["totalWorks"]
        assert len(res_new.json()["data"]["works"]) == len(res_old.json()["data"]["works"])


def test_state_scoped_renamed_district_avoids_aurangabad_collision():
    """Chhatrapati Sambhajinagar must stay scoped to Maharashtra without mixing Bihar's Aurangabad."""
    res_mh = client.get("/api/districts/CHHATRAPATI%20SAMBHAJINAGAR")
    assert res_mh.status_code == 200
    data_mh = res_mh.json()["data"]
    assert data_mh["summary"]["state"] == "Maharashtra"
    assert len(data_mh["works"]) == 77

    # Direct AURANGABAD lookup must continue resolving Bihar's Aurangabad cleanly
    res_br = client.get("/api/districts/AURANGABAD")
    assert res_br.status_code == 200
    assert res_br.json()["data"]["summary"]["state"] == "Bihar"
