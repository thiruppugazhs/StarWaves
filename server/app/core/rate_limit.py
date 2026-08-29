"""Lightweight rate-limit middleware — Redis token bucket with in-memory fallback.

No external dep (no slowapi). Tuned for e2-micro single worker.
"""
import time as _time
from collections import defaultdict, deque

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.cache import cache_get, cache_set
from app.core.config import settings

# Route-group limits: (window_s, max_requests)
LIMITS: dict[str, tuple[int, int]] = {
    "/api/v1/auth": (60, 10),       # 10/min per IP for signup/login/forgot
    "/api/v1/eve": (60, 20),         # 20/min for eve chat/stream/voice
    "/api/v1/cron": (60, 10),
    "/api/v1/calls/twilio": (60, 30),
    "/api/v1/workspace": (60, 100),
}

# In-memory fallback buckets: key -> deque[timestamps]
_mem_buckets: dict[str, deque] = defaultdict(deque)

def _group_for_path(path: str) -> tuple[int, int] | None:
    for prefix, lim in LIMITS.items():
        if path.startswith(prefix):
            return lim
    return None


def _is_allowed(key: str, window: int, limit: int) -> bool:
    now = _time.monotonic()
    # Try Redis (atomic via INCR + EXPIRE trick using cache helpers)
    rkey = f"rl:{key}"
    # Use Redis if available (via cache module's redis)
    try:
        from app.core.cache import _get_redis
        r = _get_redis()
        if r is not None:
            # Use sorted set or simple counter with expiry
            pipe = r.pipeline()
            pipe.incr(rkey)
            pipe.ttl(rkey)
            cnt, ttl = pipe.execute()
            if ttl == -1:
                r.expire(rkey, window)
            return int(cnt) <= limit
    except Exception:
        pass
    # In-memory fallback (single worker, good enough)
    dq = _mem_buckets[key]
    # purge old
    while dq and dq[0] <= now - window:
        dq.popleft()
    if len(dq) >= limit:
        return False
    dq.append(now)
    return True


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        # Skip rate-limiting in non-production/test so pytest doesn't hit 10/min cap
        if getattr(settings, "app_env", "development") != "production":
            return await call_next(request)
        path = request.url.path
        lim = _group_for_path(path)
        if lim and not getattr(settings, "is_serverless", False):
            window, limit = lim
            ip = request.client.host if request.client else "unknown"
            key = f"{path.split('/')[3] if len(path.split('/'))>3 else path}:{ip}:{window}"
            if not _is_allowed(key, window, limit):
                return Response(content='{"detail":"Rate limit exceeded. Try again shortly."}', status_code=429, media_type="application/json")
        return await call_next(request)
