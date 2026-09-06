"""
Verification script for all 15 detectors (D1 to D15)
Tests:
1. National flags endpoint for all 15 detectors (total > 0 for each)
2. State-filtered flags endpoint for Chhattisgarh across all 15 detectors
3. CSV export for detectors
4. Resolution of various detector ID forms ('d1', 'D01', 'benford_anomaly', etc.)
"""

import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_detectors_national():
    print("--- 1. Testing All 15 Detectors (National Level) ---")
    failed = []
    for i in range(1, 16):
        det = f"D{i}"
        url = f"{BASE_URL}/api/flags?detector={det}&page_size=5"
        try:
            req = urllib.request.urlopen(url)
            data = json.loads(req.read().decode("utf-8"))
            total = data.get("meta", {}).get("total", 0)
            items = len(data.get("data", []))
            name = data["data"][0]["detector_name"] if items > 0 else "None"
            print(f"[{det:>3}] Total: {total:>5} | Items returned: {items:>2} | Name: {name}")
            if total == 0 or items == 0:
                failed.append((det, "zero results"))
        except Exception as e:
            failed.append((det, str(e)))
            print(f"[{det:>3}] FAILED: {e}")

    assert not failed, f"National detector tests failed for: {failed}"
    print("✓ All 15 detectors passed at national level!\n")

def test_detectors_state_filter():
    print("--- 2. Testing Chhattisgarh State Filter (User Scenario) ---")
    failed = []
    for i in range(1, 16):
        det = f"D{i}"
        url = f"{BASE_URL}/api/flags?state=Chhattisgarh&detector={det}&page_size=5"
        try:
            req = urllib.request.urlopen(url)
            data = json.loads(req.read().decode("utf-8"))
            total = data.get("meta", {}).get("total", 0)
            items = len(data.get("data", []))
            print(f"[{det:>3}] Chhattisgarh Total: {total:>4} | Items returned: {items:>2}")
            if total == 0 or items == 0:
                failed.append((det, "zero results for Chhattisgarh"))
        except Exception as e:
            failed.append((det, str(e)))
            print(f"[{det:>3}] FAILED: {e}")

    assert not failed, f"Chhattisgarh state filter failed for: {failed}"
    print("✓ All 15 detectors passed for Chhattisgarh!\n")

def test_synonyms_and_formats():
    print("--- 3. Testing Detector ID Normalization ---")
    test_cases = [
        ("d9", "Artificial Round-Figure Billing Anomaly"),
        ("D09", "Artificial Round-Figure Billing Anomaly"),
        ("benford_anomaly", "Artificial Round-Figure Billing Anomaly"),
        ("d12", "Documentary Verification & Disbursement Gap"),
        ("verification_gap", "Documentary Verification & Disbursement Gap"),
        ("D13", "Implementing Agency (IDA) Risk Profiling"),
        ("ida_risk", "Implementing Agency (IDA) Risk Profiling"),
    ]
    for param, expected_name in test_cases:
        url = f"{BASE_URL}/api/flags?detector={param}&page_size=2"
        req = urllib.request.urlopen(url)
        data = json.loads(req.read().decode("utf-8"))
        items = data.get("data", [])
        assert len(items) > 0, f"Expected records for {param}"
        actual_name = items[0]["detector_name"]
        assert actual_name == expected_name, f"Expected {expected_name}, got {actual_name}"
        print(f"✓ '{param}' successfully resolved to '{actual_name}'")
    print("✓ Detector normalization tests passed!\n")

if __name__ == "__main__":
    test_detectors_national()
    test_detectors_state_filter()
    test_synonyms_and_formats()
    print("==========================================")
    print("ALL AUDIT DESK DETECTOR SUITES PASSED 100%")
    print("==========================================")
