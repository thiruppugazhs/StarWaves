"""Eve Studio handlers — single responsibility: builder tool executions.

Handlers run synchronously inside Eve's tool loop (already executed off the
event loop via ``asyncio.to_thread``), so disk/process work is safe here.
"""

from app.db import SqlClient

from app.services.studio import commands as studio_commands
from app.services.studio import projects as studio_projects


def handle_create_studio_project(database: SqlClient, user_id: str, arguments: dict):
    from app.schemas.studio import StudioProjectCreateRequest

    payload = StudioProjectCreateRequest(
        name=arguments["name"],
        description=arguments.get("description", ""),
        template_id=arguments.get("template_id"),
        stack=arguments.get("stack", ""),
        db_preference=arguments.get("db_preference", "sqlite"),
        auth_enabled=bool(arguments.get("auth_enabled", False)),
    )
    project = studio_projects.create_project(user_id, payload)
    warnings = project.pop("warnings", None)
    result = {
        "project": {
            "id": project["id"],
            "name": project["name"],
            "template_id": project.get("template_id"),
            "stack": project.get("stack", ""),
            "git_initialized": project.get("git_initialized", False),
            "file_count": project.get("file_count", 0),
        }
    }
    if warnings:
        result["warnings"] = warnings
    return (
        result,
        "studio-projects",
        {"type": "open_studio_project", "projectId": project["id"]},
    )


def handle_list_studio_projects(database: SqlClient, user_id: str, arguments: dict):
    projects = studio_projects.list_projects(user_id)
    return {
        "projects": [
            {
                "id": p["id"],
                "name": p["name"],
                "build_status": p.get("build_status", "draft"),
                "plan_status": p.get("plan_status", "none"),
                "stack": p.get("stack", ""),
                "db_preference": p.get("db_preference", "sqlite"),
                "auth_enabled": bool(p.get("auth_enabled", False)),
                "file_count": p.get("file_count", 0),
            }
            for p in projects
        ],
        "total": len(projects),
    }, None, None


def handle_get_studio_project(database: SqlClient, user_id: str, arguments: dict):
    try:
        project = studio_projects.get_project(user_id, arguments["workspace_id"])
    except FileNotFoundError as error:
        raise ValueError(str(error)) from error
    git = project.get("git") or {}
    return {
        "id": project["id"],
        "name": project["name"],
        "description": project.get("description", ""),
        "stack": project.get("stack", ""),
        "db_preference": project.get("db_preference", "sqlite"),
        "auth_enabled": bool(project.get("auth_enabled", False)),
        "build_status": project.get("build_status", "draft"),
        "plan_status": project.get("plan_status", "none"),
        "plan": project.get("plan"),
        "git": {
            "initialized": git.get("initialized", False),
            "branch": git.get("branch"),
            "changed_files": git.get("changed_files", []),
            "remote_url": git.get("remote_url"),
        },
        "file_count": project.get("file_count", 0),
    }, None, None


def handle_submit_build_plan(database: SqlClient, user_id: str, arguments: dict):
    try:
        project = studio_projects.save_plan(
            user_id,
            arguments["workspace_id"],
            arguments,
        )
    except FileNotFoundError as error:
        raise ValueError(str(error)) from error
    return (
        {
            "submitted": True,
            "plan_status": project.get("plan_status", "proposed"),
            "message": (
                "Plan submitted. The user must approve it in the Studio UI before "
                "building starts."
            ),
        },
        None,
        {
            "type": "show_build_approval",
            "projectId": arguments["workspace_id"],
        },
    )


def handle_write_studio_files(database: SqlClient, user_id: str, arguments: dict):
    workspace_id = arguments["workspace_id"]
    try:
        project = studio_projects.get_project(user_id, workspace_id)
    except FileNotFoundError as error:
        raise ValueError(str(error)) from error
    if project.get("plan_status") != "approved":
        raise ValueError(
            "Build plan is not approved yet. Wait for the user to approve the plan "
            "in the Studio UI before writing files."
        )
    result = studio_projects.write_batch_files(
        user_id,
        workspace_id,
        arguments["files"],
    )
    return result, "studio-projects", None


def handle_run_studio_command(database: SqlClient, user_id: str, arguments: dict):
    timeout = int(arguments.get("timeout_seconds", 300))
    try:
        result = studio_commands.run_workspace_command(
            user_id,
            arguments["workspace_id"],
            arguments["command"],
            timeout,
        )
    except studio_commands.CommandNotAllowedError as error:
        raise ValueError(str(error)) from error
    return result, None, None


def handle_publish_studio_template(database: SqlClient, user_id: str, arguments: dict):
    try:
        result = studio_projects.publish_template(user_id, arguments["workspace_id"])
    except FileNotFoundError as error:
        raise ValueError(str(error)) from error
    return result, "studio-projects", None
