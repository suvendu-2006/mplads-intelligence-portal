# MPLADS Master Datasets Directory

This directory contains the authoritative administrative, geospatial, financial, and demographic datasets for the **MPLADS National Forensic Intelligence Platform (SATARK)**.

The data architecture is structured into a **10-tier modular directory layout** alongside root-level master summary files and spatial GeoJSON layers. All datasets adhere to strict cryptographic checksum verification (`artifacts/raw_data_manifest.json`) and automated data reconciliation contracts (`tests/test_data_contract.py`).

---

## 📁 10-Tier Modular Directory Organization

| Directory | Scope & Contents | Source Authority |
|:---|:---|:---|
| [`01_Overview_and_National_Summary/`](file:///Users/suvendu/Downloads/SIH-DATA/data/01_Overview_and_National_Summary) | National cumulative allocations, expenditures, works recommended/completed, and sync metadata. | MoSPI e-SAKSHI Portal |
| [`02_States_and_UTs/`](file:///Users/suvendu/Downloads/SIH-DATA/data/02_States_and_UTs) | Aggregated summaries for all 36 States and Union Territories, district tallies, and fund utilization rates. | MoSPI State Summaries |
| [`03_MPs_Data/`](file:///Users/suvendu/Downloads/SIH-DATA/data/03_MPs_Data) | 788 individual MP profiles (`mp_profiles/`), top-performing MP rankings, and parliamentary ledger exports. | Lok Sabha & Rajya Sabha Secretariats |
| [`04_Constituencies/`](file:///Users/suvendu/Downloads/SIH-DATA/data/04_Constituencies) | 543 Parliamentary Constituencies summary metrics and cumulative project totals. | Election Commission of India / MoSPI |
| [`05_Analytics_and_Trends/`](file:///Users/suvendu/Downloads/SIH-DATA/data/05_Analytics_and_Trends) | Historical expenditure trends, year-over-year release curves, and sectoral distribution profiles. | MoSPI Analytical Division |
| [`06_Works/`](file:///Users/suvendu/Downloads/SIH-DATA/data/06_Works) | Canonical civil infrastructure works ledgers, CPWD benchmark rates, unit price baselines, and category splits. | MoSPI Works Registry & CPWD Schedule of Rates 2023 |
| [`07_Expenditures/`](file:///Users/suvendu/Downloads/SIH-DATA/data/07_Expenditures) | Cleaned financial expenditure ledgers and MP financial breakdown matrices. | Public Financial Management System (PFMS) |
| [`08_Spatial_Boundaries/`](file:///Users/suvendu/Downloads/SIH-DATA/data/08_Spatial_Boundaries) | High-precision boundary GeoJSON files for Indian States, Parliamentary Constituencies, and Districts. | Survey of India / DataMeet GIS Community |
| [`09_MP_Demographics_ADR/`](file:///Users/suvendu/Downloads/SIH-DATA/data/09_MP_Demographics_ADR) | Official Association for Democratic Reforms (ADR) election affidavits, education, assets, and disclosures. | Association for Democratic Reforms (National Election Watch) |
| [`10_District_Level_Data/`](file:///Users/suvendu/Downloads/SIH-DATA/data/10_District_Level_Data) | Administrative records for 735+ Nodal Districts, Implementing District Authorities (IDAs), and district ledgers. | District Collectorates & District Planning Committees |

---

## 📊 Root-Level Master Summary Files

* [`MPLADS_Master_Summary.xlsx`](file:///Users/suvendu/Downloads/SIH-DATA/data/MPLADS_Master_Summary.xlsx) — Comprehensive multi-tab analytical Excel workbook containing national, state, MP, sector, and trend sheets.
* [`all_mps_summary.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/all_mps_summary.csv) — Canonical summary of all 788 MPs (Lok Sabha and Rajya Sabha) with reconciled financial and works counts.
* [`all_districts_mplads_summary.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/all_districts_mplads_summary.csv) — District directory aggregating works, expenditure, IDA details, and anomaly scores across 735 districts.
* [`all_mps_financial_breakdown.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/all_mps_financial_breakdown.csv) — Detailed financial disbursements, unspent balances, and interest accruals per MP.
* [`works_completed.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/works_completed.csv) — Master list of completed works with sanction dates, expenditure amounts, and categories.
* [`works_completed_detailed.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/works_completed_detailed.csv) — Granular works dataset including implementing agencies, locations, and description text.
* [`works_recommended.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/works_recommended.csv) — Works recommended by MPs pending administrative sanction or execution.
* [`expenditures.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/expenditures.csv) — Transaction-level expenditure records with voucher and payment timestamps.
* [`cpwd_benchmark_rates.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/cpwd_benchmark_rates.csv) — Central Public Works Department (CPWD) standard rate benchmarks used by Detector D3.
* [`unit_prices_master.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/unit_prices_master.csv) — Unit price master matrix for civil items (roads, community halls, solar lighting, drinking water).
* [`assembly_constituencies_master.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/assembly_constituencies_master.csv) & [`assembly_constituencies_enriched.csv`](file:///Users/suvendu/Downloads/SIH-DATA/data/assembly_constituencies_enriched.csv) — Assembly Constituency (AC) to Parliamentary Constituency (PC) mapping index.
* [`districts_enriched.geojson`](file:///Users/suvendu/Downloads/SIH-DATA/data/districts_enriched.geojson) & [`districts_enriched_optimized.geojson`](file:///Users/suvendu/Downloads/SIH-DATA/data/districts_enriched_optimized.geojson) — GeoJSON polygons of Indian districts with embedded risk and expenditure properties.
* [`pcs_enriched.geojson`](file:///Users/suvendu/Downloads/SIH-DATA/data/pcs_enriched.geojson) & [`pcs_enriched_optimized.geojson`](file:///Users/suvendu/Downloads/SIH-DATA/data/pcs_enriched_optimized.geojson) — GeoJSON polygons of Parliamentary Constituencies with embedded MP and fund utilization properties.
* [`precomputed_mps_rf.json`](file:///Users/suvendu/Downloads/SIH-DATA/data/precomputed_mps_rf.json) & [`precomputed_states_rf.json`](file:///Users/suvendu/Downloads/SIH-DATA/data/precomputed_states_rf.json) — Precomputed Random Forest and anomaly screening aggregates for sub-second API delivery.

---

## 🔒 Data Lineage & Cryptographic Integrity

All data files in this directory are bound by a cryptographic contract:
1. **SHA-256 Hashing**: Recorded in [`artifacts/raw_data_manifest.json`](file:///Users/suvendu/Downloads/SIH-DATA/artifacts/raw_data_manifest.json).
2. **Three-Way Mathematical Reconciliation**: Verified by [`tests/test_data_contract.py`](file:///Users/suvendu/Downloads/SIH-DATA/tests/test_data_contract.py) ensuring:
   $$\sum \text{State Expenditures} = \sum \text{National Expenditure} \approx \sum \text{MP Expenditures}$$
   $$\sum \text{State Recommended Works} = \text{National Recommended Works}$$
   $$\sum \text{State Completed Works} = \text{National Completed Works}$$
3. **Zero Negative Balances**: Strict validation ensures non-negative pending works, valid payment gaps, and honest e-SAKSHI portal status mapping.
