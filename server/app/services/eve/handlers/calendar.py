"""Calendar handlers — single responsibility: calendar_events record operations."""

from app.db import SqlClient
from app.services.eve.handlers.workspace import (
    handle_create_workspace_record,
    handle_delete_workspace_record,
    handle_list_workspace_records,
)

CALENDAR_RESOURCE = "calendar_events"


def handle_create_calendar_event(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, None]:
    data = {
        "title": arguments["title"],
        "date": arguments["date"],
    }
    for field in ("time", "end_date", "notes"):
        if arguments.get(field):
            data[field] = arguments[field]
    args = {"resource": CALENDAR_RESOURCE, "data": data}
    return handle_create_workspace_record(database, user_id, args)


def handle_list_calendar_events(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    args = {"resource": CALENDAR_RESOURCE}
    return handle_list_workspace_records(database, user_id, args)


def handle_delete_calendar_event(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, None]:
    args = {"resource": CALENDAR_RESOURCE, "record_id": arguments["event_id"]}
    return handle_delete_workspace_record(database, user_id, args)
