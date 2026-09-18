"""
Assembly Constituency Service Layer.
Provides high-performance, in-memory lookups for all 4,120+ Indian Assembly Constituencies (Vidhan Sabha),
mapping them to parent Parliamentary Constituencies (Lok Sabha) and sitting MPs.
"""

import os
import sqlite3
from pathlib import Path
from typing import List, Dict, Optional
import pandas as pd

_df_assembly = None
_assembly_index = {}
_pc_to_assemblies = {}

def _load_assembly_data():
    global _df_assembly, _assembly_index, _pc_to_assemblies
    if _df_assembly is not None:
        return _df_assembly

    root_dir = Path(__file__).resolve().parent.parent.parent
    csv_candidates = [
        root_dir / "api" / "data" / "assembly_constituencies_enriched.csv",
        Path("/var/task/api/data/assembly_constituencies_enriched.csv"),
        root_dir / "data" / "assembly_constituencies_enriched.csv",
        Path("/var/task/data/assembly_constituencies_enriched.csv"),
        Path("data/assembly_constituencies_enriched.csv"),
    ]

    loaded = False
    for p in csv_candidates:
        if p.exists() and p.is_file():
            try:
                _df_assembly = pd.read_csv(p)
                loaded = True
                break
            except Exception:
                pass

    if not loaded:
        # Fallback to SQLite assembly_constituencies table
        db_path = os.environ.get("DATABASE_PATH")
        if not db_path:
            for cand in [
                root_dir / "mplads_dev.db",
                root_dir / "api" / "mplads_dev.db",
                Path("/var/task/api/mplads_dev.db"),
                Path("mplads_dev.db"),
            ]:
                if cand.exists() and cand.is_file():
                    db_path = str(cand)
                    break

        if db_path and os.path.exists(db_path):
            try:
                con = sqlite3.connect(db_path)
                _df_assembly = pd.read_sql_query("SELECT * FROM assembly_constituencies", con)
                con.close()
                loaded = True
            except Exception:
                pass

    if not loaded or _df_assembly is None or _df_assembly.empty:
        # Empty fallback dataframe
        _df_assembly = pd.DataFrame(columns=[
            "ac_name", "ac_no", "pc_name", "pc_no", "state", "district", "mp_name", "mp_id", "house"
        ])

    # Pre-build lookup dictionaries for O(1) response times
    _assembly_index = {}
    _pc_to_assemblies = {}

    for _, row in _df_assembly.iterrows():
        ac_name = str(row.get("ac_name", "")).strip()
        pc_name = str(row.get("pc_name", "")).strip().upper()
        if not ac_name:
            continue
        ac_lower = ac_name.lower()
        record = {
            "ac_name": ac_name,
            "ac_no": str(row.get("ac_no", "")),
            "pc_name": pc_name,
            "pc_no": str(row.get("pc_no", "")),
            "state": str(row.get("state", "")),
            "district": str(row.get("district", "")),
            "mp_name": str(row.get("mp_name", "")),
            "mp_id": str(row.get("mp_id", "")),
            "house": str(row.get("house", "Lok Sabha"))
        }
        if ac_lower not in _assembly_index:
            _assembly_index[ac_lower] = []
        _assembly_index[ac_lower].append(record)

        if pc_name:
            if pc_name not in _pc_to_assemblies:
                _pc_to_assemblies[pc_name] = []
            _pc_to_assemblies[pc_name].append(record)

    return _df_assembly

# Initialize on module import
_load_assembly_data()

def search_assembly_constituencies(query: str, limit: int = 10) -> List[Dict]:
    """
    Search for Assembly Constituencies by substring / prefix match.
    Returns list of matching records with parent PC and MP info.
    """
    _load_assembly_data()
    q = query.strip().lower()
    if not q:
        return []

    exact_matches = []
    prefix_matches = []
    substring_matches = []

    for ac_lower, records in _assembly_index.items():
        if ac_lower == q:
            exact_matches.extend(records)
        elif ac_lower.startswith(q):
            prefix_matches.extend(records)
        elif q in ac_lower:
            substring_matches.extend(records)

        if len(exact_matches) + len(prefix_matches) + len(substring_matches) >= limit * 2:
            break

    results = exact_matches + prefix_matches + substring_matches
    return results[:limit]

def get_mp_by_assembly_name(ac_name: str) -> Optional[Dict]:
    """
    Exact case-insensitive lookup of an Assembly Constituency.
    Returns primary matching record or None.
    """
    _load_assembly_data()
    q = ac_name.strip().lower()
    if not q:
        return None

    matches = _assembly_index.get(q)
    if matches and len(matches) > 0:
        return matches[0]

    # Try clean name without punctuation
    clean_q = "".join(c for c in q if c.isalnum() or c.isspace()).strip()
    if clean_q in _assembly_index:
        return _assembly_index[clean_q][0]

    return None

def get_assemblies_by_pc(pc_name: str) -> List[Dict]:
    """
    Retrieve all Assembly Constituencies associated with a Parliamentary Constituency.
    """
    _load_assembly_data()
    pc_upper = pc_name.strip().upper()
    return _pc_to_assemblies.get(pc_upper, [])

def get_assemblies_by_district(district: str) -> List[Dict]:
    """
    Retrieve all Assembly Constituencies in a given District.
    """
    _load_assembly_data()
    d_lower = district.strip().lower()
    if not d_lower or _df_assembly is None:
        return []
    matches = _df_assembly[_df_assembly["district"].astype(str).str.lower() == d_lower]
    return matches.to_dict(orient="records")
