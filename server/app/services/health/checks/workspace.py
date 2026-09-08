"""Workspace storage probe — isolated so health stays under 400 lines."""

import time
import os
import tempfile

from app.services.health.constants import elapsed_ms


async def check_workspace_storage() -> dict:
    t0 = time.monotonic()
    try:
        from app.core.config import settings

        base = settings.workspace_storage_path
        os.makedirs(base, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=base, delete=True) as tf:
            tf.write(b"health")
            tf.flush()
        return {"status": "ok", "latency_ms": elapsed_ms(t0), "detail": f"workspace storage writable: {base}"}
    except Exception as exc:
        return {"status": "degraded", "latency_ms": elapsed_ms(t0), "detail": f"workspace storage error: {exc}"}
