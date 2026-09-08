"""Health aggregator — composes per-service checks from other services."""

import asyncio
import logging
import time
from datetime import datetime, timezone

from app.services.health.checks import check_cache, check_database, check_whatsapp_worker, check_workspace_storage
from app.services.health.constants import _START_TS, elapsed_ms
from app.services.health.endpoints import collect_endpoints

logger = logging.getLogger(__name__)


async def collect_health(app=None, detailed: bool = True) -> dict:
    """Run all probes concurrently and build the health payload."""
    t0 = time.monotonic()
    results = await asyncio.gather(
        check_database(),
        check_cache(),
        check_whatsapp_worker(),
        check_workspace_storage(),
        return_exceptions=False,
    )
    db, redis_stat, whatsapp, workspace = results

    if db["status"] == "error":
        overall = "error"
    elif db["status"] == "degraded":
        overall = "degraded"
    else:
        overall = "ok"

    checks = {
        "database": db,
        "cache": redis_stat,
        "whatsapp_worker": whatsapp,
        "workspace_storage": workspace,
    }

    endpoints = collect_endpoints(app) if (app is not None and detailed) else None
    if not detailed and endpoints is not None:
        endpoints = None

    uptime = time.monotonic() - _START_TS
    timestamp = datetime.now(timezone.utc).isoformat()

    logger.info(
        "health detailed: status=%s db=%s/%sms redis=%s whatsapp=%s workspace=%s endpoints=%s uptime=%.1fs",
        overall,
        db["status"],
        db.get("latency_ms"),
        redis_stat["status"],
        whatsapp["status"],
        workspace["status"],
        len(endpoints) if endpoints is not None else "?",
        uptime,
    )
    for name, stat in checks.items():
        logger.debug("health[%s]=%s %sms detail=%s", name, stat["status"], stat.get("latency_ms"), stat.get("detail"))

    from app.core.config import settings

    summary = f"{overall}: db={db['status']} cache={redis_stat['status']} whatsapp={whatsapp['status']} workspace={workspace['status']}"
    payload: dict = {
        "status": overall,
        "service": settings.app_name,
        "environment": settings.app_env,
        "version": "0.1.0",
        "uptime_seconds": round(uptime, 1),
        "timestamp": timestamp,
        "checks": checks,
        "summary": summary,
        "took_ms": elapsed_ms(t0),
    }
    if detailed:
        payload["endpoints"] = endpoints
        payload["endpoint_count"] = len(endpoints) if endpoints else 0
    else:
        payload["endpoint_count"] = len(collect_endpoints(app) if app else []) if app else None
    return payload


async def collect_checks() -> dict[str, dict]:
    """Return all per-service checks without endpoint inventory — for /health/checks."""
    results = await asyncio.gather(
        check_database(),
        check_cache(),
        check_whatsapp_worker(),
        check_workspace_storage(),
        return_exceptions=False,
    )
    db, redis_stat, whatsapp, workspace = results
    return {
        "database": db,
        "cache": redis_stat,
        "whatsapp_worker": whatsapp,
        "workspace_storage": workspace,
    }


async def get_check(name: str) -> dict | None:
    mapping = {
        "database": check_database,
        "cache": check_cache,
        "whatsapp": check_whatsapp_worker,
        "whatsapp_worker": check_whatsapp_worker,
        "workspace": check_workspace_storage,
        "workspace_storage": check_workspace_storage,
    }
    fn = mapping.get(name)
    if not fn:
        return None
    return await fn()
