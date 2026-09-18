#!/usr/bin/env python3
"""
Process India Assembly Constituencies from India_AC.dbf and map to MPs from all_mps_summary.csv.
Generates:
1. data/assembly_constituencies_master.csv
2. data/assembly_constituencies_enriched.csv
3. SQLite table `assembly_constituencies` in mplads_dev.db and api/mplads_dev.db
"""

import os
import re
import struct
import sqlite3
import pandas as pd

def clean_pc_name(pc_name: str) -> str:
    if not pc_name:
        return ""
    # Remove SC/ST indicators and normalize whitespace
    c = re.sub(r"\s*\((SC|ST)\)", "", pc_name, flags=re.IGNORECASE).strip().upper()
    c = re.sub(r"\s+", " ", c)
    return c

# Aliases to match the 543 Parliamentary Constituencies in all_mps_summary.csv
PC_ALIASES = {
    "GAUHATI": "GUWAHATI",
    "UJIARPUR": "UJJARPUR",
    "MUMBAI NORTH-WEST": "MUMBAI NORTH WEST",
    "MUMBAI NORTH-CENTRAL": "MUMBAI NORTH CENTRAL",
    "MUMBAI SOUTH-CENTRAL": "MUMBAI SOUTH CENTRAL",
    "THIRUVANANTHAPURA": "THIRUVANANTHAPURAM",
    "PONDICHERRY": "PUDUCHERRY",
    "SONIPAT": "SONEPAT",
    "ANANTANAG": "ANANTNAG",
    "FATEHGARH SAHIB (SC": "FATEHGARH SAHIB",
    "TONK ? SAWAI MADHOPUR": "TONK-SAWAI MADHOPUR",
    "TONK-SAWAI MADHOPUR": "TONK-SAWAI MADHOPUR",
    "CHIKKBALLAPUR": "CHIKKABALLAPUR",
    "BATHINDA": "BHATINDA",
    "KHADOOR SAHIB": "KHADOOR SAHIB",
    "BARAMULLA": "BARAMULLA",
    "KALIABOR": "KAZIRANGA",
    "MANGALDOI": "DARRANG-UDALGURI",
    "TEZPUR": "SONITPUR",
    "AUTONOMOUS DISTRICT": "DIPHU",
    "JAYNAGAR (SC)": "JAYNAGAR",
    "CHEVELLA": "CHEVELLA",
    "MAHBUBNAGAR": "MAHABUBNAGAR",
    "WARANGAL": "WARANGAL",
    "BHIWANI-MAHENDRAGARH": "BHIWANI - MAHENDRAGARH",
    "BHIWANI - MAHENDRAGARH": "BHIWANI - MAHENDRAGARH",
    "AHMEDNAGAR": "AHMEDNAGAR",
    "DHARMAPURI": "DHARMAPURI",
    "GULBARGA": "GULBARGA",
    "DAVANAGERE": "DAVANAGERE",
    "BANGALORE RURAL": "BANGALORE RURAL",
    "BANGALORE NORTH": "BANGALORE NORTH",
    "BANGALORE CENTRAL": "BANGALORE CENTRAL",
    "BANGALORE SOUTH": "BANGALORE SOUTH",
}

def main():
    print("Loading all_mps_summary.csv...")
    df_mps = pd.read_csv("data/all_mps_summary.csv")
    
    # Build PC -> MP profile mapping
    pc_to_mp = {}
    state_to_rs = {}
    
    for _, row in df_mps.iterrows():
        house = str(row.get("house", "")).strip()
        state = str(row.get("state", "")).strip()
        mp_id = str(row.get("id", "")).strip()
        mp_name = str(row.get("mpName", "")).strip()
        const = str(row.get("constituency", "")).strip().upper()
        
        if house == "Lok Sabha" and const:
            pc_to_mp[const] = {
                "mp_id": mp_id,
                "mp_name": mp_name,
                "house": house,
                "state": state,
                "constituency": const,
            }
        elif house == "Rajya Sabha" and state:
            if state.lower() not in state_to_rs:
                state_to_rs[state.lower()] = {
                    "mp_id": mp_id,
                    "mp_name": mp_name,
                    "house": house,
                    "state": state,
                    "constituency": "Rajya Sabha",
                }

    print(f"Loaded {len(pc_to_mp)} Lok Sabha PCs and {len(state_to_rs)} Rajya Sabha state fallbacks.")

    # Read India_AC.dbf
    print("Parsing India_AC.dbf...")
    with open("India_AC.dbf", "rb") as f:
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
        ac_name = r.get("AC_NAME", "").strip().title()
        raw_pc = r.get("PC_NAME", "").strip()
        st_name = r.get("ST_NAME", "").strip().title()
        dist_name = r.get("DIST_NAME", "").strip().replace("*", "").strip().title()
        ac_no = r.get("AC_NO", "").strip()
        pc_no = r.get("PC_NO", "").strip()
        
        if not ac_name:
            continue

        c_pc = clean_pc_name(raw_pc)
        resolved_pc = PC_ALIASES.get(c_pc, c_pc)
        
        mp_info = pc_to_mp.get(resolved_pc)
        if not mp_info:
            # Fuzzy match PC
            for k, v in pc_to_mp.items():
                if (len(resolved_pc) > 3 and resolved_pc in k) or (len(k) > 3 and k in resolved_pc):
                    mp_info = v
                    resolved_pc = k
                    break

        # State normalization (e.g. Orissa -> Odisha)
        if st_name.upper() == "ORISSA":
            st_name = "Odisha"
        elif st_name.upper() == "JAMMU & KASHMIR":
            st_name = "Jammu And Kashmir"

        master_rows.append({
            "ac_name": ac_name,
            "ac_no": ac_no,
            "pc_name": resolved_pc if resolved_pc else raw_pc,
            "pc_no": pc_no,
            "state": mp_info["state"] if mp_info else st_name,
            "district": dist_name
        })

        mp_id = mp_info["mp_id"] if mp_info else ""
        mp_name = mp_info["mp_name"] if mp_info else ""
        house = mp_info["house"] if mp_info else "Lok Sabha"
        state = mp_info["state"] if mp_info else st_name

        if not mp_id:
            # If still vacant / missing, check Rajya Sabha state fallback
            rs_info = state_to_rs.get(state.lower())
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
            "house": house
        })

    # Export master CSV
    df_master = pd.DataFrame(master_rows).drop_duplicates()
    os.makedirs("data", exist_ok=True)
    df_master.to_csv("data/assembly_constituencies_master.csv", index=False)
    print(f"Saved data/assembly_constituencies_master.csv ({len(df_master)} rows)")

    # Export enriched CSV
    df_enriched = pd.DataFrame(enriched_rows).drop_duplicates()
    df_enriched.to_csv("data/assembly_constituencies_enriched.csv", index=False)
    print(f"Saved data/assembly_constituencies_enriched.csv ({len(df_enriched)} rows)")

    # Validate Padampur & Bijepur in dataset
    padampur_matches = df_enriched[df_enriched["ac_name"].str.lower() == "padampur"]
    print("\n--- Validation: Padampur in Enriched Dataset ---")
    for _, r in padampur_matches.iterrows():
        print(f"AC: {r['ac_name']} -> PC: {r['pc_name']} | State: {r['state']} | District: {r['district']} | MP: {r['mp_name']} (ID: {r['mp_id']})")

    bijepur_matches = df_enriched[df_enriched["ac_name"].str.lower() == "bijepur"]
    print("\n--- Validation: Bijepur in Enriched Dataset ---")
    for _, r in bijepur_matches.iterrows():
        print(f"AC: {r['ac_name']} -> PC: {r['pc_name']} | State: {r['state']} | District: {r['district']} | MP: {r['mp_name']} (ID: {r['mp_id']})")

    # Insert into SQLite databases (root and api/)
    for db_path in ["mplads_dev.db", "api/mplads_dev.db"]:
        if os.path.exists(os.path.dirname(db_path) or "."):
            print(f"\nWriting to SQLite database: {db_path}...")
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

if __name__ == "__main__":
    main()
