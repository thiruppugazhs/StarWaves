"""GET /updates/latest.json + /android.json + OTA passthrough.

Public, no auth. Serves file-based manifests with Cache-Control.
Tauri updater expects GET /api/v1/updates/latest.json exactly.
"""

import json
import logging
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse

from app.services.updates import UPDATES_DIR, load_android_manifest, load_ota_manifest, load_tauri_manifest

logger = logging.getLogger(__name__)

router = APIRouter()


def _latest_path() -> Path:
    return UPDATES_DIR / "latest.json"


def _android_path() -> Path:
    return UPDATES_DIR / "android.json"


@router.get("/latest.json")
async def get_tauri_latest():
    mf = load_tauri_manifest()
    if not mf:
        return JSONResponse(status_code=404, content={"detail": "No desktop release published"})
    # Serve with cache headers; also ensure JSON is valid
    path = _latest_path()
    if path.exists():
        return FileResponse(
            path,
            media_type="application/json",
            headers={"Cache-Control": "public, max-age=300"},
        )
    return JSONResponse(content=mf, headers={"Cache-Control": "public, max-age=300"})


@router.get("/android.json")
async def get_android_latest():
    mf = load_android_manifest()
    if not mf:
        return JSONResponse(status_code=404, content={"detail": "No Android release published"})
    path = _android_path()
    if path.exists():
        return FileResponse(path, media_type="application/json", headers={"Cache-Control": "public, max-age=300"})
    return JSONResponse(content=mf, headers={"Cache-Control": "public, max-age=300"})


@router.get("/ota/latest.json")
async def get_ota_latest():
    mf = load_ota_manifest()
    if not mf:
        return JSONResponse(status_code=404, content={"detail": "No OTA bundle published"})
    return JSONResponse(content=mf, headers={"Cache-Control": "public, max-age=120"})


@router.get("/ota/{bundle_id}")
async def get_ota_bundle(bundle_id: str):
    bundles_dir = UPDATES_DIR / "bundles"
    # Sanitize bundle_id
    safe = "".join(c for c in bundle_id if c.isalnum() or c in "-_.")
    path = bundles_dir / safe
    # If safe lacks extension, try .zip
    if not path.exists() and not safe.endswith(".zip"):
        path = bundles_dir / f"{safe}.zip"
    if not path.exists() or not path.is_file():
        return JSONResponse(status_code=404, content={"detail": "Bundle not found"})
    # Prevent path traversal
    try:
        path.resolve().relative_to(bundles_dir.resolve())
    except Exception:
        return JSONResponse(status_code=404, content={"detail": "Bundle not found"})
    return FileResponse(path, media_type="application/zip", headers={"Cache-Control": "public, max-age=3600"})
