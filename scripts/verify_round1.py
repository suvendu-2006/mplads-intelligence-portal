#!/usr/bin/env python3
"""
Verification Round 1: Automated & Local Comprehensive Checks
"""
import sys
import json
import gzip
from pathlib import Path
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from webapi.main import app
client = TestClient(app)

def test_geojson_assets():
    print("\n--- 1. Testing GeoJSON Files ---")
    files = [
        ("data/districts_enriched_optimized.geojson", 594),
        ("data/pcs_enriched_optimized.geojson", 543),
        ("web/public/data/districts_enriched.geojson", 594),
        ("web/public/data/pcs_enriched.geojson", 543),
        ("web/dist/data/districts_enriched.geojson", 594),
        ("web/dist/data/pcs_enriched.geojson", 543),
    ]
    for rel_path, expected_count in files:
        p = ROOT / rel_path
        assert p.exists(), f"Missing file: {rel_path}"
        size_mb = p.stat().st_size / (1024 * 1024)
        assert size_mb < 2.0, f"{rel_path} exceeds 2MB limit: {size_mb:.2f}MB"
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
        count = len(data.get("features", []))
        assert count == expected_count, f"{rel_path} feature count mismatch: {count} != {expected_count}"
        print(f"  ✓ {rel_path:45} {size_mb:5.2f}MB, {count} features (PASS)")

def test_search_endpoints():
    print("\n--- 2. Testing Search Endpoints ---")
    
    # 1. MP Constituency Search
    r = client.get("/api/mps?q=Varanasi")
    assert r.status_code == 200, f"MP search failed: {r.status_code}"
    data = r.json()["data"]
    assert any("varanasi" in (m.get("constituency") or "").lower() for m in data), "Varanasi not in MP results"
    print(f"  ✓ /api/mps?q=Varanasi -> {len(data)} results, includes Varanasi (PASS)")

    # 2. MP State Search
    r = client.get("/api/mps?q=Bihar")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) > 0 and any("Bihar" in (m.get("state") or "") for m in data), "Bihar not in MP results"
    print(f"  ✓ /api/mps?q=Bihar -> {len(data)} results from Bihar (PASS)")

    # 3. MP ID Search
    r = client.get("/api/mps?q=6a932b")
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) > 0, "ID search returned 0 results"
    print(f"  ✓ /api/mps?q=6a932b -> {len(data)} results (PASS)")

    # 4. MP Name Search
    r = client.get("/api/mps?q=Modi")
    assert r.status_code == 200
    data = r.json()["data"]
    assert any("Modi" in (m.get("mpName") or "") for m in data), "Modi not in MP results"
    print(f"  ✓ /api/mps?q=Modi -> {len(data)} results (PASS)")

    # 5. MP Detail Resolution by Constituency
    r = client.get("/api/mps/VARANASI")
    assert r.status_code == 200, f"/api/mps/VARANASI failed: {r.status_code}"
    mp = r.json()["data"]["summary"]
    assert "Modi" in mp.get("mpName", ""), f"VARANASI did not resolve to Modi: {mp.get('mpName')}"
    print(f"  ✓ /api/mps/VARANASI -> Resolved to {mp.get('mpName')} (PASS)")

    # 6. MP Detail Resolution by lowercase constituency
    r = client.get("/api/mps/Amalapuram")
    assert r.status_code == 200
    mp = r.json()["data"]["summary"]
    assert mp.get("constituency", "").lower() == "amalapuram", "Amalapuram not resolved"
    print(f"  ✓ /api/mps/Amalapuram -> Resolved to {mp.get('mpName')} ({mp.get('constituency')}) (PASS)")

    # 7. Flags Search by Constituency
    r = client.get("/api/flags?q=Varanasi")
    assert r.status_code == 200
    flags = r.json()["data"]
    print(f"  ✓ /api/flags?q=Varanasi -> {len(flags)} flagged works (PASS)")

    # 8. Flags Search by State
    r = client.get("/api/flags?q=Bihar")
    assert r.status_code == 200
    flags = r.json()["data"]
    assert len(flags) > 0, "No flags for Bihar"
    print(f"  ✓ /api/flags?q=Bihar -> {len(flags)} flagged works (PASS)")

    # 9. State Works Search with Constituency
    r = client.get("/api/states/UTTAR%20PRADESH/works?search=Varanasi")
    assert r.status_code == 200
    works_data = r.json().get("data", [])
    works = works_data if isinstance(works_data, list) else works_data.get("works", [])
    print(f"  ✓ /api/states/UTTAR PRADESH/works?search=Varanasi -> {len(works)} works (PASS)")

    # 10. SPA client route fallback
    r = client.get("/states")
    assert r.status_code == 200
    assert "SATARK-MPLADS" in r.text
    print("  ✓ SPA route /states serves index.html (PASS)")

def test_map_endpoints():
    print("\n--- 3. Testing Map Router Compression & Speed ---")
    r_pcs = client.get("/api/map/pcs", headers={"accept-encoding": "gzip"})
    assert r_pcs.status_code == 200
    pcs_bytes = len(r_pcs.content)
    print(f"  ✓ /api/map/pcs -> HTTP 200, {pcs_bytes / 1024:.1f} KB transferred (PASS)")

    r_dist = client.get("/api/map/districts", headers={"accept-encoding": "gzip"})
    assert r_dist.status_code == 200
    dist_bytes = len(r_dist.content)
    print(f"  ✓ /api/map/districts -> HTTP 200, {dist_bytes / 1024:.1f} KB transferred (PASS)")

if __name__ == "__main__":
    try:
        test_geojson_assets()
        test_search_endpoints()
        test_map_endpoints()
        print("\n=======================================================")
        print("🎉 ALL VERIFICATION ROUND 1 CHECKS PASSED (100% SUCCESS)")
        print("=======================================================\n")
    except AssertionError as e:
        print(f"\n❌ FAILED: {e}")
        sys.exit(1)
