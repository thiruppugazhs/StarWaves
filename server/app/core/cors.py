"""CORS origin allowlist — shared to avoid circular imports between app.main and routes."""
import re

from app.core.config import settings

ALLOWED_ORIGIN_REGEX = (
    r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"
    r"|^capacitor://localhost$"
    r"|^https://([a-zA-Z0-9-]+\.)*susindran\.in$"
)


def is_allowed_origin(origin: str | None) -> bool:
    if not origin:
        return False
    if re.match(ALLOWED_ORIGIN_REGEX, origin):
        return True
    return origin in settings.cors_origins
