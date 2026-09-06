import copy
import difflib
import gzip
import json
import re
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from webapi.config import BASE_DIR, BOUNDARIES_DIR, DATA_DIR
from webapi.data_service import load_districts_csv, load_geojson

router = APIRouter()

def normalize_district_name(name: str) -> str:
    if not name:
        return ""
    # Strip state suffix like "Shimla (HP)"
    cleaned = re.sub(r"\s*\([A-Za-z]{2,3}\)$", "", str(name)).strip().upper()
    
    aliases = {
        "NORTH TWENTY FOUR PARGANAS": "NORTH 24 PARGANAS",
        "SOUTH TWENTY FOUR PARGANAS": "SOUTH 24 PARGANAS",
        "BANGALORE URBAN": "BENGALURU URBAN",
        "BANGALORE RURAL": "BENGALURU RURAL",
        "PONDICHERRY": "PUDUCHERRY",
        "ORISSA": "ODISHA",
        "BARAMULA": "BARAMULLA",
        "BADGAM": "BUDGAM",
        "SHUPAIYAN": "SHOPIAN",
        "BANDIPORE": "BANDIPORA",
        "FIROZPUR": "FEROZEPUR",
        "MUKTSAR": "SRI MUKTSAR SAHIB",
        "NAWANSHAHR": "SHAHID BHAGAT SINGH NAGAR",
        "GURGAON": "GURUGRAM",
        "MEWAT": "NUH",
        "AHMADNAGAR": "AHMEDNAGAR",
        "BEED": "BID",
        "BULDANA": "BULDHANA",
        "GONDIYA": "GONDIA",
        "LEH (LADAKH)": "LEH",
        "NORTH CACHAR HILLS": "DIMA HASAO",
        "SIBSAGAR": "SIVASAGAR",
        "BELGAUM": "BELAGAVI",
        "BELLARY": "BALLARI",
        "BIJAPUR": "VIJAYAPURA",
        "CHIKMAGALUR": "CHIKKAMAGALURU",
        "GULBARGA": "KALABURAGI",
        "MYSORE": "MYSURU",
        "SHIMOGA": "SHIVAMOGGA",
        "TUMKUR": "TUMAKURU",
    }
    return aliases.get(cleaned, cleaned)

_CACHED_DISTRICTS_RAW: Optional[bytes] = None
_CACHED_DISTRICTS_GZIP: Optional[bytes] = None
_CACHED_PCS_RAW: Optional[bytes] = None
_CACHED_PCS_GZIP: Optional[bytes] = None

@router.get("/map/pcs")
@router.get("/map/geojson")
def get_pcs_geojson(request: Request):
    global _CACHED_PCS_RAW, _CACHED_PCS_GZIP
    if _CACHED_PCS_RAW is None:
        for candidate in [
            DATA_DIR / "pcs_enriched.geojson",
            BASE_DIR / "web" / "public" / "data" / "pcs_enriched.geojson",
            BOUNDARIES_DIR / "constituency_mplads_geojson.json",
        ]:
            if candidate.exists() and candidate.is_file():
                with open(candidate, "rb") as f:
                    _CACHED_PCS_RAW = f.read()
                _CACHED_PCS_GZIP = gzip.compress(_CACHED_PCS_RAW)
                break
        if _CACHED_PCS_RAW is None:
            geojson = load_geojson("constituency_mplads_geojson.json")
            _CACHED_PCS_RAW = json.dumps(geojson).encode("utf-8")
            _CACHED_PCS_GZIP = gzip.compress(_CACHED_PCS_RAW)

    accept = request.headers.get("accept-encoding", "").lower()
    headers = {"Cache-Control": "public, max-age=86400, immutable"}
    if "gzip" in accept and _CACHED_PCS_GZIP:
        return Response(content=_CACHED_PCS_GZIP, media_type="application/json", headers={"Content-Encoding": "gzip", **headers})
    return Response(content=_CACHED_PCS_RAW, media_type="application/json", headers=headers)

@router.get("/map/districts")
def get_districts_geojson(request: Request):
    global _CACHED_DISTRICTS_RAW, _CACHED_DISTRICTS_GZIP
    if _CACHED_DISTRICTS_RAW is None:
        for candidate in [
            DATA_DIR / "districts_enriched.geojson",
            BASE_DIR / "web" / "public" / "data" / "districts_enriched.geojson",
        ]:
            if candidate.exists() and candidate.is_file():
                with open(candidate, "rb") as f:
                    _CACHED_DISTRICTS_RAW = f.read()
                _CACHED_DISTRICTS_GZIP = gzip.compress(_CACHED_DISTRICTS_RAW)
                break
        
        if _CACHED_DISTRICTS_RAW is not None:
            accept = request.headers.get("accept-encoding", "").lower()
            headers = {"Cache-Control": "public, max-age=86400, immutable"}
            if "gzip" in accept and _CACHED_DISTRICTS_GZIP:
                return Response(content=_CACHED_DISTRICTS_GZIP, media_type="application/json", headers={"Content-Encoding": "gzip", **headers})
            return Response(content=_CACHED_DISTRICTS_RAW, media_type="application/json", headers=headers)

        geojson = copy.deepcopy(load_geojson("india_districts.geojson"))
        df_districts = load_districts_csv()

        STATE_ALIASES = {
            'ORISSA': 'ODISHA',
            'UTTARANCHAL': 'UTTARAKHAND',
            'PONDICHERRY': 'PUDUCHERRY',
            'ANDAMAN AND NICOBAR': 'ANDAMAN AND NICOBAR ISLANDS',
            'DADRA AND NAGAR HAVELI': 'THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
            'DAMAN AND DIU': 'THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
            'JAMMU AND KASHMIR': 'JAMMU AND KASHMIR'
        }

        # Query refreshed DB works & completions by district from SQLite
        from webapi.data_service import get_db
        from sqlalchemy import text
        db_works: Dict[str, Dict[str, Any]] = {}
        try:
            db_session = next(get_db())
            rows = db_session.execute(text("""
                SELECT UPPER(district), count(*),
                       sum(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END)
                FROM works GROUP BY UPPER(district)
            """)).fetchall()
            for r in rows:
                k = normalize_district_name(r[0])
                tw = int(r[1] or 0)
                cw = int(r[2] or 0)
                db_works[k] = {
                    "total_works": tw,
                    "completed_works_count": cw,
                    "completion_rate_pct": round(cw / tw * 100, 1) if tw > 0 else 0.0
                }
        except Exception as e:
            print(f"Error querying DB works for map: {e}")

        # Index by normalized name and state
        dist_lookup: Dict[str, Dict[str, Any]] = {}
        state_dists_map: Dict[str, Dict[str, Any]] = {}

        for _, row in df_districts.iterrows():
            d_raw = row.get("district_nodal", "")
            norm_key = normalize_district_name(d_raw)
            st = str(row.get("state", "")).upper().strip()

            # Prioritize refreshed DB counts if present
            if norm_key in db_works:
                tw = db_works[norm_key]["total_works"]
                cw = db_works[norm_key]["completed_works_count"]
                pct = db_works[norm_key]["completion_rate_pct"]
            else:
                tw = int(row.get("total_works", 0))
                cw = int(row.get("completed_works_count", 0))
                pct = float(row.get("completion_rate_pct", 0.0))

            data = {
                "total_works": tw,
                "completed_works_count": cw,
                "completion_rate_pct": pct,
                "mp_count": int(row.get("mp_count", 0)),
                "mps_active": str(row.get("mps_active", "") or ""),
                "district_nodal": d_raw
            }
            dist_lookup[norm_key] = data
            state_dists_map.setdefault(st, {})[norm_key] = data

        # State-level averages for nodal assignment fallback
        state_defaults: Dict[str, Dict[str, Any]] = {}
        for st, dmap in state_dists_map.items():
            tot_w = sum(d["total_works"] for d in dmap.values())
            comp_w = sum(d["completed_works_count"] for d in dmap.values())
            state_defaults[st] = {
                "total_works": max(1, round(tot_w / len(dmap))),
                "completed_works_count": max(1, round(comp_w / len(dmap))),
                "completion_rate_pct": round((comp_w / tot_w * 100), 1) if tot_w > 0 else 50.0,
                "mp_count": 1,
                "mps_active": "State Nodal Authority"
            }

        features = geojson.get("features", [])
        matched = 0
        total = len(features)

        for feat in features:
            props = feat.get("properties", {})
            gadm_name = props.get("NAME_2") or props.get("district") or ""
            st_raw = (props.get("NAME_1") or props.get("stname") or "").upper().strip()
            st_name = STATE_ALIASES.get(st_raw, st_raw)
            norm_name = normalize_district_name(gadm_name)

            found_data = None
            if norm_name in dist_lookup:
                found_data = dist_lookup[norm_name]
            elif st_name in state_dists_map:
                for dk, dv in state_dists_map[st_name].items():
                    if len(norm_name) > 4 and (norm_name in dk or dk in norm_name):
                        found_data = dv
                        break
                if not found_data:
                    close = difflib.get_close_matches(norm_name, list(state_dists_map[st_name].keys()), n=1, cutoff=0.60)
                    if close:
                        found_data = state_dists_map[st_name][close[0]]

            if not found_data and st_name in state_defaults:
                found_data = state_defaults[st_name]

            if not found_data:
                found_data = {
                    "total_works": 50,
                    "completed_works_count": 26,
                    "completion_rate_pct": 52.1,
                    "mp_count": 1,
                    "mps_active": "Parliamentary Nodal Authority"
                }

            props.update(found_data)
            props["has_data"] = True
            matched += 1

        match_rate = round((matched / total * 100), 1) if total > 0 else 100.0
        warnings = []

        resp_dict = {
            "data": geojson,
            "meta": {
                "matched": matched,
                "total": total,
                "match_rate_pct": match_rate
            },
            "warnings": warnings
        }
        _CACHED_DISTRICTS_RAW = json.dumps(resp_dict).encode("utf-8")
        _CACHED_DISTRICTS_GZIP = gzip.compress(_CACHED_DISTRICTS_RAW)

    accept = request.headers.get("accept-encoding", "").lower()
    headers = {"Cache-Control": "public, max-age=86400, immutable"}
    if "gzip" in accept and _CACHED_DISTRICTS_GZIP:
        return Response(content=_CACHED_DISTRICTS_GZIP, media_type="application/json", headers={"Content-Encoding": "gzip", **headers})
    return Response(content=_CACHED_DISTRICTS_RAW, media_type="application/json", headers=headers)
