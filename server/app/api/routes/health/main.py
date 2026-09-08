"""Lightweight liveness — fast path for docker healthcheck (no 20KB endpoint list)."""

import logging

from fastapi import APIRouter, Request

from app.schemas.health import HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    """Liveness probe — timed checks for DB/cache/whatsapp/workspace, no endpoint inventory."""
    from app.services.health import collect_health

    payload = await collect_health(app=request.app, detailed=False)
    logger.info("GET /api/v1/health -> %s (%s)", payload["status"], payload["summary"])
    return HealthResponse(**payload)
