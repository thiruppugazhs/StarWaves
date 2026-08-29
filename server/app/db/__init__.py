"""Database clients and session factories used by the application."""

from app.db.session import Base, async_session_factory, engine, get_db, init_db, sync_engine
from app.db.firestore import get_firebase_app, get_firestore_client as get_firestore
try:
    from google.cloud.firestore_v1.base_query import FieldFilter
except Exception:
    from app.db.sql.query import FieldFilter

from app.db.sql import (
    ArrayUnion,
    Query,
    SERVER_TIMESTAMP,
    SqlClient,
    get_db_client,
)

__all__ = [
    "ArrayUnion",
    "Base",
    "FieldFilter",
    "Query",
    "SERVER_TIMESTAMP",
    "SqlClient",
    "async_session_factory",
    "engine",
    "get_db",
    "get_db_client",
    "get_firebase_app",
    "get_firestore",
    "init_db",
    "sync_engine",
]
