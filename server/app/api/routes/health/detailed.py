"""Full inventory — checks + 231 endpoints, for dashboards and ops tail."""

import logging

from fastapi import APIRouter, Request

from app.schemas.health import HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health/detailed", response_model=HealthResponse)
async def detailed_health(request: Request) -> HealthResponse:
    from app.services.health import collect_health

    payload = await collect_health(app=request.app, detailed=True)
    logger.info("GET /api/v1/health/detailed -> %s (%s) endpoints=%s", payload["status"], payload["summary"], payload.get("endpoint_count"))
    return HealthResponse(**payload)
