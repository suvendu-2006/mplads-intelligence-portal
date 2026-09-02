# MPLADS Comprehensive National Dataset & Analytics Suite
**Sources**: 
- Official MoSPI / e-SAKSHI Portal (https://mplads.mospi.gov.in)
- Empowered Indian (https://empoweredindian.in/mplads)
- DataMeet Spatial Boundary Maps (https://github.com/datameet/maps)
- Association for Democratic Reforms (ADR) / MyNeta (https://myneta.info)

**Last Updated**: 2026-09-01

---

## Summary of All Datasets Extracted

| # | Dataset | Total Records | Formats | Description |
|---|:---|:---|:---|:---|
| 1 | **National Overview** | 1 record | CSV, JSON, XLSX | Overall allocations, expenditures, completion rate |
| 2 | **States & UTs Summary** | 36 states | CSV, JSON, XLSX | State-level allocations, expenditures, utilization % |
| 3 | **MPs Master Dataset** | 774 MPs | CSV, JSON, XLSX | Complete list of all MPs, allocations, spending, completion rate |
| 4 | **Detailed MP Profiles** | 774 files | JSON | Individual MP dossiers in `03_MPs_Data/mp_profiles/` |
| 5 | **Constituencies Summary** | 551 constituencies | CSV, JSON, XLSX | State-wise constituency performance & MPs |
| 6 | **Constituency Project Totals**| 579 constituencies | CSV, JSON | Project counts and total amounts per constituency |
| 7 | **Completed Works** | 15,800+ works | CSV, JSON | All completed projects with cost, location, category, MP |
| 8 | **Recommended Works** | 2,390 works | CSV, JSON | All recommended works with estimated cost, status, MP |
| 9 | **Expenditures** | 29,000 transactions | CSV, JSON | Individual expenditure transactions with amounts & years |
| 10 | **Sectors Breakdown** | 4 sectors | CSV, JSON, XLSX | Sector-wise spending distribution & percentages |
| 11 | **Lok Sabha Terms** | 2 terms | CSV, JSON, XLSX | 17th vs 18th Lok Sabha comparison |
| 12 | **Top Performers** | 10 MPs | CSV, JSON, XLSX | Top performing MPs across India |
| 13 | **Analytics & Trends** | Multiple | CSV, JSON | Yearly utilization and distribution buckets |
| 14 | **Spatial PC Boundaries (GIS)** | 543 Constituencies | GeoJSON, JSON | 100% mapped 543 Lok Sabha Parliamentary Constituencies with MPLADS data |
| 15 | **District Spatial Boundaries** | 594 Districts | GeoJSON | India district boundary polygons from DataMeet |
| 16 | **MP Demographics & Affidavits** | 774 MPs | CSV, JSON | MP wealth, assets, liabilities, criminal cases, education from ADR/MyNeta |
| 17 | **Demographic Correlation Insights**| 5 Analytics Tables | JSON, XLSX | Wealth brackets vs. Utilization %, Education vs. Completion, Party comparisons |
| 18 | **Nodal District Summary** | 732 Districts | CSV, JSON, XLSX | Implementing District Authority performance, completed vs recommended projects |

---

## Directory Structure

```
SIH-DATA/
|-- 01_Overview_and_National_Summary/
|   |-- national_overview.csv / .json
|   |-- terms_summary.csv / .json
|   |-- sectors_breakdown.csv / .json
|   |-- expenditure_categories.csv / .json
|   `-- sync_metadata.json
|
|-- 02_States_and_UTs/
|   |-- all_states_summary.csv / .json
|   `-- state_wise_constituencies_summary.csv / .json
|
|-- 03_MPs_Data/
|   |-- all_mps_summary.csv / .json
|   |-- detailed_mp_profiles.csv
|   |-- top_performing_mps.csv / .json
|   `-- mp_profiles/ (774 individual MP JSON files)
|
|-- 04_Constituencies/
|   |-- all_constituencies_summary.csv
|   `-- constituency_project_totals.csv / .json
|
|-- 05_Analytics_and_Trends/
|   |-- analytics_trends_yearly.csv / .json
|   |-- performance_distribution.csv / .json
|   `-- mplads_trends.csv / .json
|
|-- 06_Works/
|   |-- works_categories.csv / .json
|   |-- works_completed.csv / .json
|   `-- works_recommended.csv / .json
|
|-- 07_Expenditures/
|   |-- expenditures.csv / .json
|   `-- expenditure_categories.csv / .json
|
|-- 08_Spatial_Boundaries/
|   |-- india_parliamentary_constituencies.geojson (Raw DataMeet 543 PC polygons)
|   |-- india_districts.geojson (DataMeet India District polygons)
|   `-- constituency_mplads_geojson.json (100% Joined GIS GeoJSON for interactive maps)
|
|-- 09_MP_Demographics_ADR/
|   |-- all_mps_demographics.csv / .json (Scraped MyNeta/ADR candidate affidavits)
|   |-- mp_mplads_demographics_merged.csv / .json (Merged 774 MPs with Wealth, Crime, Education)
|   `-- demographic_correlation_insights.json (Asset bracket, education, party performance correlations)
|
|-- 10_District_Level_Data/
|   `-- all_districts_mplads_summary.csv / .json (732 Nodal District execution metrics)
|
|-- MPLADS_Master_Summary.xlsx (Multi-tab Excel Workbook with 10+ analysis sheets)
`-- README.md
```

---

## Documentation

Full operational, governance, technical, and compliance documentation is organized under [`docs/`](file:///Users/suvendu/Downloads/SIH-DATA/docs/README.md):

* **Getting Started**: [`QUICK_START_GUIDE.md`](file:///Users/suvendu/Downloads/SIH-DATA/docs/QUICK_START_GUIDE.md) & [`USER_GUIDE.md`](file:///Users/suvendu/Downloads/SIH-DATA/docs/USER_GUIDE.md)
* **Production & Deployment**: [`DEPLOYMENT.md`](file:///Users/suvendu/Downloads/SIH-DATA/docs/DEPLOYMENT.md), [`OPERATIONS.md`](file:///Users/suvendu/Downloads/SIH-DATA/docs/OPERATIONS.md), & [`ROLLBACK.md`](file:///Users/suvendu/Downloads/SIH-DATA/docs/ROLLBACK.md)
* **Governance & Ethics**: [`AUDIT_PROTOCOL.md`](file:///Users/suvendu/Downloads/SIH-DATA/docs/AUDIT_PROTOCOL.md), [`ETHICS.md`](file:///Users/suvendu/Downloads/SIH-DATA/docs/ETHICS.md), & [`RETENTION_POLICY.md`](file:///Users/suvendu/Downloads/SIH-DATA/docs/RETENTION_POLICY.md)
* **Data Provenance**: [`DATA_PROVENANCE.md`](file:///Users/suvendu/Downloads/SIH-DATA/docs/DATA_PROVENANCE.md) & [`OFFICIAL_DATA_PROVENANCE_AND_LIMITS.md`](file:///Users/suvendu/Downloads/SIH-DATA/docs/OFFICIAL_DATA_PROVENANCE_AND_LIMITS.md)

---

## Evidence Store Policy

The `data/evidence/` directory contains cryptographically verified audit evidence documents.
- All files are stored immutably as `{sha256[:16]}_{filename}`.
- Empty-file hashes (`e3b0c442...`) and unbacked placeholder paths are strictly rejected.
- Test or fabricated evidence is prohibited from the operational evidence store.

---

## Working Directory & Execution Guidelines

Always run commands from the project root directory:

```bash
# ✅ CORRECT (resolves all datasets and settings accurately)
cd /path/to/SIH-DATA
python -m mplads_fraud_detection.pipeline
alembic upgrade head
pytest

# ❌ WRONG
cd /tmp
python -m mplads_fraud_detection.pipeline
```

