# Project Scripts & Automation Utilities

This directory contains automation, data migration, forensic report generation, and system verification scripts for the **MPLADS National Forensic Intelligence Platform (SATARK)**.

---

## Directory Organization

### 1. Data Ingestion, Migration & Seeding
Scripts for populating the database, backfilling schema attributes, and running snapshot synchronization:
* [`backfill_implementing_agencies.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/backfill_implementing_agencies.py) — Backfills Implementing District Authority (IDA) names from official MoSPI sources.
* [`seed_all_detectors.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/seed_all_detectors.py) — Ensures 100% anomaly coverage across all 15 detectors (D1–D15) for testing and evaluation.
* [`seed_anomalies_for_all_states.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/seed_anomalies_for_all_states.py) — Populates realistic forensic anomaly distributions across all 36 States/UTs.
* [`ingest_all_mplads_works.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/ingest_all_mplads_works.py) — Master ingestion script loading raw CSV files into SQLite/PostgreSQL.
* [`sync_all_official_data.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/sync_all_official_data.py) — Synchronizes local datasets with official e-SAKSHI portal exports.
* [`backup_database.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/backup_database.py) — Creates compressed, timestamped backups of `mplads_dev.db`.
* [`cleanup_test_data.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/cleanup_test_data.py) — Idempotently cleans up test-generated runs and artifacts.

### 2. GIS & Spatial Boundary Processing
Scripts for processing TopoJSON/GeoJSON polygons for parliamentary constituencies and districts:
* [`process_assembly_constituencies.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/process_assembly_constituencies.py) — Maps Assembly Constituencies (AC) to Parliamentary Constituencies (PC).
* [`generate_assembly_data.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/generate_assembly_data.py) — Generates lookup maps for legislative assembly data.
* [`simplify_geojson.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/simplify_geojson.py) — Optimizes and compresses high-resolution spatial boundaries for edge CDN serving.

### 3. Report & Documentation Generators
Generators for producing professional specifications:
* [`generate_detectors_docx.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/generate_detectors_docx.py) — Generates the editable Word (.docx) version of the 15-detector specification.
* [`create_simple_word_document.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/create_simple_word_document.py) — Generates formatted Word report documentation.

### 4. End-to-End Verification & Browser Auditing
Automated browser and API verification scripts:
* [`deep_system_audit.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/deep_system_audit.py) — Complete system audit verifying DB integrity, API endpoints, and detector output.
* [`comprehensive_browser_audit.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/comprehensive_browser_audit.py) — Headless browser testing of the React frontend and Streamlit app.
* [`verify_all_pages.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/verify_all_pages.py) — E2E verification of all navigation routes, tabs, and interactive charts.
* [`verify_authorized_consoles.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/verify_authorized_consoles.py) — Role-based authorization tests for State Nodal, District Collector, and Admin views.
* [`verify_round2_e2e.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/verify_round2_e2e.py) — Full regression suite validating user interaction flows and data visualizers.

### 5. Machine Learning Operations
* [`train_model.py`](file:///Users/suvendu/Downloads/SIH-DATA/scripts/train_model.py) — Trains and calibrates the tabular `HistGradientBoostingClassifier` model.
