from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

BASE_WEB_DIR = Path(__file__).resolve().parent.parent / "web"
DIST_DIR = BASE_WEB_DIR / "dist"

def mount_static_files(app: FastAPI):
    effective_dist = DIST_DIR if DIST_DIR.exists() else (BASE_WEB_DIR if (BASE_WEB_DIR / "index.html").exists() else None)

    if effective_dist is None:
        # In dev mode before frontend build
        @app.get("/")
        async def dev_root():
            return JSONResponse({
                "service": "MPLADS National Intelligence & Forensic Web API",
                "status": "Running (Dev Mode)",
                "docs_url": "/docs",
                "message": "Frontend dev server runs at http://localhost:5173. For production bundle, run: npm run build"
            })
        return

    assets_dir = effective_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # Catch-all for SPA client-side routing
    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def serve_spa(full_path: str):
        # Allow API calls to pass through without interception
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        
        index_file = effective_dist / "index.html"
        if index_file.exists():
            headers = {
                "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
            }
            return FileResponse(str(index_file), headers=headers)
        return JSONResponse(
            status_code=503,
            content={"error": "Frontend build not found. Please execute: npm run build"}
        )
