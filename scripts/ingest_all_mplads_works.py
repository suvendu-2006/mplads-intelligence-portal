import sqlite3
import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_FILE = BASE_DIR / "mplads_dev.db"
CSV_FILE = BASE_DIR / "06_Works" / "all_mplads_works.csv"
COMPLETED_CSV = BASE_DIR / "06_Works" / "works_completed.csv"

def categorize(desc):
    d = str(desc).lower()
    if any(k in d for k in ['borewell', 'bore well', 'drinking water', 'water supply', 'pipeline', 'handpump']):
        return 'Drinking Water Supply'
    if any(k in d for k in ['cc road', 'road', 'drain', 'pathway', 'bridge', 'culvert', 'tar road', 'pavement']):
        return 'Roads & Pathways'
    if any(k in d for k in ['community hall', 'community center', 'shed', 'mandapam', 'bhavan', 'samithi']):
        return 'Community Centers & Halls'
    if any(k in d for k in ['school', 'college', 'classroom', 'compound wall', 'zphs', 'education', 'library']):
        return 'Education & School Infrastructure'
    if any(k in d for k in ['cctv', 'gym', 'park', 'playground', 'stadium', 'crematorium', 'shmashan']):
        return 'Public Amenities & Sports'
    if any(k in d for k in ['solar', 'light', 'lamp', 'electricity', 'transformer', 'high mast']):
        return 'Solar & Public Lighting'
    if any(k in d for k in ['health', 'hospital', 'clinic', 'ct scan', 'dispensary', 'ambulance', 'phc', 'chc']):
        return 'Public Health & Sanitation'
    return 'Other Civil Development'

def main():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()

    c.execute("SELECT work_id FROM works")
    existing_ids = set(r[0] for r in c.fetchall())
    print(f"Existing works in DB: {len(existing_ids)}")

    df = pd.read_csv(CSV_FILE)
    df_new = df[~df['work_id'].isin(existing_ids)].copy()
    print(f"New works to ingest from all_mplads_works.csv: {len(df_new)}")

    # Check completed IDs
    completed_ids = set()
    if COMPLETED_CSV.exists():
        df_comp = pd.read_csv(COMPLETED_CSV)
        completed_ids = set(df_comp['work_id'].dropna().astype(int))

    rows_to_insert = []
    for _, r in df_new.iterrows():
        try:
            wid = int(r['work_id'])
            raw_desc = str(r['work_description']) if pd.notna(r['work_description']) else "Local Area Infrastructure Development"
            cost_val = float(r['recommended_amount']) if pd.notna(r['recommended_amount']) and float(r['recommended_amount']) > 0 else 100000.0
            category_val = categorize(raw_desc)
            
            constituency_val = str(r['constituency']) if pd.notna(r['constituency']) else "General"
            state_val = str(r['state']) if pd.notna(r['state']) else "India"
            mp_name_val = str(r['mp_name']) if pd.notna(r['mp_name']) else "Representative"
            house_val = str(r['house']) if pd.notna(r['house']) else "Lok Sabha"
            
            # Determine status
            raw_status = str(r.get('status', 'recommended')).lower()
            if wid in completed_ids:
                status_val = 'completed'
            elif 'complete' in raw_status:
                status_val = 'completed'
            else:
                status_val = 'recommended'

            has_pmt = bool(r.get('has_payments', False)) or (status_val == 'completed')
            total_paid_val = float(r['total_paid']) if pd.notna(r.get('total_paid')) and float(r['total_paid']) > 0 else (cost_val if status_val == 'completed' else 0.0)

            rec_date = str(r['recommendation_date'])[:10] if pd.notna(r.get('recommendation_date')) else None
            comp_date = rec_date if status_val == 'completed' else None

            rows_to_insert.append((
                wid,
                raw_desc,
                cost_val,
                category_val,
                constituency_val,
                constituency_val, # district
                mp_name_val,
                constituency_val, # mp_constituency
                comp_date,
                rec_date,
                status_val,
                1 if has_pmt else 0,
                total_paid_val,
                0.0, # payment_gap_percentage
                1 if has_pmt else 0,
                house_val,
                "18th Lok Sabha",
                state_val,
                "official_mplads_census"
            ))
        except Exception as ex:
            continue

    print(f"Prepared {len(rows_to_insert)} records for insertion...")

    insert_sql = """
        INSERT OR IGNORE INTO works (
            work_id, work_description, cost, category, location, district,
            mp_name, mp_constituency, completion_date, recommended_date,
            status, has_payments, total_paid, payment_gap_percentage,
            payment_record_exists, house, ls_term, state, data_origin
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    c.executemany(insert_sql, rows_to_insert)
    conn.commit()

    c.execute("SELECT COUNT(*) FROM works")
    total_after = c.fetchone()[0]
    print(f"✓ Ingestion complete! Total works in DB now: {total_after}")

    # Check Eatala Rajender
    c.execute("SELECT COUNT(*) FROM works WHERE lower(mp_name) LIKE '%rajender%'")
    er_count = c.fetchone()[0]
    print(f"✓ Works for Eatala Rajender in DB now: {er_count}")

    conn.close()

if __name__ == "__main__":
    main()
