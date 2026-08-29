"""SQLite-backed database helpers shared by integration and E2E tests.

The engine itself is created once at import time (see ``tests/conftest.py``),
bound to a throwaway SQLite file. These helpers reset schema state around each
test and seed well-known rows.
"""

from datetime import datetime, timezone

import pytest

TEST_DB_USER = {
    "uid": "user-1",
    "email": "user1@example.com",
    "display_name": "User One",
}


def clean_database() -> None:
    """Drop and recreate every table for a pristine per-test schema."""
    from app.db.session import Base, sync_engine

    Base.metadata.drop_all(sync_engine)
    Base.metadata.create_all(sync_engine)
    # Clear the response cache so previous test data does not leak into the
    # next test when the local in-memory fallback is used (REDIS_URL unset in
    # conftest.py). Redis-backed runs use ephemeral prefixes but local tests
    # share a single process-wide dict.
    try:
        from app.core.cache import cache_clear

        cache_clear()
    except Exception:
        pass


@pytest.fixture()
def db():
    """Function-scoped fixture: fresh empty SQLite schema around each test."""
    clean_database()
    yield
    clean_database()


def get_sql_client():
    """Return the application's real SqlClient singleton."""
    from app.db import get_db_client

    return get_db_client()


def seed_user(
    uid: str = TEST_DB_USER["uid"],
    email: str = TEST_DB_USER["email"],
    display_name: str = TEST_DB_USER["display_name"],
    **extra_fields,
) -> dict:
    """Insert a user document through the SQL compat layer and return it."""
    client = get_sql_client()
    data = {
        "uid": uid,
        "email": email.lower().strip(),
        "display_name": display_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **extra_fields,
    }
    client.collection("users").document(uid).set(data)
    return data
