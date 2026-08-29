"""Reusable test scaffolding for the Starwaves backend test suite.

Modules:
- ``db``       — SQLite database lifecycle + seeding helpers
- ``auth``     — user fixtures, real Bearer tokens, dependency override helpers
- ``fakes``    — fake Firestore snapshots/collections and scripted AI providers
- ``external`` — httpx MockTransport wiring for outbound HTTP mocking
"""

from tests.support.auth import (
    TEST_USER,
    TEST_USER_2,
    auth_headers,
    headers_for,
    token_for,
)
from tests.support.db import clean_database, get_sql_client, seed_user

__all__ = [
    "TEST_USER",
    "TEST_USER_2",
    "auth_headers",
    "clean_database",
    "get_sql_client",
    "headers_for",
    "seed_user",
    "token_for",
]
