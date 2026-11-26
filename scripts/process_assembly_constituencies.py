#!/usr/bin/env python3
"""
Process India Assembly Constituencies from India_AC.dbf and map to MPs from all_mps_summary.csv.
Generates:
1. data/assembly_constituencies_master.csv
2. data/assembly_constituencies_enriched.csv & api/data/assembly_constituencies_enriched.csv
3. SQLite table `assembly_constituencies` in mplads_dev.db and gzipped api/mplads_dev.db.gz
"""

import gzip
import os
import re
import shutil
import sqlite3
import struct
import pandas as pd

# Exact repairs for DBF-truncated AC_NAME strings where "(S" lost its "C)" or "T)"
TRUNCATED_AC_REPAIRS = {
    "SULTHANBATHERY (S": "Sulthanbathery (St)",
    "BHARATPUR-SONHAT (S": "Bharatpur-Sonhat (St)",
    "AIZAWL NORTH-III (S": "Aizawl North-Iii (St)",
    "AIZAWL SOUTH-III (S": "Aizawl South-Iii (St)",
    "SRI HARGOBINDPUR (S": "Sri Hargobindpur (Sc)",
    "KILVAITHINANKUPPAM(SC": "Kilvaithinankuppam (Sc)",
    "SECUNDERABAD CANTT. (SC": "Secunderabad Cantt. (Sc)",
    "CHHOTA UDAIPUR (ST": "Chhota Udaipur (St)",
    "SRI RENUKAJI (SC": "Sri Renukaji (Sc)",
    "RAMBRAI JYRNGAM (ST": "Rambrai Jyrngam (St)",
    "AIZAWL NORTH-II (ST": "Aizawl North-Ii (St)",
    "AIZAWL WEST-III (ST": "Aizawl West-Iii (St)",
    "Aizawl South-II (ST".upper(): "Aizawl South-Ii (St)",
    "NIHAL SINGHWALA (SC": "Nihal Singhwala (Sc)",
    "RAJPUR ROAD (SC": "Rajpur Road (Sc)",
    "NANAK MATTA (ST": "Nanak Matta (St)",
    # Field-width truncated AC names in India_AC.dbf (no unclosed parenthesis)
    "B.H.E.L. RANIPU": "B.H.E.L. Ranipur",
    "DR.RADHAKRISHNAN NAGA": "Dr.Radhakrishnan Nagar",
    "CHEPAUK-THIRUVALLIKEN": "Chepauk-Thiruvallikeni",
    "NERAVY- T.R. PATTIN": "Neravy- T.R. Pattinam",
}


def clean_ac_name(raw_ac: str) -> str:
    """Repair truncated DBF AC names, clean punctuation, and enforce consistent Title Case with (Sc)/(St)."""
    if not raw_ac:
        return ""
    ac = re.sub(r"\s+", " ", raw_ac.replace("*", "")).strip()
    if not ac:
        return ""

    # Replace corrupted '?' separator (e.g., 'Ovala ?Majiwada', 'Baran?Atru (SC)')
    ac = re.sub(r"\s*\?\s*", "-", ac)

    # Check explicit truncated AC repair table first
    upper_ac = ac.upper()
    if upper_ac in TRUNCATED_AC_REPAIRS:
        return TRUNCATED_AC_REPAIRS[upper_ac]

    # Generic repair for any truncated reservation tag missing ')'
    if "(" in ac and ")" not in ac:
        if re.search(r"\(\s*SC$", ac, flags=re.IGNORECASE):
            ac = re.sub(r"\(\s*SC$", "(SC)", ac, flags=re.IGNORECASE)
        elif re.search(r"\(\s*ST$", ac, flags=re.IGNORECASE):
            ac = re.sub(r"\(\s*ST$", "(ST)", ac, flags=re.IGNORECASE)
        else:
            ac = f"{ac})"

    # Ensure single space before '(' and clean internal spacing
    ac = re.sub(r"\s*\(", " (", ac)
    ac = re.sub(r"\s+", " ", ac).strip()

    # Consistent Title Case while preserving canonical (Sc) / (St) / (Bl) tags
    ac = ac.title()
    ac = re.sub(r"\(\s*sc\s*\)", "(Sc)", ac, flags=re.IGNORECASE)
    ac = re.sub(r"\(\s*st\s*\)", "(St)", ac, flags=re.IGNORECASE)
    ac = re.sub(r"\(\s*bl\s*\)", "(Bl)", ac, flags=re.IGNORECASE)
    return ac


def clean_pc_name(pc_name: str) -> str:
    """Normalize DBF PC_NAME by removing full or truncated (SC)/(ST) markers and fixing '?' separators."""
    if not pc_name:
        return ""
    c = pc_name.strip().upper()
    # Replace '?' separator (e.g., 'TONK ? SAWAI MADHOPUR', 'KARAULI ?DHOLPUR(SC)', 'RATNAGIRI ?SINDHUDUR')
    c = re.sub(r"\s*\?\s*", "-", c)
    # Remove full or DBF-truncated reservation tags
    c = re.sub(r"\s*\((?:SC|ST)\)?", "", c, flags=re.IGNORECASE)
    c = re.sub(r"\s+", " ", c).strip()
    return c


def alnum_key(name: str) -> str:
    """Alphanumeric-only uppercase key for hyphen/space/dot-tolerant exact matching."""
    return re.sub(r"[^A-Z0-9]", "", name.upper())


def normalize_state_name(st_name: str) -> str:
    """Normalize DBF state names to match all_mps_summary.csv."""
    s = re.sub(r"\s+", " ", (st_name or "")).strip()
    upper = s.upper()
    if upper == "ORISSA":
        return "Odisha"
    if upper == "UTTARKHAND":
        return "Uttarakhand"
    if upper == "JAMMU & KASHMIR":
        return "Jammu And Kashmir"
    return s.title()


# Aliases from cleaned DBF PC_NAME to canonical Parliamentary Constituency in all_mps_summary.csv & works
PC_ALIASES = {
    "ANANTANAG": "ANANTNAG",
    "AUTONOMOUS DISTRICT": "DIPHU",
    "BARAMULLA": "BARAMULLAH",
    "BATHINDA": "BHATINDA",
    "BHIWANI-MAHENDRAGARH": "BHIWANI MAHENDRAGARH",
    "CHANDNI CHOWK": "CHANDINI CHOWK",
    "CHEVELLA": "CHELVELLA",
    "CHIKKABALLAPUR": "CHIKBALLAPUR",
    "CHIKKBALLAPUR": "CHIKBALLAPUR",
    "DHARMAPURI": "DHARAMAPURI",
    "FATEHGARH SAHIB": "FATEHGARH SAHIB",
    "GAUHATI": "GUWAHATI",
    "JANJGIR-CHAMPA": "JANJGIR CHAMPA",
    "JAYNAGAR": "JOYNAGAR",
    "KALIABOR": "KAZIRANGA",
    "KARAULI-DHOLPUR": "KARAULI-DHOLPUR",
    "MAHBUBNAGAR": "MAHABUBNAGAR",
    "MANGALDOI": "DARRANG-UDALGURI",
    "MUMBAI NORTH-CENTRAL": "MUMBAI NORTH-CENTRAL",
    "MUMBAI NORTH-EAST": "MUMBAI NORTH EAST",
    "MUMBAI NORTH-WEST": "MUMBAI NORTH WEST",
    "MUMBAI SOUTH -CENTRA": "MUMBAI SOUTH CENTRAL",
    "MUMBAI SOUTH-CENTRA": "MUMBAI SOUTH CENTRAL",
    "MUMBAI SOUTH-CENTRAL": "MUMBAI SOUTH CENTRAL",
    "NAINITAL-UDHAMSINGH NAG": "NAINITAL UDHAM SINGH NAG.",
    "NARSAPURAM": "NARASAPURAM",
    "PONDICHERRY": "PUDUCHERRY",
    "PURNIA": "PURNEA",
    "RATNAGIRI-SINDHUDUR": "RATNAGIRI-SINDHUDURG",
    "SONIPAT": "SONEPAT",
    "SURGUJA": "SARGUJA",
    "TEZPUR": "SONITPUR",
    "THIRUVANANTHAPURA": "THIRUVANANTHAPURAM",
    "TONK-SAWAI MADHOPUR": "TONK-SAWAI MADHOPUR",
    "UJIARPUR": "UJJARPUR",
    "WARANGAL": "WARANGEL",
}


def main():
    mps_csv = "api/data/all_mps_summary.csv" if os.path.exists("api/data/all_mps_summary.csv") else "data/all_mps_summary.csv"
    print(f"Loading {mps_csv}...")
    df_mps = pd.read_csv(mps_csv)

    # Build state-scoped and unique PC -> MP profile lookups (keep first row on bye-election duplicates like NANDED)
    pc_state_to_mp = {}
    pc_state_alnum_to_mp = {}
    pc_to_mps_list = {}
    pc_alnum_to_mps_list = {}
    state_to_rs = {}

    for _, row in df_mps.iterrows():
        house = str(row.get("house", "")).strip()
        state = str(row.get("state", "")).strip()
        mp_id = str(row.get("id", "")).strip()
        mp_name = str(row.get("mpName", "")).strip()
        const = str(row.get("constituency", "")).strip().upper()
        state_upper = state.upper()

        if house == "Lok Sabha" and const:
            info = {
                "mp_id": mp_id,
                "mp_name": mp_name,
                "house": house,
                "state": state,
                "constituency": const,
            }
            if (state_upper, const) not in pc_state_to_mp:
                pc_state_to_mp[(state_upper, const)] = info
            ak = alnum_key(const)
            if (state_upper, ak) not in pc_state_alnum_to_mp:
                pc_state_alnum_to_mp[(state_upper, ak)] = info
            pc_to_mps_list.setdefault(const, []).append(info)
            pc_alnum_to_mps_list.setdefault(ak, []).append(info)
        elif house == "Rajya Sabha" and state:
            if state_upper not in state_to_rs:
                state_to_rs[state_upper] = {
                    "mp_id": mp_id,
                    "mp_name": mp_name,
                    "house": house,
                    "state": state,
                    "constituency": "Rajya Sabha",
                }

    print(f"Loaded {len(pc_state_to_mp)} state-scoped Lok Sabha PCs and {len(state_to_rs)} Rajya Sabha state fallbacks.")

    dbf_path = "India_AC.dbf" if os.path.exists("India_AC.dbf") else "data/08_Spatial_Boundaries/India_AC.dbf"
    print(f"Parsing {dbf_path}...")
    with open(dbf_path, "rb") as f:
        num_records, header_len, record_len = struct.unpack("<IHH", f.read(32)[4:12])
        fields = []
        while True:
            field_desc = f.read(32)
            if field_desc[0] == 0x0D:
                break
            name = field_desc[:11].replace(b"\x00", b"").decode("latin1").strip()
            flen = field_desc[16]
            fields.append((name, flen))

        f.seek(header_len)
        raw_rows = []
        for _ in range(num_records):
            rec = f.read(record_len)
            if not rec or rec[0] == 0x2A:
                continue
            offset = 1
            row = {}
            for fname, flen in fields:
                row[fname] = rec[offset:offset+flen].decode("latin1", errors="ignore").strip()
                offset += flen
            raw_rows.append(row)

    print(f"Extracted {len(raw_rows)} raw records from DBF.")

    master_rows = []
    enriched_rows = []

    for r in raw_rows:
        ac_name = clean_ac_name(r.get("AC_NAME", ""))
        raw_pc = r.get("PC_NAME", "").strip()
        st_name = normalize_state_name(r.get("ST_NAME", ""))
        dist_name = re.sub(r"\s+", " ", r.get("DIST_NAME", "").replace("*", "")).strip().title()
        ac_no = r.get("AC_NO", "").strip()
        pc_no = r.get("PC_NO", "").strip()

        if not ac_name:
            continue

        c_pc = clean_pc_name(raw_pc)
        resolved_pc = PC_ALIASES.get(c_pc, c_pc)
        st_upper = st_name.upper()
        # 2008 DBF predates 2014 Telangana split; check both Andhra Pradesh and Telangana
        candidate_states = [st_upper, "TELANGANA"] if st_upper == "ANDHRA PRADESH" else [st_upper]

        mp_info = None
        for cs in candidate_states:
            mp_info = pc_state_to_mp.get((cs, resolved_pc))
            if mp_info:
                break

        if not mp_info:
            ak = alnum_key(resolved_pc)
            for cs in candidate_states:
                mp_info = pc_state_alnum_to_mp.get((cs, ak))
                if mp_info:
                    break

        if not mp_info:
            exact_matches = pc_to_mps_list.get(resolved_pc, [])
            if len({m["state"].upper() for m in exact_matches}) == 1:
                mp_info = exact_matches[0]
            else:
                alnum_matches = pc_alnum_to_mps_list.get(alnum_key(resolved_pc), [])
                if len({m["state"].upper() for m in alnum_matches}) == 1:
                    mp_info = alnum_matches[0]

        if mp_info:
            resolved_pc = mp_info["constituency"]

        state = mp_info["state"] if mp_info else st_name

        master_rows.append({
            "ac_name": ac_name,
            "ac_no": ac_no,
            "pc_name": resolved_pc if resolved_pc else raw_pc,
            "pc_no": pc_no,
            "state": state,
            "district": dist_name,
        })

        mp_id = mp_info["mp_id"] if mp_info else ""
        mp_name = mp_info["mp_name"] if mp_info else ""
        house = mp_info["house"] if mp_info else "Lok Sabha"

        if not mp_id:
            rs_info = state_to_rs.get(state.upper())
            if rs_info:
                mp_id = rs_info["mp_id"]
                mp_name = rs_info["mp_name"]
                house = rs_info["house"]

        enriched_rows.append({
            "ac_name": ac_name,
            "ac_no": ac_no,
            "pc_name": resolved_pc if resolved_pc else raw_pc,
            "pc_no": pc_no,
            "state": state,
            "district": dist_name,
            "mp_name": mp_name if mp_name else "Vacant",
            "mp_id": mp_id if mp_id else "vacant",
            "house": house,
        })

    # Export master CSV
    df_master = pd.DataFrame(master_rows).drop_duplicates()
    os.makedirs("data", exist_ok=True)
    df_master.to_csv("data/assembly_constituencies_master.csv", index=False)
    print(f"Saved data/assembly_constituencies_master.csv ({len(df_master)} rows)")

    # Export enriched CSV to both data/ and api/data/
    df_enriched = pd.DataFrame(enriched_rows).drop_duplicates()
    df_enriched.to_csv("data/assembly_constituencies_enriched.csv", index=False)
    print(f"Saved data/assembly_constituencies_enriched.csv ({len(df_enriched)} rows)")
    if os.path.isdir("api/data"):
        df_enriched.to_csv("api/data/assembly_constituencies_enriched.csv", index=False)
        print(f"Synced api/data/assembly_constituencies_enriched.csv ({len(df_enriched)} rows)")

    # Sanity validations
    broken_ac = df_enriched[
        df_enriched["ac_name"].str.contains(r"\(", na=False)
        & ~df_enriched["ac_name"].str.contains(r"\)", na=False)
    ]
    assert broken_ac.empty, f"Truncated AC names still present: {broken_ac['ac_name'].tolist()}"
    question_ac = df_enriched[df_enriched["ac_name"].str.contains(r"\?", na=False)]
    assert question_ac.empty, f"Corrupted '?' AC names still present: {question_ac['ac_name'].tolist()}"
    question_pc = df_enriched[df_enriched["pc_name"].str.contains(r"\?", na=False)]
    assert question_pc.empty, f"Corrupted '?' PC names still present: {question_pc['pc_name'].tolist()}"

    # Validate Mumbai PCs and Kendrapara
    for check_pc in ["MUMBAI NORTH", "MUMBAI NORTH EAST", "MUMBAI NORTH-CENTRAL", "KENDRAPARA"]:
        cnt = len(df_enriched[df_enriched["pc_name"] == check_pc])
        print(f"Validation: {check_pc} -> {cnt} ACs")

    # Insert into SQLite database (root mplads_dev.db only; never spawn empty api/mplads_dev.db)
    for db_path in ["mplads_dev.db"]:
        if os.path.exists(db_path):
            print(f"\nUpdating SQLite database: {db_path}...")
            con = sqlite3.connect(db_path)
            cur = con.cursor()
            cur.execute("DROP TABLE IF EXISTS assembly_constituencies")
            cur.execute("""
                CREATE TABLE assembly_constituencies (
                    ac_name VARCHAR(100),
                    ac_no VARCHAR(20),
                    pc_name VARCHAR(100),
                    pc_no VARCHAR(20),
                    state VARCHAR(100),
                    district VARCHAR(100),
                    mp_name VARCHAR(200),
                    mp_id VARCHAR(50),
                    house VARCHAR(50)
                )
            """)
            cur.execute("CREATE INDEX idx_ac_name ON assembly_constituencies(ac_name)")
            cur.execute("CREATE INDEX idx_ac_pc ON assembly_constituencies(pc_name)")
            cur.execute("CREATE INDEX idx_ac_mp ON assembly_constituencies(mp_id)")

            records_to_insert = [
                (r["ac_name"], str(r["ac_no"]), r["pc_name"], str(r["pc_no"]), r["state"], r["district"], r["mp_name"], r["mp_id"], r["house"])
                for _, r in df_enriched.iterrows()
            ]
            cur.executemany("""
                INSERT INTO assembly_constituencies 
                (ac_name, ac_no, pc_name, pc_no, state, district, mp_name, mp_id, house)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, records_to_insert)
            con.commit()
            cur.execute("SELECT COUNT(*) FROM assembly_constituencies")
            cnt = cur.fetchone()[0]
            con.close()
            print(f"Inserted {cnt} rows into {db_path} table assembly_constituencies.")

            if os.path.isdir("api"):
                gz_tmp = "api/mplads_dev.db.gz.tmp"
                with open(db_path, "rb") as f_in, gzip.open(gz_tmp, "wb", compresslevel=6) as f_out:
                    shutil.copyfileobj(f_in, f_out)
                os.replace(gz_tmp, "api/mplads_dev.db.gz")
                print("Synced api/mplads_dev.db.gz cleanly.")


if __name__ == "__main__":
    main()
