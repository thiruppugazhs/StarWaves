"""Backward-compatibility facade for the SQL database adapter.

All implementation details have been modularized into `app.db.sql`.
"""

from __future__ import annotations

from app.db.sql._shared import (
    SERVER_TIMESTAMP,
    ArrayUnion,
    coerce_model_value,
    is_array_union,
    is_server_timestamp,
    json_safe,
    utc_now_iso,
)
from app.db.sql.calls import (
    call_participant_identity,
    call_snapshot,
)
from app.db.sql.client import (
    SqlClient,
    get_db_client,
    get_firestore,
)
from app.db.sql.query import (
    SqlBatch,
    SqlCollectionRef,
    SqlDocRef,
    SqlQuery,
    SqlSnapshot,
)

# Legacy aliases for internal helper references
_utc_now_iso = utc_now_iso
_is_server_timestamp = is_server_timestamp
_coerce_model_value = coerce_model_value
_is_array_union = is_array_union
_json_safe = json_safe
_call_participant_identity = call_participant_identity
_call_snapshot = call_snapshot

__all__ = [
    "ArrayUnion",
    "SERVER_TIMESTAMP",
    "SqlBatch",
    "SqlClient",
    "SqlCollectionRef",
    "SqlDocRef",
    "SqlQuery",
    "SqlSnapshot",
    "_call_participant_identity",
    "_call_snapshot",
    "_coerce_model_value",
    "_is_array_union",
    "_is_server_timestamp",
    "_json_safe",
    "_utc_now_iso",
    "call_participant_identity",
    "call_snapshot",
    "coerce_model_value",
    "get_db_client",
    "get_firestore",
    "is_array_union",
    "is_server_timestamp",
    "json_safe",
    "utc_now_iso",
]
