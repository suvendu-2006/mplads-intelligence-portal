import json
from functools import lru_cache
from typing import Dict, Any, Optional
from pathlib import Path
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from webapi.config import (
    DB_URL, DATA_DIR, OVERVIEW_DIR, STATES_DIR, MPS_DIR, ANALYTICS_DIR, BOUNDARIES_DIR, DEMOGRAPHICS_DIR
)

engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@lru_cache(maxsize=1)
def load_national_csv() -> Dict[str, Any]:
    file_path = OVERVIEW_DIR / "national_overview.csv"
    df = pd.read_csv(file_path, encoding="utf-8-sig")
    return df.iloc[0].to_dict()

@lru_cache(maxsize=1)
def load_states_csv() -> pd.DataFrame:
    file_path = STATES_DIR / "all_states_summary.csv"
    return pd.read_csv(file_path, encoding="utf-8-sig")

@lru_cache(maxsize=1)
def load_districts_csv() -> pd.DataFrame:
    file_path = DATA_DIR / "all_districts_mplads_summary.csv"
    return pd.read_csv(file_path, encoding="utf-8-sig")

@lru_cache(maxsize=1)
def load_mps_csv() -> pd.DataFrame:
    file_path = DATA_DIR / "all_mps_summary.csv"
    df = pd.read_csv(file_path, encoding="utf-8-sig")
    df["pendingWorks"] = df["pendingWorks"].clip(lower=0)
    df["inProgressPayments"] = df["inProgressPayments"].clip(lower=0.0)
    df["paymentGapPercentage"] = df["paymentGapPercentage"].clip(lower=0.0)
    return df

@lru_cache(maxsize=1)
def load_cpwd_benchmarks() -> pd.DataFrame:
    file_path = DATA_DIR / "cpwd_benchmark_rates.csv"
    return pd.read_csv(file_path, encoding="utf-8-sig")

@lru_cache(maxsize=1)
def load_expenditures_csv() -> pd.DataFrame:
    file_path = DATA_DIR / "expenditures.csv"
    return pd.read_csv(file_path, encoding="utf-8-sig")

@lru_cache(maxsize=1)
def load_mplads_trends_csv() -> pd.DataFrame:
    file_path = ANALYTICS_DIR / "mplads_trends.csv"
    if file_path.exists():
        return pd.read_csv(file_path, encoding="utf-8-sig")
    return pd.DataFrame()

@lru_cache(maxsize=1)
def load_demographics_merged_csv() -> pd.DataFrame:
    file_path = DEMOGRAPHICS_DIR / "mp_mplads_demographics_merged.csv"
    if file_path.exists():
        return pd.read_csv(file_path, encoding="utf-8-sig")
    return pd.DataFrame()

@lru_cache(maxsize=1024)
def load_mp_profile(mp_id: str) -> Optional[Dict[str, Any]]:
    # In 03_MPs_Data/mp_profiles/ files are named mp_{mp_id}.json
    file_path = MPS_DIR / "mp_profiles" / f"mp_{mp_id}.json"
    if not file_path.exists():
        file_path = MPS_DIR / "mp_profiles" / f"{mp_id}.json"
    
    profile: Dict[str, Any] = {}
    if file_path.exists():
        with open(file_path, "r", encoding="utf-8") as f:
            profile = json.load(f)
    else:
        profile = {"mp": {"id": mp_id}}

    # Merge real Myneta ADR Demographics
    try:
        df_dem = load_demographics_merged_csv()
        if not df_dem.empty:
            match = df_dem[df_dem["id"].astype(str) == str(mp_id)]
            if match.empty:
                mp_name = str(profile.get("mp", {}).get("name") or profile.get("name", "")).strip()
                if mp_name:
                    match = df_dem[df_dem["mpName"].str.lower() == mp_name.lower()]

            if not match.empty:
                row = match.iloc[0]
                dossier = profile.get("dossier") or {}
                
                tot_assets_raw = str(row.get("total_assets_raw") or "").replace("\xa0", " ").strip()
                liabilities_raw = str(row.get("liabilities_raw") or "").replace("\xa0", " ").strip()
                education = str(row.get("education") or "").strip()
                party = str(row.get("party") or "").strip()
                criminal_cases = int(row.get("criminal_cases", 0))

                dossier["education"] = education if education and education.lower() != "nan" else None
                dossier["party"] = party if party and party.lower() != "nan" else None
                dossier["criminal_cases"] = criminal_cases
                dossier["total_assets"] = tot_assets_raw if tot_assets_raw and tot_assets_raw.lower() != "nan" else None
                dossier["movable_assets"] = tot_assets_raw if tot_assets_raw and tot_assets_raw.lower() != "nan" else None
                dossier["liabilities"] = liabilities_raw if liabilities_raw and liabilities_raw.lower() != "nan" else None

                profile["dossier"] = dossier
    except Exception as e:
        print(f"Error merging demographics for MP {mp_id}: {e}")

    return profile

@lru_cache(maxsize=4)
def load_geojson(file_name: str) -> Dict[str, Any]:
    file_path = BOUNDARIES_DIR / file_name
    if not file_path.exists():
        raise FileNotFoundError(f"GeoJSON file not found: {file_path}")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)
