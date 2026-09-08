"""GET /updates/check — platform-aware version gate.

Public, no auth. Query: platform {windows,android,linux,macos}, currentVersion, arch.
Compares against file-based manifests (latest.json / android.json).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.schemas.updates import UpdateCheckResponse
from app.services.updates import is_newer, load_android_manifest, load_tauri_manifest

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/check", response_model=UpdateCheckResponse)
async def check_update(
    platform: str = Query(..., description="Target platform", pattern="^(windows|android|linux|macos)$"),
    currentVersion: str = Query(..., alias="currentVersion", description="Caller version e.g. 0.1.0"),
    arch: str | None = Query(None, description="Arch e.g. x64, arm64"),
) -> UpdateCheckResponse | JSONResponse:
    p = (platform or "").lower()
    current = (currentVersion or "").strip()
    if not current:
        return JSONResponse(status_code=400, content={"detail": "currentVersion is required"})
    # Per platform manifest
    if p == "android":
        mf = load_android_manifest()
        if not mf:
            return UpdateCheckResponse(
                updateAvailable=False,
                latestVersion=current,
                currentVersion=current,
                platform=p,
                arch=arch,
                notes=None,
            )
        latest = (mf.get("latestVersion") or mf.get("version") or current).strip()
        available = is_newer(latest, current)
        return UpdateCheckResponse(
            updateAvailable=available,
            latestVersion=latest,
            currentVersion=current,
            url=mf.get("url"),
            notes=mf.get("notes"),
            force=bool(mf.get("force", False)),
            sha256=mf.get("sha256"),
            size=mf.get("size"),
            publishedAt=mf.get("publishedAt") or mf.get("pub_date"),
            platform=p,
            arch=arch,
        )
    # windows/linux/macos → Tauri latest.json
    mf = load_tauri_manifest()
    if not mf:
        return UpdateCheckResponse(
            updateAvailable=False,
            latestVersion=current,
            currentVersion=current,
            platform=p,
            arch=arch,
        )
    latest = (mf.get("version") or current).strip()
    available = is_newer(latest, current)
    # Resolve platform key: tauri uses windows-x86_64 etc.
    key = None
    platforms = mf.get("platforms") or {}
    # Try exact then fallback
    candidates = []
    if arch:
        candidates.append(f"{p}-{arch}")
        candidates.append(f"{p}-{arch.replace('x64','x86_64')}")
    candidates += [f"{p}-x86_64", f"{p}-aarch64", p, "windows-x86_64"]
    for c in candidates:
        if c in platforms:
            key = c
            break
    entry = platforms.get(key) if key else None
    # If no arch-specific, take first platform as fallback
    if not entry and platforms:
        entry = next(iter(platforms.values()))
    url = entry.get("url") if isinstance(entry, dict) else None
    sig = entry.get("signature") if isinstance(entry, dict) else None
    return UpdateCheckResponse(
        updateAvailable=available,
        latestVersion=latest,
        currentVersion=current,
        url=url,
        notes=mf.get("notes"),
        force=False,
        signature=sig,
        publishedAt=mf.get("pub_date"),
        platform=p,
        arch=arch,
    )
