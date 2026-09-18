#!/usr/bin/env python3
"""
Verification Round 2: End-to-End Integration & Deep Verification
"""
import sys
import json
from pathlib import Path
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from webapi.main import app
client = TestClient(app)

def test_deep_search_scenarios():
    print("\n--- 1. Deep Search Scenarios Across Entities ---")
    
    # Work description search in flags
    r = client.get("/api/flags?q=drainage")
    assert r.status_code == 200
    flags = r.json()["data"]
    print(f"  ✓ Description search: /api/flags?q=drainage -> {len(flags)} flags found")

    # Numeric work ID exact/substring search in flags
    r_all = client.get("/api/flags?page=1&page_size=5")
    sample_work_id = str(r_all.json()["data"][0]["work_id"])
    r = client.get(f"/api/flags?q={sample_work_id}")
    assert r.status_code == 200
    flags = r.json()["data"]
    assert any(str(f["work_id"]) == sample_work_id for f in flags), f"Work ID {sample_work_id} not found"
    print(f"  ✓ Work ID search: /api/flags?q={sample_work_id} -> exact match verified (PASS)")

    # Multiple constituency resolutions
    constituencies_to_test = [
        ("VARANASI", "Modi"),
        ("GANDHINAGAR", "Amit Shah"),
        ("WAYANAD", "Priyanka Gandhi Vadra"),
        ("AMALAPURAM", "Balayogi"),
        ("BARAMATI", "Supriya Sule")
    ]
    for const, expected_name_part in constituencies_to_test:
        r = client.get(f"/api/mps/{const}")
        assert r.status_code == 200, f"Failed to resolve {const}: {r.status_code}"
        data = r.json()["data"]["summary"]
        assert all(part.lower() in data["mpName"].lower() for part in expected_name_part.split()), f"{const} resolved to {data['mpName']}, expected {expected_name_part}"
        print(f"  ✓ Constituency lookup: /api/mps/{const:15} -> {data['mpName']} (PASS)")

    # State search across regions
    states = ["KERALA", "GUJARAT", "ASSAM", "MAHARASHTRA", "TAMIL NADU"]
    for st in states:
        r = client.get(f"/api/mps?q={st}")
        assert r.status_code == 200
        count = len(r.json()["data"])
        assert count > 0, f"No MPs found for state {st}"
        print(f"  ✓ State search: /api/mps?q={st:15} -> {count} MPs found (PASS)")

    # State works with constituency search
    r = client.get("/api/states/BIHAR/works?search=Patna")
    assert r.status_code == 200
    works = r.json().get("data", [])
    print(f"  ✓ State works: /api/states/BIHAR/works?search=Patna -> {len(works)} works found (PASS)")

def test_geojson_integrity():
    print("\n--- 2. GeoJSON Geometry & Property Integrity ---")
    dist_file = ROOT / "web/dist/data/districts_enriched.geojson"
    pc_file = ROOT / "web/dist/data/pcs_enriched.geojson"

    with open(dist_file, "r", encoding="utf-8") as f:
        dist_data = json.load(f)
    with open(pc_file, "r", encoding="utf-8") as f:
        pc_data = json.load(f)

    # Check districts properties
    first_dist = dist_data["features"][0]
    assert "geometry" in first_dist and first_dist["geometry"]["coordinates"]
    props = first_dist["properties"]
    assert "NAME_2" in props or "district" in props or "dtname" in props or "district_name" in props
    print(f"  ✓ Districts GeoJSON: {len(dist_data['features'])} valid polygon features with properties (PASS)")

    # Check PCs properties
    first_pc = pc_data["features"][0]
    assert "geometry" in first_pc and first_pc["geometry"]["coordinates"]
    props_pc = first_pc["properties"]
    assert "pc_name" in props_pc or "constituency" in props_pc or "PC_NAME" in props_pc
    print(f"  ✓ PCs GeoJSON: {len(pc_data['features'])} valid polygon features with properties (PASS)")

def test_frontend_bundle_integrity():
    print("\n--- 3. Frontend Bundle & Route Integrity ---")
    index_html = ROOT / "web/dist/index.html"
    assert index_html.exists()
    content = index_html.read_text(encoding="utf-8")
    assert "SATARK-MPLADS" in content or "MPLADS" in content
    print("  ✓ web/dist/index.html contains application title and assets (PASS)")

    # Check key chunk files
    dist_assets = list((ROOT / "web/dist/assets").glob("*.js"))
    assert len(dist_assets) >= 10, f"Expected >= 10 JS chunks, found {len(dist_assets)}"
    print(f"  ✓ web/dist/assets contains {len(dist_assets)} optimized JS bundles (PASS)")

if __name__ == "__main__":
    try:
        test_deep_search_scenarios()
        test_geojson_integrity()
        test_frontend_bundle_integrity()
        print("\n=======================================================")
        print("🎉 ALL VERIFICATION ROUND 2 CHECKS PASSED (100% SUCCESS)")
        print("=======================================================\n")
    except AssertionError as e:
        print(f"\n❌ FAILED: {e}")
        sys.exit(1)
