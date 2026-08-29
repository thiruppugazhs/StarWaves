"""Reusable HTTP client factory — single source for httpx usage.

Eliminates ~15 ad-hoc AsyncClient(timeout=...) constructions across
routes/services with inconsistent timeouts and no shared retry/limits.
"""

import httpx

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36 Starwaves/1.0"
)

DEFAULT_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
DEFAULT_LIMITS = httpx.Limits(max_keepalive_connections=10, max_connections=20)


def create_async_client(
    *,
    timeout: float | httpx.Timeout | None = None,
    base_url: str | None = None,
    headers: dict[str, str] | None = None,
    follow_redirects: bool = True,
) -> httpx.AsyncClient:
    """Create an AsyncClient with shared defaults (limits, User-Agent)."""
    resolved_timeout = timeout if isinstance(timeout, httpx.Timeout) else httpx.Timeout(timeout) if timeout is not None else DEFAULT_TIMEOUT
    resolved_headers = {"User-Agent": DEFAULT_USER_AGENT}
    if headers:
        resolved_headers.update(headers)
    kwargs: dict = {
        "timeout": resolved_timeout,
        "headers": resolved_headers,
        "limits": DEFAULT_LIMITS,
        "follow_redirects": follow_redirects,
    }
    if base_url:
        kwargs["base_url"] = base_url
    return httpx.AsyncClient(**kwargs)


def create_sync_client(
    *,
    timeout: float | httpx.Timeout | None = None,
    base_url: str | None = None,
    headers: dict[str, str] | None = None,
    follow_redirects: bool = True,
) -> httpx.Client:
    """Sync counterpart for web_browsing / discovery helpers."""
    resolved_timeout = timeout if isinstance(timeout, httpx.Timeout) else httpx.Timeout(timeout) if timeout is not None else DEFAULT_TIMEOUT
    resolved_headers = {"User-Agent": DEFAULT_USER_AGENT}
    if headers:
        resolved_headers.update(headers)
    kwargs: dict = {
        "timeout": resolved_timeout,
        "headers": resolved_headers,
        "limits": DEFAULT_LIMITS,
        "follow_redirects": follow_redirects,
    }
    if base_url:
        kwargs["base_url"] = base_url
    return httpx.Client(**kwargs)
