"""
Deterministic Assembly Segment Resolver for MPLADS Works.

Partitions every developmental work within a Parliamentary Constituency (PC)
into strictly ONE canonical Vidhan Sabha Assembly Constituency (`ac_name`) from
that PC's ECI assembly roster OR `UNSPECIFIED_SEGMENT` ("District-Wide / Unspecified").
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from webapi.config import BASE_DIR

UNSPECIFIED_SEGMENT = "District-Wide / Unspecified"

_AC_SUFFIX_RE = re.compile(
    r"\s*\(\s*(?:sc|st|s\.c\.|s\.t\.|s)\s*\)?$",
    flags=re.IGNORECASE,
)

_IDA_LOCATION_TAIL_RE = re.compile(
    r"\([^)]*(?:_ida|collector|commissioner|commisioner|officer|nodal|planning|magistrate|ceo|\bdc\b|\bdpo\b)[^)]*\)\s*$",
    flags=re.IGNORECASE,
)

_DIRECTIONAL_JOINED_RE = re.compile(
    r"([a-z]{3,})(north|south|east|west|central|rural|urban|city|town|cantt)$"
)

_NON_GEO_DIST_WORDS = frozenset({
    "in", "of", "the", "a", "an", "and", "or", "to", "for", "at", "by", "from",
    "with", "on", "near", "under", "court", "bar", "collector", "collectorate",
    "hospital", "hq", "headquarter", "headquarters", "office", "magistrate",
    "planning", "police", "school", "college", "level", "wide", "wise", "admin",
    "administration", "authority", "committee", "council", "development", "drda",
    "rural", "urban", "nodal", "mplads", "library", "hall", "association",
    "center", "centre", "board", "officer", "judge", "session", "sessions",
})

# Explicit Indian transliteration and historical/official alias pairs
_TRANSLITERATION_PAIRS: Tuple[Tuple[str, str], ...] = (
    ("rajanagar", "rajnagar"),
    ("mahakalapada", "mahakalpara"),
    ("kendrapara", "kendrapada"),
    ("kaikaluru", "kaikalur"),
    ("unguturu", "ungutur"),
    ("denduluru", "dendulur"),
    ("fatuha", "fatua"),
    ("dharmapuri", "dharamapuri"),
    ("chikkaballapur", "chikballapur"),
    ("narasapuram", "narsapuram"),
    ("chevella", "chelvella"),
    ("gurgaon", "gurugram"),
    ("sulthanbathery", "sultanbathery"),
    ("sulthanbathery", "sulthan bathery"),
    ("sulthanbathery", "sultan bathery"),
    ("bhiwani", "bhivani"),
    ("mahabubnagar", "mahbubnagar"),
    ("jaynagar", "joynagar"),
    ("purnia", "purnea"),
    ("surguja", "sarguja"),
    ("warangal", "warangel"),
    ("barabanki", "bara banki"),
    ("firozpur", "ferozepur"),
    ("ferozepur", "firozpur"),
    ("tumkur", "tumakuru"),
    ("belgaum", "belagavi"),
    ("gulbarga", "kalaburagi"),
    ("bellary", "ballari"),
    ("shimoga", "shivamogga"),
    ("mysore", "mysuru"),
    ("mangalore", "mangaluru"),
    ("bangalore", "bengaluru"),
    ("hubli", "hubballi"),
    ("dharwad", "dharwar"),
    ("allahabad", "prayagraj"),
    ("faizabad", "ayodhya"),
    ("pondicherry", "puducherry"),
    ("calcutta", "kolkata"),
    ("madras", "chennai"),
    ("bombay", "mumbai"),
    ("trivandrum", "thiruvananthapuram"),
    ("cochin", "kochi"),
    ("trichur", "thrissur"),
    ("palghat", "palakkad"),
    ("quilon", "kollam"),
    ("alleppey", "alappuzha"),
    ("cuddapah", "kadapa"),
    ("rajahmundry", "rajamahendravaram"),
    ("bezwada", "vijayawada"),
    ("waltair", "visakhapatnam"),
    ("gauhati", "guwahati"),
    ("baroda", "vadodara"),
    ("broach", "bharuch"),
    ("benares", "varanasi"),
    ("banaras", "varanasi"),
    ("poona", "pune"),
    ("nasik", "nashik"),
    ("solapur", "sholapur"),
    ("osmanabad", "dharashiv"),
    ("ahmednagar", "ahilyanagar"),
    ("nainital udhamsingh nag", "nainital udham singh nagar"),
    ("nainital udham singh nag", "nainital udham singh nagar"),
    ("bantwala", "bantval"),
    ("sulya", "sullia"),
    ("ramanagara", "ramanagaram"),
    ("channapatana", "channapatna"),
    ("anakapalli", "anakapalle"),
    ("sreerampur", "serampore"),
    ("champdani", "champdany"),
    ("champadany", "champdani"),
    ("nellore", "nelloore"),
    ("gudur", "guduru"),
    ("ongole", "ongolu"),
    ("eluru", "elur"),
)

_TRANSLITERATION_MAP: Dict[str, List[str]] = {}
for _a, _b in _TRANSLITERATION_PAIRS:
    _TRANSLITERATION_MAP.setdefault(_a, []).append(_b)
    _TRANSLITERATION_MAP.setdefault(_b, []).append(_a)

# Short/English-homograph AC names that require geographic context or Title/Upper case
_AMBIGUOUS_SHORT_ACS = frozenset({
    "man", "pen", "salt", "para", "mal", "ron", "rai", "jat", "uri", "bah",
    "goh", "vav", "wai", "ara", "mau", "leh", "una", "nuh", "aul", "gill",
    "kota", "bank", "camp", "fort", "park", "port", "road", "tank", "well",
})

_NAMESAKE_CONTEXT_BEFORE = (
    r"(?:"
    r"block|"
    r"ward(?:\s+no\.?\s*\d+)?|"
    r"municipality|municipal|muncipal|"
    r"nagar\s+palika|nagarpalika|nagar\s+nigam|nagar\s+parishad|nagar\s+panchayat|"
    r"town|city|corporation|tehsil|taluk|taluka|mandal|panchayat\s+samiti|"
    r"cantt|cantonment|"
    r"legislative\s+assembly|vidhan\s+sabha|assembly(?:\s+(?:constituency|segment))?"
    r")\s+(?:of\s+)?"
)

_NAMESAKE_CONTEXT_AFTER = (
    r"\s+(?:"
    r"municipality|municipal(?:\s+(?:council|corporation|committee))?|muncipal|"
    r"nagar\s+palika|nagarpalika|nagar\s+nigam|nagar\s+parishad|nagar\s+panchayat|"
    r"city|town|ward(?:\s+no\.?\s*\d+)?|block|tehsil|taluk|taluka|mandal|"
    r"panchayat\s+samiti|corporation|ulb|cantt|cantonment|"
    r"legislative\s+assembly|vidhan\s+sabha|assembly(?:\s+(?:constituency|segment))?|"
    r"a\s*c\b(?!\s*(?:unit|plant|hall|room|system|machine|split|window|ton|voltas|install))"
    r")"
)

_GEO_CONTEXT_SHORT_BEFORE = (
    r"(?:"
    r"block|taluk|taluka|tehsil|mandal|halka|halqa|gp|gram\s+panchayat|"
    r"village|vill|town|city|ward|p\s*s|municipality|municipal|at|near|via|"
    r"assembly|vidhan\s+sabha"
    r")\s+(?:of\s+)?"
)

_GEO_CONTEXT_SHORT_AFTER = (
    r"\s+(?:"
    r"block|taluk|taluka|tehsil|mandal|halka|halqa|gp|gram\s+panchayat|"
    r"town|city|ward|p\s*s|municipality|municipal|road|high\s+school|school|"
    r"assembly|vidhan\s+sabha"
    r")"
)

_FORBIDDEN_BEFORE_RE = re.compile(
    r"(?:^|\s)(?:dist|district|distt|zilla|zila)\s+$"
)
_FORBIDDEN_AFTER_LOK_RE = re.compile(
    r"^\s+(?:lok\s+sabha|parliamentary)\b"
)
_VIA_BEFORE_RE = re.compile(r"(?:^|\s)via\s+$")

_DIST_MENTION_PREFIX_RE = re.compile(
    r"\b(?:dist|district|distt|zilla|zila)\s+(?:of\s+)?([a-z]{3,}(?:\s+[a-z]{3,})?)\b"
)
_DIST_MENTION_SUFFIX_RE = re.compile(
    r"\b([a-z]{3,})\s+(?:district|distt)\b"
)


def strip_reserved_suffix(name: str) -> str:
    """Strip trailing (Sc)/(St)/(S.C.)/(S.T.)/(S reservations from AC/PC names."""
    if not name:
        return ""
    return _AC_SUFFIX_RE.sub("", str(name).strip()).strip()


def normalize_text(text: str) -> str:
    """Lowercase and collapse punctuation/whitespace to single spaces."""
    if not text:
        return ""
    return re.sub(r"[^a-z0-9]+", " ", str(text).lower()).strip()


def _expand_name_variants(base_norm: str) -> List[str]:
    """Generate safe transliteration and punctuation variants for an AC/PC name."""
    if not base_norm:
        return []

    seen: List[str] = []
    seen_set = set()

    def _add(val: str) -> None:
        v = val.strip()
        if v and v not in seen_set:
            seen_set.add(v)
            seen.append(v)

    _add(base_norm)

    # Split joined directional suffixes (e.g., aurangabadwest -> aurangabad west)
    m_dir = _DIRECTIONAL_JOINED_RE.match(base_norm)
    if m_dir:
        _add(f"{m_dir.group(1)} {m_dir.group(2)}")

    # Merge single-letter initial runs (e.g., "r k puram" -> "rk puram", "s a s nagar" -> "sas nagar")
    merged_initials = re.sub(
        r"\b([a-z](?:\s+[a-z])+)\b",
        lambda m: m.group(1).replace(" ", ""),
        base_norm,
    )
    if merged_initials != base_norm:
        _add(merged_initials)

    # Cantt <-> Cantonment
    if re.search(r"\bcantt\b", base_norm):
        _add(re.sub(r"\bcantt\b", "cantonment", base_norm))
    if re.search(r"\bcantonment\b", base_norm):
        _add(re.sub(r"\bcantonment\b", "cantt", base_norm))

    # Direct dictionary aliases on full string and individual long tokens
    for alt in _TRANSLITERATION_MAP.get(base_norm, []):
        _add(alt)

    tokens = base_norm.split()
    if len(tokens) > 1:
        # Also include concatenated form for hyphenated multi-word names >= 8 chars
        joined = "".join(tokens)
        if len(joined) >= 8:
            _add(joined)

    # Phonetic / suffix variations on each token of safe length
    for idx, tok in enumerate(tokens):
        tok_alts = set()
        for alt in _TRANSLITERATION_MAP.get(tok, []):
            tok_alts.add(alt)
        if len(tok) >= 5:
            if "ph" in tok:
                tok_alts.add(tok.replace("ph", "f"))
            if tok.startswith("f"):
                tok_alts.add("ph" + tok[1:])
            if "aa" in tok:
                tok_alts.add(tok.replace("aa", "a"))
            if "oo" in tok:
                tok_alts.add(tok.replace("oo", "u"))
            if "ee" in tok:
                tok_alts.add(tok.replace("ee", "i"))
        if len(tok) >= 7:
            if tok.endswith("pada"):
                tok_alts.add(tok[:-4] + "para")
            elif tok.endswith("para"):
                tok_alts.add(tok[:-4] + "pada")
            if tok.endswith("nagar"):
                tok_alts.add(tok + "a")
            elif tok.endswith("nagara"):
                tok_alts.add(tok[:-1])
            if tok.endswith("am"):
                tok_alts.add(tok[:-1])
            elif tok.endswith("a") and not tok.endswith("aa"):
                tok_alts.add(tok + "m")
                tok_alts.add(tok[:-1])
            elif tok.endswith(("l", "n", "r")) and not tok.endswith(("nagar", "pur", "bad", "garh")):
                tok_alts.add(tok + "a")
            if tok.endswith("i"):
                tok_alts.add(tok[:-1] + "e")
            elif tok.endswith("e"):
                tok_alts.add(tok[:-1] + "i")
        if len(tok) >= 6:
            if tok.endswith("uru"):
                tok_alts.add(tok[:-1])
            elif tok.endswith("ur"):
                tok_alts.add(tok + "u")
            if tok.endswith("garh"):
                tok_alts.add(tok[:-1])
            elif tok.endswith("gar"):
                tok_alts.add(tok + "h")
            if tok.endswith("pura"):
                tok_alts.add(tok[:-1])
            elif tok.endswith("pur"):
                tok_alts.add(tok + "a")
            if tok.endswith("bada"):
                tok_alts.add(tok[:-1])
            elif tok.endswith("bad"):
                tok_alts.add(tok + "a")

        for alt in tok_alts:
            if len(alt) >= 4:
                new_tokens = list(tokens)
                new_tokens[idx] = alt
                _add(" ".join(new_tokens))

    return seen


def _clean_sub_location(loc_raw: str, dist_norm: str, pc_norm_variants: set, state_norm: str) -> str:
    """
    Extract meaningful sub-location from `work.location` by stripping IDA wrapper tags.
    Returns empty string when location merely repeats the district, PC, or state.
    """
    if not loc_raw:
        return ""

    cleaned = _IDA_LOCATION_TAIL_RE.sub("", loc_raw.strip()).strip()
    if cleaned == loc_raw.strip() and loc_raw.strip().endswith(")") and loc_raw.count("(") == 1:
        prefix, paren = loc_raw.split("(", 1)
        inner = paren.rstrip(")").strip().lower()
        if prefix.strip() and inner not in {"west", "east", "north", "south", "sc", "st"}:
            cleaned = prefix.strip()

    cleaned_norm = normalize_text(cleaned)
    if not cleaned_norm:
        return ""
    if cleaned_norm == dist_norm or cleaned_norm in pc_norm_variants or (state_norm and cleaned_norm == state_norm):
        return ""
    if dist_norm and cleaned_norm in _expand_name_variants(dist_norm):
        return ""
    return cleaned_norm


def _subdistrict_map_candidates() -> List[Path]:
    return [
        BASE_DIR / "api" / "data" / "subdistrict_ac_map.json",
        BASE_DIR / "data" / "subdistrict_ac_map.json",
        Path("/var/task/api/data/subdistrict_ac_map.json"),
        Path("/var/task/data/subdistrict_ac_map.json"),
        Path("api/data/subdistrict_ac_map.json"),
        Path("data/subdistrict_ac_map.json"),
    ]


@lru_cache(maxsize=1)
def load_subdistrict_ac_map() -> Dict[str, Dict[str, str]]:
    """Load and cache curated PC -> {subdistrict/block/locality: ac_name} mapping."""
    for candidate in _subdistrict_map_candidates():
        if candidate.exists() and candidate.is_file():
            try:
                with open(candidate, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    return data
            except Exception:
                continue
    return {}


def _lookup_pc_subdistrict_map(
    pc_name: str,
    pc_norm_variants: set,
    raw_map: Dict[str, Dict[str, str]],
) -> Dict[str, str]:
    if not raw_map or not pc_name:
        return {}
    pc_upper = pc_name.strip().upper()
    if pc_upper in raw_map and isinstance(raw_map[pc_upper], dict):
        return raw_map[pc_upper]

    # Normalized PC key fallback
    for k, v in raw_map.items():
        if not isinstance(v, dict):
            continue
        k_norm = normalize_text(strip_reserved_suffix(k))
        if k_norm in pc_norm_variants:
            return v
    return {}


def _match_is_forbidden_context(
    desc_raw: str,
    text_norm: str,
    start: int,
    end: int,
    matched_text: str,
    check_district_suffix: bool = False,
) -> bool:
    before = text_norm[:start]
    after = text_norm[end:]
    if _FORBIDDEN_BEFORE_RE.search(before):
        return True
    if _FORBIDDEN_AFTER_LOK_RE.search(after):
        return True
    if check_district_suffix and re.match(r"^\s+(?:district|distt)\b", after):
        # Reject "<Name> district" (no comma before district and not "District - <Other>")
        if re.search(
            rf"\b{re.escape(matched_text)}\s+(?:district|distt)\b(?!\s*[-:])",
            desc_raw,
            flags=re.IGNORECASE,
        ):
            return True
    return False


def _match_is_via_preceded(text_norm: str, start: int) -> bool:
    return bool(_VIA_BEFORE_RE.search(text_norm[:start]))


def _has_short_geo_signal(
    desc_raw: str,
    desc_norm: str,
    start: int,
    end: int,
    variant: str,
) -> bool:
    before = desc_norm[:start]
    after = desc_norm[end:]
    if re.search(_GEO_CONTEXT_SHORT_BEFORE + r"$", before):
        return True
    if re.search(r"^" + _GEO_CONTEXT_SHORT_AFTER, after):
        return True
    # Allow if original description is mixed-case and the token appears capitalized
    if desc_raw and not desc_raw.islower() and not desc_raw.isupper():
        if re.search(rf"\b{re.escape(variant)}\b", desc_raw, flags=re.IGNORECASE):
            for m in re.finditer(rf"\b{re.escape(variant)}\b", desc_raw, flags=re.IGNORECASE):
                tok = m.group(0)
                if tok and tok[0].isupper():
                    return True
    return False


def _has_outside_district_mention(
    desc_norm: str,
    allowed_districts: set,
    pc_norm_variants: set,
) -> bool:
    for m in _DIST_MENTION_PREFIX_RE.finditer(desc_norm):
        cand = m.group(1).strip()
        first_word = cand.split()[0]
        if first_word in _NON_GEO_DIST_WORDS:
            continue
        if cand in allowed_districts or cand in pc_norm_variants:
            continue
        if first_word in allowed_districts or first_word in pc_norm_variants:
            continue
        return True

    for m in _DIST_MENTION_SUFFIX_RE.finditer(desc_norm):
        cand = m.group(1).strip()
        if cand in _NON_GEO_DIST_WORDS:
            continue
        if cand in allowed_districts or cand in pc_norm_variants:
            continue
        return True
    return False


_SUBDISTRICT_IDA_RE = re.compile(
    r"\b(?:municipality|municipal|muncipal|nagar\s+palika|nagarpalika|nagar\s+nigam|nagar\s+parishad|"
    r"nagar\s+panchayat|cantonment|cantt|block|bdo|panchayat\s+samiti|tehsil|tahsil|taluk|taluka|mandal)\b",
    flags=re.IGNORECASE,
)


def _extract_subdistrict_ida(ida_raw: str, dist_norm: str, pc_norm_variants: set) -> str:
    """Extract normalized implementing agency text only if it names a sub-district body (not Collectorate/DRDA)."""
    if not ida_raw or not _SUBDISTRICT_IDA_RE.search(ida_raw):
        return ""
    norm = normalize_text(ida_raw)
    if not norm or norm == dist_norm or norm in pc_norm_variants:
        return ""
    return norm


def assign_segments_for_pc(
    pc_name: str,
    assemblies: List[Dict[str, Any]],
    works: List[Dict[str, Any]],
    pc_state: str = "",
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int]:
    """
    Assign strictly one `assembly_segment` (either a canonical `ac_name` from `assemblies`
    or `UNSPECIFIED_SEGMENT`) to every work in `works` in O(N) time.

    Returns:
        (works_with_segments, segments_summary_with_counts, unspecified_count)
    """
    # Deduplicate canonical assemblies while preserving ECI ac_no order
    canonical_acs: List[Dict[str, Any]] = []
    seen_ac_names = set()
    for ac in assemblies or []:
        ac_name = str(ac.get("ac_name", "")).strip()
        if not ac_name or ac_name in seen_ac_names:
            continue
        seen_ac_names.add(ac_name)
        canonical_acs.append(dict(ac))

    def _ac_sort_key(item: Dict[str, Any]) -> Tuple[int, str]:
        raw_no = str(item.get("ac_no", "")).strip()
        return (int(raw_no) if raw_no.isdigit() else 999999, str(item.get("ac_name", "")))

    canonical_acs.sort(key=_ac_sort_key)

    if not canonical_acs:
        for w in works:
            w["assembly_segment"] = UNSPECIFIED_SEGMENT
        return works, [], len(works)

    # Canonical lookup maps to enforce the exact-ac_name invariant
    exact_ac_lookup: Dict[str, str] = {}
    norm_ac_lookup: Dict[str, str] = {}
    for ac in canonical_acs:
        cname = ac["ac_name"]
        exact_ac_lookup[cname] = cname
        exact_ac_lookup[cname.lower()] = cname
        ac_norm = normalize_text(strip_reserved_suffix(cname))
        if ac_norm and ac_norm not in norm_ac_lookup:
            norm_ac_lookup[ac_norm] = cname

    def _resolve_canonical_ac(target: str) -> Optional[str]:
        if not target:
            return None
        t = str(target).strip()
        if t in exact_ac_lookup:
            return exact_ac_lookup[t]
        if t.lower() in exact_ac_lookup:
            return exact_ac_lookup[t.lower()]
        t_norm = normalize_text(strip_reserved_suffix(t))
        return norm_ac_lookup.get(t_norm)

    pc_norm = normalize_text(strip_reserved_suffix(pc_name))
    pc_norm_variants = set(_expand_name_variants(pc_norm))
    state_norm = normalize_text(pc_state)

    # Collect districts and covered PC names belonging to this scope's assemblies
    district_to_acs: Dict[str, List[str]] = {}
    all_pc_districts = set(pc_norm_variants)
    covered_pc_names = [pc_name] if pc_name else []
    for ac in canonical_acs:
        d_norm = normalize_text(ac.get("district", ""))
        if d_norm:
            district_to_acs.setdefault(d_norm, []).append(ac["ac_name"])
            for d_var in _expand_name_variants(d_norm):
                all_pc_districts.add(d_var)
        ac_pc = str(ac.get("pc_name", "")).strip()
        if ac_pc and ac_pc not in covered_pc_names:
            covered_pc_names.append(ac_pc)

    # Namesake ACs share normalized name with PC or any assembly district in PC
    namesake_acs = set()
    ac_entries: List[Dict[str, Any]] = []
    for ac in canonical_acs:
        cname = ac["ac_name"]
        ac_base = strip_reserved_suffix(cname)
        ac_norm = normalize_text(ac_base)
        variants = _expand_name_variants(ac_norm)
        is_namesake = any(v in all_pc_districts for v in variants)
        if is_namesake:
            namesake_acs.add(cname)

        # Tier 1 patterns (all variants sorted longest first)
        sorted_variants = sorted(variants, key=lambda x: (-len(x), x))
        var_union = "|".join(re.escape(v) for v in sorted_variants)
        t1_re = re.compile(
            rf"(?:\b(?:{var_union})\s+(?:legislative\s+assembly|vidhan\s+sabha|assembly(?:\s+(?:constituency|segment))?|a\s*c(?!\s*(?:unit|plant|hall|room|system|machine|split|window|ton|voltas|install)))\b|"
            rf"\b(?:legislative\s+assembly|vidhan\s+sabha|assembly\s+(?:constituency|segment))\s+(?:of\s+)?(?:{var_union})\b)"
        )
        t3_re = re.compile(rf"\b({var_union})\b")
        ns_before_re = re.compile(_NAMESAKE_CONTEXT_BEFORE + r"$")
        ns_after_re = re.compile(r"^" + _NAMESAKE_CONTEXT_AFTER)

        ac_entries.append({
            "ac_name": cname,
            "ac_norm": ac_norm,
            "variants": sorted_variants,
            "is_namesake": is_namesake,
            "t1_re": t1_re,
            "t3_re": t3_re,
            "ns_before_re": ns_before_re,
            "ns_after_re": ns_after_re,
        })

    # Longest AC name first for Tier 1 and Tier 3
    ac_entries_by_len = sorted(ac_entries, key=lambda e: (-len(e["ac_norm"]), e["ac_name"]))
    non_namesake_entries = [e for e in ac_entries_by_len if not e["is_namesake"]]
    namesake_entries = [e for e in ac_entries_by_len if e["is_namesake"]]

    # Tier 2 curated subdistrict/block/locality patterns (merged across scope + covered PCs)
    raw_sub_map = load_subdistrict_ac_map()
    pc_sub_map: Dict[str, str] = {}
    for c_pc in covered_pc_names:
        c_pc_norm = normalize_text(strip_reserved_suffix(c_pc))
        c_pc_vars = set(_expand_name_variants(c_pc_norm))
        for k, v in _lookup_pc_subdistrict_map(c_pc, c_pc_vars, raw_sub_map).items():
            if k not in pc_sub_map:
                pc_sub_map[k] = v
    tier2_patterns: List[Tuple[int, str, re.Pattern[str], str]] = []
    seen_t2_keys = set()
    for raw_key, raw_target in pc_sub_map.items():
        canon_target = _resolve_canonical_ac(raw_target)
        if not canon_target:
            continue
        k_norm = normalize_text(raw_key)
        if not k_norm or k_norm in seen_t2_keys:
            continue
        seen_t2_keys.add(k_norm)
        tier2_patterns.append((
            len(k_norm),
            k_norm,
            re.compile(rf"\b{re.escape(k_norm)}\b"),
            canon_target,
        ))
    tier2_patterns.sort(key=lambda item: (-item[0], item[1]))

    # Tier 4 unique-district mapping
    unique_district_ac: Dict[str, str] = {}
    for d_norm, ac_list in district_to_acs.items():
        if len(ac_list) == 1 and d_norm not in pc_norm_variants:
            for d_var in _expand_name_variants(d_norm):
                unique_district_ac[d_var] = ac_list[0]
    unique_dist_patterns: List[Tuple[int, str, re.Pattern[str], str]] = sorted(
        [
            (len(d_var), d_var, re.compile(rf"\b{re.escape(d_var)}\b"), ac_target)
            for d_var, ac_target in unique_district_ac.items()
        ],
        key=lambda item: (-item[0], item[1]),
    )

    counts: Dict[str, int] = {ac["ac_name"]: 0 for ac in canonical_acs}
    unspecified_count = 0

    for w in works:
        desc_raw = str(
            w.get("work_description")
            or w.get("description")
            or w.get("workDescription")
            or ""
        )
        loc_raw = str(w.get("location") or "")
        dist_raw = str(w.get("district") or "")
        ida_raw = str(w.get("implementing_agency") or w.get("implementingAgency") or "")

        desc_norm = normalize_text(desc_raw)
        dist_norm = normalize_text(dist_raw)
        sub_loc_norm = _clean_sub_location(loc_raw, dist_norm, pc_norm_variants, state_norm)
        ida_sub_norm = _extract_subdistrict_ida(ida_raw, dist_norm, pc_norm_variants)

        assigned: Optional[str] = None

        # --- TIER 1: Explicit AC mention ---
        if desc_norm:
            for entry in ac_entries_by_len:
                m = entry["t1_re"].search(desc_norm)
                if m and not _FORBIDDEN_AFTER_LOK_RE.search(desc_norm[m.end():]):
                    assigned = entry["ac_name"]
                    break

        # --- TIER 2: Curated Block / Mandal / Tehsil / ULB / Locality map ---
        deferred_via_t2: Optional[str] = None
        if assigned is None and tier2_patterns:
            if desc_norm:
                for _, k_norm, pat, target_ac in tier2_patterns:
                    for m in pat.finditer(desc_norm):
                        if _match_is_forbidden_context(desc_raw, desc_norm, m.start(), m.end(), k_norm, check_district_suffix=False):
                            continue
                        if _match_is_via_preceded(desc_norm, m.start()):
                            if deferred_via_t2 is None:
                                deferred_via_t2 = target_ac
                            continue
                        assigned = target_ac
                        break
                    if assigned is not None:
                        break

            if assigned is None and sub_loc_norm:
                for _, k_norm, pat, target_ac in tier2_patterns:
                    if k_norm in district_to_acs and len(district_to_acs[k_norm]) > 1:
                        continue
                    if pat.search(sub_loc_norm):
                        assigned = target_ac
                        break

            if assigned is None and ida_sub_norm:
                for _, k_norm, pat, target_ac in tier2_patterns:
                    if k_norm in district_to_acs and len(district_to_acs[k_norm]) > 1:
                        continue
                    if pat.search(ida_sub_norm):
                        assigned = target_ac
                        break

        # --- TIER 3A: Word-boundary match for non-namesake ACs ---
        deferred_via_t3: Optional[str] = None
        if assigned is None and desc_norm:
            for entry in non_namesake_entries:
                for m in entry["t3_re"].finditer(desc_norm):
                    matched_var = m.group(1)
                    if _match_is_forbidden_context(desc_raw, desc_norm, m.start(), m.end(), matched_var, check_district_suffix=True):
                        continue
                    if len(matched_var) <= 2 or matched_var in _AMBIGUOUS_SHORT_ACS:
                        if not _has_short_geo_signal(desc_raw, desc_norm, m.start(), m.end(), matched_var):
                            continue
                    if _match_is_via_preceded(desc_norm, m.start()):
                        if deferred_via_t3 is None:
                            deferred_via_t3 = entry["ac_name"]
                        continue
                    assigned = entry["ac_name"]
                    break
                if assigned is not None:
                    break

        # Apply deferred `Via ...` fallback before Namesake Pass 3B
        if assigned is None:
            assigned = deferred_via_t2 or deferred_via_t3

        # --- TIER 3B: Namesake AC match with strict municipal/urban/block context ---
        if assigned is None:
            text_3b = desc_norm
            if text_3b:
                for entry in namesake_entries:
                    for m in entry["t3_re"].finditer(text_3b):
                        matched_var = m.group(1)
                        if _match_is_forbidden_context(desc_raw, text_3b, m.start(), m.end(), matched_var, check_district_suffix=True):
                            continue
                        before = text_3b[:m.start()]
                        after = text_3b[m.end():]
                        if entry["ns_before_re"].search(before) or entry["ns_after_re"].search(after):
                            assigned = entry["ac_name"]
                            break
                    if assigned is not None:
                        break
            if assigned is None and ida_sub_norm:
                for entry in ac_entries_by_len:
                    if len(entry["ac_norm"]) <= 3 or entry["ac_norm"] in _AMBIGUOUS_SHORT_ACS:
                        continue
                    for m in entry["t3_re"].finditer(ida_sub_norm):
                        before = ida_sub_norm[:m.start()]
                        after = ida_sub_norm[m.end():]
                        if entry["ns_before_re"].search(before) or entry["ns_after_re"].search(after):
                            assigned = entry["ac_name"]
                            break
                    if assigned is not None:
                        break

        # --- TIER 4: Unique District Disambiguation within multi-district PC ---
        if assigned is None and unique_dist_patterns:
            has_outside = bool(desc_norm) and _has_outside_district_mention(
                desc_norm, all_pc_districts, pc_norm_variants
            )
            if not has_outside:
                if dist_norm and dist_norm not in pc_norm_variants and dist_norm in unique_district_ac:
                    assigned = unique_district_ac[dist_norm]
                elif sub_loc_norm:
                    for _, _, pat, target_ac in unique_dist_patterns:
                        if pat.search(sub_loc_norm):
                            assigned = target_ac
                            break

        if assigned is None or assigned not in counts:
            assigned = UNSPECIFIED_SEGMENT
            unspecified_count += 1
        else:
            counts[assigned] += 1

        w["assembly_segment"] = assigned

    segments_summary: List[Dict[str, Any]] = []
    for ac in canonical_acs:
        ac_copy = dict(ac)
        ac_copy["count"] = counts[ac["ac_name"]]
        segments_summary.append(ac_copy)

    return works, segments_summary, unspecified_count
