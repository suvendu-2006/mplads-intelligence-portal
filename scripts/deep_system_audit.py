"""
Comprehensive Deep Audit Suite for SATARK-MPLADS Web API
Tests all 36 states, sample MPs, districts, flags, analytics, and data contracts.
"""
import urllib.request
import urllib.parse
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def get(endpoint):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, headers={"User-Agent": "DeepAuditSuite/2.0"})
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"Endpoint {endpoint} failed with status {resp.status}"
        return json.loads(resp.read().decode("utf-8"))

def audit_national():
    print("\n--- 1. Auditing National Dashboard ---")
    data = get("/api/national")["data"]
    assert data["totalAllocated"] > 1e11, "totalAllocated should be > ₹10,000 Cr"
    assert data["totalExpenditure"] > 3e10, "totalExpenditure should be > ₹3,000 Cr"
    assert 30 <= data["utilizationPercentage"] <= 40, f"utilizationPercentage should be ~33.9%, got {data['utilizationPercentage']}"
    assert data["pendingWorks"] >= 0, "pendingWorks cannot be negative"
    assert data["totalWorksCompleted"] > 0, "totalWorksCompleted must be positive"
    assert data["totalMPs"] == 774, f"Expected 774 MPs, got {data['totalMPs']}"
    print(f"✓ National KPI: Allocated=₹{data['totalAllocated']/1e7:.0f} Cr, Used=₹{data['totalExpenditure']/1e7:.0f} Cr, Utilization={data['utilizationPercentage']:.1f}%")

    analytics = get("/api/national/analytics")["data"]
    assert "topSectors" in analytics and len(analytics["topSectors"]) > 0, "topSectors missing"
    assert "yearlyTrends" in analytics and len(analytics["yearlyTrends"]) > 0, "yearlyTrends missing"
    total_sector_pct = sum(s["sharePct"] for s in analytics["topSectors"])
    print(f"✓ Analytics: {len(analytics['topSectors'])} sectors ({total_sector_pct:.1f}% sampled), {len(analytics['yearlyTrends'])} trend years")

def audit_all_36_states():
    print("\n--- 2. Auditing All 36 States & UTs ---")
    states_list = get("/api/states")["data"]
    assert len(states_list) == 36, f"Expected 36 states, got {len(states_list)}"
    
    total_state_alloc = 0.0
    for st in states_list:
        state_name = st["state"]
        alloc = st.get("totalAllocated", 0)
        exp = st.get("totalExpenditure", 0)
        util = st.get("utilizationPercentage", 0)
        red_pct = st.get("red_pct", 0)
        total_state_alloc += alloc

        # Assert no negative values
        assert alloc >= 0, f"State {state_name} has negative allocation"
        assert exp >= 0, f"State {state_name} has negative expenditure"
        assert 0 <= util <= 100, f"State {state_name} has invalid utilization {util}"
        assert 0 <= red_pct <= 100, f"State {state_name} has invalid red_pct {red_pct}"
        
        # Test state detail endpoint
        detail = get(f"/api/states/{urllib.parse.quote(state_name)}")["data"]
        assert detail["state"] == state_name, f"Detail state mismatch for {state_name}"
        assert len(detail["districts"]) > 0, f"State {state_name} has no districts"

        # Test state flags endpoint (first page)
        flags_resp = get(f"/api/states/{urllib.parse.quote(state_name)}/flags?page=1&page_size=5")
        flags = flags_resp["data"]
        for f in flags:
            assert f["work_id"] > 0, f"Invalid work_id in {state_name}"
            assert len(f["work_description"].strip()) > 0, f"Empty work_description in {state_name}"
            assert f["workDescription"] == f["work_description"], f"workDescription alias mismatch in {state_name}"
            assert f["detectorName"] == f["detector_name"], f"detectorName alias mismatch in {state_name}"
            assert f["cost"] >= 0, f"Negative cost in {state_name}"
            assert f["district"], f"Empty district in {state_name}"
            assert f["severity"] >= 0.30, f"Severity out of range in {state_name}"

    print(f"✓ All 36 states verified! Total state allocation sum = ₹{total_state_alloc/1e7:.0f} Cr")

def audit_mps():
    print("\n--- 3. Auditing MPs Section ---")
    mps_resp = get("/api/mps?page=1&page_size=10")
    total_mps = mps_resp["meta"]["total"]
    assert total_mps == 774, f"Expected 774 total MPs, got {total_mps}"
    
    sample_mp_ids = [
        ("6a932b5bcd944524379eddd9", "Anurag Singh Thakur"),
        ("6a932b5ecd944524379ee207", "Dr. Santrupt Misra"),
    ]
    for mp_id, expected_name in sample_mp_ids:
        mp_data = get(f"/api/mps/{mp_id}")["data"]
        summary = mp_data["summary"]
        print(f"✓ Verified MP #{mp_id}: {summary['mpName']} ({summary['house']}, {summary['state']})")
        assert summary["allocatedAmount"] > 0, "MP allocated amount should be > 0"
        
        dossier = mp_data.get("dossier")
        assert dossier is not None, "Dossier should not be None"
        print(f"  Dossier: Education={dossier.get('education')}, Criminal cases={dossier.get('criminal_cases')}, Assets={dossier.get('total_assets')}")

def audit_districts():
    print("\n--- 4. Auditing District Dashboards ---")
    sample_districts = ["SHIMLA", "PILIBHIT", "VARANASI", "LUCKNOW", "KANGRA"]
    for dist in sample_districts:
        d = get(f"/api/districts/{urllib.parse.quote(dist)}")["data"]
        summary = d["summary"]
        assert summary["district"] == dist, f"District name mismatch {summary['district']} vs {dist}"
        assert summary["totalWorks"] > 0, f"No works in district {dist}"
        print(f"✓ District {dist}: {summary['totalWorks']} works, {summary['completedWorks']} completed ({summary['completionRate']:.1f}%), {len(d['works'])} sampled works")

def audit_flags_and_export():
    print("\n--- 5. Auditing Forensic Flags & CSV Export ---")
    flags_resp = get("/api/flags?page=1&page_size=10")
    assert flags_resp["meta"]["total"] > 0, "No flags returned"
    for f in flags_resp["data"]:
        assert f["workDescription"], "Missing workDescription alias"
        assert f["detectorName"], "Missing detectorName alias"
        assert f["sanctionedCost"] is not None, "Missing sanctionedCost alias"

    # Verify CSV export
    csv_url = f"{BASE_URL}/api/flags/export"
    req = urllib.request.Request(csv_url)
    with urllib.request.urlopen(req) as resp:
        content = resp.read()
        assert content.startswith(b"\xef\xbb\xbf"), "CSV missing UTF-8 BOM"
        lines = content.decode("utf-8-sig").splitlines()
        header = lines[0].split(",")
        assert "work_id" in header or "Work ID" in header, f"Invalid CSV header: {header}"
        assert len(lines) > 50, f"Expected >50 CSV lines, got {len(lines)}"
        print(f"✓ Flags CSV Export verified: {len(lines)-1} rows with UTF-8 BOM")

if __name__ == "__main__":
    try:
        audit_national()
        audit_all_36_states()
        audit_mps()
        audit_districts()
        audit_flags_and_export()
        print("\n=======================================================")
        print("ALL SYSTEM & DATA CONTRACT AUDITS PASSED FLAWLESSLY!")
        print("=======================================================\n")
    except Exception as e:
        print(f"\n❌ AUDIT FAILED: {e}", file=sys.stderr)
        sys.exit(1)
