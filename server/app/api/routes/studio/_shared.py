"""Studio routes shared helpers — facade over core/errors."""

from app.core.config import settings
from app.core.errors import bad_request, not_found, service_unavailable

# Re-export for backward compat
__all__ = ["require_non_serverless", "not_found", "bad_request"]


def require_non_serverless() -> None:
    """Studio builds run processes and touch disk — unavailable on serverless."""
    if getattr(settings, "is_serverless", False):
        raise service_unavailable("Studio is not available in serverless mode.")
