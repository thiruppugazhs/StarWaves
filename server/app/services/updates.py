"""Backend-hosted updater service — file-based manifests under static/updates.

Design per ADR 0004: manifests are JSON files written by build scripts
to SERVER_STATIC_UPDATES_DIR (default server/static/updates). No DB,
no auth for reads. Semver comparison via lightweight parser to avoid
extra deps (packaging not required). OTA bundles are optional.

Manifests:
- latest.json (Tauri updater v1Compatible)
- android.json (custom)
- bundles/latest.json (OTA)
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

from app.core.config import settings

# Resolve updates dir: env UPDATES_DIR > WORKSPACE_STORAGE_PATH sibling > server/static/updates
_ENV_DIR = os.getenv("UPDATES_DIR") or os.getenv("STATIC_UPDATES_DIR")
if _ENV_DIR:
    UPDATES_DIR = Path(_ENV_DIR)
else:
    # Default: server/static/updates (repo-relative)
    UPDATES_DIR = Path(__file__).resolve().parents[2] / "static" / "updates"

# Allow override via settings if needed
try:
    _cfg_dir = getattr(settings, "updates_dir", None)
    if _cfg_dir:
        UPDATES_DIR = Path(_cfg_dir)
except Exception:
    pass


def _ensure_dir() -> None:
    try:
        UPDATES_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass


def _read_json(path: Path) -> dict | None:
    try:
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def load_tauri_manifest() -> dict | None:
    _ensure_dir()
    return _read_json(UPDATES_DIR / "latest.json")


def load_android_manifest() -> dict | None:
    _ensure_dir()
    return _read_json(UPDATES_DIR / "android.json")


def load_ota_manifest() -> dict | None:
    _ensure_dir()
    return _read_json(UPDATES_DIR / "bundles" / "latest.json")


def _parse_semver(v: str) -> tuple[int, ...]:
    """Coarse semver parser: splits on . - + and extracts leading ints.
    Handles 0.1.0, 0.1.0-beta, v0.1.0. Non-numeric suffix ignored for comparison.
    """
    s = (v or "").strip().lstrip("vV")
    # keep only numeric dot parts before -/+
    s = re.split(r"[-+]", s, maxsplit=1)[0]
    parts: list[int] = []
    for p in s.split("."):
        m = re.match(r"(\d+)", p)
        parts.append(int(m.group(1)) if m else 0)
    # pad to 3
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts)


def is_newer(latest: str, current: str) -> bool:
    try:
        return _parse_semver(latest) > _parse_semver(current)
    except Exception:
        return latest.strip() != current.strip()


def _public_base_url() -> str:
    # Prefer API_BASE_URL or FRONTEND_URL host; fallback to relative /updates
    base = os.getenv("API_BASE_URL") or os.getenv("PUBLIC_UPDATES_BASE_URL") or ""
    if base:
        base = base.rstrip("/")
        # API_BASE_URL is like https://api.starwaves.susindran.in
        # Ensure we use /updates or /api/v1/updates/latest.json already handled via route,
        # but for artifact URLs we return absolute https://host/updates/<file>
        # If base already includes /api/v1, strip it for static alias
        if base.endswith("/api/v1"):
            base = base[: -len("/api/v1")]
        return base
    # Fallback: use FRONTEND_URL host if it is not localhost
    front = getattr(settings, "frontend_url", "") or ""
    if front and "localhost" not in front and "127.0.0.1" not in front:
        return front.rstrip("/")
    return ""


def absolute_updates_url(filename: str) -> str:
    base = _public_base_url()
    if base:
        return f"{base}/updates/{filename.lstrip('/')}"
    return f"/updates/{filename.lstrip('/')}"
