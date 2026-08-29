"""Navigation handlers — single responsibility: page navigation and record opening."""

from app.db import SqlClient

from app.services.eve.constants import WORKSPACE_PAGES
from app.services.eve.workspace_records import _clean_record_id


def handle_navigate_page(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, dict]:
    page = arguments["page"]
    if page not in WORKSPACE_PAGES:
        raise ValueError("Unsupported page.")
    return {"queued": True, "page": page}, None, {"type": "navigate_page", "page": page}


def handle_open_record(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, dict]:
    resource = arguments["resource"]
    record_id = _clean_record_id(resource, arguments["record_id"])
    page = "project-detail" if resource == "projects" else "document-opener"
    id_key = "projectId" if resource == "projects" else "documentId"
    action_id = f"project-{record_id}" if resource == "projects" and not record_id.startswith("project-") else record_id
    return {"queued": True, "resource": resource, "record_id": record_id}, None, {"type": "open_record", "page": page, id_key: action_id}


def handle_refresh_workspace_data(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, dict]:
    return {"queued": True}, None, {"type": "refresh_workspace_data"}


def handle_open_studio_project(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, dict]:
    """Open a Studio project in the builder view (emitted by Studio tools)."""
    project_id = _clean_record_id("studio", arguments["project_id"])
    return (
        {"queued": True, "projectId": project_id},
        None,
        {"type": "open_studio_project", "projectId": project_id},
    )
