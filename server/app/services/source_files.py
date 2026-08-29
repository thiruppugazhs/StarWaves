"""Source file resolution — fetch bytes from a workspace path or an external URL."""

import mimetypes
import os

from app.core.http import create_sync_client
from app.repositories import workspace_files as ws_repo


class SourceFileError(RuntimeError):
    """Raised when a source file cannot be located or fetched."""


def fetch_source_bytes(user_id: str, source: str) -> tuple[bytes, str]:
    """Return (bytes, mime_type) for a workspace file path or HTTP(S) URL."""
    if source.startswith(("http://", "https://")):
        from app.services.http_requests import HttpRequestError, _assert_public_url

        try:
            _assert_public_url(source)
        except HttpRequestError as exc:
            raise SourceFileError(str(exc)) from exc
        with create_sync_client() as http:
            response = http.get(source)
        response.raise_for_status()
        mime_type = response.headers.get("content-type", "").split(";")[0].strip()
        if not mime_type:
            mime_type = "application/octet-stream"
        return response.content, mime_type
    path = source.lstrip("/")
    full_path = ws_repo._safe_path(user_id, path)
    if not os.path.isfile(full_path):
        raise SourceFileError(f"File not found: {source}")
    mime_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(full_path, "rb") as f:
        return f.read(), mime_type
