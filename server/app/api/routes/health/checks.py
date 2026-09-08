"""Per-service probes — each check lives in its own service (other service), routed here."""

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.health import DependencyStatus

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health/checks", response_model=dict[str, DependencyStatus])
async def list_checks() -> dict[str, DependencyStatus]:
    from app.services.health import collect_checks

    result = await collect_checks()
    logger.info("GET /api/v1/health/checks -> %s", {k: v["status"] for k, v in result.items()})
    return {k: DependencyStatus(**v) for k, v in result.items()}


@router.get("/health/checks/{name}", response_model=DependencyStatus)
async def get_single_check(name: str) -> DependencyStatus:
    from app.services.health import get_check

    data = await get_check(name)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Unknown check '{name}'. Use database, cache, whatsapp, workspace.")
    logger.info("GET /api/v1/health/checks/%s -> %s", name, data["status"])
    return DependencyStatus(**data)
