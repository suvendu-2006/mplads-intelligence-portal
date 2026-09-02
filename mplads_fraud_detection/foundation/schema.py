"""
Canonical Database Models for MPLADS Fraud Detection System.
Compatible with PostgreSQL (production) and SQLite (embedded testing).
Includes Procurement, Payment, Inspection, Audit Outcomes, Fraud Labels, and ML Predictions.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, Float, String, Text, Date, DateTime, Boolean,
    ForeignKey, UniqueConstraint, CheckConstraint, Index, JSON
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class PipelineRun(Base):
    """Tracks snapshot execution runs with atomic status management."""
    __tablename__ = "pipeline_runs"

    run_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_key = Column(String(100), nullable=False, index=True)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="RUNNING", nullable=False)
    error_message = Column(Text, nullable=True)

    anomalies = relationship("Anomaly", back_populates="pipeline_run", cascade="all, delete-orphan")
    review_items = relationship("ReviewQueueItem", back_populates="pipeline_run", cascade="all, delete-orphan")
    entity_risks = relationship("EntityRisk", back_populates="pipeline_run", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="pipeline_run", cascade="all, delete-orphan")


class Dataset(Base):
    """Authoritative Registry for all Ingested External Data Files."""
    __tablename__ = "datasets"

    dataset_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_name = Column(String(255), nullable=False)
    source_organization = Column(String(255), nullable=True)
    source_url = Column(Text, nullable=True)
    file_checksum_sha256 = Column(String(64), nullable=False, unique=True, index=True)
    row_count = Column(Integer, nullable=True)
    data_origin = Column(String(50), CheckConstraint(
        "data_origin IN ('OFFICIAL', 'VERIFIED_AUDIT', 'SYNTHETIC_DEMO')"
    ), nullable=False)
    retrieved_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    works = relationship("Work", back_populates="dataset")


class IngestionRun(Base):
    """Tracks batch ETL ingestion cycles with full row count reconciliation."""
    __tablename__ = "ingestion_runs"

    run_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    git_commit_hash = Column(String(40), nullable=True)
    etl_version = Column(String(20), default="v5.0", nullable=True)
    raw_row_count = Column(Integer, nullable=True)
    valid_row_count = Column(Integer, nullable=True)
    duplicate_row_count = Column(Integer, nullable=True)
    rejected_row_count = Column(Integer, nullable=True)
    reconciliation_summary = Column(JSON, nullable=True)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="RUNNING")  # RUNNING, COMPLETED, FAILED

    works = relationship("Work", back_populates="ingestion_run")


class Work(Base):
    """Canonical Single-Source-of-Truth for all MPLADS Infrastructure Works."""
    __tablename__ = "works"

    work_id = Column(Integer, primary_key=True)
    work_description = Column(Text, nullable=False)
    cost = Column(Float, nullable=False)
    category = Column(String(100), nullable=True, index=True)
    location = Column(Text, nullable=True)
    district = Column(String(100), nullable=False, index=True)
    mp_name = Column(String(200), nullable=False, index=True)
    mp_constituency = Column(String(100), nullable=True, index=True)
    completion_date = Column(Date, nullable=True, index=True)
    recommended_date = Column(Date, nullable=True, index=True)
    status = Column(String(50), default="completed", nullable=False, index=True)
    has_payments = Column(Boolean, default=False, nullable=False)
    total_paid = Column(Float, default=0.0, nullable=False)
    payment_gap_percentage = Column(Float, default=0.0, nullable=True)
    payment_record_exists = Column(Boolean, default=False, nullable=False)
    house = Column(String(50), nullable=True)
    ls_term = Column(String(50), nullable=True)
    state = Column(String(100), default="ANDHRA PRADESH", nullable=True)

    # Lineage & Provenance Tracking
    source_file = Column(String(255), nullable=True)
    source_file_checksum = Column(String(64), nullable=True)
    source_url = Column(Text, nullable=True)
    retrieved_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)
    etl_version = Column(String(20), default="v5.0", nullable=True)

    # Phase 2 Data Quality & Source Association
    data_origin = Column(String(50), default="OFFICIAL", nullable=False)
    data_quality_status = Column(String(20), default="COMPLETE")  # COMPLETE, PARTIAL, MISSING
    payment_data_status = Column(String(30), default="NOT_APPLICABLE")  # VERIFIED, MISSING, PARTIAL, NOT_APPLICABLE
    data_completeness_score = Column(Float, default=1.0)  # 0.0 to 1.0
    source_dataset_id = Column(String(36), ForeignKey("datasets.dataset_id"), nullable=True)
    ingestion_run_id = Column(String(36), ForeignKey("ingestion_runs.run_id"), nullable=True)

    dataset = relationship("Dataset", back_populates="works")
    ingestion_run = relationship("IngestionRun", back_populates="works")

    anomalies = relationship("Anomaly", back_populates="work", cascade="all, delete-orphan")
    tenders = relationship("Tender", back_populates="work", cascade="all, delete-orphan")
    payment_vouchers = relationship("PaymentVoucher", back_populates="work", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="work", cascade="all, delete-orphan")
    inspections = relationship("Inspection", back_populates="work", cascade="all, delete-orphan")
    measurement_books = relationship("MeasurementBook", back_populates="work", cascade="all, delete-orphan")
    geotagged_photos = relationship("GeotaggedPhoto", back_populates="work", cascade="all, delete-orphan")
    audit_outcomes = relationship("AuditOutcome", back_populates="work", cascade="all, delete-orphan")
    fraud_labels = relationship("FraudLabel", back_populates="work", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="work", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("cost > 0", name="chk_positive_cost"),
        Index("idx_works_district_date", "district", "completion_date"),
        Index("idx_works_mp_date", "mp_name", "recommended_date"),
    )


class Anomaly(Base):
    """Deduplicated Forensic Anomaly Records generated by Detectors D1-D12, D15."""
    __tablename__ = "anomalies"

    anomaly_id = Column(Integer, primary_key=True, autoincrement=True)
    work_id = Column(Integer, ForeignKey("works.work_id", ondelete="CASCADE"), nullable=False, index=True)
    detector_type = Column(String(50), nullable=False, index=True)
    severity = Column(Float, nullable=False, index=True)
    explanation = Column(Text, nullable=False)
    evidence = Column(JSON, nullable=False)
    run_id = Column(String(36), ForeignKey("pipeline_runs.run_id", ondelete="CASCADE"), nullable=False, index=True)
    detected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    work = relationship("Work", back_populates="anomalies")
    pipeline_run = relationship("PipelineRun", back_populates="anomalies")

    __table_args__ = (
        UniqueConstraint("work_id", "detector_type", "run_id", name="uq_work_detector_run"),
        CheckConstraint("severity >= 0.50 AND severity <= 1.00", name="chk_valid_anomaly_severity"),
        Index("idx_anomalies_composite", "detector_type", "severity"),
    )


class ReviewQueueItem(Base):
    """Borderline Case Review Queue for D2 & content similarity flags."""
    __tablename__ = "review_queue"

    review_id = Column(Integer, primary_key=True, autoincrement=True)
    work_id_a = Column(Integer, ForeignKey("works.work_id", ondelete="CASCADE"), nullable=False)
    work_id_b = Column(Integer, ForeignKey("works.work_id", ondelete="CASCADE"), nullable=False)
    detector_type = Column(String(50), nullable=False)
    similarity = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), default="PENDING", nullable=False)
    run_id = Column(String(36), ForeignKey("pipeline_runs.run_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    pipeline_run = relationship("PipelineRun", back_populates="review_items")


class EntityRisk(Base):
    """Forensic Risk Profiles for Implementing District Authorities (IDAs) and MPs (D13, D14)."""
    __tablename__ = "entity_risks"

    entity_type = Column(String(20), primary_key=True)  # 'ida', 'mp', 'constituency'
    entity_key = Column(String(200), primary_key=True)
    run_id = Column(String(36), ForeignKey("pipeline_runs.run_id", ondelete="CASCADE"), primary_key=True)
    composite_risk = Column(Float, nullable=False)      # 0.0 - 100.0
    risk_tier = Column(String(20), nullable=False)      # 'Clean', 'Medium', 'High', 'Very High', 'Critical'
    risk_rank = Column(Integer, nullable=False)
    breakdown = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    pipeline_run = relationship("PipelineRun", back_populates="entity_risks")

    __table_args__ = (
        Index("idx_entity_risk_rank", "entity_type", "risk_rank"),
    )


# ==========================================
# EXTENDED PROCUREMENT & CONTRACTOR SCHEMA
# ==========================================

class Tender(Base):
    """Tendering & E-Procurement records linked to works."""
    __tablename__ = "tenders"

    tender_id = Column(String(50), primary_key=True)
    tender_package_id = Column(String(50), nullable=True, index=True)
    work_id = Column(Integer, ForeignKey("works.work_id", ondelete="CASCADE"), nullable=True, index=True)
    tender_date = Column(Date, nullable=True)
    award_date = Column(Date, nullable=True)
    estimated_cost = Column(Float, nullable=True)
    awarded_cost = Column(Float, nullable=True)
    bidder_count = Column(Integer, default=1)
    procurement_method = Column(String(50), default="E-Tender")

    work = relationship("Work", back_populates="tenders")
    bidders = relationship("Bidder", back_populates="tender", cascade="all, delete-orphan")


class Bidder(Base):
    """Bidding entities participating in tenders."""
    __tablename__ = "bidders"

    bidder_id = Column(String(50), primary_key=True)
    tender_id = Column(String(50), ForeignKey("tenders.tender_id", ondelete="CASCADE"), nullable=False, index=True)
    bidder_name = Column(String(255), nullable=False)
    bid_amount = Column(Float, nullable=False)
    rank = Column(Integer, default=1)
    is_winner = Column(Boolean, default=False)

    tender = relationship("Tender", back_populates="bidders")


class Contractor(Base):
    """Contractor / Vendor Master Ledger."""
    __tablename__ = "contractors"

    contractor_id = Column(String(50), primary_key=True)
    contractor_name = Column(String(255), nullable=False, index=True)
    gstin = Column(String(15), nullable=True, index=True)
    pan = Column(String(10), nullable=True)
    bank_account_hash = Column(String(64), nullable=True)
    registration_number = Column(String(50), nullable=True)


# ==========================================
# EXTENDED PAYMENT & INVOICING SCHEMA
# ==========================================

class PaymentVoucher(Base):
    """Itemized Payment Vouchers & Treasury Disbursements."""
    __tablename__ = "payment_vouchers"

    voucher_id = Column(String(50), primary_key=True)
    work_id = Column(Integer, ForeignKey("works.work_id", ondelete="CASCADE"), nullable=False, index=True)
    contractor_id = Column(String(50), ForeignKey("contractors.contractor_id"), nullable=True, index=True)
    voucher_date = Column(Date, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    payment_mode = Column(String(50), default="PFMS/Treasury")
    invoice_id = Column(String(50), nullable=True)

    work = relationship("Work", back_populates="payment_vouchers")


class Invoice(Base):
    """Contractor Invoices & Quantity Bill of Quantities (BOQ)."""
    __tablename__ = "invoices"

    invoice_id = Column(String(50), primary_key=True)
    work_id = Column(Integer, ForeignKey("works.work_id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_date = Column(Date, nullable=False)
    invoice_amount = Column(Float, nullable=False)
    quantity_billed = Column(Float, nullable=True)
    unit_rate = Column(Float, nullable=True)

    work = relationship("Work", back_populates="invoices")


# ==========================================
# PHYSICAL INSPECTION & VERIFICATION SCHEMA
# ==========================================

class Inspection(Base):
    """Field Inspection Findings and Quality Certifications."""
    __tablename__ = "inspections"

    inspection_id = Column(String(50), primary_key=True)
    work_id = Column(Integer, ForeignKey("works.work_id", ondelete="CASCADE"), nullable=False, index=True)
    inspection_date = Column(Date, nullable=False)
    inspection_type = Column(String(50), default="Physical Verification")
    inspector_name = Column(String(255), nullable=True)
    status = Column(String(50), default="Completed")
    findings = Column(Text, nullable=True)
    is_passed = Column(Boolean, default=True)

    work = relationship("Work", back_populates="inspections")


class MeasurementBook(Base):
    """Engineer Measurement Book (MB) Recordings."""
    __tablename__ = "measurement_books"

    mb_id = Column(String(50), primary_key=True)
    work_id = Column(Integer, ForeignKey("works.work_id", ondelete="CASCADE"), nullable=False, index=True)
    mb_date = Column(Date, nullable=False)
    page_number = Column(Integer, nullable=True)
    quantity_measured = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)
    engineer_name = Column(String(255), nullable=True)
    is_approved = Column(Boolean, default=True)

    work = relationship("Work", back_populates="measurement_books")


class GeotaggedPhoto(Base):
    """Geotagged Photographs with Coordinate Provenance."""
    __tablename__ = "geotagged_photos"

    photo_id = Column(String(50), primary_key=True)
    work_id = Column(Integer, ForeignKey("works.work_id", ondelete="CASCADE"), nullable=False, index=True)
    photo_date = Column(Date, nullable=True)
    photo_stage = Column(String(50), default="during") # before/during/after
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    photo_url = Column(Text, nullable=True)
    photo_hash = Column(String(64), nullable=True)

    work = relationship("Work", back_populates="geotagged_photos")


# ==========================================
# AUDIT OUTCOMES, LABELS & COMPLAINTS
# ==========================================

class AuditOutcome(Base):
    """Official Statutory Audit Findings (CAG, State Vigilance)."""
    __tablename__ = "audit_outcomes"

    audit_id = Column(String(50), primary_key=True)
    work_id = Column(Integer, ForeignKey("works.work_id", ondelete="CASCADE"), nullable=False, index=True)
    audit_date = Column(Date, nullable=False)
    auditor_organization = Column(String(100), default="CAG/Vigilance")
    audit_type = Column(String(50), default="Performance Audit")
    finding_category = Column(String(50), nullable=True)
    fraud_confirmed = Column(Boolean, default=False, index=True)
    recovery_amount = Column(Float, default=0.0)
    recovery_order_number = Column(String(50), nullable=True)
    prosecution_status = Column(String(50), nullable=True)

    work = relationship("Work", back_populates="audit_outcomes")


class Complaint(Base):
    """Public, Whistleblower, and Administrative Grievances."""
    __tablename__ = "complaints"

    complaint_id = Column(String(50), primary_key=True)
    work_id = Column(Integer, ForeignKey("works.work_id", ondelete="CASCADE"), nullable=False, index=True)
    complaint_date = Column(Date, nullable=False)
    complainant_type = Column(String(50), default="Citizen")
    complaint_category = Column(String(100), nullable=True)
    status = Column(String(50), default="Pending Investigation")
    resolution = Column(Text, nullable=True)


class FraudLabel(Base):
    """Ground-Truth Human Audit Label Registry for Supervised ML Models."""
    __tablename__ = "fraud_labels"

    label_id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    work_id = Column(Integer, ForeignKey("works.work_id", ondelete="CASCADE"), nullable=False, index=True)
    label_class = Column(String(50), nullable=False, index=True) # CONFIRMED_FRAUD, SUSPICIOUS_UNCONFIRMED, CLEARED_OR_LEGITIMATE, UNKNOWN
    label_date = Column(Date, default=lambda: datetime.now(timezone.utc).date(), nullable=False)
    labeler_id = Column(String(50), default="Auditor")
    confidence = Column(String(20), default="HIGH") # HIGH, MEDIUM, LOW
    evidence_summary = Column(Text, nullable=True)
    evidence_documents = Column(JSON, nullable=True)
    audit_outcome_id = Column(String(50), ForeignKey("audit_outcomes.audit_id"), nullable=True)
    review_status = Column(String(50), default="VERIFIED")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    work = relationship("Work", back_populates="fraud_labels")


class LabelReview(Base):
    """Inter-Rater Dual Review & Adjudication Protocol."""
    __tablename__ = "label_reviews"

    review_id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    label_id = Column(String(50), ForeignKey("fraud_labels.label_id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id = Column(String(50), nullable=False)
    review_date = Column(Date, default=lambda: datetime.now(timezone.utc).date(), nullable=False)
    agreement = Column(Boolean, default=True)
    disagreement_reason = Column(Text, nullable=True)
    final_label = Column(String(50), nullable=True)


# ==========================================
# ML PREDICTIONS & UNCERTAINTY QUANTIFICATION
# ==========================================

class Prediction(Base):
    """Calibrated Fraud-Risk Machine Learning Predictions."""
    __tablename__ = "predictions"

    prediction_id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    work_id = Column(Integer, ForeignKey("works.work_id", ondelete="CASCADE"), nullable=False, index=True)
    fraud_probability = Column(Float, nullable=False, index=True)
    confidence_interval_lower = Column(Float, nullable=False)
    confidence_interval_upper = Column(Float, nullable=False)
    uncertainty_score = Column(Float, default=0.0)
    model_version = Column(String(50), default="ensemble_v1", nullable=False)
    feature_version = Column(String(50), default="v1.0", nullable=False)
    run_id = Column(String(36), ForeignKey("pipeline_runs.run_id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    work = relationship("Work", back_populates="predictions")
    pipeline_run = relationship("PipelineRun", back_populates="predictions")


# ==========================================
# AUTHENTICATION & AUDIT TRAIL (RBAC)
# ==========================================

class User(Base):
    """Authenticated user accounts with Role-Based Access Control (RBAC)."""
    __tablename__ = "users"

    user_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), CheckConstraint(
        "role IN ('Viewer', 'Analyst', 'Auditor', 'SeniorReviewer', 'Admin')"
    ), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime, nullable=True)

    audit_logs = relationship("AuditLog", back_populates="user")


class AuditLog(Base):
    """Immutable Audit Trail recording all security and investigative events."""
    __tablename__ = "audit_logs"

    log_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(String(36), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    details_json = Column(JSON, nullable=True)

    user = relationship("User", back_populates="audit_logs")

