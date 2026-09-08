"""CORS origin allowlist — shared to avoid circular imports between app.main and routes."""
import re

from app.core.config import settings

ALLOWED_ORIGIN_REGEX = (
    r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"
    r"|^capacitor://localhost$"
    r"|^tauri://localhost$"
    r"|^https://tauri\.localhost$"
    r"|^com\.starwaves\.app://.*$"
    r"|^app\.starwaves\.workspace://.*$"
    r"|^https://([a-zA-Z0-9-]+\.)*susindran\.in$"
    r"|^https://([a-zA-Z0-9-]+\.)*vercel\.app$"
)


def is_allowed_origin(origin: str | None) -> bool:
    if not origin:
        return False
    if re.match(ALLOWED_ORIGIN_REGEX, origin):
        return True
    for allowed in settings.cors_origins:
        if not allowed:
            continue
        if "*" in allowed:
            # Wildcard suffix match: https://*.vercel.app -> suffix vercel.app
            # Convert wildcard pattern to regex: escape, replace \* with .*
            pattern = re.escape(allowed).replace(r"\*", ".*")
            if re.fullmatch(pattern, origin):
                return True
            # Fallback suffix check for simple *.domain
            if allowed.startswith("https://*."):
                suffix = allowed[len("https://*.") :]
                if origin.startswith("https://") and origin.endswith(suffix):
                    # Ensure subdomain present (e.g. foo.vercel.app not vercel.app)
                    remainder = origin[len("https://") : -len(suffix) if suffix else None]
                    if remainder and remainder.endswith("."):
                        return True
        elif origin == allowed:
            return True
    return False
