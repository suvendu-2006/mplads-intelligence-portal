"""
Comprehensive verification suite for deterministic Vidhan Sabha Assembly Segment
partitioning across MPLADS Parliamentary Constituencies and MP profiles.
"""

from __future__ import annotations

import json
import re
import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func

from mplads_fraud_detection.foundation.schema import Work
from webapi.config import BASE_DIR
from webapi.data_service import get_db, load_mps_csv
from webapi.main import app
from webapi.services.assembly_segment_resolver import (
    UNSPECIFIED_SEGMENT,
    assign_segments_for_pc,
)
from webapi.services.assembly_service import get_assemblies_by_pc

client = TestClient(app)

KEY_PCS = [
    "KENDRAPARA",
    "VARANASI",
    "GURGAON",
    "ELURU",
    "PATNA SAHIB",
    "MUMBAI NORTH",
    "MUMBAI NORTH EAST",
    "JANJGIR CHAMPA",
]

UTS_WITHOUT_LEGISLATURE = {
    "ANDAMAN AND NICOBAR ISLANDS",
    "CHANDIGARH",
    "DADRA & NAGAR HAVELI",
    "DAMAN AND DIU",
    "LAKSHADWEEP",
}


def _assert_partition_invariant(
    label: str,
    summary: Dict[str, Any],
    works: List[Dict[str, Any]],
) -> Dict[str, int]:
    """Assert exact 100% disjoint partitioning across assembly_segments + unspecified."""
    assert "assembly_segments" in summary, f"{label}: missing summary.assembly_segments"
    assert "unspecifiedWorksCount" in summary, f"{label}: missing summary.unspecifiedWorksCount"

    segments = summary["assembly_segments"]
    unspecified_count = summary["unspecifiedWorksCount"]
    assert isinstance(segments, list)
    assert isinstance(unspecified_count, int) and unspecified_count >= 0

    canonical_names = [s["ac_name"] for s in segments]
    assert len(canonical_names) == len(set(canonical_names)), (
        f"{label}: duplicate canonical AC names in assembly_segments: {canonical_names}"
    )
    allowed_segments = set(canonical_names) | {UNSPECIFIED_SEGMENT}

    observed_counts: Counter[str] = Counter()
    for w in works:
        seg = w.get("assembly_segment")
        assert isinstance(seg, str) and seg.strip(), (
            f"{label}: work {w.get('work_id')} missing non-empty assembly_segment"
        )
        assert seg in allowed_segments, (
            f"{label}: work {w.get('work_id')} has unexpected assembly_segment '{seg}' "
            f"not in {sorted(allowed_segments)}"
        )
        observed_counts[seg] += 1

    # Summary counts must match exact work-level counts with zero gaps or double-counting
    for seg_entry in segments:
        ac_name = seg_entry["ac_name"]
        assert seg_entry["count"] == observed_counts[ac_name], (
            f"{label}: summary count {seg_entry['count']} != observed {observed_counts[ac_name]} for {ac_name}"
        )

    assert unspecified_count == observed_counts[UNSPECIFIED_SEGMENT], (
        f"{label}: summary unspecifiedWorksCount {unspecified_count} != observed "
        f"{observed_counts[UNSPECIFIED_SEGMENT]}"
    )
    assert sum(s["count"] for s in segments) + unspecified_count == len(works), (
        f"{label}: partition sum mismatch ({sum(s['count'] for s in segments)} + "
        f"{unspecified_count} != {len(works)})"
    )

    return {s["ac_name"]: s["count"] for s in segments}


@pytest.mark.parametrize("pc_name", KEY_PCS)
def test_key_pcs_disjoint_partition_constituency_and_mp_endpoints(pc_name: str):
    """
    Verify exact disjoint 100% partition invariant on both /api/constituencies/{pc}
    and /api/mps/{mp} for all 8 spotlight Parliamentary Constituencies.
    """
    res_pc = client.get(f"/api/constituencies/{pc_name}")
    assert res_pc.status_code == 200, f"/api/constituencies/{pc_name} failed: {res_pc.text}"
    pc_data = res_pc.json()["data"]
    pc_summary = pc_data["summary"]
    pc_works = pc_data["works"]

    seg_counts_pc = _assert_partition_invariant(
        f"/api/constituencies/{pc_name}", pc_summary, pc_works
    )
    assert len(pc_summary.get("assemblies", [])) == len(pc_summary["assembly_segments"])
    assert sum(a["count"] for a in pc_summary["assemblies"]) == sum(seg_counts_pc.values())

    res_mp = client.get(f"/api/mps/{pc_name}")
    assert res_mp.status_code == 200, f"/api/mps/{pc_name} failed: {res_mp.text}"
    mp_data = res_mp.json()["data"]
    mp_summary = mp_data["summary"]
    mp_works = mp_data["works"]

    _assert_partition_invariant(f"/api/mps/{pc_name}", mp_summary, mp_works)
    all_acs_list = mp_summary.get("all_assemblies_in_pc", [])
    seg_ac_names = [s["ac_name"] for s in mp_summary["assembly_segments"]]
    assert len(all_acs_list) == len(seg_ac_names)
    assert set(all_acs_list) == set(seg_ac_names)


def test_kendrapara_accuracy_and_mahakalpara_disambiguation():
    """
    Verify Kendrapara's 56 works load without truncation, all 7 Vidhan Sabha segments
    have > 0 mapped works, and #230529 (Baulakani, Block Mahakalpara) maps to
    'Mahakalapada' rather than falsely substring-matching 'Aul'.
    """
    expected_acs = {
        "Aul",
        "Rajanagar",
        "Salipur",
        "Kendrapara (Sc)",
        "Mahanga",
        "Patkura",
        "Mahakalapada",
    }

    for endpoint in ("/api/constituencies/KENDRAPARA", "/api/mps/KENDRAPARA"):
        res = client.get(endpoint)
        assert res.status_code == 200
        data = res.json()["data"]
        summary = data["summary"]
        works = data["works"]

        assert len(works) == 56, f"{endpoint}: expected 56 works, got {len(works)}"
        counts = _assert_partition_invariant(endpoint, summary, works)
        assert set(counts.keys()) == expected_acs

        for ac_name in expected_acs:
            assert counts[ac_name] > 0, f"{endpoint}: expected > 0 works in {ac_name}, got {counts}"

        assert summary["unspecifiedWorksCount"] > 0, (
            f"{endpoint}: expected generic district-wide works in '{UNSPECIFIED_SEGMENT}'"
        )
        assert counts["Kendrapara (Sc)"] < 56

        work_230529 = next((w for w in works if w["work_id"] == 230529), None)
        assert work_230529 is not None, f"{endpoint}: missing work #230529"
        assert work_230529["assembly_segment"] == "Mahakalapada", (
            f"{endpoint}: work #230529 mapped to {work_230529['assembly_segment']!r}, "
            "expected 'Mahakalapada' (must not match 'Aul' inside 'Baulakani')"
        )


def test_no_ac_leaks_or_dbf_truncations():
    """
    Verify Mumbai PCs do not bleed into one another, Janjgir Champa resolves all 8 ACs,
    Sulthanbathery (St) has closing ')', zero unclosed '(' remain in CSV/DB/TS,
    and subdistrict_ac_map.json is synced and valid against canonical AC names.
    """
    mumbai_north = [a["ac_name"] for a in get_assemblies_by_pc("MUMBAI NORTH")]
    mumbai_ne = [a["ac_name"] for a in get_assemblies_by_pc("MUMBAI NORTH EAST")]
    mumbai_nc = [a["ac_name"] for a in get_assemblies_by_pc("MUMBAI NORTH-CENTRAL")]
    janjgir = [a["ac_name"] for a in get_assemblies_by_pc("JANJGIR CHAMPA")]

    assert mumbai_north == [
        "Dahisar",
        "Borivali",
        "Magathane",
        "Charkop",
        "Kandivali East",
        "Malad West",
    ]
    assert mumbai_ne == [
        "Mulund",
        "Bhandup West",
        "Vikhroli",
        "Ghatkopar East",
        "Ghatkopar West",
        "Mankhurd Shivaji Nagar",
    ]
    assert mumbai_nc == [
        "Chandivali",
        "Vile Parle",
        "Vandre West",
        "Kalina",
        "Vandre East",
        "Kurla (Sc)",
    ]
    assert set(mumbai_north).isdisjoint(mumbai_ne)
    assert set(mumbai_north).isdisjoint(mumbai_nc)
    assert set(mumbai_ne).isdisjoint(mumbai_nc)

    assert len(janjgir) == 8
    assert "Janjgir-Champa" in janjgir

    # Verify API endpoints reflect exact AC counts for Mumbai & Janjgir Champa
    for pc_name, expected_len in [
        ("MUMBAI NORTH", 6),
        ("MUMBAI NORTH EAST", 6),
        ("JANJGIR CHAMPA", 8),
    ]:
        res = client.get(f"/api/constituencies/{pc_name}")
        assert res.status_code == 200
        assert len(res.json()["data"]["summary"]["assembly_segments"]) == expected_len

    # Verify Sulthanbathery closing ')' in API, CSVs, DB, and frontend TS file
    wayanad_acs = [a["ac_name"] for a in get_assemblies_by_pc("WAYANAD")]
    sulthan_matches = [a for a in wayanad_acs if a.lower().startswith("sulthanbathery")]
    assert len(sulthan_matches) == 1
    assert sulthan_matches[0].lower() == "sulthanbathery (st)"
    assert sulthan_matches[0].endswith(")")

    res_wayanad = client.get("/api/constituencies/WAYANAD")
    assert res_wayanad.status_code == 200
    wayanad_api_acs = [
        a["ac_name"] for a in res_wayanad.json()["data"]["summary"]["assembly_segments"]
    ]
    assert any(a.lower() == "sulthanbathery (st)" and a.endswith(")") for a in wayanad_api_acs)

    # Check CSV files for zero unclosed '(' and exact sync
    df_api = pd.read_csv(BASE_DIR / "api" / "data" / "assembly_constituencies_enriched.csv")
    df_data = pd.read_csv(BASE_DIR / "data" / "assembly_constituencies_enriched.csv")
    assert df_api.equals(df_data), "api/data and data assembly_constituencies_enriched.csv diverged"

    for col in ("ac_name", "pc_name"):
        unclosed = df_api[
            df_api[col].astype(str).str.contains(r"\(", na=False)
            & ~df_api[col].astype(str).str.contains(r"\)", na=False)
        ][col].tolist()
        assert unclosed == [], f"Found unclosed '(' in CSV column {col}: {unclosed}"

    # Check SQLite assembly_constituencies table for zero unclosed '('
    db_path = BASE_DIR / "mplads_dev.db"
    if db_path.exists():
        con = sqlite3.connect(str(db_path))
        try:
            db_acs = pd.read_sql_query("SELECT ac_name, pc_name FROM assembly_constituencies", con)
        finally:
            con.close()
        assert len(db_acs) == len(df_api)
        unclosed_db = [
            name
            for name in db_acs["ac_name"].astype(str)
            if "(" in name and ")" not in name
        ]
        assert unclosed_db == [], f"Found unclosed '(' in DB assembly_constituencies: {unclosed_db}"

    # Check frontend TS file has Sulthanbathery (St) with closing ')' and zero unclosed '('
    ts_path = BASE_DIR / "web" / "src" / "lib" / "assemblyConstituencies.ts"
    ts_text = ts_path.read_text(encoding="utf-8")
    assert '"ac": "Sulthanbathery (St)"' in ts_text
    ts_ac_values = re.findall(r'"ac":\s*"([^"]+)"', ts_text)
    assert len(ts_ac_values) == len(df_api)
    ts_unclosed = [val for val in ts_ac_values if "(" in val and ")" not in val]
    assert ts_unclosed == [], f"Found unclosed '(' in assemblyConstituencies.ts: {ts_unclosed}"

    # Verify subdistrict_ac_map.json sync and target AC validity
    sub_data = json.loads((BASE_DIR / "data" / "subdistrict_ac_map.json").read_text(encoding="utf-8"))
    sub_api = json.loads((BASE_DIR / "api" / "data" / "subdistrict_ac_map.json").read_text(encoding="utf-8"))
    assert sub_data == sub_api, "data/subdistrict_ac_map.json and api/data/subdistrict_ac_map.json diverged"
    assert len(sub_data) >= 40

    for pc_key, mappings in sub_data.items():
        pc_acs = {a["ac_name"] for a in get_assemblies_by_pc(pc_key)}
        assert pc_acs, f"subdistrict_ac_map PC '{pc_key}' has no assemblies"
        for phrase, target_ac in mappings.items():
            assert target_ac in pc_acs, (
                f"subdistrict_ac_map[{pc_key!r}][{phrase!r}] = {target_ac!r} "
                f"is not in canonical ACs {sorted(pc_acs)}"
            )


def test_state_scoped_duplicate_pc_disambiguation():
    """
    Verify PC names shared across states (AURANGABAD, HAMIRPUR, MAHARAJGANJ)
    resolve cleanly to their state's own assemblies when queried by MP ID.
    """
    df_mps = load_mps_csv()
    ls = df_mps[df_mps["house"].astype(str).str.lower().str.contains("lok")]
    dup_pcs = ls[ls["constituency"].astype(str).str.upper().isin(["AURANGABAD", "HAMIRPUR", "MAHARAJGANJ"])]
    assert len(dup_pcs) == 6

    for _, row in dup_pcs.iterrows():
        mp_id = str(row["id"])
        expected_state = str(row["state"]).strip().lower()
        res = client.get(f"/api/mps/{mp_id}")
        assert res.status_code == 200
        data = res.json()["data"]
        summary = data["summary"]
        segs = summary["assembly_segments"]
        assert len(segs) > 0
        seg_states = {str(s["state"]).strip().lower() for s in segs}
        assert seg_states == {expected_state}, (
            f"MP {mp_id} ({row['constituency']}, {expected_state}) leaked states {seg_states}"
        )
        _assert_partition_invariant(f"/api/mps/{mp_id}", summary, data["works"])


def test_resolver_unit_edge_cases():
    """Unit tests for namesake guards, Lok Sabha exclusion, and empty-assembly UTs."""
    kendrapara_acs = get_assemblies_by_pc("KENDRAPARA", state="Odisha")
    sample_works = [
        {
            "work_id": 1,
            "work_description": "Supply of tricycles across Dist- Kendrapara",
            "location": "KENDRAPARA",
            "district": "KENDRAPARA",
        },
        {
            "work_id": 2,
            "work_description": "Drainage work in Kendrapara Municipality Ward No 4",
            "location": "KENDRAPARA",
            "district": "KENDRAPARA",
        },
        {
            "work_id": 3,
            "work_description": "Community hall in Kendrapara Lok Sabha constituency",
            "location": "KENDRAPARA",
            "district": "KENDRAPARA",
        },
    ]
    out_works, segs, unspec = assign_segments_for_pc(
        "KENDRAPARA", kendrapara_acs, sample_works, pc_state="Odisha"
    )
    assert out_works[0]["assembly_segment"] == UNSPECIFIED_SEGMENT
    assert out_works[1]["assembly_segment"] == "Kendrapara (Sc)"
    assert out_works[2]["assembly_segment"] == UNSPECIFIED_SEGMENT
    assert sum(s["count"] for s in segs) + unspec == 3

    ut_works = [{"work_id": 99, "work_description": "Park renovation", "location": "CHANDIGARH", "district": "CHANDIGARH"}]
    out_ut, ut_segs, ut_unspec = assign_segments_for_pc("CHANDIGARH", [], ut_works, pc_state="Chandigarh")
    assert ut_segs == []
    assert ut_unspec == 1
    assert out_ut[0]["assembly_segment"] == UNSPECIFIED_SEGMENT


def test_all_pcs_api_constituencies_partition_sweep():
    """
    Comprehensive API sweep across ALL 539 unique Lok Sabha PCs in /api/constituencies/{pc}:
    verifies 100% of PCs return 200 OK and satisfy
    sum(segment_counts) + unspecified_count == len(works) with zero missing or double-counted works.
    """
    df_mps = load_mps_csv()
    ls = df_mps[df_mps["house"].astype(str).str.lower().str.contains("lok")]
    unique_pcs = sorted(ls["constituency"].dropna().astype(str).str.strip().str.upper().unique())
    assert len(unique_pcs) >= 500

    failures: List[str] = []
    total_works_checked = 0
    total_mapped = 0
    total_unspecified = 0

    for pc in unique_pcs:
        res = client.get(f"/api/constituencies/{pc}")
        if res.status_code != 200:
            failures.append(f"{pc}: HTTP {res.status_code}")
            continue
        data = res.json()["data"]
        summary = data["summary"]
        works = data["works"]
        segs = summary.get("assembly_segments", [])

        if pc not in UTS_WITHOUT_LEGISLATURE and len(segs) == 0:
            failures.append(f"{pc}: 0 assembly segments returned")
            continue

        try:
            counts = _assert_partition_invariant(pc, summary, works)
            total_works_checked += len(works)
            total_mapped += sum(counts.values())
            total_unspecified += summary["unspecifiedWorksCount"]
        except AssertionError as exc:
            failures.append(str(exc))

    assert failures == [], f"Partition sweep failed for {len(failures)} PCs: {failures[:10]}"
    assert total_works_checked > 40000
    assert total_mapped + total_unspecified == total_works_checked


def test_all_lok_sabha_seats_service_partition_sweep():
    """
    Service-level sweep across ALL 542 unique (PC, state) Lok Sabha seats against DB works
    via assign_segments_for_pc, ensuring zero gaps even for same-named PCs across states.
    """
    df_mps = load_mps_csv()
    ls = df_mps[df_mps["house"].astype(str).str.lower().str.contains("lok")]
    seats = (
        ls[["constituency", "state", "mpName"]]
        .drop_duplicates(subset=["constituency", "state"])
        .to_dict("records")
    )
    assert len(seats) == 542

    db = next(get_db())
    try:
        total_works = 0
        total_mapped = 0
        total_unspec = 0
        for seat in seats:
            pc_name = str(seat["constituency"]).strip().upper()
            state_name = str(seat["state"]).strip()
            mp_name = str(seat["mpName"]).strip()

            assemblies = get_assemblies_by_pc(pc_name, state=state_name)
            if pc_name not in UTS_WITHOUT_LEGISLATURE:
                assert len(assemblies) > 0, f"Missing ECI assemblies for ({pc_name}, {state_name})"

            pc_filter = (func.lower(Work.mp_constituency) == pc_name.lower()) & (
                func.lower(Work.state) == state_name.lower()
            )
            db_works = db.query(Work).filter(
                pc_filter | (func.lower(func.trim(Work.mp_name)) == mp_name.lower())
            ).all()

            works_payload = [
                {
                    "work_id": w.work_id,
                    "work_description": w.work_description or "",
                    "location": w.location or pc_name,
                    "district": w.district or state_name,
                }
                for w in db_works
            ]
            out_works, segs, unspec = assign_segments_for_pc(
                pc_name, assemblies, works_payload, pc_state=state_name
            )
            observed = Counter(w["assembly_segment"] for w in out_works)
            assert sum(s["count"] for s in segs) + unspec == len(out_works)
            assert unspec == observed[UNSPECIFIED_SEGMENT]
            for s in segs:
                assert s["count"] == observed[s["ac_name"]]

            total_works += len(out_works)
            total_mapped += sum(s["count"] for s in segs)
            total_unspec += unspec

        assert total_mapped + total_unspec == total_works
        assert total_works > 40000
    finally:
        db.close()


def test_repaired_dbf_ac_truncations_and_pan_india_transliterations():
    """Verify repaired DBF field-width AC names and nationwide sub-district/transliteration mappings."""
    df_api = pd.read_csv(BASE_DIR / "api" / "data" / "assembly_constituencies_enriched.csv")
    ac_set = set(df_api["ac_name"].astype(str))
    for expected_name in (
        "B.H.E.L. Ranipur",
        "Dr.Radhakrishnan Nagar",
        "Chepauk-Thiruvallikeni",
        "Neravy- T.R. Pattinam",
    ):
        assert expected_name in ac_set, f"Missing repaired DBF AC name: {expected_name}"

    sub_data = json.loads((BASE_DIR / "api" / "data" / "subdistrict_ac_map.json").read_text(encoding="utf-8"))
    assert len(sub_data) >= 150, f"Expected >= 150 PCs in subdistrict_ac_map.json, got {len(sub_data)}"

    # Verify pan-India district/PC endpoints resolve non-zero segments cleanly across regions
    for pc, min_mapped in [
        ("DAKSHINA KANNADA", 70),
        ("KURNOOL", 50),
        ("NANDYAL", 70),
        ("JALNA", 40),
        ("SREERAMPUR", 40),
    ]:
        res = client.get(f"/api/constituencies/{pc}")
        assert res.status_code == 200
        d = res.json()["data"]
        ws = d["works"]
        segs = d["summary"]["assembly_segments"]
        unspec = d["summary"]["unspecifiedWorksCount"]
        assert sum(s["count"] for s in segs) + unspec == len(ws)
        mapped = len(ws) - unspec
        assert mapped >= min_mapped, f"{pc}: expected >= {min_mapped} mapped works, got {mapped}/{len(ws)}"

    # Verify Cuttack district resolves via KATAKA alias to its 9 district ACs (not Nayagada/Kandhamal)
    res_cut = client.get("/api/districts/CUTTACK")
    assert res_cut.status_code == 200
    cut_data = res_cut.json()["data"]
    cut_ac_names = {s["ac_name"] for s in cut_data["summary"]["assembly_segments"]}
    assert "Barabati-Cuttack" in cut_ac_names
    assert "Salipur" in cut_ac_names
    assert "Baliguda (St)" not in cut_ac_names
    assert len(cut_ac_names) == 9


def test_all_indian_districts_api_partition_sweep():
    """Verify /api/districts/{district} partitions 100% of works across ALL districts in India."""
    from webapi.data_service import load_districts_csv

    df_dist = load_districts_csv()
    unique_districts = sorted(df_dist["district_nodal"].dropna().astype(str).str.strip().unique())
    assert len(unique_districts) >= 500

    failures: List[str] = []
    districts_with_segments = 0
    for d_name in unique_districts:
        res = client.get(f"/api/districts/{d_name}")
        if res.status_code != 200:
            failures.append(f"{d_name}: HTTP {res.status_code}")
            continue
        data = res.json()["data"]
        summary = data["summary"]
        works = data["works"]
        segs = summary.get("assembly_segments", [])
        unspec = summary.get("unspecifiedWorksCount", 0)
        if segs:
            districts_with_segments += 1
        if works:
            try:
                _assert_partition_invariant(f"districts/{d_name}", summary, works)
            except AssertionError as exc:
                failures.append(str(exc))
        else:
            if sum(s.get("count", 0) for s in segs) + unspec != 0:
                failures.append(f"{d_name}: non-zero count for empty works")

    assert failures == [], f"District partition sweep failed for {len(failures)} districts: {failures[:10]}"
    assert districts_with_segments >= 500

