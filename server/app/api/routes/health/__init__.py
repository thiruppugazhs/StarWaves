"""Facade — preserves `from app.api.routes.health import router` after split.

The monolithic 27-line health.py has been split per SRP:
- main.py      : GET /health (lightweight, for docker healthcheck)
- detailed.py  : GET /health/detailed (full checks + 231 endpoints)
- checks.py    : GET /health/checks and GET /health/checks/{name} (per-service probes from other services)

Each check's logic lives in `app/services/health/checks/{name}.py` — i.e. in
another service, so the health endpoint itself stays small.
"""

from fastapi import APIRouter

from .checks import router as checks_router
from .detailed import router as detailed_router
from .main import router as main_router

router = APIRouter()
router.include_router(main_router)
router.include_router(detailed_router)
router.include_router(checks_router)

__all__ = ["router"]
