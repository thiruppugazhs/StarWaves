"""Root pytest configuration — deterministic, database-isolated test environment.

This module MUST be imported before any ``app.*`` module (pytest imports root
conftest.py before collecting test modules, which guarantees ordering):

1. Stubs ``dotenv.load_dotenv`` so local ``.env`` / ``.env.prod`` secrets and
   machine-specific values never leak into the test process.
2. Points ``DATABASE_URL`` at a throwaway SQLite file so tests never touch the
   developer's real ``starwaves.db``.
3. Removes environment values that would trigger network side effects
   (``REDIS_URL``) or background daemons.

Per-test database isolation is provided by the ``db`` fixture (drop + create
all tables around every test).
"""

import os
import tempfile

import pytest

_TEST_TMPDIR = tempfile.mkdtemp(prefix="starwaves-tests-")

# --- 1) Block .env loading BEFORE app.core.config is imported anywhere. ------
import dotenv  # noqa: E402

dotenv.load_dotenv = lambda *args, **kwargs: False

# --- 2) Deterministic environment for the whole test process. ---------------
os.environ.pop("REDIS_URL", None)
os.environ.pop("VERCEL", None)
os.environ.pop("AWS_LAMBDA_FUNCTION_NAME", None)
os.environ.pop("IS_SERVERLESS", None)  # serverless mode disables workspace/studio routes
os.environ.pop("TWILIO_ACCOUNT_SID", None)
os.environ.pop("TWILIO_AUTH_TOKEN", None)
# Note: ServerBackgroundWorker starts only via app lifespan; tests instantiate
# TestClient without a context manager so the daemon never runs.
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///" + os.path.join(
    _TEST_TMPDIR, "starwaves-test.sqlite3"
).replace("\\", "/")

# --- 3) Import-order guard ----------------------------------------------------
# ``app.models`` imports ``app.db.session``, whose package __init__ cascades
# through ``app.db.sql`` handlers that import models back. Importing the DB
# layer first breaks that cycle for every test module regardless of its own
# import order.
import app.db.session  # noqa: E402,F401

# --- 4) Shared fixtures -------------------------------------------------------
from tests.support.auth import TEST_USER  # noqa: E402,F401
from tests.support.db import clean_database, db  # noqa: E402,F401


@pytest.fixture()
def client(db):
    """TestClient against the real app + fresh SQLite schema per test.

    Instantiated WITHOUT a context manager so the app lifespan (and the
    ServerBackgroundWorker daemon it starts) never runs during tests.
    """
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


@pytest.fixture()
def auth_client(client):
    """Client pre-armed with a valid Bearer token for TEST_USER."""
    from app.core.auth import create_user_token

    client.headers.update({"Authorization": f"Bearer {create_user_token(TEST_USER)}"})
    return client


@pytest.fixture()
def other_user_headers():
    """Authorization headers for a second user (ownership-isolation checks)."""
    from tests.support.auth import headers_for

    return headers_for({"uid": "user-2", "email": "user2@example.com", "name": "User Two"})


@pytest.fixture(autouse=True)
def _clear_cache_between_tests():
    """Ensure the in-memory response cache never leaks between tests.

    The cache is process-global (local dict when REDIS_URL is unset, which is
    always the case in tests). Without this, a cached GET from one test would
    be returned for the next test even though the DB has been reset or the
    Firestore mock has been reconfigured, producing flaky stale-data assertions.
    """
    try:
        from app.core.cache import cache_clear

        cache_clear()
    except Exception:
        pass
    yield
    try:
        from app.core.cache import cache_clear

        cache_clear()
    except Exception:
        pass
