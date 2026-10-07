# SATARK Forensic Fraud Detection Engine (`mplads_fraud_detection`)

The `mplads_fraud_detection` package is the core surveillance, screening, and decision-intelligence engine of **Project SATARK**. It provides end-to-end automated anomaly detection for public infrastructure works funded under India's Member of Parliament Local Area Development Scheme (MPLADS).

The engine implements a hybrid forensic methodology combining **15 statutory rule-based detectors**, **53 tabular feature extractors**, **unsupervised anomaly detection (Isolation Forest)**, **empirical probability calibration**, and a **human-in-the-loop dual-review audit queue**.

---

## 🏛️ Architecture & Submodules

```
mplads_fraud_detection/
├── auth/                       # Role-Based Access Control (RBAC) & permissions
│   └── rbac.py                 # Enforces Viewer, Auditor, Analyst, Senior Reviewer, Admin
│
├── detectors/                  # 15 Statutory Forensic Screening Detectors
│   ├── detector_01_unusual_patterns.py   # D1: Isolation Forest Multivariate Outliers
│   ├── detector_02_duplicate_works.py    # D2: TF-IDF Cosine Semantic Duplicate Scope
│   ├── detector_03_cost_overruns.py      # D3: CPWD Rate Benchmark Overrun (>20%)
│   ├── detector_04_ghost_works.py        # D4: Completed Status with Zero Disbursement
│   ├── detector_05_bill_splitting.py     # D5: Smurfing below ₹50L/₹10L Approval Ceilings
│   ├── detector_06_delay_violation.py    # D6: Execution Delays Exceeding 365 Days
│   ├── detector_07_timing_anomaly.py     # D7: March Rush (Year-End Budget Surges)
│   ├── detector_08_bulk_completion.py    # D8: Same-Day Unrealistic Batch Certification
│   ├── detector_09_benford_anomaly.py    # D9: Benford's Law First-Digit Distribution
│   ├── detector_10_vague_description.py  # D10: Ambiguous or Sub-15 Character Scope
│   ├── detector_11_plausibility_mismatch.py # D11: Asset Category Plausibility Bounds
│   ├── detector_12_verification_gap.py   # D12: Measurement Book & Geotag Photo Gaps
│   ├── detector_13_ida_risk.py           # D13: Implementing Agency (IDA) Risk Profiling
│   ├── detector_14_mp_risk.py            # D14: MP Portfolio Concentration & Fund Velocity
│   ├── detector_15_copy_paste_pricing.py # D15: Formulaic Copy-Paste Exact Price Repetition
│   └── registry.py                       # Detector Registry & Capacity Tier Allocation
│
├── features/                   # Feature Engineering Pipeline
│   ├── feature_extractor.py    # Generates 53 tabular features per work
│   ├── detector_features.py    # Continuous anomaly indicators (0.0 to 1.0)
│   └── excluded_attributes.py  # Constitutional Non-Discrimination Attribute Isolation Guard
│
├── foundation/                 # Relational Data Layer & ETL
│   ├── schema.py               # Canonical SQLAlchemy ORM Models (Works, Anomalies, Risks, AuditLogs)
│   ├── db.py                   # DB connection, connection pooling, and SQLite WAL tuning
│   ├── etl.py                  # Idempotent CSV/JSON ingestion pipeline
│   ├── ida_extractor.py        # Implementing District Authority name normalization & regex cleaner
│   ├── evidence_store.py       # Cryptographic evidence attachment store (SHA-256 validation)
│   └── utils.py                # Composite risk scoring & mathematical verification
│
├── models/                     # Machine Learning Models & Probability Calibration
│   ├── baseline_model.py       # Interpretable Logistic Regression / Decision Tree baseline
│   ├── gradient_boosting.py    # HistGradientBoostingClassifier with early stopping
│   └── calibration.py          # Expected Calibration Error (ECE) & Platt scaling
│
├── review_queue/               # Human-in-the-Loop Audit Triage
│   └── priority_router.py      # Assigns priority tiers (Audit Now, Review, Clean) & dual-review gating
│
├── monitoring/                 # Drift Detection & System Health
│   ├── drift_detector.py       # Population Stability Index (PSI) feature drift auditor
│   ├── alerting.py             # Webhook and email alert dispatchers
│   └── health.py               # Database and pipeline health diagnostics
│
├── validation/                 # Schema & Ingestion Validation
│   └── schemas.py              # Pydantic schemas for data contracts & API inputs
│
├── maintenance/                # Operations & Compliance
│   └── retention.py            # Evidence retention and immutable audit trail lifecycle
│
├── config.py                   # System configuration & statutory constants
├── logging_config.py           # Structured JSON and console logging configuration
├── pipeline.py                 # Master orchestrator executing D1-D15 end-to-end
└── settings.py                 # Pydantic Settings with fail-closed production validation
```

---

## ⚖️ Constitutional Fairness & Ethical Isolation

SATARK enforces **strict mathematical isolation** of sensitive demographic attributes in accordance with Articles 14, 15, and 16 of the Constitution of India:
* The module [`features/excluded_attributes.py`](file:///Users/suvendu/Downloads/SIH-DATA/mplads_fraud_detection/features/excluded_attributes.py) dynamically audits every feature vector before it is passed to ML models or detector scoring functions.
* Sensitive attributes (**Political Party Affiliation**, **Religion**, **Caste**, **Gender**, and **Age**) are strictly blocked and quarantined from feature inputs.
* The test suite [`tests/test_feature_extractor.py`](file:///Users/suvendu/Downloads/SIH-DATA/tests/test_feature_extractor.py) enforces that zero prohibited attributes can leak into the screening pipeline.

---

## 🛡️ Triage Priority Tiers

The triage engine (`review_queue/priority_router.py`) maps detector composite scores into actionable administrative tiers:
* **AUDIT NOW (Critical Risk)**: High composite severity ($\ge 0.70$) or multiple statutory triggers requiring immediate on-site physical inspection.
* **REVIEW (Elevated Risk)**: Moderate composite severity ($0.50 \le s < 0.70$) requiring documentary review of Measurement Books (MB) and invoices.
* **CLEAN (Low Risk)**: Normal civil works ($s < 0.50$) cleared for standard routine audit sampling.
