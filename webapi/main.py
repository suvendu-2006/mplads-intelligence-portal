from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from webapi.routers import (
    national, states, mps, flags, entity_risks, roles, meta, map, districts
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
import os

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

# Include API Routers under /api
app.include_router(national.router, prefix="/api", tags=["National"])
app.include_router(states.router, prefix="/api", tags=["States"])
app.include_router(mps.router, prefix="/api", tags=["MPs"])
app.include_router(flags.router, prefix="/api", tags=["Flags"])
app.include_router(entity_risks.router, prefix="/api", tags=["Entity Risks"])
app.include_router(roles.router, prefix="/api", tags=["Roles & RBAC"])
app.include_router(meta.router, prefix="/api", tags=["Metadata"])
app.include_router(map.router, prefix="/api", tags=["GIS Map"])
app.include_router(districts.router, prefix="/api", tags=["Districts"])

# Mount static frontend and SPA catch-all (lowest priority)
mount_static_files(app)
