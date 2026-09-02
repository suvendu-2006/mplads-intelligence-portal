"""
Canonical ETL Ingestion & Validation Pipeline for MPLADS Fraud Detection System.
Handles data loading, field coercion, date normalization, cross-file deduplication, and database loading.
"""

import os
import logging
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from mplads_fraud_detection.config import (
    WORKS_COMPLETED_DETAILED_CSV,
    WORKS_COMPLETED_CSV,
    WORKS_RECOMMENDED_CSV,
    ALL_MPS_FINANCIAL_BREAKDOWN_CSV
)
from mplads_fraud_detection.foundation.schema import Work

logger = logging.getLogger(__name__)


def load_and_clean_works_data() -> pd.DataFrame:
    """
    Loads, cleans, and merges all source datasets into a single canonical works DataFrame.

    Returns:
        pd.DataFrame containing 17,039 verified, clean, non-overlapping work records.
    """
    logger.info("Starting Canonical ETL Ingestion...")

    # 1. Load Completed Works Detailed (15,800 rows)
    if not os.path.exists(WORKS_COMPLETED_DETAILED_CSV):
        raise FileNotFoundError(f"Missing required dataset: {WORKS_COMPLETED_DETAILED_CSV}")

    df_comp = pd.read_csv(WORKS_COMPLETED_DETAILED_CSV, low_memory=False)
    logger.info(f"Loaded {len(df_comp):,} rows from {WORKS_COMPLETED_DETAILED_CSV.name}")

    # Standardize column types
    df_comp["work_id"] = pd.to_numeric(df_comp["work_id"], errors="coerce").astype("Int64")
    df_comp["cost"] = pd.to_numeric(df_comp["cost"], errors="coerce")
    df_comp = df_comp[df_comp["work_id"].notna() & (df_comp["cost"] > 0)].copy()

    # 2. Merge with Completed Works Metadata (21,799 rows) for recommendation_date & payment fields
    if os.path.exists(WORKS_COMPLETED_CSV):
        df_comp_meta = pd.read_csv(WORKS_COMPLETED_CSV, low_memory=False)
        df_comp_meta["work_id"] = pd.to_numeric(df_comp_meta["work_id"], errors="coerce").astype("Int64")

        # Rename recommendation_date -> recommended_date
        if "recommendation_date" in df_comp_meta.columns and "recommended_date" not in df_comp_meta.columns:
            df_comp_meta.rename(columns={"recommendation_date": "recommended_date"}, inplace=True)

        meta_cols = ["work_id", "recommended_date", "has_payments", "total_paid", "payment_count"]
        available_meta = [c for c in meta_cols if c in df_comp_meta.columns]
        
        # Deduplicate metadata on work_id before merge
        df_comp_meta_dedup = df_comp_meta[available_meta].drop_duplicates(subset=["work_id"], keep="first")
        
        df_comp = df_comp.merge(df_comp_meta_dedup, on="work_id", how="left")
    else:
        logger.warning(f"Metadata file {WORKS_COMPLETED_CSV.name} not found. Setting defaults.")
        df_comp["recommended_date"] = None
        df_comp["has_payments"] = False
        df_comp["total_paid"] = 0.0

    df_comp["status"] = "completed"

    # 3. Load Recommended / In-Progress Works (2,390 raw rows)
    if os.path.exists(WORKS_RECOMMENDED_CSV):
        df_rec = pd.read_csv(WORKS_RECOMMENDED_CSV, low_memory=False)
        logger.info(f"Loaded {len(df_rec):,} raw rows from {WORKS_RECOMMENDED_CSV.name}")

        # Rename columns to match canonical schema
        rename_map = {
            "workId": "work_id",
            "estimated_cost": "cost",
            "hasPayments": "has_payments",
            "totalPaid": "total_paid",
            "paymentCount": "payment_count",
            "lsTerm": "ls_term"
        }
        df_rec.rename(columns=rename_map, inplace=True)
        df_rec["work_id"] = pd.to_numeric(df_rec["work_id"], errors="coerce").astype("Int64")
        df_rec["cost"] = pd.to_numeric(df_rec["cost"], errors="coerce")

        # Strict Deduplication Policy (reduces 2,390 -> 1,244 records)
        df_rec_clean = df_rec.drop_duplicates(subset=["work_id"], keep="first").copy()
        df_rec_clean = df_rec_clean[df_rec_clean["work_id"].notna() & (df_rec_clean["cost"] > 0)].copy()
        df_rec_clean["status"] = "Recommended"
        df_rec_clean["completion_date"] = None

        # Cross-file ID Overlap Resolution (Completed status takes precedence)
        completed_ids = set(df_comp["work_id"])
        overlapping_ids = set(df_rec_clean["work_id"]).intersection(completed_ids)
        if overlapping_ids:
            logger.info(f"Resolving {len(overlapping_ids)} cross-file ID overlaps. Completed status takes precedence.")
            df_rec_clean = df_rec_clean[~df_rec_clean["work_id"].isin(overlapping_ids)].copy()

        logger.info(f"Clean recommended works after deduplication: {len(df_rec_clean):,} records.")
    else:
        df_rec_clean = pd.DataFrame()

    # 4. Concatenate Completed + Recommended
    df_unified = pd.concat([df_comp, df_rec_clean], ignore_index=True)

    # 5. Merge MP Financial Breakdown (for payment_gap_percentage)
    if os.path.exists(ALL_MPS_FINANCIAL_BREAKDOWN_CSV):
        df_mp_fin = pd.read_csv(ALL_MPS_FINANCIAL_BREAKDOWN_CSV, low_memory=False)
        if "mp_name" in df_mp_fin.columns and "payment_gap_percentage" in df_mp_fin.columns:
            mp_gap_map = df_mp_fin.set_index("mp_name")["payment_gap_percentage"].to_dict()
            df_unified["payment_gap_percentage"] = df_unified["mp_name"].map(mp_gap_map).fillna(0.0)
    else:
        df_unified["payment_gap_percentage"] = 0.0

    # 6. Harmonize and Coerce All Fields
    df_unified["work_id"] = df_unified["work_id"].astype(int)
    df_unified["work_description"] = df_unified["work_description"].fillna("Not specified").astype(str).str.strip()
    df_unified["cost"] = df_unified["cost"].astype(float)
    df_unified["category"] = df_unified["category"].fillna("Normal/Others").astype(str)
    df_unified["location"] = df_unified["location"].fillna("").astype(str)
    df_unified["district"] = df_unified["district"].fillna("UNKNOWN").astype(str).str.upper()
    df_unified["mp_name"] = df_unified["mp_name"].fillna("UNKNOWN").astype(str)
    df_unified["mp_constituency"] = df_unified["mp_constituency"].fillna("").astype(str)

    # Date parsing
    df_unified["completion_date"] = pd.to_datetime(df_unified["completion_date"], errors="coerce").dt.date
    df_unified["recommended_date"] = pd.to_datetime(df_unified["recommended_date"], errors="coerce").dt.date

    # Payment fields
    df_unified["has_payments"] = df_unified["has_payments"].fillna(False).astype(bool)
    df_unified["total_paid"] = pd.to_numeric(df_unified["total_paid"], errors="coerce").fillna(0.0).astype(float)
    df_unified["payment_record_exists"] = (df_unified["total_paid"] > 0) | (df_unified["has_payments"] == True)
    df_unified["house"] = df_unified["house"].fillna("Lok Sabha").astype(str) if "house" in df_unified.columns else "Lok Sabha"
    df_unified["ls_term"] = df_unified["ls_term"].fillna("17th").astype(str) if "ls_term" in df_unified.columns else "17th"
    df_unified["state"] = df_unified["state"].fillna("ANDHRA PRADESH").astype(str) if "state" in df_unified.columns else "ANDHRA PRADESH"

    # Ensure unique work_id constraint
    df_unified = df_unified.drop_duplicates(subset=["work_id"], keep="first")
    logger.info(f"Canonical ETL Ingestion Complete: {len(df_unified):,} verified unique works.")

    return df_unified


def load_works_into_db(session: Session, df_unified: Optional[pd.DataFrame] = None) -> int:
    """
    Populates the works table in the database from the canonical DataFrame.
    """
    if df_unified is None:
        df_unified = load_and_clean_works_data()

    existing_count = session.query(Work).count()
    if existing_count == len(df_unified):
        logger.info(f"Works table already fully populated with {existing_count:,} records.")
        return existing_count

    # Clear and bulk insert
    session.query(Work).delete()
    
    records = []
    for _, row in df_unified.iterrows():
        work = Work(
            work_id=int(row["work_id"]),
            work_description=str(row["work_description"]),
            cost=float(row["cost"]),
            category=str(row["category"]) if pd.notna(row["category"]) else "Normal/Others",
            location=str(row["location"]) if pd.notna(row["location"]) else "",
            district=str(row["district"]),
            mp_name=str(row["mp_name"]),
            mp_constituency=str(row["mp_constituency"]) if pd.notna(row["mp_constituency"]) else "",
            completion_date=row["completion_date"] if pd.notna(row["completion_date"]) else None,
            recommended_date=row["recommended_date"] if pd.notna(row["recommended_date"]) else None,
            status=str(row["status"]),
            has_payments=bool(row["has_payments"]),
            total_paid=float(row["total_paid"]) if pd.notna(row["total_paid"]) else 0.0,
            payment_gap_percentage=float(row["payment_gap_percentage"]) if pd.notna(row["payment_gap_percentage"]) else 0.0,
            payment_record_exists=bool(row["payment_record_exists"]),
            house=str(row["house"]) if pd.notna(row["house"]) else "Lok Sabha",
            ls_term=str(row["ls_term"]) if pd.notna(row["ls_term"]) else "17th",
            state=str(row["state"]) if pd.notna(row["state"]) else "ANDHRA PRADESH"
        )
        records.append(work)

    session.bulk_save_objects(records)
    session.flush()
    logger.info(f"Inserted {len(records):,} records into works table.")
    return len(records)
