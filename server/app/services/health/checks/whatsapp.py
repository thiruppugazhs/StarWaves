"""WhatsApp worker probe — lives next to the whatsapp service, not the health aggregator."""

import time

from app.services.health.constants import elapsed_ms


async def check_whatsapp_worker() -> dict:
    t0 = time.monotonic()
    try:
        from app.core.config import settings
        from app.core.http import create_async_client

        url = (settings.whatsapp_gateway_url or "http://whatsapp-worker:3001").rstrip("/") + "/health"
        async with create_async_client(timeout=2.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return {"status": "ok", "latency_ms": elapsed_ms(t0), "detail": f"whatsapp-worker {url} 200"}
            return {"status": "degraded", "latency_ms": elapsed_ms(t0), "detail": f"whatsapp-worker {url} {resp.status_code}"}
    except Exception as exc:
        return {"status": "degraded", "latency_ms": elapsed_ms(t0), "detail": f"whatsapp-worker unreachable: {exc}"}
