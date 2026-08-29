"""Lean Redis-backed cache with local fallback for e2-micro (1-10 users).

If REDIS_URL is set (VM docker-compose includes redis:7-alpine 96M), use Redis SETEX/GET.
Otherwise fallback to in-memory dict with TTL + LRU 1000 bound.
Keeps 1GB host lean: no external Redis cost, no pgbouncer needed.
"""
import asyncio
import hashlib
import json as _json
import time as _time
from functools import wraps
from typing import Any, Callable

try:
    import redis as _redis  # type: ignore
except Exception:  # pragma: no cover
    _redis = None

from app.core.config import settings

_local_cache: dict[str, tuple[float, Any]] = {}
_MAX_LOCAL = 1000

_redis_client = None

# TTL presets for simple GET caching (kept short to avoid stale UX while still
# absorbing hot-read bursts from dashboards / navigation).
CACHE_TTL_SHORT = 30
CACHE_TTL_MEDIUM = 60
CACHE_TTL_LONG = 300

# Keys that hold per-user GET caches must never leak across users — every
# key helper forces a user_id segment when a user is present.


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    if not getattr(settings, "redis_url", None) or _redis is None:
        return None
    try:
        _redis_client = _redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2, decode_responses=False)
        _redis_client.ping()
        return _redis_client
    except Exception:
        return None


def cache_get(key: str) -> Any | None:
    r = _get_redis()
    if r is not None:
        try:
            import json

            raw = r.get(key)
            if raw is None:
                return None
            if isinstance(raw, bytes):
                raw = raw.decode()
            return json.loads(raw)
        except Exception:
            pass
    # local fallback
    entry = _local_cache.get(key)
    if not entry:
        return None
    expires, val = entry
    if expires < _time.monotonic():
        _local_cache.pop(key, None)
        return None
    return val


def _to_jsonable(value: Any) -> Any:
    """Recursively convert Pydantic models and other non-JSON types to plain dicts."""
    if isinstance(value, list):
        return [_to_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {k: _to_jsonable(v) for k, v in value.items()}
    if hasattr(value, "model_dump"):
        try:
            return _to_jsonable(value.model_dump(mode="json"))  # type: ignore[attr-defined]
        except Exception:
            pass
    if hasattr(value, "dict"):
        try:
            return _to_jsonable(value.dict())  # type: ignore[attr-defined]
        except Exception:
            pass
    return value


def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    storable = _to_jsonable(value)
    r = _get_redis()
    if r is not None:
        try:
            import json

            r.setex(key, ttl, json.dumps(storable, default=str))
            return
        except Exception:
            pass
    # local with LRU bound — store the jsonable form so Redis/local parity holds
    if len(_local_cache) >= _MAX_LOCAL:
        # evict oldest (first)
        oldest = next(iter(_local_cache))
        _local_cache.pop(oldest, None)
    _local_cache[key] = (_time.monotonic() + ttl, storable)


def cache_delete(key: str) -> None:
    r = _get_redis()
    if r is not None:
        try:
            r.delete(key)
        except Exception:
            pass
    _local_cache.pop(key, None)


def cache_invalidate_prefix(prefix: str) -> None:
    if not prefix:
        return
    r = _get_redis()
    if r is not None:
        try:
            for k in r.scan_iter(match=f"{prefix}*"):
                r.delete(k)
        except Exception:
            pass
    for k in list(_local_cache.keys()):
        if k.startswith(prefix):
            _local_cache.pop(k, None)


def cache_clear() -> None:
    """Clear all local entries; Redis keys are left untouched (tests use local only)."""
    _local_cache.clear()


# ---------------------------------------------------------------------------
# Response-cache helpers for simple GET endpoints
# ---------------------------------------------------------------------------

_EXCLUDED_KEY_PARAMS = {"database", "db", "request", "response"}


def _extract_user_id(kwargs: dict[str, Any]) -> str | None:
    user = kwargs.get("user")
    if isinstance(user, dict) and user.get("uid"):
        return str(user["uid"])
    for key in ("user_id", "current_user_id", "uid"):
        val = kwargs.get(key)
        if isinstance(val, str) and val:
            return val
    return None


def build_cache_key(prefix: str, user_id: str | None = None, **params: Any) -> str:
    """Deterministic cache key with mandatory user scoping when present.

    Example:
        build_cache_key("todos:list", user_id="user-1", cursor="abc", limit=20)
        -> "todos:list:user-1:8f3a..."
    """
    filtered: dict[str, Any] = {}
    for k, v in params.items():
        if k in _EXCLUDED_KEY_PARAMS:
            continue
        if v is None:
            continue
        filtered[k] = v
    if not filtered:
        if user_id:
            return f"{prefix}:{user_id}"
        return prefix
    # Stable JSON + short hash keeps Redis keys bounded even for paginated cursors
    payload = _json.dumps(filtered, sort_keys=True, default=str, separators=(",", ":"))
    digest = hashlib.md5(payload.encode()).hexdigest()[:12]
    if user_id:
        return f"{prefix}:{user_id}:{digest}"
    return f"{prefix}:anon:{digest}"


def cache_invalidate_user_prefix(prefix: str, user_id: str | None) -> None:
    """Invalidate a user-scoped prefix, e.g. ``todos:user-1`` wipes list+detail."""
    if not prefix:
        return
    if user_id:
        cache_invalidate_prefix(f"{prefix}:{user_id}")
    else:
        cache_invalidate_prefix(prefix)


def cached(ttl: int = CACHE_TTL_SHORT, prefix: str | None = None):
    """Decorator for simple GET handlers — caches JSON-serializable returns.

    The key is ``{prefix}:{user_id}:{hash(query_params)}`` when a ``user`` or
    ``user_id`` kwarg is present, otherwise ``{prefix}:anon:{hash}``. ``None``
    and exceptions bypass the cache to avoid persisting 404s or empty mutations.
    """

    def decorator(func: Callable):
        cache_prefix = prefix or func.__name__

        if asyncio.iscoroutinefunction(func):

            @wraps(func)
            async def async_wrapper(*args: Any, **kwargs: Any):
                uid = _extract_user_id(kwargs)
                params = {k: v for k, v in kwargs.items() if k not in _EXCLUDED_KEY_PARAMS and k != "user"}
                for alias in ("user_id", "current_user_id", "uid"):
                    params.pop(alias, None)
                # Include positional args that look like identifiers in the key
                if args:
                    for idx, val in enumerate(args):
                        if isinstance(val, (str, int, float)):
                            params[f"arg{idx}"] = val
                key = build_cache_key(cache_prefix, uid, **params) if params else build_cache_key(cache_prefix, uid)
                hit = cache_get(key)
                if hit is not None:
                    return hit
                result = await func(*args, **kwargs)
                if result is not None:
                    cache_set(key, result, ttl=ttl)
                return result

            return async_wrapper

        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any):
            uid = _extract_user_id(kwargs)
            params = {k: v for k, v in kwargs.items() if k not in _EXCLUDED_KEY_PARAMS and k != "user"}
            for alias in ("user_id", "current_user_id", "uid"):
                params.pop(alias, None)
            if args:
                for idx, val in enumerate(args):
                    if isinstance(val, (str, int, float)):
                        params[f"arg{idx}"] = val
            key = build_cache_key(cache_prefix, uid, **params) if params else build_cache_key(cache_prefix, uid)
            hit = cache_get(key)
            if hit is not None:
                return hit
            result = func(*args, **kwargs)
            if result is not None:
                cache_set(key, result, ttl=ttl)
            return result

        return sync_wrapper

    return decorator
