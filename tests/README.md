# SATARK Automated Test Suite & Acceptance Gates (`tests`)

This directory contains the automated test pyramid for the **MPLADS National Forensic Intelligence Platform (SATARK)**. The test suite guarantees zero data corruption, mathematical reconciliation across administrative boundaries, server-side security enforcement, and statutory forensic screening precision.

---

## 🏛️ Test Suite Directory Map

```
tests/
├── fixtures/                   # Isolated Synthetic Datasets (Zero Production Contamination)
│   ├── synthetic_10_works.csv
│   ├── synthetic_edge_cases.csv
│   ├── synthetic_fraud_cases.csv
│   └── README.md
│
├── acceptance_tests.sh         # Master 16-Gate Production Acceptance Test Suite
├── staging_smoke_test.sh       # PostgreSQL TLS & Offline DDL Migration Smoke Test
├── conftest.py                 # Pytest shared fixtures (isolated DB sessions, mock clients)
│
├── test_data_contract.py       # Mathematical reconciliation between National, State, MP, District ledgers
├── test_idempotency.py         # Mathematical proof of zero duplicate records on repeated ingestion
├── test_metrics_integrity.py   # Mathematical verification of KPI calculations & financial formulas
├── test_cpwd_provenance.py     # CPWD benchmark rates & unit price consistency
│
├── test_api.py                 # 100% contract coverage for FastAPI endpoints
├── test_implementing_agency_api.py # Implementing District Authority (IDA) endpoint tests
├── test_assembly_search.py     # Assembly Constituency (AC) search & resolution tests
│
├── test_rbac_server_side.py    # Server-side Role-Based Access Control (5 administrative roles)
├── test_label_approval_workflow.py # Dual-review audit workflow & cryptographic evidence validation
├── test_settings.py            # Fail-closed Pydantic settings & production configuration rules
├── test_postgres_tls_staging.py# PostgreSQL TLS `sslmode=require` & connect args enforcement
│
├── verify_detectors.py         # End-to-end execution of all 15 screening detectors (D1 to D15)
├── test_detector_registry.py   # Registry completeness & capacity tier assignment
├── test_detector_features.py   # Continuous feature extraction for detector screening
├── test_monotonic_severity.py  # Mathematical monotonicity of risk & severity scoring functions
├── test_synthetic_fraud_injections.py # Known fraud pattern detection validation
│
├── test_ml_models.py           # Machine learning model training guards & calibration (ECE)
├── test_drift_detector.py      # Population Stability Index (PSI) feature drift monitoring
├── test_evaluation_metrics.py  # Precision@K & demographic fairness audit (disparate impact)
├── test_feature_extractor.py   # Constitutional non-discrimination attribute quarantine enforcement
│
├── test_data_validation.py     # Data boundary validation (negative costs, future dates, invalid status)
├── test_ida_extractor.py       # Regex normalization for 2,000+ agency name variants
├── test_isolated_db.py         # Test DB fixture isolation & rollback integrity
├── test_dashboard_data_loading.py # Resilient data loader signatures & fallback handling
└── test_alerting.py            # Alert notification dispatchers (webhooks, email)
```

---

## 🚦 Execution Commands

### 1. Fast CI Pytest Suite (Excludes Slow Model Training)
```bash
# Runs 100+ unit, integration, and security tests in under 30 seconds
.venv/bin/pytest -v tests/ -m "not slow"
```

### 2. Full Acceptance Gate (16 Comprehensive Gates)
```bash
# Validates credentials, data lineage, migrations, RBAC, Docker, and ML quarantine
bash tests/acceptance_tests.sh
```

### 3. Staging Smoke Test (PostgreSQL & TLS Parameters)
```bash
# Verifies production PostgreSQL TLS configuration and offline Alembic DDL compilation
bash tests/staging_smoke_test.sh
```

### 4. Specific Test Suites
```bash
# Run API endpoint contract tests
.venv/bin/pytest tests/test_api.py -v

# Run data reconciliation contract tests
.venv/bin/pytest tests/test_data_contract.py -v

# Run server-side RBAC security tests
.venv/bin/pytest tests/test_rbac_server_side.py -v

# Run all 15 detector validations
.venv/bin/pytest tests/verify_detectors.py -v
```
