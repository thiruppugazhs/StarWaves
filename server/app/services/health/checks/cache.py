"""Cache probe — redis PING with local fallback for e2-micro."""

import asyncio
import time

from app.services.health.constants import elapsed_ms


async def check_cache() -> dict:
    t0 = time.monotonic()
    try:
        from app.core.cache import _get_redis  # type: ignore

        client = _get_redis()
        if client is None:
            from app.core.config import settings

            if not getattr(settings, "redis_url", None):
                return {"status": "ok", "latency_ms": elapsed_ms(t0), "detail": "local in-memory cache (REDIS_URL not set)"}
            return {"status": "degraded", "latency_ms": elapsed_ms(t0), "detail": "redis fallback to local cache"}

        await asyncio.to_thread(client.ping)
        return {"status": "ok", "latency_ms": elapsed_ms(t0), "detail": "redis PING ok"}
    except Exception as exc:
        return {"status": "degraded", "latency_ms": elapsed_ms(t0), "detail": f"redis unavailable, fallback: {exc}"}
