"""Studio template catalog — single responsibility: registry + scaffold application."""

import os

from app.repositories import workspace_files as ws_repo
from app.services.studio.constants import MAX_BATCH_FILES
from app.services.studio.templates.api import API_TEMPLATES
from app.services.studio.templates.fullstack import FULLSTACK_TEMPLATES
from app.services.studio.templates.saas import SAAS_TEMPLATES
from app.services.studio.templates.web import WEB_TEMPLATES

CURATED_TEMPLATES = {
    template["id"]: template
    for template in [*WEB_TEMPLATES, *SAAS_TEMPLATES, *API_TEMPLATES, *FULLSTACK_TEMPLATES]
}


def list_curated_templates() -> list[dict]:
    """Curated catalog summaries (no file bodies)."""
    return [
        {
            "id": t["id"],
            "name": t["name"],
            "description": t.get("description", ""),
            "stack": t.get("stack", ""),
            "kind": "curated",
            "source_project_id": None,
        }
        for t in CURATED_TEMPLATES.values()
    ]


def get_template(template_id: str) -> dict | None:
    return CURATED_TEMPLATES.get(template_id)


def scaffold_from_template(user_id: str, workspace_id: str, template: dict) -> int:
    """Write template files into a studio workspace. Returns number of files written."""
    files = template.get("files", [])
    if not files:
        return 0
    if len(files) > MAX_BATCH_FILES:
        raise ValueError(
            f"Template '{template['id']}' exceeds the {MAX_BATCH_FILES}-file scaffold cap."
        )
    for entry in files:
        ws_repo.write_file(user_id, entry["path"], entry["content"], workspace_id=workspace_id)
    return len(files)


def snapshot_workspace_as_template_files(user_id: str, workspace_id: str) -> list[dict]:
    """Read every text file in a workspace to build a custom template definition."""
    nodes = ws_repo.list_tree(user_id, workspace_id)
    files = []
    for node in nodes:
        if node.get("is_directory"):
            continue
        content, _size = ws_repo.read_file(user_id, node["path"], workspace_id=workspace_id)
        files.append({"path": node["path"], "content": content})
    return files


def write_snapshot_into_workspace(
    user_id: str, target_workspace_id: str, files: list[dict]
) -> int:
    """Materialize template snapshot files into a fresh workspace."""
    for entry in files:
        ws_repo.write_file(
            user_id, entry["path"], entry["content"], workspace_id=target_workspace_id
        )
    return len(files)


def ensure_gitignore(user_id: str, workspace_id: str) -> bool:
    """Guarantee a .gitignore exists so git init never commits junk. Returns True if created."""
    root = ws_repo._workspace_root(user_id, workspace_id)
    gitignore_path = os.path.join(root, ".gitignore")
    if os.path.exists(gitignore_path):
        return False
    ws_repo.write_file(
        user_id,
        ".gitignore",
        "node_modules/\ndist/\nbuild/\n__pycache__/\n*.db\n.env\n.env.*\n!.env.example\n",
        workspace_id=workspace_id,
    )
    return True
