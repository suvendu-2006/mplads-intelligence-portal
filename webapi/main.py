import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from webapi.routers import (
    national, states, mps, flags, entity_risks, roles, meta, map, districts, constituencies
)
from webapi.static_serve import mount_static_files
from webapi.data_service import load_national_csv, load_states_csv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("webapi")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing MPLADS National Intelligence API...")
    try:
        nat = load_national_csv()
        st_df = load_states_csv()
        nat_alloc = float(nat.get("totalAllocated", 0.0))
        st_alloc = float(st_df["totalAllocated"].sum())
        diff_pct = abs(nat_alloc - st_alloc) / nat_alloc * 100 if nat_alloc > 0 else 0
        logger.info(f"Data reconciliation: National Allocated=₹{nat_alloc:,.2f} vs States Sum=₹{st_alloc:,.2f} (Delta={diff_pct:.3f}%)")
        
        # Warmup cache for instant sub-50ms user experience
        from webapi.aggregators import compute_all_states_red_flag_pct, compute_all_mps_red_flag_pct
        from webapi.data_service import SessionLocal
        db = SessionLocal()
        try:
            compute_all_states_red_flag_pct(db)
            compute_all_mps_red_flag_pct(db)
        finally:
            db.close()
        from webapi.routers.national import get_national_analytics
        get_national_analytics()

        # In non-serverless local environments, pre-warmup GeoJSON as well
        if not os.getenv("VERCEL"):
            from webapi.routers.map import get_districts_geojson, get_pcs_geojson
            from starlette.requests import Request
            dummy_req = Request({"type": "http", "headers": [(b"accept-encoding", b"gzip")]})
            get_pcs_geojson(dummy_req)
            get_districts_geojson(dummy_req)
            logger.info("⚡ In-memory cache pre-warmed: all endpoints primed for <50ms latency!")
        else:
            logger.info("⚡ Vercel Serverless environment: rapid <1s startup active (GeoJSON served via Edge CDN)!")
    except Exception as e:
        logger.warning(f"Startup data check warning: {e}")
    yield

app = FastAPI(
    title="MPLADS National Intelligence & Forensic API",
    description="Unified API powering the national surveillance and forensic command center.",
    version="2.0.0",
    lifespan=lifespan
)

# Compression and CORS configuration
app.add_middleware(GZipMiddleware, minimum_size=1000)

from starlette.requests import Request

@app.middleware("http")
async def add_performance_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if request.method == "GET" and response.status_code == 200:
        if path.startswith("/api/"):
            # Check if this endpoint is role-scoped or sensitive
            is_role_scoped = (
                path.startswith("/api/my-state")
                or path.startswith("/api/roles")
                or path.startswith("/api/switch-role")
                or path.startswith("/api/review-queue")
            )
            if is_role_scoped:
                response.headers["Cache-Control"] = "private, no-store, no-cache, must-revalidate"
                response.headers["Vary"] = "x-role, x-state, x-district, x-mp-id, Authorization, Cookie"
            else:
                if not response.headers.get("Cache-Control"):
                    response.headers["Cache-Control"] = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
                # Retain edge caching while isolating per-role variants and content encoding
                existing_vary = response.headers.get("Vary")
                role_vary = "x-role, x-state, x-district, x-mp-id, Accept-Encoding"
                response.headers["Vary"] = f"{existing_vary}, {role_vary}" if existing_vary else role_vary
    elif request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        response.headers["Cache-Control"] = "private, no-store, no-cache, must-revalidate"
        response.headers["Vary"] = "x-role, x-state, x-district, x-mp-id, Authorization, Cookie"
    return response

allowed_origins = os.getenv(
    "MPLADS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:8000,http://127.0.0.1:5173,http://127.0.0.1:8000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount core API Routers under /api prefix
api_routers = [
    (national.router, "National"),
    (states.router, "States"),
    (mps.router, "MPs"),
    (flags.router, "Flags"),
    (entity_risks.router, "Entity Risks"),
    (roles.router, "Roles & RBAC"),
    (meta.router, "Metadata"),
    (map.router, "GIS Map"),
    (districts.router, "Districts"),
    (constituencies.router, "Constituencies"),
]
for router, tag in api_routers:
    app.include_router(router, prefix="/api", tags=[tag])

# Mount static frontend and SPA catch-all (lowest priority)
mount_static_files(app)
