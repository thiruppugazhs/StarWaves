"""Authentication helpers — real tokens, well-known users, override utilities."""

from contextlib import contextmanager

TEST_USER = {"uid": "user-1", "email": "user1@example.com", "name": "User One"}
TEST_USER_2 = {"uid": "user-2", "email": "user2@example.com", "name": "User Two"}


def token_for(user: dict | None = None) -> str:
    """Create a real Starwaves Bearer token signed with the app secret."""
    from app.core.auth import create_user_token

    return create_user_token(user or TEST_USER)


def auth_headers(user: dict | None = None) -> dict[str, str]:
    """Authorization headers carrying a valid Bearer token for ``user``."""
    return {"Authorization": f"Bearer {token_for(user)}"}


def headers_for(user: dict) -> dict[str, str]:
    """Explicit-user alias of :func:`auth_headers` for multi-user journeys."""
    return {"Authorization": f"Bearer {token_for(user)}"}


@contextmanager
def dependency_override(app, dependency, replacement):
    """Temporarily override a FastAPI dependency, restoring state afterwards."""
    previous = app.dependency_overrides.get(dependency)
    app.dependency_overrides[dependency] = replacement
    try:
        yield
    finally:
        if previous is None:
            app.dependency_overrides.pop(dependency, None)
        else:
            app.dependency_overrides[dependency] = previous


@contextmanager
def override_settings(**values):
    """Temporarily patch frozen ``Settings`` attributes (bypasses frozen via object.__setattr__)."""
    from app.core.config import settings

    originals = {}
    try:
        for key, value in values.items():
            originals[key] = getattr(settings, key)
            object.__setattr__(settings, key, value)
        yield settings
    finally:
        for key, value in originals.items():
            object.__setattr__(settings, key, value)
