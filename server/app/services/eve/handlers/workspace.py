"""Workspace handlers — single responsibility: workspace records, search and generation."""

from __future__ import annotations

from typing import Any

from app.db import SqlClient

from app.services.eve.constants import SUPPORTED_RESOURCES
from app.services.eve.workspace_insights import _workspace_insight
from app.services.eve.workspace_records import (
    _bulk_update_records,
    _create_record,
    _explain_record,
    _generate_text_artifact,
    _list_records,
    _search_records,
    _update_record,
    delete_workspace_record,
    restore_workspace_record,
)


def handle_search_workspace(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    return _search_records(database, user_id, arguments["query"], arguments.get("resources")), None, None


def handle_workspace_insight(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    return _workspace_insight(database, user_id, arguments["kind"], arguments.get("date"), arguments.get("query")), None, None


def handle_explain_record(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    return _explain_record(database, user_id, arguments["resource"], arguments["record_id"]), None, None


def handle_generate_text_artifact(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    return _generate_text_artifact(
        database,
        user_id,
        arguments["kind"],
        arguments.get("resource"),
        arguments.get("record_id"),
        arguments.get("prompt"),
    ), None, None


def handle_bulk_update_records(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str | None, None]:
    resource = arguments["resource"]
    result = _bulk_update_records(database, user_id, resource, arguments["updates"])
    return result, resource if result["updated"] else None, None


def handle_delete_workspace_record(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, None]:
    resource = arguments["resource"]
    msg, _ = delete_workspace_record(database, {"uid": user_id}, resource, arguments["record_id"])
    return {"message": msg}, resource, None


def handle_restore_workspace_record(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, None]:
    resource = arguments["resource"]
    msg, _ = restore_workspace_record(database, {"uid": user_id}, resource, arguments["record_id"])
    return {"message": msg}, resource, None


RESOURCE_ALIASES: dict[str, str] = {
    "todo": "todos",
    "todos": "todos",
    "task": "todos",
    "tasks": "todos",
    "project": "projects",
    "projects": "projects",
    "job": "jobs",
    "jobs": "jobs",
    "hackathon": "hackathons",
    "hackathons": "hackathons",
    "document": "documents",
    "documents": "documents",
    "doc": "documents",
    "docs": "documents",
    "notification": "notifications",
    "notifications": "notifications",
}


def _normalize_resource(raw: Any) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    return RESOURCE_ALIASES.get(raw.strip().lower())


def handle_list_workspace_records(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    raw_resource = arguments.get("resource")
    resource = _normalize_resource(raw_resource)
    if not resource or resource not in SUPPORTED_RESOURCES:
        return {
            "error": f"Unsupported workspace resource '{raw_resource}'. Supported resources: {', '.join(SUPPORTED_RESOURCES)}."
        }, None, None
    return {"records": _list_records(database, user_id, resource)}, None, None


def handle_create_workspace_record(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str | None, None]:
    raw_resource = arguments.get("resource")
    resource = _normalize_resource(raw_resource)
    if not resource or resource not in SUPPORTED_RESOURCES:
        return {
            "error": f"Unsupported workspace resource '{raw_resource}'. Supported resources: {', '.join(SUPPORTED_RESOURCES)}."
        }, None, None
    data = arguments.get("data")
    if not isinstance(data, dict) or not data:
        return {"error": "'data' object is required to create a record."}, None, None
    return {"record": _create_record(database, user_id, resource, data)}, resource, None


def handle_update_workspace_record(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str | None, None]:
    raw_resource = arguments.get("resource")
    resource = _normalize_resource(raw_resource)
    if not resource or resource not in SUPPORTED_RESOURCES:
        return {
            "error": f"Unsupported workspace resource '{raw_resource}'. Supported resources: {', '.join(SUPPORTED_RESOURCES)}."
        }, None, None
    record_id = arguments.get("record_id")
    changes = arguments.get("changes")
    if not record_id:
        return {"error": "'record_id' is required to update a record."}, None, None
    if not isinstance(changes, dict) or not changes:
        return {"error": "'changes' object is required to update a record."}, None, None
    return {
        "record": _update_record(database, user_id, resource, record_id, changes)
    }, resource, None

