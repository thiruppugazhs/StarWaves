"""SQL-backed Firestore compatibility package for Starwaves."""

from app.db.sql._shared import (
    SERVER_TIMESTAMP,
    ArrayUnion,
    is_array_union,
    is_server_timestamp,
    utc_now_iso,
)
from app.db.sql.client import SqlClient, get_db_client, get_firestore
from app.db.sql.query import (
    FieldFilter,
    Query,
    SqlBatch,
    SqlCollectionRef,
    SqlDocRef,
    SqlQuery,
    SqlSnapshot,
)

__all__ = [
    "ArrayUnion",
    "FieldFilter",
    "Query",
    "SERVER_TIMESTAMP",
    "SqlBatch",
    "SqlClient",
    "SqlCollectionRef",
    "SqlDocRef",
    "SqlQuery",
    "SqlSnapshot",
    "get_db_client",
    "get_firestore",
    "is_array_union",
    "is_server_timestamp",
    "utc_now_iso",
]
