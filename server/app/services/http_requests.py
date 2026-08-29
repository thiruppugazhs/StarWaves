"""Arbitrary HTTP request service for Eve tools, with SSRF and response-size guards."""

import ipaddress
import socket
from urllib.parse import urlparse

from app.core.http import create_sync_client

ALLOWED_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE")
MAX_RESPONSE_CHARS = 30000
REQUEST_TIMEOUT_SECONDS = 30
BLOCKED_HOSTNAME = "localhost"


class HttpRequestError(ValueError):
    """Raised when a request is blocked or cannot be completed."""


def _assert_public_url(url: str) -> None:
    """Reject non-HTTP(S) schemes, localhost names, and private/reserved IP targets."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HttpRequestError("Only http and https URLs are allowed.")
    hostname = parsed.hostname or ""
    if not hostname or hostname.lower() == BLOCKED_HOSTNAME:
        raise HttpRequestError("Requests to localhost are not allowed.")
    try:
        addr_infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise HttpRequestError(f"Cannot resolve host '{hostname}'.") from exc
    for info in addr_infos:
        address = ipaddress.ip_address(info[4][0])
        if (
            address.is_private
            or address.is_loopback
            or address.is_link_local
            or address.is_reserved
            or address.is_unspecified
            or address.is_multicast
            or not address.is_global
        ):
            raise HttpRequestError("Requests to private or reserved addresses are not allowed.")


def perform_request(
    method: str,
    url: str,
    body: dict | None = None,
    headers: dict[str, str] | None = None,
) -> dict:
    """Execute an outbound HTTP request and return a truncated JSON/text summary."""
    method = method.upper()
    if method not in ALLOWED_METHODS:
        raise HttpRequestError(f"Method must be one of {ALLOWED_METHODS}.")
    _assert_public_url(url)
    try:
        with create_sync_client(follow_redirects=False) as http:
            response = http.request(
                method,
                url,
                json=body if method != "GET" else None,
                headers=headers,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            # Check redirect target if any
            if 300 <= response.status_code < 400:
                loc = response.headers.get("location")
                if loc:
                    _assert_public_url(loc)
    except HttpRequestError:
        raise
    except Exception as exc:
        raise HttpRequestError(f"Request failed: {exc}") from exc

    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            payload: object = response.json()
        except ValueError:
            payload = response.text[:MAX_RESPONSE_CHARS]
    else:
        payload = response.text[:MAX_RESPONSE_CHARS]
    return {
        "status_code": response.status_code,
        "content_type": content_type,
        "body": payload,
        "truncated": len(response.text) > MAX_RESPONSE_CHARS,
    }
