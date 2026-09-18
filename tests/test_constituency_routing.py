import pytest
from fastapi.testclient import TestClient
from webapi.main import app

client = TestClient(app)

def test_parliamentary_constituency_bargarh():
    res = client.get("/api/constituencies/BARGARH")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["parliamentary_constituency"].upper() == "BARGARH"
    assert "PRADEEP PUROHIT" in data["representative_mp"]["name"]
    assert data["state"] == "Odisha"
    assert len(data["assemblies"]) >= 7
    ac_names = [a["ac_name"].lower() for a in data["assemblies"]]
    assert "bijepur" in ac_names
    assert "padampur" in ac_names

def test_assembly_constituency_bijepur():
    res = client.get("/api/constituencies/Bijepur")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["constituency_type"] == "assembly"
    assert data["display_name"].lower() == "bijepur"
    assert data["parliamentary_constituency"].upper() == "BARGARH"
    assert "PRADEEP PUROHIT" in data["representative_mp"]["name"]
    assert data["state"] == "Odisha"

def test_assembly_constituency_padampur():
    res = client.get("/api/constituencies/Padampur")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["constituency_type"] == "assembly"
    assert data["display_name"].lower() == "padampur"
    assert data["parliamentary_constituency"].upper() == "BARGARH"
    assert "PRADEEP PUROHIT" in data["representative_mp"]["name"]
    assert data["state"] == "Odisha"

def test_constituency_with_ac_param():
    res = client.get("/api/constituencies/BARGARH?ac=Bijepur")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["assembly_constituency"] == "Bijepur"
    assert data["parliamentary_constituency"].upper() == "BARGARH"

def test_constituency_varanasi():
    res = client.get("/api/constituencies/Varanasi")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "Narendra Modi" in data["representative_mp"]["name"]
    assert data["state"] == "Uttar Pradesh"

def test_non_existent_constituency():
    res = client.get("/api/constituencies/TotallyFakeConstituency999")
    assert res.status_code == 404
