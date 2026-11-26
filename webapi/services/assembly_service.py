"""
Assembly Constituency Service Layer.
Provides high-performance, in-memory lookups for all 4,120+ Indian Assembly Constituencies (Vidhan Sabha),
mapping them to parent Parliamentary Constituencies (Lok Sabha) and sitting MPs.
"""

import os
import re
import sqlite3
from pathlib import Path
from typing import List, Dict, Optional
import pandas as pd

_df_assembly = None
_assembly_index = {}
_assembly_norm_index = {}
_pc_to_assemblies = {}
_pc_norm_to_assemblies = {}
_pc_alnum_to_assemblies = {}

_PC_SUFFIX_RE = re.compile(
    r"\s*\(\s*(?:sc|st|s\.c\.|s\.t\.|s)\s*\)?$",
    flags=re.IGNORECASE,
)

# Bidirectional canonical PC spelling/renaming aliases
_PC_ALIAS_EQUIV: Dict[str, str] = {
    "DHARMAPURI": "DHARAMAPURI",
    "DHARAMAPURI": "DHARMAPURI",
    "CHANDNI CHOWK": "CHANDINI CHOWK",
    "CHANDINI CHOWK": "CHANDNI CHOWK",
    "CHEVELLA": "CHELVELLA",
    "CHELVELLA": "CHEVELLA",
    "CHIKKABALLAPUR": "CHIKBALLAPUR",
    "CHIKBALLAPUR": "CHIKKABALLAPUR",
    "CHIKKBALLAPUR": "CHIKBALLAPUR",
    "JAYNAGAR": "JOYNAGAR",
    "JOYNAGAR": "JAYNAGAR",
    "NARSAPURAM": "NARASAPURAM",
    "NARASAPURAM": "NARSAPURAM",
    "PURNIA": "PURNEA",
    "PURNEA": "PURNIA",
    "SURGUJA": "SARGUJA",
    "SARGUJA": "SURGUJA",
    "WARANGAL": "WARANGEL",
    "WARANGEL": "WARANGAL",
    "GAUHATI": "GUWAHATI",
    "GUWAHATI": "GAUHATI",
    "SONIPAT": "SONEPAT",
    "SONEPAT": "SONIPAT",
    "BATHINDA": "BHATINDA",
    "BHATINDA": "BATHINDA",
    "PONDICHERRY": "PUDUCHERRY",
    "PUDUCHERRY": "PONDICHERRY",
    "UJIARPUR": "UJJARPUR",
    "UJJARPUR": "UJIARPUR",
    "ANANTNAG": "ANANTANAG",
    "ANANTANAG": "ANANTNAG",
    "THIRUVANANTHAPURAM": "THIRUVANANTHAPURA",
    "THIRUVANANTHAPURA": "THIRUVANANTHAPURAM",
    "MAHABUBNAGAR": "MAHBUBNAGAR",
    "MAHBUBNAGAR": "MAHABUBNAGAR",
    "MANGALDOI": "DARRANG UDALGURI",
    "DARRANG UDALGURI": "MANGALDOI",
    "KALIABOR": "KAZIRANGA",
    "KAZIRANGA": "KALIABOR",
    "TEZPUR": "SONITPUR",
    "SONITPUR": "TEZPUR",
    "AUTONOMOUS DISTRICT": "DIPHU",
    "DIPHU": "AUTONOMOUS DISTRICT",
    "NAINITAL UDHAM SINGH NAG": "NAINITAL UDHAMSINGH NAGAR",
    "NAINITAL UDHAMSINGH NAG": "NAINITAL UDHAM SINGH NAG",
    "NAINITAL UDHAM SINGH NAGAR": "NAINITAL UDHAM SINGH NAG",
    "NAINITAL UDHAMSINGH NAGAR": "NAINITAL UDHAM SINGH NAG",
    "RATNAGIRI SINDHUDUR": "RATNAGIRI SINDHUDURG",
    "RATNAGIRI SINDHUDURG": "RATNAGIRI SINDHUDUR",
    "BHIWANI MAHENDRAGARH": "BHIWANI MAHENDRAGARH",
    "GURGAON": "GURUGRAM",
    "GURUGRAM": "GURGAON",
    "BANGALORE RURAL": "BENGALURU RURAL",
    "BENGALURU RURAL": "BANGALORE RURAL",
    "BANGALORE NORTH": "BENGALURU NORTH",
    "BENGALURU NORTH": "BANGALORE NORTH",
    "BANGALORE CENTRAL": "BENGALURU CENTRAL",
    "BENGALURU CENTRAL": "BANGALORE CENTRAL",
    "BANGALORE SOUTH": "BENGALURU SOUTH",
    "BENGALURU SOUTH": "BANGALORE SOUTH",
}

_STATE_ALIAS_EQUIV: Dict[str, str] = {
    "ORISSA": "ODISHA",
    "PONDICHERRY": "PUDUCHERRY",
    "UTTARANCHAL": "UTTARAKHAND",
    "JAMMU & KASHMIR": "JAMMU AND KASHMIR",
    "NCT OF DELHI": "DELHI",
    "ANDAMAN & NICOBAR ISLANDS": "ANDAMAN AND NICOBAR ISLANDS",
    "DADRA & NAGAR HAVELI": "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
    "DAMAN & DIU": "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
}


def _normalize_pc_key(name: str) -> str:
    if not name:
        return ""
    cleaned = _PC_SUFFIX_RE.sub("", str(name).strip()).upper()
    cleaned = re.sub(r"[^A-Z0-9]+", " ", cleaned).strip()
    return cleaned


def _normalize_state(state: str) -> str:
    s = re.sub(r"[^A-Z0-9]+", " ", str(state or "").strip().upper()).strip()
    return _STATE_ALIAS_EQUIV.get(s, s)


def _filter_by_state(records: List[Dict], state: Optional[str]) -> List[Dict]:
    if not state or not records:
        return records
    target_state = _normalize_state(state)
    if not target_state:
        return records
    matched = [r for r in records if _normalize_state(r.get("state", "")) == target_state]
    return matched if matched else records


def reload_assembly_data():
    """Force reload of assembly CSV/SQLite cache."""
    global _df_assembly
    _df_assembly = None
    return _load_assembly_data()


def _load_assembly_data():
    global _df_assembly, _assembly_index, _assembly_norm_index, _pc_to_assemblies, _pc_norm_to_assemblies, _pc_alnum_to_assemblies
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
    _assembly_norm_index = {}
    _pc_to_assemblies = {}
    _pc_norm_to_assemblies = {}
    _pc_alnum_to_assemblies = {}

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
            "house": str(row.get("house", "Lok Sabha")),
        }
        _assembly_index.setdefault(ac_lower, []).append(record)

        ac_norm = _normalize_pc_key(ac_name).lower()
        if ac_norm:
            _assembly_norm_index.setdefault(ac_norm, []).append(record)

        if pc_name:
            _pc_to_assemblies.setdefault(pc_name, []).append(record)
            pc_norm = _normalize_pc_key(pc_name)
            if pc_norm:
                _pc_norm_to_assemblies.setdefault(pc_norm, []).append(record)
                alnum = pc_norm.replace(" ", "")
                if alnum:
                    _pc_alnum_to_assemblies.setdefault(alnum, []).append(record)

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

    norm_q = _normalize_pc_key(ac_name).lower()
    if norm_q in _assembly_norm_index:
        return _assembly_norm_index[norm_q][0]

    return None


def get_assemblies_by_pc(pc_name: str, state: Optional[str] = None) -> List[Dict]:
    """
    Retrieve all Assembly Constituencies associated with a Parliamentary Constituency.
    Handles punctuation, (Sc)/(St) suffixes, and known PC spelling aliases.
    """
    _load_assembly_data()
    if not pc_name:
        return []

    pc_upper = pc_name.strip().upper()
    if pc_upper in _pc_to_assemblies:
        return _filter_by_state(_pc_to_assemblies[pc_upper], state)

    pc_norm = _normalize_pc_key(pc_upper)
    if pc_norm in _pc_norm_to_assemblies:
        return _filter_by_state(_pc_norm_to_assemblies[pc_norm], state)

    alias = _PC_ALIAS_EQUIV.get(pc_norm)
    if alias and alias in _pc_norm_to_assemblies:
        return _filter_by_state(_pc_norm_to_assemblies[alias], state)

    # Punctuation/space-collapsed match (e.g., BHIWANI MAHENDRAGARH vs BHIWANIMAHENDRAGARH)
    alnum = pc_norm.replace(" ", "")
    if len(alnum) > 4 and alnum in _pc_alnum_to_assemblies:
        return _filter_by_state(_pc_alnum_to_assemblies[alnum], state)

    return []


def get_assemblies_by_district(
    district: str,
    state: Optional[str] = None,
    fallback_pcs: Optional[List[str]] = None,
) -> List[Dict]:
    """
    Retrieve Assembly Constituencies in a given District (with state scoping,
    punctuation/historical district aliases, and fallback to covered PCs).
    """
    _load_assembly_data()
    if not district or _df_assembly is None or _df_assembly.empty:
        return []

    dist_aliases = {
        "GURUGRAM": "GURGAON",
        "GURGAON": "GURUGRAM",
        "PRAYAGRAJ": "ALLAHABAD",
        "ALLAHABAD": "PRAYAGRAJ",
        "AYODHYA": "FAIZABAD",
        "FAIZABAD": "AYODHYA",
        "KALABURAGI": "GULBARGA",
        "GULBARGA": "KALABURAGI",
        "BELAGAVI": "BELGAUM",
        "BELGAUM": "BELAGAVI",
        "TUMAKURU": "TUMKUR",
        "TUMKUR": "TUMAKURU",
        "SHIVAMOGGA": "SHIMOGA",
        "SHIMOGA": "SHIVAMOGGA",
        "BALLARI": "BELLARY",
        "BELLARY": "BALLARI",
        "VIJAYAPURA": "BIJAPUR",
        "BIJAPUR": "VIJAYAPURA",
        "BENGALURU": "BANGALORE",
        "BANGALORE": "BENGALURU",
        "BENGALURU URBAN": "BANGALORE",
        "BENGALURU RURAL": "BANGALORE RURAL",
        "MYSURU": "MYSORE",
        "MYSORE": "MYSURU",
        "MANGALURU": "MANGALORE",
        "MANGALORE": "MANGALURU",
        "CHHATRAPATI SAMBHAJINAGAR": "AURANGABAD",
        "DHARASHIV": "OSMANABAD",
        "OSMANABAD": "DHARASHIV",
        "AHILYANAGAR": "AHMEDNAGAR",
        "AHMEDNAGAR": "AHILYANAGAR",
        "PURBI CHAMPARAN": "PURBA CHAMPARAN",
        "EAST CHAMPARAN": "PURBA CHAMPARAN",
        "WEST CHAMPARAN": "PASHCHIM CHAMPARAN",
        "PASCHIM CHAMPARAN": "PASHCHIM CHAMPARAN",
        "SPS NELLORE": "NELLORE",
        "SRI POTTI SRIRAMULU NELLORE": "NELLORE",
        "YSR": "KADAPA",
        "YSR KADAPA": "KADAPA",
        "CUDDAPAH": "KADAPA",
        "KHERI": "LAKHIMPUR KHERI",
        "NUH": "MEWAT",
        "MEWAT": "NUH",
        "AHMADABAD": "AHMEDABAD",
        "AHMEDABAD": "AHMADABAD",
        "MUMBAI SUBURBAN": "MUMBAI SUBURBAN",
        "KHORDHA": "KHURDA",
        "KHURDA": "KHORDHA",
        "BALASORE": "BALESHWAR",
        "BALESHWAR": "BALASORE",
        "KEONJHAR": "KENDUJHAR",
        "KENDUJHAR": "KEONJHAR",
        "KATAKA": "CUTTACK",
        "CUTTACK": "KATAKA",
        "NAYAGADA": "NAYAGARH",
        "NAYAGARH": "NAYAGADA",
        "PONDICHERRY": "PUDUCHERRY",
        "PUDUCHERRY": "PONDICHERRY",
    }

    d_norm = _normalize_pc_key(district)
    candidates = [d_norm]
    if d_norm in dist_aliases:
        candidates.append(dist_aliases[d_norm])
    cand_set = set(candidates)

    dist_series = _df_assembly["district"].fillna("").astype(str)
    mask = dist_series.apply(lambda v: _normalize_pc_key(v) in cand_set)
    matches = _df_assembly[mask]

    if not matches.empty:
        records = matches.to_dict(orient="records")
        filtered = _filter_by_state(records, state)
        if filtered:
            return filtered

    # Fallback: newly created districts may map directly via covered PCs
    if fallback_pcs:
        seen_ac = set()
        pc_records: List[Dict] = []
        for pc in fallback_pcs:
            for rec in get_assemblies_by_pc(pc, state=state):
                key = (rec.get("ac_name"), rec.get("pc_name"))
                if key not in seen_ac:
                    seen_ac.add(key)
                    pc_records.append(rec)
        if pc_records:
            return pc_records

    # Last fallback: district matches PC name directly
    return get_assemblies_by_pc(district, state=state)
