"""Reusable repository helpers — soft-delete, snapshot conversion, date handling."""

from datetime import datetime, timezone
from typing import Any

from app.db import ArrayUnion, Query, SERVER_TIMESTAMP


def soft_delete_payload() -> dict[str, Any]:
    return {
        "deleted": True,
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": SERVER_TIMESTAMP,
    }


def restore_payload() -> dict[str, Any]:
    return {
        "deleted": False,
        "deleted_at": None,
        "updated_at": SERVER_TIMESTAMP,
    }


def is_deleted(data: dict[str, Any] | None) -> bool:
    return bool(data and data.get("deleted"))


def require_not_deleted(snapshot) -> dict[str, Any] | None:
    """Return dict if snapshot exists and not soft-deleted, else None."""
    if not getattr(snapshot, "exists", False):
        return None
    data = snapshot.to_dict() or {}
    if data.get("deleted"):
        return None
    return {"id": snapshot.id, **data}


def dict_to_snapshot(data: dict[str, Any]):
    """Convert dict with 'id' key to snapshot-like object for from_snapshot helpers."""
    return type("S", (), {"id": data["id"], "to_dict": lambda s, d=data: d})()


def to_snapshot_list(items: list[dict[str, Any]]):
    return [dict_to_snapshot(d) for d in items]
