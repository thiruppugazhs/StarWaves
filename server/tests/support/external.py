"""Outbound HTTP mocking helpers built on ``httpx.MockTransport``.

Services create clients via :func:`app.core.http.create_async_client` /
:func:`create_sync_client`. These helpers patch those factories so every
outbound request during a test is answered by an in-process handler — no new
dependencies, no real network.
"""

import json
from contextlib import contextmanager

import httpx


def _transport(handler) -> httpx.MockTransport:
    return httpx.MockTransport(handler)


@contextmanager
def patched_async_http(handler, base_url: str | None = None):
    """Patch ``create_async_client`` to route all requests through ``handler``.

    ``handler(request: httpx.Request) -> httpx.Response``
    """
    from app.core import http as core_http

    original = core_http.create_async_client

    def factory(**kwargs):
        kwargs.pop("limits", None)
        kwargs["base_url"] = base_url or kwargs.get("base_url")
        return httpx.AsyncClient(transport=_transport(handler), **kwargs)

    core_http.create_async_client = factory
    try:
        yield
    finally:
        core_http.create_async_client = original


@contextmanager
def patched_sync_http(handler, base_url: str | None = None):
    """Patch ``create_sync_client`` to route all requests through ``handler``."""
    from app.core import http as core_http

    original = core_http.create_sync_client

    def factory(**kwargs):
        kwargs["base_url"] = base_url or kwargs.get("base_url")
        return httpx.Client(transport=_transport(handler), **kwargs)

    core_http.create_sync_client = factory
    try:
        yield
    finally:
        core_http.create_sync_client = original


def json_response(status_code: int = 200, body=None, headers: dict | None = None) -> httpx.Response:
    """Build a JSON httpx.Response inside a MockTransport handler."""
    return httpx.Response(
        status_code,
        content=json.dumps(body if body is not None else {}).encode(),
        headers={"content-type": "application/json", **(headers or {})},
        request=httpx.Request("GET", "http://test"),
    )
