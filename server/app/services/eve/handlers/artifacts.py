"""Shared helper for Eve handlers that produce binary artifacts (images, video, audio)."""

import base64
import datetime
import re

from app.repositories import workspace_files as ws_repo

MEDIA_FOLDER = "media"
_SAFE_NAME = re.compile(r"[^a-zA-Z0-9._-]+")


def save_media_file(user_id: str, prefix: str, extension: str, data: bytes) -> str:
    """Save generated media bytes into the user's workspace and return the relative path."""
    timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    safe_prefix = _SAFE_NAME.sub("-", prefix)[:40].strip("-") or "artifact"
    path = f"{MEDIA_FOLDER}/{safe_prefix}-{timestamp}.{extension}"
    ws_repo.write_file(user_id, path, base64.b64encode(data).decode("ascii"), encoding="base64")
    return path
