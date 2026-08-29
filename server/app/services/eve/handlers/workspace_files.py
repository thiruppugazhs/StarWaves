"""Workspace file handlers — single responsibility: code workspace file operations."""

from app.db import SqlClient


def handle_read_workspace_file(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.repositories import workspace_files as ws_repo

    ws_id = arguments.get("workspace_id", "default")
    try:
        content, size = ws_repo.read_file(user_id, arguments["path"], workspace_id=ws_id)
    except FileNotFoundError:
        raise ValueError(f"File not found: {arguments['path']}")
    return {"path": arguments["path"], "content": content, "size": size}, None, None


def handle_write_workspace_file(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, None]:
    from app.repositories import workspace_files as ws_repo

    ws_id = arguments.get("workspace_id", "default")
    size = ws_repo.write_file(user_id, arguments["path"], arguments["content"], workspace_id=ws_id)
    return {"path": arguments["path"], "size": size, "written": True}, "workspace-files", None


def handle_list_workspace_files(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.repositories import workspace_files as ws_repo

    ws_id = arguments.get("workspace_id", "default")
    files = ws_repo.list_tree(user_id, workspace_id=ws_id)
    directory = arguments.get("directory")
    if directory:
        prefix = directory.rstrip("/") + "/"
        files = [f for f in files if f["path"].startswith(prefix) or f["path"] == directory.rstrip("/")]
    return {"files": files, "total": len(files)}, None, None


def handle_search_workspace_files(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.repositories import workspace_files as ws_repo

    ws_id = arguments.get("workspace_id", "default")
    matches = ws_repo.search_files(user_id, arguments["query"], arguments.get("file_glob"), workspace_id=ws_id)
    return {"matches": matches, "total": len(matches)}, None, None


def handle_run_workspace_command(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.core.config import settings
    from app.services.studio.commands import run_workspace_command as _run_studio_command

    if getattr(settings, "is_serverless", False):
        raise ValueError("Command execution is not available in serverless mode.")
    ws_id = arguments.get("workspace_id", "default")
    command = arguments.get("command") or ""
    if not command.strip():
        raise ValueError("command must not be empty.")
    result = _run_studio_command(user_id, ws_id, command, timeout_seconds=30)
    return {
        "stdout": result.get("stdout", "")[:5000],
        "stderr": result.get("stderr", "")[:2000],
        "exit_code": result.get("exit_code", result.get("returncode", 0)),
    }, None, None


def handle_open_workspace_browser(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, dict]:
    """Emit a frontend action that opens the given URL in the workspace browser panel."""
    url = arguments["url"].strip()
    if not url:
        raise ValueError("url must not be empty.")
    return {"opened": True, "url": url}, None, {"type": "open_browser_url", "url": url}
