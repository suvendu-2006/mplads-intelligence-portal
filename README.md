# 🛡️ SATARK — MPLADS National Forensic Intelligence & Surveillance Platform

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/Auditing_Engine-Production_Ready-success?style=for-the-badge)]()

> **Project SATARK** is an enterprise-grade national surveillance, forensic anomaly detection, and decision-intelligence platform engineered for India's **Member of Parliament Local Area Development Scheme (MPLADS)**. 
> 
> The platform continuously monitors and audits over **₹14,700+ Crore** in public capital allocations across **36 States & Union Territories**, **543 Lok Sabha Constituencies**, **245 Rajya Sabha MPs**, and **780+ Nodal Districts**.

---

## 🏛️ System Architecture

SATARK is built on an asynchronous, decoupled 5-tier architecture that bridges raw administrative datasets with high-speed forensic surveillance and decision intelligence:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES & CRYPTOGRAPHIC INGESTION LAYER                         │
│   MoSPI / e-SAKSHI Portals • State Summaries • District Ledgers • CPWD Schedule of Rates     │
│                     (Automated SHA-256 Checksumming & Idempotent ETL)                        │
└──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                               │
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                        CANONICAL RELATIONAL DATABASE LAYER (SQLAlchemy)                      │
│   Works • Anomalies • EntityRisks • Tenders • Contractors • Vouchers • Inspections • Labels  │
│                   (PostgreSQL Production • SQLite WAL 256MB Memory-Mapped)                   │
└──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                               │
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                      THE FORENSIC DETECTION & MACHINE LEARNING BRAIN                         │
│   15 Statutory Detectors (D1-D15) ──► 53 Tabular Features ──► HistGradientBoosting (Calib)   │
│             (Isolation Forest • Benford's Law • TF-IDF Cosine • CPWD Overruns)               │
└──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                               │
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                    GOVERNANCE, DUAL-REVIEW QUEUE & HIGH-SPEED API LAYER                      │
│   Priority Action Tiers (Audit Now / Review / Clean) • RBAC (5 Roles) • FastAPI (<50ms)      │
└──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                               │
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PRESENTATION SURFACES                                      │
│    Streamlit Forensic Workbench (app.py)    •    React 18 / Vite National Portal (web/)      │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Systematic Repository Layout

The repository is organized following clean architectural separation of concerns:

```
SIH-DATA/
│
├── webapi/                     # High-Performance FastAPI REST Backend
│   ├── routers/                # Endpoint routers (national, states, mps, districts, flags, map, roles)
│   ├── services/               # Assembly & GIS data services
│   ├── aggregators.py          # In-memory TTL aggregation caches (<50ms latency)
│   ├── data_service.py         # SQLite WAL connection tuning & CSV loaders
│   └── main.py                 # ASGI application entrypoint & startup warmup
│
├── mplads_fraud_detection/     # Core Forensic Fraud Engine
│   ├── detectors/              # 15 Statutory Forensic Screening Detectors (D1 to D15)
│   ├── foundation/             # Canonical SQLAlchemy models, DB sessions & ETL pipeline
│   ├── features/               # 53 Tabular feature extraction pipeline
│   ├── models/                 # Gradient boosting classifiers & probability calibration (ECE)
│   ├── review_queue/           # Human-in-the-loop priority router & dual-review adjudication
│   ├── auth/                   # Role-Based Access Control (RBAC) & admin bootstrapping
│   ├── monitoring/             # Feature drift detection & model health monitors
│   └── pipeline.py             # Master orchestrator executing D1-D15 end-to-end
│
├── web/                        # React 18 + Vite Interactive Frontend
│   ├── src/components/         # Reusable surveillance UI components & charts
│   ├── src/pages/              # National Dashboard, GIS Map, MP Dossier, State & District consoles
│   ├── src/lib/                # API client, internationalization (i18n), design palette
│   └── package.json            # Node.js dependencies
│
├── docs/                       # Operational, Technical & Legal Documentation
│   ├── SATARK_MPLADS_15_Detectors_Guide.pdf          # Official 15-detector forensic manual
│   ├── SATARK_MPLADS_15_Detectors_Specification.docx  # Editable Word specification
│   ├── QUICK_START_GUIDE.md    # 5-minute onboarding & local execution guide
│   ├── USER_GUIDE.md           # Dashboard user manual & role privileges
│   ├── DEPLOYMENT.md           # Docker, PostgreSQL & production configuration
│   ├── AUDIT_PROTOCOL.md       # Standard operating procedure for field auditors
│   ├── ETHICS.md               # Constitutional non-discrimination & fairness policy
│   └── README.md               # Master documentation index
│
├── scripts/                    # Automation, Seeding & Report Generation Utilities
│   ├── generate_detectors_docx.py # Compiles the 15-detector statutory forensic manual
│   ├── seed_all_detectors.py   # Populates 100% anomaly coverage across D1-D15
│   ├── backfill_implementing_agencies.py  # Backfills IDA names from MoSPI datasets
│   ├── sync_all_official_data.py # Syncs local data with e-SAKSHI portal exports
│   └── README.md               # Master script catalogue
│
├── tests/                      # Automated Testing Pyramid
│   ├── test_pipeline.py        # End-to-end verification of all 15 detectors
│   ├── test_idempotency.py     # Mathematical proof of zero duplicate counting
│   ├── test_api.py             # 100% contract validation for all REST endpoints
│   └── test_rbac.py            # Security boundary & role-authorization tests
│
├── data/                       # Authoritative Master & Archival Datasets
│   ├── 01_Overview_and_National_Summary/ # Expenditure & sector national totals
│   ├── 02_States_and_UTs/      # All 36 State & UT aggregated summaries
│   ├── 03_MPs_Data/            # 788 MP profiles & Lok Sabha/Rajya Sabha dossiers
│   ├── 04_Constituencies/      # Parliamentary Constituency metrics & allocations
│   ├── 05_Analytics_and_Trends/# Historical trends, year-over-year analytics
│   ├── 06_Works/               # Master works datasets & CPWD benchmark rates
│   ├── 07_Expenditures/        # Financial breakdown & treasury disbursements
│   ├── 08_Spatial_Boundaries/  # GeoJSON spatial boundaries (Districts & PCs)
│   ├── 09_MP_Demographics_ADR/ # ADR Myneta affidavits, assets & disclosures
│   ├── 10_District_Level_Data/ # 730+ Nodal District administrative ledgers
│   ├── MPLADS_Master_Summary.xlsx # Comprehensive analytical workbook (10+ sheets)
│   ├── all_districts_mplads_summary.csv # Nodal District metrics
│   ├── all_mps_summary.csv     # Canonical MP summary
│   ├── works_completed.csv     # Official completed works
│   └── expenditures.csv        # Detailed expenditure records
│
├── api/                        # Production Serverless Functions & Edge Bundle
│   ├── index.py                # ASGI Edge entrypoint with on-demand DB hydration
│   ├── mplads_dev.db.gz        # High-compression SQLite database image
│   └── data/                   # Bundled edge data assets (<10MB)
│
├── app.py                      # Streamlit Forensic Auditor Workbench & Live Console
├── Dockerfile                  # Hardened multi-stage container configuration
├── docker-compose.yml          # Production stack orchestration
├── docker-entrypoint.sh        # Container initialization & migration hook
├── check_env.sh                # Production environment validation script
├── vercel.json                 # Serverless edge deployment configuration
├── requirements.txt            # Python web dependencies
├── requirements-full.txt       # Full ML & forensic audit dependencies
├── requirements.lock           # Cryptographically pinned lockfile
├── LICENSE                     # MIT Open Source License
└── alembic.ini                 # Alembic database migration configuration
```

---

## 🔍 The 15 Statutory Forensic Detectors

SATARK deploys an ensemble of 15 automated screening detectors grounded in the **General Financial Rules (GFR 2017)**, **CPWD Schedule of Rates 2023**, and **CAG Auditing Standards**:

| ID | Detector Name | Legal / Statutory Basis | Vulnerability Detected |
|:---|:---|:---|:---|
| **D1** | **Multivariate Outlier Screen** | Isolation Forest Spatial Density | High-dimensional anomalies across cost, time, and payment ratios. |
| **D2** | **Duplicate Scope Detection** | MPLADS Guidelines 2023 (Clause 3.4) | Cross-year double funding of identical works via TF-IDF Cosine Similarity > 0.85. |
| **D3** | **CPWD Cost Overrun Analysis** | CPWD Schedule of Rates 2023 | Sanctioned costs exceeding official civil engineering benchmarks by > 20%. |
| **D4** | **Ghost Works & Payments** | MPLADS Guidelines 2016 (Clause 8.3) | Works officially marked completed with zero treasury disbursements. |
| **D5** | **Tender Splitting (Smurfing)** | GFR 2017 Rule 157 | Slicing projects just below ₹50 Lakh / ₹10 Lakh statutory approval limits. |
| **D6** | **Execution Delay Violation** | Mandatory 365-Day Completion Norm | Chronically stalled, delayed, or abandoned infrastructure projects. |
| **D7** | **March Rush Timing Anomaly** | Public Accounts Committee Directives | Frantic budget dumping and rushed approvals between March 25 and 31. |
| **D8** | **Same-Day Bulk Certification** | State Vigilance Anti-Batch Norms | Engineers paper-certifying >5 major works on the identical calendar date. |
| **D9** | **Benford's Law Forensic Screen** | Nigrini Forensic Accounting Standards | Fabricated numbers, unnatural digit distributions, and excess round estimates. |
| **D10**| **Vague Scope Ambiguity** | CAG Performance Audit Standards | Descriptions under 15 characters lacking location, units, or physical asset type. |
| **D11**| **Category Plausibility Bounds**| MoSPI Engineering Boundaries | Engineering absurdities (e.g. ₹50 Lakh borewell or ₹15,000 hospital). |
| **D12**| **Documentary Verification Gap**| e-SAKSHI Digital Audit Mandate | Completed works lacking Measurement Books (MB) or Geotagged Photos. |
| **D13**| **IDA Portfolio Risk Profiling**| District Governance Benchmarks | Composite institutional risk index (0–100) for District Collectorates. |
| **D14**| **MP Portfolio Concentration** | Public Allocation Guidelines | Sectoral over-concentration and fund velocity per elected representative. |
| **D15**| **Copy-Paste Pricing Matching** | CAG Report on Formulaic Approvals | Repetitive, identical-rupee sanctions across distinct civil projects. |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python**: 3.11 or 3.12
- **Node.js**: 18+ (for React frontend)
- **SQLite3** or **PostgreSQL**

### 1. Clone & Set Up Python Environment
```bash
git clone https://github.com/suvendu-2006/mplads-intelligence-portal.git
cd mplads-intelligence-portal

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Launch the High-Performance REST API
```bash
# Starts FastAPI with in-memory warmup on http://localhost:8000
uvicorn webapi.main:app --host 0.0.0.0 --port 8000 --reload
```
* Interactive API Documentation (Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)
* Health Check: [http://localhost:8000/api/meta/health](http://localhost:8000/api/meta/health)

### 3. Launch the Streamlit Forensic Command Center
```bash
streamlit run app.py
```
* Opens the investigator workbench on [http://localhost:8501](http://localhost:8501)

### 4. Launch the React National Surveillance Portal
```bash
cd web
npm install
npm run dev
```
* Opens the interactive GIS dashboard on [http://localhost:5173](http://localhost:5173)

### 5. Run Automated Verification Tests
```bash
# Run API and endpoint contract tests
pytest tests/test_api.py -v

# Run mathematical idempotency tests
pytest tests/test_idempotency.py -v
```

---

## 🐳 Docker Deployment

The platform is fully containerized using a hardened multi-stage Docker build:

```bash
# Build and run using Docker Compose
docker compose up -d --build

# Verify container health
curl http://localhost:8000/api/meta/health
```

---

## ⚖️ Ethical AI & Constitutional Fairness

SATARK complies with Indian constitutional non-discrimination standards:
* **Strict Attribute Quarantine:** Sensitive demographic attributes (political party affiliation, MP religion, caste, gender, and age) are mathematically isolated and excluded from all fraud detection algorithms and risk models.
* **Explainable by Design:** Every red flag produces a human-readable statutory violation summary with verifiable transactional evidence.
* **Natural Justice & Dual Review:** AI models output decision-support triage leads; statutory actions require physical verification and senior dual-review signoffs.

---

## 📄 License & Attribution

Developed for national administrative surveillance and transparency under the **Smart India Hackathon (SIH)**. 
Official Data Sources: Ministry of Statistics & Programme Implementation (MoSPI), DataMeet GIS Maps, and the Association for Democratic Reforms (ADR).
