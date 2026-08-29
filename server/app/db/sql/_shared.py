"""Shared helpers, coercion utilities, and constants for the SQL database adapter."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

SERVER_TIMESTAMP = "__SQL_SERVER_TIMESTAMP__"


class ArrayUnion:
    """Emulates Firestore's ArrayUnion field transform."""

    def __init__(self, values: list[Any]):
        self.values = values


def utc_now_iso() -> str:
    """Return the current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


def is_server_timestamp(value: Any) -> bool:
    """Check if value represents a Firestore SERVER_TIMESTAMP sentinel or placeholder."""
    if value is None:
        return False
    if value == SERVER_TIMESTAMP:
        return True
    sv = str(value)
    if sv.startswith("__SQL_SERVER_TIMESTAMP"):
        return True
    if type(value).__name__ == "Sentinel" or "Sentinel" in sv or "server timestamp" in sv.lower():
        return True
    return False


_TIMESTAMP_KEYS = {
    "created_at",
    "updated_at",
    "scheduled_time",
    "completed_at",
    "deadline",
    "event_date",
    "timestamp",
    "email_verified_at",
    "last_run_at",
    "next_run_at",
    "scheduled_time",
    "deleted_at",
    "starts_at",
    "ends_at",
    "execute_at",
    "next_run_at",
}


def coerce_model_value(key: str, val: Any) -> Any:
    """Coerce input values to appropriate Python/SQL types for model attributes."""
    if val is None:
        return None
    if is_server_timestamp(val):
        return datetime.now(timezone.utc)
    if key in _TIMESTAMP_KEYS:
        if isinstance(val, str):
            try:
                return datetime.fromisoformat(val.replace("Z", "+00:00"))
            except Exception:
                return datetime.now(timezone.utc)
    return val


def is_array_union(value: Any) -> bool:
    """Check if value is an ArrayUnion object (duck-typed for compat with firebase_admin)."""
    return type(value).__name__ == "ArrayUnion" and hasattr(value, "values")


def json_safe(obj: Any) -> Any:
    """Recursively convert datetime and non-JSON native objects to JSON-serializable primitives."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [json_safe(v) for v in obj]
    return obj


def clean_data(data: dict[str, Any]) -> dict[str, Any]:
    """Clean dictionary data replacing SERVER_TIMESTAMP and ArrayUnion before persisting."""
    cleaned: dict[str, Any] = {}
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()
    for k, v in data.items():
        if is_server_timestamp(v):
            cleaned[k] = now_dt if k in _TIMESTAMP_KEYS else now_iso
        elif isinstance(v, ArrayUnion) or is_array_union(v):
            cleaned[k] = v.values
        else:
            cleaned[k] = v
    return cleaned
