import base64
import fnmatch
import json
import mimetypes
import os
import re
import shutil
import uuid
from datetime import datetime, timezone

from app.db import SqlClient

from app.core.config import settings


def _user_base(user_id: str) -> str:
    """Return the base storage path for a user's workspaces."""
    base = os.path.abspath(settings.workspace_storage_path)
    return os.path.join(base, user_id)


def _sanitize_workspace_id(workspace_id: str) -> str:
    """Sanitize workspace identifier to prevent path traversal."""
    if not workspace_id:
        return "default"
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "-", workspace_id.strip()).strip("-")
    return cleaned or "default"


def _workspace_root(user_id: str, workspace_id: str = "default") -> str:
    """Return the absolute disk path for a specific user workspace."""
    ws_id = _sanitize_workspace_id(workspace_id)
    return os.path.join(_user_base(user_id), ws_id)


def _safe_path(user_id: str, relative_path: str, workspace_id: str = "default") -> str:
    """Resolve a relative path inside the user workspace, rejecting traversal and symlinks."""
    if "\x00" in relative_path or relative_path.startswith("/") or relative_path.startswith("\\"):
        raise ValueError("Path traversal is not allowed.")
    # Reject absolute/parent traversal via path parts
    parts = relative_path.replace("\\", "/").split("/")
    for part in parts:
        if part in (".", "..", "") and relative_path not in ("", "."):
            if part == "..":
                raise ValueError("Path traversal is not allowed.")
    root = os.path.abspath(_workspace_root(user_id, workspace_id))
    resolved = os.path.abspath(os.path.join(root, relative_path))
    # Canonical check against symlink escape
    real_root = os.path.realpath(root)
    real_resolved = os.path.realpath(resolved)
    if not (real_resolved == real_root or real_resolved.startswith(real_root + os.sep)):
        raise ValueError("Path traversal is not allowed.")
    # Disallow direct access to metadata / hidden files
    filename = os.path.basename(real_resolved)
    if filename.startswith(".workspaces") or filename == ".git":
        raise ValueError("Access denied.")
    return resolved


def _metadata_file(user_id: str) -> str:
    """Return path to the workspaces metadata JSON file."""
    return os.path.join(_user_base(user_id), ".workspaces.json")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_workspaces_metadata(user_id: str) -> list[dict]:
    """Load workspace list from metadata file or initialize default workspace."""
    meta_path = _metadata_file(user_id)
    user_root = _user_base(user_id)
    os.makedirs(user_root, exist_ok=True)

    if os.path.isfile(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except (json.JSONDecodeError, OSError):
            pass

    # Discover existing directories if metadata file is absent
    workspaces = []
    if os.path.isdir(user_root):
        for entry in os.scandir(user_root):
            if entry.is_dir() and not entry.name.startswith("."):
                workspaces.append({
                    "id": entry.name,
                    "name": entry.name.replace("-", " ").replace("_", " ").title(),
                    "created_at": _now_iso(),
                    "updated_at": _now_iso(),
                })

    if not workspaces:
        workspaces.append({
            "id": "default",
            "name": "Default Workspace",
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        })
        os.makedirs(os.path.join(user_root, "default"), exist_ok=True)

    _save_workspaces_metadata(user_id, workspaces)
    return workspaces


def _save_workspaces_metadata(user_id: str, workspaces: list[dict]) -> None:
    """Save workspace list to metadata file."""
    meta_path = _metadata_file(user_id)
    os.makedirs(os.path.dirname(meta_path), exist_ok=True)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(workspaces, f, indent=2)


def _count_workspace_files(user_id: str, workspace_id: str) -> int:
    """Count non-directory files inside a workspace."""
    root = _workspace_root(user_id, workspace_id)
    if not os.path.isdir(root):
        return 0
    count = 0
    for _, _, filenames in os.walk(root):
        count += len(filenames)
    return count


def list_workspaces(user_id: str) -> list[dict]:
    """List all workspaces for a user with their file counts."""
    workspaces = _load_workspaces_metadata(user_id)
    result = []
    for ws in workspaces:
        count = _count_workspace_files(user_id, ws["id"])
        result.append({
            "id": ws["id"],
            "name": ws.get("name", ws["id"]),
            "created_at": ws.get("created_at", _now_iso()),
            "updated_at": ws.get("updated_at", _now_iso()),
            "file_count": count,
        })
    return result


def create_workspace(user_id: str, name: str) -> dict:
    """Create a new workspace directory and update metadata."""
    name_clean = name.strip()
    if not name_clean:
        raise ValueError("Workspace name cannot be empty.")

    workspaces = _load_workspaces_metadata(user_id)
    base_slug = re.sub(r"[^a-zA-Z0-9_-]", "-", name_clean.lower()).strip("-") or "workspace"
    ws_id = base_slug

    existing_ids = {ws["id"] for ws in workspaces}
    if ws_id in existing_ids:
        ws_id = f"{base_slug}-{uuid.uuid4().hex[:6]}"

    ws_root = _workspace_root(user_id, ws_id)
    os.makedirs(ws_root, exist_ok=True)

    now = _now_iso()
    new_ws = {
        "id": ws_id,
        "name": name_clean,
        "created_at": now,
        "updated_at": now,
    }
    workspaces.append(new_ws)
    _save_workspaces_metadata(user_id, workspaces)

    return {**new_ws, "file_count": 0}


def rename_workspace(user_id: str, workspace_id: str, new_name: str) -> dict:
    """Rename a workspace's display name."""
    name_clean = new_name.strip()
    if not name_clean:
        raise ValueError("Workspace name cannot be empty.")

    workspaces = _load_workspaces_metadata(user_id)
    ws_id = _sanitize_workspace_id(workspace_id)

    target = None
    for ws in workspaces:
        if ws["id"] == ws_id:
            target = ws
            break

    if not target:
        raise FileNotFoundError(f"Workspace '{workspace_id}' not found.")

    target["name"] = name_clean
    target["updated_at"] = _now_iso()
    _save_workspaces_metadata(user_id, workspaces)

    count = _count_workspace_files(user_id, ws_id)
    return {**target, "file_count": count}


def delete_workspace(user_id: str, workspace_id: str) -> bool:
    """Delete a workspace directory and its files."""
    ws_id = _sanitize_workspace_id(workspace_id)
    workspaces = _load_workspaces_metadata(user_id)

    target_idx = None
    for i, ws in enumerate(workspaces):
        if ws["id"] == ws_id:
            target_idx = i
            break

    if target_idx is None:
        return False

    # Delete files on disk
    ws_root = _workspace_root(user_id, ws_id)
    if os.path.isdir(ws_root):
        shutil.rmtree(ws_root, ignore_errors=True)

    workspaces.pop(target_idx)

    # Ensure at least one workspace exists
    if not workspaces:
        workspaces.append({
            "id": "default",
            "name": "Default Workspace",
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        })
        os.makedirs(os.path.join(_user_base(user_id), "default"), exist_ok=True)

    _save_workspaces_metadata(user_id, workspaces)
    return True


def list_tree(user_id: str, workspace_id: str = "default") -> list[dict]:
    """Walk the specified workspace directory and return a flat list of file nodes."""
    root = _workspace_root(user_id, workspace_id)
    if not os.path.isdir(root):
        return []
    nodes = []
    for dirpath, dirnames, filenames in os.walk(root):
        # Exclude hidden directories like .git
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        rel_dir = os.path.relpath(dirpath, root)
        if rel_dir == ".":
            rel_dir = ""
        for dirname in dirnames:
            path = os.path.join(rel_dir, dirname).replace("\\", "/") if rel_dir else dirname
            nodes.append({"path": path, "name": dirname, "is_directory": True, "size": 0})
        for filename in filenames:
            if filename.startswith(".workspaces"):
                continue
            path = os.path.join(rel_dir, filename).replace("\\", "/") if rel_dir else filename
            full_path = os.path.join(dirpath, filename)
            stat = os.stat(full_path)
            mime, _ = mimetypes.guess_type(filename)
            nodes.append({
                "path": path,
                "name": filename,
                "is_directory": False,
                "size": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "mime_type": mime,
            })
    return nodes


def read_file(user_id: str, relative_path: str, workspace_id: str = "default") -> tuple[str, int]:
    """Read file content as UTF-8 text. Returns (content, size). Cap 1MB read."""
    full_path = _safe_path(user_id, relative_path, workspace_id)
    if not os.path.isfile(full_path):
        raise FileNotFoundError(f"File not found: {relative_path}")
    size = os.path.getsize(full_path)
    if size > 1 * 1024 * 1024:
        raise ValueError("File too large to read (max 1MB).")
    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read(1 * 1024 * 1024 + 1)
        if len(content) > 1 * 1024 * 1024:
            raise ValueError("File too large.")
    return content, size


def write_file(
    user_id: str,
    relative_path: str,
    content: str,
    encoding: str = "utf-8",
    workspace_id: str = "default",
) -> int:
    """Write content to a file. Creates parent directories as needed. Returns bytes written."""
    full_path = _safe_path(user_id, relative_path, workspace_id)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    if encoding == "base64":
        try:
            data = base64.b64decode(content, validate=True)
        except Exception:
            raise ValueError("Invalid base64 content.")
        if len(data) > 2 * 1024 * 1024:
            raise ValueError("File too large (max 2MB).")
        with open(full_path, "wb") as f:
            f.write(data)
        return len(data)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
    return len(content.encode("utf-8"))


def delete_file(user_id: str, relative_path: str, workspace_id: str = "default") -> bool:
    """Delete a file from the workspace. Returns True if deleted."""
    full_path = _safe_path(user_id, relative_path, workspace_id)
    if not os.path.isfile(full_path):
        return False
    os.remove(full_path)
    # Clean up empty parent directories
    parent = os.path.dirname(full_path)
    root = _workspace_root(user_id, workspace_id)
    while parent != root and os.path.isdir(parent) and not os.listdir(parent):
        os.rmdir(parent)
        parent = os.path.dirname(parent)
    return True


def search_files(
    user_id: str,
    query: str,
    file_glob: str | None = None,
    workspace_id: str = "default",
) -> list[dict]:
    """Search for text content across workspace files. Returns matching file paths and line numbers."""
    root = _workspace_root(user_id, workspace_id)
    if not os.path.isdir(root):
        return []
    matches = []
    query_lower = query.lower()
    TEXT_EXTENSIONS = {
        ".py", ".js", ".jsx", ".ts", ".tsx", ".css", ".html", ".json", ".md", ".txt",
        ".yaml", ".yml", ".toml", ".cfg", ".ini", ".sh", ".bat", ".rs", ".go", ".java",
        ".c", ".cpp", ".h", ".hpp", ".rb", ".php", ".sql", ".xml", ".csv", ".env",
        ".gitignore", ".sdignore",
    }
    for dirpath, _, filenames in os.walk(root):
        for filename in filenames:
            _, ext = os.path.splitext(filename)
            if ext.lower() not in TEXT_EXTENSIONS:
                continue
            rel_path = os.path.relpath(os.path.join(dirpath, filename), root).replace("\\", "/")
            if file_glob and not fnmatch.fnmatch(rel_path, file_glob):
                continue
            full_path = os.path.join(dirpath, filename)
            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    for line_num, line in enumerate(f, 1):
                        if query_lower in line.lower():
                            matches.append({
                                "path": rel_path,
                                "line": line_num,
                                "content": line.strip()[:200],
                            })
                            if len(matches) >= 100:
                                return matches
            except OSError:
                continue
    return matches

