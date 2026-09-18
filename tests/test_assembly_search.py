"""
Automated unit and integration test suite for Assembly Constituency (AC) search,
MP lookup resolution, and parent Parliamentary Constituency (PC) mapping.
"""

import time
import pytest
from fastapi.testclient import TestClient
from webapi.main import app

client = TestClient(app)

def test_mps_query_padampur():
    """Verify /api/mps?q=Padampur returns PRADEEP PUROHIT (Bargarh, Odisha)."""
    start = time.time()
    res = client.get("/api/mps?q=Padampur")
    elapsed = time.time() - start

    assert res.status_code == 200, f"Expected 200 OK, got {res.status_code}"
    assert elapsed < 0.5, f"Endpoint took too long: {elapsed:.3f}s"

    data = res.json().get("data", [])
    assert len(data) > 0, "Expected at least 1 MP matching Padampur"

    mp_names = [m.get("mpName") for m in data]
    constituencies = [m.get("constituency") for m in data]

    assert "PRADEEP PUROHIT" in mp_names, f"PRADEEP PUROHIT missing in {mp_names}"
    assert "BARGARH" in constituencies, f"BARGARH missing in {constituencies}"

    purohit = next(m for m in data if m.get("mpName") == "PRADEEP PUROHIT")
    assert purohit.get("state") == "Odisha"
    assert purohit.get("matched_via") == "assembly_constituency"

def test_mps_query_bijepur():
    """Verify /api/mps?q=Bijepur returns PRADEEP PUROHIT (Bargarh, Odisha)."""
    res = client.get("/api/mps?q=Bijepur")
    assert res.status_code == 200
    data = res.json().get("data", [])
    assert any(m.get("mpName") == "PRADEEP PUROHIT" and m.get("constituency") == "BARGARH" for m in data)

def test_mps_query_rohini():
    """Verify /api/mps?q=Rohini returns North West Delhi MP."""
    res = client.get("/api/mps?q=Rohini")
    assert res.status_code == 200
    data = res.json().get("data", [])
    constituencies = [m.get("constituency") for m in data]
    assert any("DELHI" in c.upper() for c in constituencies)

def test_mp_detail_by_padampur():
    """Verify /api/mps/PADAMPUR resolves with 200 OK to PRADEEP PUROHIT profile."""
    res = client.get("/api/mps/PADAMPUR")
    assert res.status_code == 200, f"Expected 200 OK, got {res.status_code}: {res.text}"
    body = res.json()
    summary = body.get("data", {}).get("summary", {})

    assert summary.get("mpName") == "PRADEEP PUROHIT"
    assert summary.get("constituency") == "BARGARH"
    assert summary.get("state") == "Odisha"
    assert summary.get("matched_assembly_constituency") == "Padampur"
    assert "BARGARH" in summary.get("all_assemblies_in_pc", []) or len(summary.get("all_assemblies_in_pc", [])) >= 5

def test_mp_detail_case_insensitive():
    """Verify /api/mps/Padampur case-insensitively resolves."""
    res = client.get("/api/mps/Padampur")
    assert res.status_code == 200
    summary = res.json().get("data", {}).get("summary", {})
    assert summary.get("mpName") == "PRADEEP PUROHIT"

def test_mp_detail_by_bijepur():
    """Verify /api/mps/BIJEPUR resolves with 200 OK to PRADEEP PUROHIT."""
    res = client.get("/api/mps/BIJEPUR")
    assert res.status_code == 200
    summary = res.json().get("data", {}).get("summary", {})
    assert summary.get("mpName") == "PRADEEP PUROHIT"
    assert summary.get("constituency") == "BARGARH"

def test_mp_detail_by_rohini():
    """Verify /api/mps/ROHINI resolves to Delhi North West MP profile."""
    res = client.get("/api/mps/ROHINI")
    assert res.status_code == 200
    summary = res.json().get("data", {}).get("summary", {})
    assert "DELHI" in summary.get("constituency", "").upper()

def test_mp_detail_invalid_ac():
    """Verify non-existent constituency returns 404 with informative message."""
    res = client.get("/api/mps/NON_EXISTENT_XYZ_123")
    assert res.status_code == 404
    detail = res.json().get("detail", "")
    assert "No MP found" in detail

def test_existing_pc_precedence():
    """Verify existing Parliamentary Constituencies like VARANASI still resolve accurately."""
    res = client.get("/api/mps/VARANASI")
    assert res.status_code == 200
    summary = res.json().get("data", {}).get("summary", {})
    assert summary.get("constituency") == "VARANASI"
    assert summary.get("mpName") == "Shri Narendra Modi"
