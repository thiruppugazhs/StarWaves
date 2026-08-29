"""Studio repository — single responsibility: Studio project metadata on top of workspaces.

Studio projects are regular code workspaces (same disk isolation as
``workspace_files``) flagged with ``type: "studio"`` plus builder metadata
(template, stack, DB preference, build status, plan, git state). Metadata is
persisted in the same per-user ``.workspaces.json`` file so both features stay
in sync.
"""

import uuid
from datetime import datetime, timezone

from app.db import SqlClient

from app.repositories import workspace_files as ws_repo

STUDIO_TYPE = "studio"

_STUDIO_DEFAULTS = {
    "description": "",
    "template_id": None,
    "stack": "",
    "db_preference": "sqlite",
    "auth_enabled": False,
    "build_status": "draft",
    "plan_status": "none",
    "plan": None,
    "git_initialized": False,
    "github_repo_url": None,
    "published_template_id": None,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _with_studio_defaults(entry: dict) -> dict:
    merged = {**entry, **{k: entry.get(k, v) for k, v in _STUDIO_DEFAULTS.items()}}
    merged.setdefault("type", "default")
    return merged


def get_studio_project(user_id: str, workspace_id: str) -> dict:
    """Return one studio project (metadata + file count) or raise FileNotFoundError."""
    workspaces = ws_repo._load_workspaces_metadata(user_id)
    ws_id = ws_repo._sanitize_workspace_id(workspace_id)
    for entry in workspaces:
        if entry.get("id") == ws_id and entry.get("type") == STUDIO_TYPE:
            project = _with_studio_defaults(entry)
            project["file_count"] = ws_repo._count_workspace_files(user_id, ws_id)
            return project
    raise FileNotFoundError(f"Studio project '{workspace_id}' not found.")


def list_studio_projects(user_id: str) -> list[dict]:
    """List all studio projects for a user, newest first."""
    workspaces = ws_repo._load_workspaces_metadata(user_id)
    projects = []
    for entry in workspaces:
        if entry.get("type") != STUDIO_TYPE:
            continue
        project = _with_studio_defaults(entry)
        project["file_count"] = ws_repo._count_workspace_files(user_id, entry["id"])
        projects.append(project)
    projects.sort(key=lambda p: p.get("created_at", ""), reverse=True)
    return projects


def create_studio_project(
    user_id: str,
    name: str,
    *,
    description: str = "",
    template_id: str | None = None,
    stack: str = "",
    db_preference: str = "sqlite",
    auth_enabled: bool = False,
) -> dict:
    """Create a new studio workspace directory with builder metadata."""
    name_clean = name.strip()
    if not name_clean:
        raise ValueError("Project name cannot be empty.")

    workspaces = ws_repo._load_workspaces_metadata(user_id)
    base_slug = ws_repo._sanitize_workspace_id(name_clean.lower().replace(" ", "-"))
    ws_id = base_slug or "project"
    existing_ids = {ws["id"] for ws in workspaces}
    if ws_id in existing_ids:
        ws_id = f"{base_slug}-{uuid.uuid4().hex[:6]}"

    ws_root = ws_repo._workspace_root(user_id, ws_id)
    import os

    os.makedirs(ws_root, exist_ok=True)

    now = _now_iso()
    project = {
        "id": ws_id,
        "name": name_clean,
        "type": STUDIO_TYPE,
        "description": description.strip(),
        "template_id": template_id,
        "stack": stack,
        "db_preference": db_preference,
        "auth_enabled": auth_enabled,
        "created_at": now,
        "updated_at": now,
    }
    workspaces.append(project)
    ws_repo._save_workspaces_metadata(user_id, workspaces)
    return {**_with_studio_defaults(project), "file_count": 0}


def update_studio_project(user_id: str, workspace_id: str, updates: dict) -> dict:
    """Patch editable studio fields; returns the updated project."""
    workspaces = ws_repo._load_workspaces_metadata(user_id)
    ws_id = ws_repo._sanitize_workspace_id(workspace_id)

    allowed = (
        "name",
        "description",
        "db_preference",
        "auth_enabled",
        "build_status",
        "plan_status",
        "plan",
        "git_initialized",
        "github_repo_url",
        "published_template_id",
        "stack",
        "template_id",
    )
    target = None
    for entry in workspaces:
        if entry.get("id") == ws_id and entry.get("type") == STUDIO_TYPE:
            target = entry
            break
    if target is None:
        raise FileNotFoundError(f"Studio project '{workspace_id}' not found.")

    for key in allowed:
        if key in updates and updates[key] is not None:
            target[key] = updates[key]
    target["updated_at"] = _now_iso()
    ws_repo._save_workspaces_metadata(user_id, workspaces)

    project = _with_studio_defaults(target)
    project["file_count"] = ws_repo._count_workspace_files(user_id, ws_id)
    return project


def delete_studio_project(user_id: str, workspace_id: str) -> bool:
    """Delete a studio project (directory + metadata). Returns True if deleted."""
    workspaces = ws_repo._load_workspaces_metadata(user_id)
    ws_id = ws_repo._sanitize_workspace_id(workspace_id)
    remaining = [
        ws for ws in workspaces
        if not (ws.get("id") == ws_id and ws.get("type") == STUDIO_TYPE)
    ]
    if len(remaining) == len(workspaces):
        return False
    import shutil

    shutil.rmtree(ws_repo._workspace_root(user_id, ws_id), ignore_errors=True)
    ws_repo._save_workspaces_metadata(user_id, remaining)
    return True


def publish_as_template(user_id: str, workspace_id: str) -> str:
    """Mark a studio project as a reusable personal template. Returns template id."""
    template_id = f"custom-{ws_repo._sanitize_workspace_id(workspace_id)}"
    update_studio_project(
        user_id,
        workspace_id,
        {"published_template_id": template_id},
    )
    return template_id


def find_template_source(user_id: str, template_id: str) -> dict:
    """Find the studio project published under the given custom template id."""
    projects = list_studio_projects(user_id)
    for project in projects:
        if project.get("published_template_id") == template_id:
            return project
    raise FileNotFoundError(f"Template '{template_id}' not found.")


def unpublish_template(database: SqlClient, user_id: str, workspace_id: str) -> None:  # noqa: ARG001
    """Remove the published-template flag from a studio project."""
    update_studio_project(user_id, workspace_id, {"published_template_id": None})
