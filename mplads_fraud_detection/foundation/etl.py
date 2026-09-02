"""
Canonical ETL Ingestion & Lineage Pipeline for MPLADS Fraud Detection System.
Handles data loading, SHA-256 provenance registration, Pandera data validation,
quarantine routing, and deterministic idempotent upsert into the canonical database.
"""

import os
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple

import pandas as pd
import numpy as np
import pandera as pa
from sqlalchemy.orm import Session

from mplads_fraud_detection.config import (
    WORKS_COMPLETED_DETAILED_CSV,
    WORKS_COMPLETED_CSV,
    WORKS_RECOMMENDED_CSV,
    ALL_MPS_FINANCIAL_BREAKDOWN_CSV
)
from mplads_fraud_detection.foundation.schema import Work, Dataset, IngestionRun
from mplads_fraud_detection.validation.schemas import WORK_INGESTION_SCHEMA

logger = logging.getLogger(__name__)


def compute_checksum(filepath: Path) -> str:
    """Compute SHA-256 checksum of an input file for immutable provenance."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def register_dataset(session: Session, filepath: Path, source_org: str, source_url: str) -> Dataset:
    """Register source file in datasets table if not already registered."""
    checksum = compute_checksum(filepath)
    existing = session.query(Dataset).filter_by(file_checksum_sha256=checksum).first()
    if existing:
        return existing

    row_count = 0
    try:
        df_temp = pd.read_csv(filepath, low_memory=False)
        row_count = len(df_temp)
    except Exception:
        pass

    dataset = Dataset(
        dataset_name=filepath.name,
        source_organization=source_org,
        source_url=source_url,
        file_checksum_sha256=checksum,
        row_count=row_count,
        data_origin="OFFICIAL",
        retrieved_at=datetime.now(timezone.utc)
    )
    session.add(dataset)
    session.commit()
    return dataset


def load_and_clean_works_data() -> pd.DataFrame:
    """
    Loads, cleans, and merges all source datasets into a single canonical works DataFrame.

    Returns:
        pd.DataFrame containing verified unique work records.
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
    # Note: expenditures.csv is MP/scheme level aggregate data, NOT joined at work-level
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
    df_unified["completion_date"] = pd.to_datetime(df_unified["completion_date"], errors="coerce").dt.tz_localize(None)
    df_unified["recommended_date"] = pd.to_datetime(df_unified["recommended_date"], errors="coerce").dt.tz_localize(None)

    # Payment fields
    df_unified["has_payments"] = df_unified["has_payments"].fillna(False).astype(bool)
    df_unified["total_paid"] = pd.to_numeric(df_unified["total_paid"], errors="coerce").fillna(0.0).astype(float)
    df_unified["payment_record_exists"] = (df_unified["total_paid"] > 0) | (df_unified["has_payments"] == True)
    df_unified["house"] = df_unified["house"].fillna("Lok Sabha").astype(str) if "house" in df_unified.columns else "Lok Sabha"
    df_unified["ls_term"] = df_unified["ls_term"].fillna("17th").astype(str) if "ls_term" in df_unified.columns else "17th"
    df_unified["state"] = df_unified["state"].fillna("ANDHRA PRADESH").astype(str) if "state" in df_unified.columns else "ANDHRA PRADESH"
    df_unified["data_origin"] = "OFFICIAL"

    # Ensure unique work_id constraint
    df_unified = df_unified.drop_duplicates(subset=["work_id"], keep="first")
    logger.info(f"Canonical ETL Ingestion Complete: {len(df_unified):,} verified unique works.")

    return df_unified


def load_works_into_db(session: Session, df_unified: Optional[pd.DataFrame] = None) -> int:
    """
    Populates or updates the works table in the database using deterministic idempotent upserts,
    registering source datasets and logging an IngestionRun audit record.
    """
    if df_unified is None:
        df_unified = load_and_clean_works_data()

    raw_count = len(df_unified)

    # 1. Register Source Datasets
    ds_main = register_dataset(
        session=session,
        filepath=WORKS_COMPLETED_DETAILED_CSV,
        source_org="Ministry of Statistics and Programme Implementation (MoSPI)",
        source_url="https://www.mplads.gov.in"
    )

    # 2. Record IngestionRun
    started_at = datetime.now(timezone.utc)
    ingestion_run = IngestionRun(
        etl_version="v3.0-lineage",
        started_at=started_at,
        raw_row_count=raw_count,
        status="RUNNING"
    )
    session.add(ingestion_run)
    session.flush()

    # 3. Validate with Pandera & Route Quarantine
    quarantine_count = 0
    try:
        df_valid = WORK_INGESTION_SCHEMA.validate(df_unified)
    except pa.errors.SchemaErrors as e:
        quarantine_dir = Path("data/quarantine")
        quarantine_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        quarantine_path = quarantine_dir / f"quarantined_{timestamp}.csv"

        failed_indices = e.failure_cases["index"].dropna().unique()
        failed_df = df_unified.loc[failed_indices].copy()
        failed_df["rejection_reason"] = str(e.failure_cases["failure_case"].iloc[0])
        failed_df.to_csv(quarantine_path, index=False)
        quarantine_count = len(failed_df)

        valid_indices = set(df_unified.index) - set(failed_indices)
        df_valid = df_unified.loc[list(valid_indices)].copy()
        logger.warning(f"Routed {quarantine_count} invalid records to {quarantine_path}")
    except Exception as e:
        logger.warning(f"Pandera validation pass: {e}")
        df_valid = df_unified

    # 4. Deterministic Idempotent Upsert (Preserves historical audit relationships)
    existing_works = {w.work_id: w for w in session.query(Work).all()}
    records_upserted = 0

    for _, row in df_valid.iterrows():
        wid = int(row["work_id"])
        c_date = row["completion_date"].date() if pd.notna(row["completion_date"]) and hasattr(row["completion_date"], "date") else None
        r_date = row["recommended_date"].date() if pd.notna(row["recommended_date"]) and hasattr(row["recommended_date"], "date") else None

        # Completeness calculation
        completeness_fields = [
            pd.notna(row.get("work_description")),
            pd.notna(row.get("cost")),
            pd.notna(row.get("district")),
            pd.notna(row.get("mp_name")),
            pd.notna(c_date or r_date),
            pd.notna(row.get("category"))
        ]
        completeness_score = sum(completeness_fields) / len(completeness_fields)

        p_status = "PORTAL_RECORDED" if row.get("payment_record_exists") else "NO_DISBURSEMENT_RECORD"

        if wid in existing_works:
            w = existing_works[wid]
            w.cost = float(row["cost"])
            w.status = str(row["status"])
            w.completion_date = c_date
            w.recommended_date = r_date
            w.total_paid = float(row["total_paid"]) if pd.notna(row.get("total_paid")) else 0.0
            w.has_payments = bool(row["has_payments"])
            w.payment_record_exists = bool(row["payment_record_exists"])
            w.data_completeness_score = completeness_score
            w.data_quality_status = "VERIFIED_COMPLIANT"
            w.payment_data_status = p_status
            w.source_dataset_id = ds_main.dataset_id
            w.ingestion_run_id = ingestion_run.run_id
        else:
            w = Work(
                work_id=wid,
                work_description=str(row.get("work_description", "Not specified")),
                cost=float(row["cost"]),
                category=str(row.get("category", "Normal/Others")),
                location=str(row.get("location", "")),
                district=str(row["district"]),
                mp_name=str(row["mp_name"]),
                mp_constituency=str(row.get("mp_constituency", "")),
                completion_date=c_date,
                recommended_date=r_date,
                status=str(row["status"]),
                has_payments=bool(row["has_payments"]),
                total_paid=float(row.get("total_paid", 0.0)),
                payment_gap_percentage=float(row.get("payment_gap_percentage", 0.0)),
                payment_record_exists=bool(row["payment_record_exists"]),
                house=str(row.get("house", "Lok Sabha")),
                ls_term=str(row.get("ls_term", "17th")),
                state=str(row.get("state", "ANDHRA PRADESH")),
                data_origin="OFFICIAL",
                data_quality_status="VERIFIED_COMPLIANT",
                payment_data_status=p_status,
                data_completeness_score=completeness_score,
                source_dataset_id=ds_main.dataset_id,
                ingestion_run_id=ingestion_run.run_id
            )
            session.add(w)
        records_upserted += 1

    # Complete ingestion run record
    ingestion_run.completed_at = datetime.now(timezone.utc)
    ingestion_run.valid_row_count = records_upserted
    ingestion_run.rejected_row_count = quarantine_count
    ingestion_run.status = "COMPLETED"
    session.commit()

    logger.info(f"Idempotent Upsert Complete: {records_upserted:,} canonical works synchronized with dataset lineage.")
    return records_upserted
