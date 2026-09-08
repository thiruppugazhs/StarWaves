"""Filesystem repository for versioned 3D modeling projects.

Modeling projects intentionally live beside workspace storage rather than in
the workspace-file JSON API: model binaries are too large for that API's
request limits. Every path is derived from the authenticated user and a
sanitized project id before it is accessed.
"""

import json
import os
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings

PROJECT_SCHEMA_VERSION = 1
ALLOWED_ASSET_EXTENSIONS = {
    ".vrm",
    ".glb",
    ".gltf",
    ".obj",
    ".fbx",
    ".mtl",
    ".bin",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".ktx2",
    ".basis",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_segment(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "-", str(value or "").strip()).strip("-")
    return cleaned or fallback


def _projects_root(user_id: str, workspace_id: str = "default") -> Path:
    base = Path(settings.workspace_storage_path).expanduser().resolve()
    return base / _safe_segment(user_id, "user") / ".modeling" / _safe_segment(workspace_id, "default")


def _project_root(user_id: str, project_id: str, workspace_id: str = "default") -> Path:
    project = _projects_root(user_id, workspace_id) / _safe_segment(project_id, "project")
    root = _projects_root(user_id, workspace_id).resolve()
    resolved = project.resolve()
    if not str(resolved).startswith(f"{root}{os.sep}"):
        raise ValueError("Invalid modeling project path.")
    return project


def _project_file(root: Path) -> Path:
    return root / "project.json"


def _read_json(path: Path, default: dict | None = None) -> dict:
    if not path.is_file():
        return default or {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Could not read modeling project data: {error}") from error


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def _project_response(data: dict) -> dict:
    return {
        "id": data["id"],
        "name": data["name"],
        "workspace_id": data.get("workspace_id", "default"),
        "schema_version": int(data.get("schema_version", PROJECT_SCHEMA_VERSION)),
        "created_at": data["created_at"],
        "updated_at": data["updated_at"],
        "current_version_id": data.get("current_version_id"),
        "scene": data.get("scene") or {},
        "assets": data.get("assets") or [],
    }


def list_projects(user_id: str) -> list[dict]:
    root = _projects_root(user_id)
    if not root.is_dir():
        return []
    projects = []
    for workspace_root in root.parent.iterdir() if root.parent.is_dir() else []:
        if not workspace_root.is_dir() or workspace_root.name.startswith("."):
            continue
        for project_root in workspace_root.iterdir():
            if project_root.is_dir() and (project_root / "project.json").is_file():
                projects.append(_project_response(_read_json(project_root / "project.json")))
    return sorted(projects, key=lambda project: project["updated_at"], reverse=True)


def create_project(user_id: str, name: str, workspace_id: str = "default") -> dict:
    project_id = uuid.uuid4().hex
    now = _now_iso()
    data = {
        "id": project_id,
        "name": name.strip(),
        "workspace_id": _safe_segment(workspace_id, "default"),
        "schema_version": PROJECT_SCHEMA_VERSION,
        "created_at": now,
        "updated_at": now,
        "current_version_id": None,
        "scene": {},
        "assets": [],
    }
    root = _project_root(user_id, project_id, data["workspace_id"])
    root.mkdir(parents=True, exist_ok=False)
    (root / "versions").mkdir()
    (root / "assets").mkdir()
    _write_json(_project_file(root), data)
    return _project_response(data)


def get_project(user_id: str, project_id: str, workspace_id: str = "default") -> dict:
    root = _project_root(user_id, project_id, workspace_id)
    path = _project_file(root)
    if not path.is_file():
        raise FileNotFoundError("Modeling project not found.")
    return _project_response(_read_json(path))


def update_project(user_id: str, project_id: str, name: str | None, workspace_id: str = "default") -> dict:
    root = _project_root(user_id, project_id, workspace_id)
    path = _project_file(root)
    data = _read_json(path)
    if not data:
        raise FileNotFoundError("Modeling project not found.")
    if name is not None:
        data["name"] = name.strip()
    data["updated_at"] = _now_iso()
    _write_json(path, data)
    return _project_response(data)


def delete_project(user_id: str, project_id: str, workspace_id: str = "default") -> None:
    root = _project_root(user_id, project_id, workspace_id)
    if not _project_file(root).is_file():
        raise FileNotFoundError("Modeling project not found.")
    shutil.rmtree(root)


def save_version(user_id: str, project_id: str, scene: dict, message: str, workspace_id: str = "default") -> dict:
    root = _project_root(user_id, project_id, workspace_id)
    project_path = _project_file(root)
    data = _read_json(project_path)
    if not data:
        raise FileNotFoundError("Modeling project not found.")
    version_id = uuid.uuid4().hex
    created_at = _now_iso()
    version = {"id": version_id, "message": message.strip() or "Manual save", "created_at": created_at, "scene": scene}
    _write_json(root / "versions" / f"{version_id}.json", version)
    data["scene"] = scene
    data["current_version_id"] = version_id
    data["updated_at"] = created_at
    _write_json(project_path, data)
    return version


def get_version(user_id: str, project_id: str, version_id: str, workspace_id: str = "default") -> dict:
    root = _project_root(user_id, project_id, workspace_id)
    path = root / "versions" / f"{_safe_segment(version_id, 'version')}.json"
    if not path.is_file():
        raise FileNotFoundError("Modeling project version not found.")
    return _read_json(path)


def save_asset(
    user_id: str,
    project_id: str,
    filename: str,
    content: bytes,
    content_type: str,
    relative_path: str | None = None,
    asset_set_id: str | None = None,
    workspace_id: str = "default",
) -> dict:
    root = _project_root(user_id, project_id, workspace_id)
    project_path = _project_file(root)
    data = _read_json(project_path)
    if not data:
        raise FileNotFoundError("Modeling project not found.")
    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", Path(filename or "asset").name)[:160]
    extension = Path(safe_name).suffix.lower()
    if extension not in ALLOWED_ASSET_EXTENSIONS:
        raise ValueError("Unsupported modeling asset type.")
    if len(content) > settings.modeling_asset_max_bytes:
        raise ValueError("Modeling asset exceeds the configured size limit.")
    asset_id = uuid.uuid4().hex
    stored_name = f"{asset_id}_{safe_name}"
    asset_path = root / "assets" / stored_name
    asset_path.parent.mkdir(parents=True, exist_ok=True)
    asset_path.write_bytes(content)
    asset = {
        "id": asset_id,
        "filename": safe_name,
        "relative_path": relative_path or safe_name,
        "content_type": content_type or "application/octet-stream",
        "size": len(content),
        "asset_set_id": asset_set_id,
        "url": f"/modeling/projects/{data['id']}/assets/{asset_id}",
        "created_at": _now_iso(),
        "stored_name": stored_name,
    }
    data.setdefault("assets", []).append(asset)
    data["updated_at"] = _now_iso()
    _write_json(project_path, data)
    return {key: value for key, value in asset.items() if key != "stored_name"}


def list_assets(user_id: str, project_id: str, workspace_id: str = "default") -> list[dict]:
    return get_project(user_id, project_id, workspace_id).get("assets", [])


def get_asset_path(user_id: str, project_id: str, asset_id: str, workspace_id: str = "default") -> tuple[Path, dict]:
    root = _project_root(user_id, project_id, workspace_id)
    data = _read_json(_project_file(root))
    for asset in data.get("assets", []):
        if asset.get("id") == asset_id:
            path = root / "assets" / f"{asset_id}_{asset['filename']}"
            if path.is_file():
                return path, asset
    raise FileNotFoundError("Modeling asset not found.")


def delete_asset(user_id: str, project_id: str, asset_id: str, workspace_id: str = "default") -> None:
    root = _project_root(user_id, project_id, workspace_id)
    project_path = _project_file(root)
    data = _read_json(project_path)
    assets = data.get("assets", [])
    target = next((asset for asset in assets if asset.get("id") == asset_id), None)
    if target is None:
        raise FileNotFoundError("Modeling asset not found.")
    (root / "assets" / f"{asset_id}_{target['filename']}").unlink(missing_ok=True)
    data["assets"] = [asset for asset in assets if asset.get("id") != asset_id]
    data["updated_at"] = _now_iso()
    _write_json(project_path, data)
