import os
import re
from pathlib import Path
from typing import Tuple, Optional, Dict, Union
import pandas as pd


def normalize_agency_name(raw: Optional[str]) -> str:
    """
    Cleans typos, administrative annotations, parentheses extractions, and formats
    agency names into standardized canonical forms.
    Rules:
    - Extract from parentheses: MON(Deputy Commissioner Mon_IDA) -> Deputy Commissioner, Mon
    - Strip _IDA suffix and trailing numbering (_1, _2)
    - Fix common typos: Commisioner -> Commissioner, Magistrae -> Magistrate, Colletor -> Collector, Distirct -> District
    - Preserve key administrative acronyms (PWD, CPWD, DRDA, BDO, etc.)
    """
    if not raw:
        return ""
    s = str(raw).strip()
    if s.lower() in ["nan", "none", "null", ""]:
        return ""

    # Strip NOTE clauses often tagged in MP work descriptions
    s = re.split(r'\bNOTE\b|\bNote\b|\bAs per approved\b', s)[0].strip()

    # Remove dates/dispatch numbers in parentheses like "(17 Dated 27.12.2024)"
    s = re.sub(r'\(\s*\d+\s*(?:dated|Dated).*?\)', '', s)

    # Check for pattern like DISTRICT(Agency Name_IDA) e.g., MON(Deputy Commissioner Mon_IDA)
    m_paren = re.search(r'([A-Za-z\s]+)?\((.*?)\)', s)
    if m_paren:
        prefix = (m_paren.group(1) or "").strip()
        inner = m_paren.group(2).strip()
        # If inner has meaningful agency text, prefer inner
        if len(inner) > 3:
            s = inner

    # Remove trailing/embedded _IDA markers and numbered suffixes
    s = re.sub(r'_IDA\b', '', s, flags=re.IGNORECASE)
    s = re.sub(r'_IDA$', '', s, flags=re.IGNORECASE)
    s = re.sub(r'_\d+$', '', s)
    s = s.replace('_', ' ')
    s = re.sub(r'\s+', ' ', s).strip(' .,-')

    # Standardize common typos from MoSPI raw feeds
    s = re.sub(r'\bMagistrae\b', 'Magistrate', s, flags=re.IGNORECASE)
    s = re.sub(r'\bCommisioner\b', 'Commissioner', s, flags=re.IGNORECASE)
    s = re.sub(r'\bColletor\b', 'Collector', s, flags=re.IGNORECASE)
    s = re.sub(r'\bDistirct\b', 'District', s, flags=re.IGNORECASE)
    s = re.sub(r'\bAuthroity\b', 'Authority', s, flags=re.IGNORECASE)

    # Standardize separator in "Deputy Commissioner Mon" -> "Deputy Commissioner, Mon"
    # or "District Magistrate Patna" -> "District Magistrate, Patna" or "District Magistrate South 24 Parganas"
    m_dc_dm = re.match(r'^(District Magistrate|Deputy Commissioner|District Collector|District Planning Officer)\s+([A-Za-z0-9\s]+)$', s, flags=re.IGNORECASE)
    if m_dc_dm:
        title_part = m_dc_dm.group(1).title()
        area_part = m_dc_dm.group(2).title().strip()
        s = f"{title_part}, {area_part}"

    # Preserve key public acronyms
    acronym_map = {
        r'\bPwd\b': 'PWD',
        r'\bCpwd\b': 'CPWD',
        r'\bDrda\b': 'DRDA',
        r'\bRes\b': 'RES',
        r'\bNrlm\b': 'NRLM',
        r'\bCeo\b': 'CEO',
        r'\bDc\b': 'DC',
        r'\bDm\b': 'DM',
        r'\bMp\b': 'M.P.',
        r'\bEm\b': 'E/M',
        r'\bPcc\b': 'PCC',
        r'\bRcc\b': 'RCC',
        r'\bAsi\b': 'ASI',
        r'\bGem\b': 'GeM',
        r'\bBdo\b': 'BDO',
    }

    title_str = s.title().strip(' .,-')
    # If comma exists, preserve comma casing
    if ',' in s:
        parts = [p.strip().title() for p in s.split(',')]
        title_str = ', '.join(parts)

    for pattern, repl in acronym_map.items():
        title_str = re.sub(pattern, repl, title_str, flags=re.IGNORECASE)

    return title_str


def clean_agency_name(raw: Optional[str]) -> str:
    """Alias for normalize_agency_name for backward compatibility."""
    return normalize_agency_name(raw)


def derive_agency_from_district(district: Optional[str], state: Optional[str] = None) -> str:
    """
    Intelligently derives the canonical implementing agency when ida is missing.
    Fallback hierarchy:
    1. District Magistrate / Collector, {District Name}
    2. State Nodal Authority, {State Name}
    3. District Implementing Authority
    """
    if district and str(district).strip() and str(district).strip().upper() not in ['UNKNOWN', 'SITTING RAJYA SABHA', 'NAN', 'NONE']:
        clean_dist = normalize_agency_name(str(district))
        return f"District Magistrate, {clean_dist}"

    if state and str(state).strip() and str(state).strip().upper() not in ['UNKNOWN', 'NAN', 'NONE']:
        clean_st = normalize_agency_name(str(state))
        return f"State Nodal Authority, {clean_st}"

    return "District Implementing Authority"


def validate_agency_name(name: Optional[str]) -> bool:
    """
    Quality check for completeness: returns True if agency name is valid, non-empty, and standardized.
    """
    if not name:
        return False
    s = str(name).strip()
    if s.lower() in ["", "nan", "none", "null", "undefined"]:
        return False
    return len(s) >= 3


def extract_ida_from_csv(csv_path: Optional[Union[str, Path]] = None) -> Dict[int, str]:
    """
    Parses ida column from all_mplads_works.csv and returns work_id -> ida mapping dictionary.
    """
    if csv_path is None:
        base_dir = Path(__file__).resolve().parent.parent.parent
        csv_path = base_dir / "06_Works" / "all_mplads_works.csv"
    else:
        csv_path = Path(csv_path)

    if not csv_path.exists():
        return {}

    df = pd.read_csv(csv_path, usecols=["work_id", "ida"], low_memory=False)
    ida_map = {}
    for _, row in df.dropna(subset=["work_id", "ida"]).iterrows():
        try:
            wid = int(row["work_id"])
            val = str(row["ida"]).strip()
            if val and val.lower() != "nan":
                ida_map[wid] = val
        except Exception:
            continue
    return ida_map


def extract_and_normalize_agency(
    raw_ida: Optional[str] = None,
    work_description: Optional[str] = None,
    location: Optional[str] = None,
    district: Optional[str] = None,
    state: Optional[str] = None
) -> Tuple[str, str]:
    """
    Extracts and standardizes the implementing agency.
    Returns:
        (implementing_agency_clean, implementing_agency_raw)
    """
    # 1. Check for explicit line agency in work description
    if work_description:
        desc = str(work_description)
        m_asi = re.search(r'with the (.*?) (?:serving as|will act as) the implementing agency', desc, re.I)
        if m_asi:
            val = m_asi.group(1).strip()
            return normalize_agency_name(val), val

        m_act = re.search(r'([A-Za-z\s]+(?:\([A-Za-z\s]+\))?) will act as the implementing agency', desc, re.I)
        if m_act:
            val = m_act.group(1).strip()
            return normalize_agency_name(val), val

        m_ia = re.search(r'Implementing Agency\s*[-:]\s*(?:Manager,\s*)?([^\n\r]+)', desc, re.I)
        if m_ia:
            val = m_ia.group(1).strip()
            cleaned = normalize_agency_name(val)
            if len(cleaned) > 3 and not cleaned.lower().startswith('not'):
                return cleaned, val

    # 2. Check raw_ida from CSV
    if raw_ida and str(raw_ida).strip() and str(raw_ida).strip().lower() != 'nan':
        raw_str = str(raw_ida).strip()
        cleaned = normalize_agency_name(raw_str)
        if cleaned:
            return cleaned, raw_str

    # 3. Check location if it holds IDA string
    if location and str(location).strip():
        loc_str = str(location).strip()
        if '_IDA' in loc_str.upper() or any(k in loc_str.upper() for k in ['COLLECTOR', 'MAGISTRATE', 'COMMISSIONER', 'PLANNING']):
            cleaned = normalize_agency_name(loc_str)
            if cleaned:
                return cleaned, loc_str

    # 4. Fallback: Derive from district
    if district and str(district).strip() and str(district).strip().upper() not in ['UNKNOWN', 'SITTING RAJYA SABHA']:
        derived = derive_agency_from_district(district, state)
        return derived, f"DERIVED_DISTRICT:{district}"

    # 5. Fallback: Derive from state
    if state and str(state).strip() and str(state).strip().upper() != 'UNKNOWN':
        derived = derive_agency_from_district(None, state)
        return derived, f"DERIVED_STATE:{state}"

    # 6. Default Fallback
    return "District Implementing Authority", "DEFAULT_AUTHORITY"

