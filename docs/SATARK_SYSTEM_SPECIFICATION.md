# SATARK-MPLADS: Complete System Architecture & Technical Specification
**National Intelligence, Forensic Auditing & Continuous Surveillance Command Center for the MPLAD Scheme**
*Ministry of Statistics & Programme Implementation (MoSPI) • Government of India*

---

## 1. Executive Summary & Scheme Scope

### 1.1 Context & Problem Statement
The Member of Parliament Local Area Development Scheme (MPLADS) is a Central Sector Scheme enabling MPs to recommend developmental civil works with an annual allocation of ₹5 Crore per representative. 
* **National Financial Scale:** ₹39,600+ Crore historical outlay across 543 Lok Sabha Constituencies, 245 Rajya Sabha Members, and 732+ Administrative Districts.
* **The Structural Blind Spot:** Existing administrative portals like **e-SAKSHI** serve exclusively as transactional workflow systems (tracking sanction uploads and completion milestones). They do not perform algorithmic rate-benchmarking, spatial collision analysis, or shadow cartel detection.
* **The Solution — SATARK-MPLADS:** A proactive, automated surveillance platform that continuously reconciles works execution data with expenditure ledgers against statutory standards: Central Vigilance Commission (CVC) guidelines, General Financial Rules (GFR 2017), and CPWD Delhi Schedule of Rates (DSR 2023).

---

## 2. End-to-End System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. PRESENTATION TIER                            │
│  React 18 + Vite 5 + TypeScript + Tailwind CSS + Leaflet GIS           │
│  - National Command Center (/)         - District Console (/district)  │
│  - State Performance (/states)        - Forensic Audit Desk (/audit)  │
│  - MP Directory (/mps)                 - National GIS Map (/map)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (HTTPS REST API Requests)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        2. EDGE & GATEWAY TIER                          │
│  Vercel Edge Network / Reverse Proxy                                   │
│  - Global CDN Caching: stale-while-revalidate                          │
│  - Automated GZip Compression (>1,000 Bytes)                           │
│  - Dynamic CORS & Security Headers                                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Proxied ASGI Async Pipeline)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        3. APPLICATION CORE TIER                        │
│  FastAPI (Python 3.11 / ASGI) Microservice Engine                      │
│  ├── Lifespan In-Memory Pre-Warming (Precomputed State/MP Hashes)      │
│  ├── Dynamic Role-Based Access Control (4 Tier RBAC)                   │
│  ├── 9 APIRouters (National, States, MPs, Flags, Districts, Map, etc.) │
│  └── Pydantic v2 Serialization & Strict Data Validation                │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌─────────────────────────────────────┐  ┌───────────────────────────────┐
│     4. FORENSIC DETECTION CORE      │  │     5. PERSISTENCE TIER       │
│  15 Specialized Anomaly Detectors   │  │  SQLAlchemy ORM + SQLite 3    │
│  - CPWD Plinth Rate Benchmarking    │  │  (mplads_dev.db)              │
│  - Isolation Forest Outlier Engines │  │  ├── works (56,896 records)   │
│  - TF-IDF Duplicate Scope Scanners  │  │  ├── anomalies (22,294 flags) │
│  - GFR Bill Splitting Analyzers     │  │  ├── entity_risks (IDAs/MPs)  │
│  - March Fiscal Dumping Profilers   │  │  └── vouchers (29,001 entries)│
└─────────────────────────────────────┘  └───────────────────────────────┘
```

---

## 3. Database Schema & Data Ingestion Pipeline

### 3.1 Data Provenance & Ground Truth
SATARK normalizes official MoSPI open data releases, joining physical execution ledgers with expenditure vouchers:
* `works_completed.csv` & `works_completed_detailed.csv`: 56,896 civil projects with sanctions, dates, implementing agencies, and descriptions.
* `expenditures.csv`: 29,001 liquid treasury disbursement vouchers tracking milestone releases.
* `cpwd_benchmark_rates.csv`: Base engineering plinth rates across civil categories (roads, lighting, community halls, school classrooms).
* `pcs_enriched.geojson` & `districts_enriched.geojson`: Spatial boundary polygons for 543 Parliamentary Constituencies and 594 Districts.

### 3.2 Primary Database Tables (`mplads_dev.db`)
1. **`works`**: Master project table (`work_id`, `work_description`, `sanctioned_amount`, `sanction_date`, `completion_date`, `district`, `state`, `mp_name`, `category`, `implementing_agency`).
2. **`anomalies`**: 22,294 flagged fraud indicators (`id`, `work_id`, `detector_type`, `detector_name`, `severity`, `tier`, `explanation`, `evidence` JSON, `detected_at`).
3. **`entity_risks`**: Aggregated institutional non-compliance indices for Implementing Development Agencies (IDAs) and MPs.
4. **`payment_vouchers`**: Disbursement records tracking financial outflow dates and voucher IDs (`payment_mode` defaulting to `PFMS/Treasury`).
5. **`users` & `audit_logs`**: Role assignments and persistent auditor review history.

---

## 4. The 15 Algorithmic Fraud Detectors (D1–D15)

| ID | Detector Name | Statutory / Methodological Source | Trigger Rule / Formula | Primary Output |
| :--- | :--- | :--- | :--- | :--- |
| **D1** | Multivariate Statistical Outliers | Isolation Forest Algorithm | Multivariate financial/temporal deviation from category median. | Anomaly score (`-0.81`), Red/Amber tier flag. |
| **D2** | Cross-Year Duplicate Works | MPLADS Guidelines 2023 Cl 3.4 | TF-IDF n-gram vectorization with Cosine Similarity $>0.85$. | Duplicate scope flag with target `work_id`. |
| **D3** | CPWD Cost Overrun Benchmark | CPWD Delhi Schedule of Rates (DSR 2023) | Billed unit rate $> \text{CPWD Ceiling (Base + Inflation + 25\%)}$. | Excess billed INR (+₹19.9L), statutory citation. |
| **D4** | Payment & Disbursement Gaps | MPLADS Guidelines 2016 Cl 8.3 | Work certified "Completed" with zero liquid treasury disbursals. | Ghost project / voucher verification alert. |
| **D5** | Tender Splitting (Smurfing) | GFR 2017 Rule 157 | Multiple identical works within 7 days just below ₹10L/₹50L limits. | Evaded statutory approval ceiling alert. |
| **D6** | Statutory Duration & Stalled Works | MoSPI 365-Day Mandatory Execution Norm | Project incomplete $>730$ days without sanctioned extension. | Overdue duration days and locked capital. |
| **D7** | March Fiscal Year-End Dumping | Public Accounts Committee (PAC) Reports | $>60\%$ of annual MP spend authorized between March 25–31. | Timing anomaly flag for unvetted budget rush. |
| **D8** | Same-Day Bulk Completions | State Vigilance Inspection Manuals | Single agency certifying $>5$ major works on identical date. | Paper sign-off / non-site inspection warning. |
| **D9** | Benford’s Law Forensic Screen | Forensic Accounting (Nigrini Standards) | Logarithmic first-digit deviation + excess round allocations. | Non-estimate arbitrary allocation alert. |
| **D10** | Vague Description Ambiguity | CAG Performance Audit Standards | Description $<15$ chars or missing asset type/location/quantity. | Unverifiable scope audit citation. |
| **D11** | Category-Cost Plausibility Bounds| MoSPI & CPWD Asset Norms | Cost outside physical engineering min/max bounds. | Severe over/under-budgeting flag. |
| **D12** | Documentary Verification Gap | e-SAKSHI Digital Audit Mandate | Completed work lacking digital Measurement Book (MB) or photo. | Missing verification dossier alert. |
| **D13** | IDA Agency Portfolio Profiling | District Administrative Benchmarks | Historical anomaly concentration & delay frequency by agency. | High/Medium/Low agency risk ranking. |
| **D14** | MP Portfolio Concentration | Public Governance Standards | Single-vendor concentration (Herfindahl Index $HHI > 0.40$). | Favoritism / vendor skew index. |
| **D15** | Copy-Paste Formulaic Estimates | CAG Report on Formulaic Approvals | Disparate works sanctioned at identical non-standard rupee value. | Non-site-specific estimate flag. |

---

## 5. Solutions for the 9 Real-World Corruption Scams

```
┌────────────────────────────────────────────────────────────────────────┐
│                     9 Real-World Corruption Scams                      │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. Cross-Scheme Double Billing │ 6. The White Elephant Asset           │
│ 2. Contractor Bid Rigging      │ 7. Statutory SC/ST Fund Diversion     │
│ 3. Substandard Materials       │ 8. Politician Private Trusts          │
│ 4. Photo & GPS Spoofing        │ 9. Unchecked Subcontracting (Shells)  │
│ 5. Post-Award Scope Creep      │                                       │
└────────────────────────────────┴───────────────────────────────────────┘
```

1. **Cross-Scheme Double Billing:** Solved via PostGIS spatial collision:
   $$\text{ST\_DWithin}(\text{geom\_mplads},\ \text{geom\_other},\ 25\text{m}) \le 25\text{m}$$
   combined with string Levenshtein distance on work descriptions ($>85\%$ similarity).
2. **Contractor Cartels & Bid Rigging:** Extracts PAN fingerprints from GSTINs ($\text{GSTIN}[2:12]$), matches bank account hashes, and builds Bipartite Co-Bidding Graphs to detect collusive rotation under Section 3 of the Competition Act, 2002.
3. **Substandard Materials & Quality Fraud:** Reconciles GST e-Way Bill material mass balance (cement/steel tonnage vs. engineering volume) and enforces 28-day NABL concrete compressive crush tests.
4. **Photo & GPS Coordinate Spoofing:** Google Play Integrity hardware attestation blocks Android mock locations; Computer Vision perceptual hashing (pHash) and on-site plaque OCR verify physical originality.
5. **Post-Award Scope Creep:** Monitors Cost Escalation Delta:
   $$\Delta C = \frac{C_{\text{final}} - C_{\text{awarded}}}{C_{\text{awarded}}} > 0.25$$
   triggering automated CVC Chief Technical Examiner re-inspections for escalations $>25\%$.
6. **The White Elephant Asset:** Post-completion DISCOM smart meter telemetry flags assets with 0 kWh electricity usage over 90 days; citizen QR codes enable public ground-truth reporting.
7. **Statutory SC/ST Allocation Violations:** Continuous mathematical quota monitoring ($15\%$ SC, $7.5\%$ ST per MoSPI Clause 2.5) paired with an automated "Quota Parity Freeze" on general funds.
8. **Funneling Funds to Private Trusts:** Matches NGO board members against MP Election Commission Form 26 Affidavits and enforces the lifetime ₹50 Lakh trust cap.
9. **Unchecked Subcontracting & Front Companies:** Audits winning contractor EPFO/BOCW active labor muster rolls, checks GST e-Way bill consignee names, and monitors PFMS Single Nodal Agency (SNA) 72-hour fund outflow velocities.

---

## 6. The API Microservice Specification

```
[ Client Request ] ➔ [ GZip Middleware ] ➔ [ Cache-Control Injector ] ➔ [ APIRouter ] ➔ [ SQLAlchemy ORM ]
```

### 6.1 Complete Endpoint Directory
* **National Surveillance:**
  * `GET /api/national/summary`: Total Outlay (₹11,682 Cr), Disbursed (₹3,964 Cr), Queue (40,233), Gap (39.8%), Rate (33.9%).
  * `GET /api/national/analytics`: Sectoral distribution (Roads: 32.6%, Lighting: 11.9%, Halls: 7.9%) and multi-year expenditure curves.
* **State & UT Governance:**
  * `GET /api/states`: All 36 States/UTs ranked by allocation and expenditure velocity.
  * `GET /api/states/{state}`: State-specific dossier detailing district distribution and MP participation.
* **District Administration:**
  * `GET /api/districts/{district}`: District Collectorate workbench showing sanctioned portfolio, IDA agency split, and local works ledger.
* **Parliamentary Oversight:**
  * `GET /api/mps`: 774 MPs across Lok Sabha (18th House) and Rajya Sabha.
  * `GET /api/mps/{mp_id}`: MP-specific financial ledger and recommendation history.
* **Forensic Auditing:**
  * `GET /api/flags`: Paginated anomaly records (50/page) supporting text search (`q`), state, tier (`red`/`amber`), and detector filters.
  * `GET /api/flags/{work_id}`: Comprehensive evidence dossier with CPWD DSR rate calculations.
  * `GET /api/entity-risks`: Institutional risk indices for IDAs and MPs.
* **Spatial & Access Control:**
  * `GET /api/map/pcs` & `GET /api/map/districts`: GeoJSON geometry layers with embedded financial absorption telemetry.
  * `GET /api/roles/me` & `POST /api/roles/switch`: Server-side RBAC session state management.
  * `GET /api/meta/detectors`: Diagnostic metadata catalog for detectors D1–D15.

---

## 7. Frontend User Experience & Role-Based Access Control

### 7.1 Multi-Role Security Model
SATARK provides tailored user interfaces based on administrative clearance:
1. **Public Citizen (`public_citizen`):** Open transparency interface, national summaries, state rankings, and read-only anomaly disclosures.
2. **District Authority (`district_authority`):** District Planning Officer (DPO) and Collector console with operational approval queues, sanction velocity dials, and agency assignment ledgers.
3. **State Nodal Officer (`state_nodal_officer`):** Cross-district allocation manager monitoring statewide utilization parity.
4. **Auditor (`auditor`):** CAG & MoSPI vigilance officer console granting access to raw forensic evidence dossiers, statutory citations, and audit trail sign-offs.

---

## 8. Deployment & Operational Telemetry

* **Edge CDN Caching:** Vercel Global Edge caches public analytical endpoints with HTTP headers:
  `Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`
* **Performance SLAs:**
  * Cold Start API Response: $<250\text{ms}$
  * Edge Cached Query Response: $<45\text{ms}$
  * Table Pagination Latency: $<60\text{ms}$
  * GIS Map Initialization: $<1.2\text{s}$ (utilizing compressed GeoJSON layers)
* **High Availability & Fallback:** Client-side fallback snapshots (`defaultData.ts`) and session storage caching ensure uninterrupted operation during presentation evaluations.

---
*SATARK-MPLADS Official System Specification • Prepared for National Level Hackathon Presentation & Technical Audit.*
