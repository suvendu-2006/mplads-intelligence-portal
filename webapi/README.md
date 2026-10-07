# SATARK High-Performance REST API (`webapi`)

The `webapi` package delivers an enterprise-grade, asynchronous REST API powered by **FastAPI**. It serves forensic intelligence, real-time audit leads, geospatial boundaries, and administrative analytics to the React frontend, Streamlit workbench, and external surveillance systems.

The API is engineered for ultra-low latency (<50ms for complex queries) through aggressive memory-mapped caching, SQLite WAL connection tuning, and precomputed analytical materialized views.

---

## 🚀 Directory Structure & Components

```
webapi/
├── routers/                    # Domain-Specific REST Endpoint Routers
│   ├── national.py             # /api/national — National overview, sector share, and trends
│   ├── states.py               # /api/states — 36 States/UTs summaries and district cards
│   ├── mps.py                  # /api/mps — 788 Lok Sabha & Rajya Sabha MP dossiers & search
│   ├── districts.py            # /api/districts — 735 Nodal Districts, IDA profiles, and works
│   ├── constituencies.py       # /api/constituencies — 543 Parliamentary Constituencies & AC mapping
│   ├── flags.py                # /api/flags — Forensic red flags, detector filters, and CSV export
│   ├── entity_risks.py         # /api/entity-risks — Empirical Bayes risk indices (Districts & MPs)
│   ├── map.py                  # /api/map — Optimized GeoJSON vector layers for GIS Choropleths
│   ├── roles.py                # /api/roles — RBAC simulation & multi-role console authentication
│   └── meta.py                 # /api/meta — System health check, DB stats, and audit timestamp
│
├── services/                   # Business Logic & Data Lookup Services
│   └── assembly_service.py     # Assembly Constituency (AC) to Parliamentary Constituency (PC) resolver
│
├── aggregators.py              # In-Memory TTL Aggregation Caches (<50ms response latency)
├── config.py                   # Environment setup, DB candidate discovery & detector maps
├── data_service.py             # Optimized DB session providers, CSV fallback loaders & WAL tuning
├── export.py                   # High-throughput streaming CSV / Excel audit export generators
├── models.py                   # Pydantic serialization models & query schemas
├── auth_demo.py                # Interactive RBAC session management & credential verification
├── precomputed_data.py         # In-memory datasets for zero-disk cold start resilience
├── static_serve.py             # SPA fallback routing for production frontend assets (`web/dist/`)
└── main.py                     # ASGI entrypoint, CORS configuration & startup cache warmups
```

---

## 📡 REST API Endpoint Reference

| Endpoint | Method | Description | Cache Strategy |
|:---|:---|:---|:---|
| `/api/meta/health` | `GET` | System health check, DB connectivity, and version metadata. | Uncached |
| `/api/national/overview` | `GET` | National cumulative totals (₹14,700+ Cr, 56,800+ works). | 1-Hour TTL |
| `/api/national/analytics` | `GET` | Sectoral breakdown (6 canonical sectors) and historical trends. | 1-Hour TTL |
| `/api/states` | `GET` | List all 36 States and Union Territories with fund utilization rates. | 30-Min TTL |
| `/api/states/{name}` | `GET` | Granular state detail: nodal districts, active MPs, and anomaly counts. | 15-Min TTL |
| `/api/mps` | `GET` | Directory of 788 MPs with filters for House, State, Party, and status. | In-Memory Cached |
| `/api/mps/{id}` | `GET` | Full MP dossier: financial utilization, works breakdown, ADR profile. | In-Memory Cached |
| `/api/districts` | `GET` | Directory of 735 Nodal Districts with pagination and search. | In-Memory Cached |
| `/api/districts/{name}` | `GET` | District dashboard: completed vs recommended works, IDA profile, flags. | In-Memory Cached |
| `/api/constituencies/{name}` | `GET` | Parliamentary Constituency detail, MP assignment, and AC boundaries. | In-Memory Cached |
| `/api/flags` | `GET` | Paginated forensic red flags filterable by D1–D15, tier, state, and IDA. | Fast Index Query |
| `/api/flags/export` | `GET` | High-throughput streaming CSV export for field auditor spreadsheets. | Streaming Response |
| `/api/map/layers` | `GET` | Metadata and boundary bounding boxes for GIS map visualization. | In-Memory Cached |
| `/api/roles/switch` | `POST` | Simulates role transitions (State Nodal, District Collector, Auditor). | Session State |

---

## 🛠️ Local Development & Execution

```bash
# 1. Activate Python virtual environment
source .venv/bin/activate

# 2. Launch FastAPI with hot-reload
uvicorn webapi.main:app --host 0.0.0.0 --port 8000 --reload

# 3. Access Swagger UI & OpenAPI Specification
# Interactive Documentation: http://localhost:8000/docs
# OpenAPI JSON Specification: http://localhost:8000/openapi.json
```
