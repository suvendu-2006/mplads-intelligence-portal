# SATARK — MPLADS Public Fund Tracking & Audit Portal

SATARK helps citizens, journalists, researchers, and government auditors see how **MPLADS** (Members of Parliament Local Area Development Scheme) money is spent across India.

Every Member of Parliament receives annual public funds to build schools, roads, drinking water facilities, community halls, and health infrastructure in their area. This project brings official spending records together in one searchable website and automatically flags unusual spending patterns for human review.

---

## What This Project Covers

- **36** States and Union Territories
- **788** Members of Parliament (543 Lok Sabha and 245 Rajya Sabha)
- **735** Nodal Districts
- **4,130** Vidhan Sabha (Assembly) Segments
- **56,898** detailed public works records
- **₹11,764+ Crore** in tracked public allocations

---

## What You Can Do on the Portal

- **National, State, and District Views:** Track total funds allocated, money spent, unspent balance, and project completion rates anywhere in India.
- **MP and Constituency Profiles:** Open any Member of Parliament or Parliamentary Constituency to inspect every sanctioned and completed project, implementing agency, and cost breakdown.
- **Vidhan Sabha Segment Filtering:** Inside any Constituency, MP, or District page, click a Vidhan Sabha segment pill to see only works in that assembly area. Works without a specific locality tag in official records are grouped clearly under **District-Wide / Unspecified** so counts always add up to 100%.
- **Automated Audit Alerts (15 Checks):** Spot duplicate projects, unusually high project costs, year-end spending spikes, chronic delays, or vague descriptions.
- **Interactive India Map:** Explore spending and completion metrics visually across states, districts, and constituencies.
- **Multi-Language & Role Views:** Switch between English and Indian regional languages, or preview how the dashboard appears to citizens, District Authorities, State Nodal Officers, and MoSPI officials.

---

## How the 15 Audit Checks Work

Automated checks scan public works records to highlight cases worth checking by a human auditor. An alert is a review lead, not proof of wrongdoing.

| Check | Name | What It Looks For |
| :--- | :--- | :--- |
| D1 | Unusual Pattern Check | Projects whose cost, timeline, and payment values stand out sharply from similar works. |
| D2 | Duplicate Work Check | Similar or identical work descriptions funded more than once. |
| D3 | Cost Overrun Check | Sanctioned costs that are much higher than standard CPWD government engineering rates. |
| D4 | Missing Payment Check | Projects marked completed without matching disbursement records. |
| D5 | Split Project Check | Multiple smaller sanctions placed just below approval cost thresholds. |
| D6 | Execution Delay Check | Projects that remain incomplete well past standard completion timelines. |
| D7 | Year-End Rush Check | Large clusters of approvals rushed through in the final week of March. |
| D8 | Bulk Certification Check | Many major works signed off on the exact same calendar day. |
| D9 | Number Pattern Check | Unusual digit patterns or overly rounded estimates in cost figures. |
| D10 | Vague Description Check | Short or unclear project descriptions missing location, unit, or asset details. |
| D11 | Cost-Size Sanity Check | Costs that do not fit the type of asset (for example, an unusually expensive small fixture). |
| D12 | Missing Document Check | Completed projects missing measurement books or verification records. |
| D13 | Agency Risk Summary | High alert concentration at a specific implementing agency or collectorate. |
| D14 | Spending Concentration | Heavy skew toward a single category or narrow pattern in an MP portfolio. |
| D15 | Repeated Exact Pricing | Different projects sanctioned for the exact same rupee amount repeatedly. |

---

## Project Structure

```text
SIH-DATA/
├── web/                    Frontend website built with React, TypeScript, and Vite
├── webapi/                 Backend REST API built with FastAPI
├── mplads_fraud_detection/ Core audit engine, 15 detectors, database models, and access control
├── api/                    Serverless entrypoint and compressed SQLite database image
├── data/                   Official MoSPI summaries, spatial boundaries, and sub-district maps
├── scripts/                Data sync, boundary processing, and database build scripts
├── tests/                  Automated tests and 16-gate production verification script
├── docs/                   Setup guides, user manuals, audit protocol, and ethics policy
└── app.py                  Optional Streamlit investigator workbench
```

For deeper technical notes in specific areas, see:
- [Frontend Guide](web/README.md)
- [Backend API Guide](webapi/README.md)
- [Audit Engine Guide](mplads_fraud_detection/README.md)
- [Dataset Documentation](data/README.md)
- [Documentation Index](docs/README.md)

---

## How to Run Locally

### Requirements
- **Python** 3.11 or 3.12
- **Node.js** 18 or higher

### 1. Download the repository and set up Python
```bash
git clone https://github.com/suvendu-2006/mplads-intelligence-portal.git
cd mplads-intelligence-portal

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Unpack the local database (needed on a fresh clone)
The repository stores the SQLite database in compressed form so it stays lightweight on GitHub. Unpack it once before starting the backend:
```bash
gzip -dc api/mplads_dev.db.gz > mplads_dev.db
```

### 3. Start the Backend API
```bash
uvicorn webapi.main:app --host 127.0.0.1 --port 8000 --reload
```
- API health check: `http://127.0.0.1:8000/api/meta/health`
- Interactive API docs: `http://127.0.0.1:8000/docs`

### 4. Start the Website
Open a second terminal in the project folder:
```bash
cd web
npm install
npm run dev
```
- Open `http://127.0.0.1:5173` in your browser.

### Optional: Docker or Streamlit
- **Run everything with Docker:** `docker compose up -d --build`
- **Run Streamlit workbench:** `streamlit run app.py` (opens at `http://localhost:8501`)

---

## Running Tests

```bash
# Run automated backend, API, and nationwide segment checks
pytest -v tests/ -m "not slow"

# Run the 16-gate security and data integrity checklist
bash tests/acceptance_tests.sh

# Check and build the frontend
cd web && npx tsc --noEmit && npm run build
```

---

## How the System Works (Architecture)

Everything in SATARK is organized so that non-technical visitors get fast answers while auditors and engineers can trace every number back to its source. Below is the full architecture, ordered from the parts users see first down to the data pipelines and servers running behind the scenes.

### High-Level Flow (5 Steps)

1. **Public Portal (`web/`)** — Citizens and auditors open the React web app, search any State, District, Constituency, MP, or Vidhan Sabha segment, and explore charts, maps, and work ledgers.
2. **FastAPI & Edge Layer (`webapi/`, `api/index.py`, `vercel.json`)** — Requests hit cached FastAPI endpoints. In serverless production, compressed data unpacks into memory/temporary storage in milliseconds while edge headers serve repeat reads quickly.
3. **Assembly Segment Resolver (`webapi/services/assembly_segment_resolver.py`)** — Works in a district or parliamentary constituency are deterministically sorted into their Vidhan Sabha segments (or `District-Wide / Unspecified`) using explicit labels and verified sub-district maps.
4. **Audit Engine & Access Control (`mplads_fraud_detection/`)** — Fifteen statutory checks (D1–D15) scan project records, score agency and portfolio risk, enforce role-based access control, and route findings through a dual-review queue.
5. **Data Storage & Pipelines (`scripts/`, `data/`, `mplads_dev.db`, `migrations/`)** — Official MoSPI/e-SAKSHI records, ADR affidavits, CPWD engineering benchmarks, and ECI boundary files are cleaned, verified, and stored in SQLite (local/edge) or PostgreSQL (production).

### Layer-by-Layer Breakdown

#### 1. User Interface Layer (`web/` and `app.py`)
- **React Web Portal (`web/`):** Built with React 19, TypeScript, Vite, Tailwind CSS, Recharts, and Leaflet. National, state, and MP summary chunks are bundled for quick opening, while interactive tabs let users filter projects by status, implementing agency, search keywords, and Vidhan Sabha assembly segment. Multi-language support (`web/src/lib/i18n.ts`) renders numbers and labels across English and Indian regional languages.
- **Investigator Workbench (`app.py`):** An optional Streamlit console tailored for internal audit analysts who want tabular exploration and direct pipeline triggers.

#### 2. API, Caching & Edge Delivery (`webapi/`, `api/index.py`, `vercel.json`)
- **FastAPI Routers (`webapi/routers/`):** Dedicated routes power national overviews (`/api/national`), state and district summaries (`/api/states`, `/api/districts`), parliamentary constituencies (`/api/constituencies`), MPs (`/api/mps`), audit alerts (`/api/flags`), GIS map overlays (`/api/map`), and role switching (`/api/roles`).
- **Startup Warmup & Caching (`webapi/aggregators.py`, `webapi/data_service.py`):** Pre-loads CSV summaries and warms database aggregates at startup so dashboard endpoints respond without scanning full tables on every click.
- **Serverless Edge Deployment (`api/index.py`, `vercel.json`):** On Vercel, `api/index.py` unpacks the compressed database image (`api/mplads_dev.db.gz`) into `/tmp/mplads_dev.db` on cold start and exposes the ASGI app, while `vercel.json` configures static asset caching and CDN `stale-while-revalidate` headers on read-only API routes.

#### 3. Deterministic Vidhan Sabha Partitioning (`webapi/services/assembly_segment_resolver.py`, `webapi/services/assembly_service.py`)
- **Canonical ECI Mapping (`assembly_constituencies_enriched.csv`):** Links all 4,130 Vidhan Sabha assembly constituencies to their parent Lok Sabha parliamentary constituencies and districts, including repaired boundary spellings and state-scoped disambiguation for shared constituency names (such as Aurangabad, Hamirpur, and Maharajganj).
- **Four-Tier Matching Engine:** Every public work is assigned to strictly one canonical assembly segment (or **District-Wide / Unspecified**) without double-counting or guessing:
  1. Explicit Vidhan Sabha / Assembly mentions in the project description (ignoring Lok Sabha references).
  2. Verified sub-district lookup (`subdistrict_ac_map.json`, covering blocks, mandals, talukas, tehsils, municipalities, and panchayat samitis across 154 constituencies in 20 states).
  3. Word-boundary and Indian spelling-variant matching (`-a`/`-am`, `-i`/`-e`, `Cantt`/`Cantonment`) with strict guards so generic district-headquarters names never swallow rural projects.
  4. Single-segment district disambiguation for multi-district constituencies, plus safe extraction from sub-district implementing agencies (municipalities, cantonments, BDOs).

#### 4. Forensic Audit Engine, Governance & Security (`mplads_fraud_detection/`)
- **15 Rule-Based Detectors (`mplads_fraud_detection/detectors/`):** Screen works for outliers, TF-IDF description duplicates, CPWD benchmark cost overruns, missing disbursements, threshold splitting, delays, March budget rushes, bulk sign-offs, Benford digit anomalies, vague descriptions, plausibility errors, documentary gaps, and repeated pricing.
- **Role-Based Access Control & Dual Review (`auth/`, `review_queue/`):** Protects audit actions across Viewer, Analyst, Field Auditor, Senior Reviewer, District/State Nodal Officer, and Admin roles. Confirmed fraud labels require stored document evidence, SHA-256 checksum verification, and two-person approval.
- **ML Quarantine Policy (`models/`, `features/`, `monitoring/`):** Experimental machine-learning training scripts are gated behind administrative review controls until sufficient verified human audit labels exist; production triage relies strictly on deterministic statutory rules.

#### 5. Data Ingestion, Boundaries & Database (`scripts/`, `data/`, `migrations/`, `Dockerfile`)
- **Ingestion & Boundary Scripts (`scripts/`):** Sync official MoSPI e-SAKSHI datasets, clean implementing agency names, compute CPWD unit benchmarks, and parse ECI spatial boundaries (`India_AC.dbf`) into synchronized CSV, SQLite, and frontend lookup modules.
- **Database & Migrations (`mplads_fraud_detection/foundation/`, `migrations/`):** Uses SQLAlchemy models (`Work`, `Anomaly`, `EntityRisk`, `PipelineRun`, `FraudLabel`, `AuditLog`) with SQLite WAL mode for local/serverless runs, PostgreSQL with TLS enforcement (`sslmode=require`) for production deployments, and idempotent Alembic migrations.
- **Container & CI Verification (`Dockerfile`, `docker-compose.yml`, `tests/acceptance_tests.sh`):** Automated CI runs unit/API tests, nationwide segment partition sweeps, and the 16-gate acceptance suite covering security, data reconciliation, anti-synthetic guarantees, and ML quarantine.

---

## Fairness & Data Sources

- **Non-Discrimination Guarantee:** Personal and political details (political party, religion, caste, gender, and age) are strictly excluded from every audit check and scoring rule.
- **Human Review First:** Alerts only prioritize records for inspection; official action requires physical verification and dual human sign-off.
- **Official Data Sources:** Ministry of Statistics & Programme Implementation (MoSPI / e-SAKSHI), DataMeet open boundary maps, and Association for Democratic Reforms (ADR) public affidavits.
- **License:** Released under the [MIT License](LICENSE).
