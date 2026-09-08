"""Facade — preserves `from app.api.routes.updates import router` after split.

Split per SRP (§3.1): check (version-gated) + latest (Tauri+Android manifests).
"""

from fastapi import APIRouter

from .check import router as check_router
from .latest import router as latest_router

router = APIRouter()
router.include_router(check_router)
router.include_router(latest_router)

__all__ = ["router"]
