"""Studio project service — single responsibility: orchestrate repo, git, templates, plans."""

from app.repositories import studio as studio_repo
from app.repositories import workspace_files as ws_repo
from app.services.studio import git_ops
from app.services.studio.templates import (
    get_template,
    scaffold_from_template,
    snapshot_workspace_as_template_files,
)


def list_projects(user_id: str) -> list[dict]:
    return studio_repo.list_studio_projects(user_id)


def get_project(user_id: str, workspace_id: str) -> dict:
    project = studio_repo.get_studio_project(user_id, workspace_id)
    project["git"] = git_ops.status(user_id, workspace_id)
    return project


def create_project(user_id: str, payload: dict) -> dict:
    """Create a studio project; scaffold the chosen template and init git."""
    template = None
    if payload.template_id:
        if payload.template_id.startswith("custom-"):
            source = studio_repo.find_template_source(user_id, payload.template_id)
            template = {
                "id": payload.template_id,
                "name": source["name"],
                "stack": source.get("stack", ""),
                "files": snapshot_workspace_as_template_files(user_id, source["id"]),
            }
        else:
            template = get_template(payload.template_id)
            if template is None:
                raise ValueError(f"Unknown template '{payload.template_id}'.")

    project = studio_repo.create_studio_project(
        user_id,
        payload.name,
        description=payload.description,
        template_id=payload.template_id,
        stack=template.get("stack", payload.stack) if template else payload.stack,
        db_preference=payload.db_preference,
        auth_enabled=payload.auth_enabled,
    )
    workspace_id = project["id"]

    warnings: list[str] = []
    if template is not None:
        try:
            scaffold_from_template(user_id, workspace_id, template)
        except (OSError, ValueError) as error:
            warnings.append(f"Template scaffold failed: {error}")

    git_initialized = git_ops.ensure_initialized(user_id, workspace_id)
    if not git_initialized:
        warnings.append("git is unavailable on the server — version history disabled.")
    if git_ops.is_available():
        try:
            git_ops.commit_all(user_id, workspace_id, "Initial commit by StarWaves Studio")
        except git_ops.GitUnavailableError as error:
            warnings.append(str(error))
    studio_repo.update_studio_project(
        user_id, workspace_id, {"git_initialized": git_initialized}
    )

    refreshed = studio_repo.get_studio_project(user_id, workspace_id)
    refreshed["warnings"] = warnings
    return refreshed


def update_project(user_id: str, workspace_id: str, updates: dict) -> dict:
    return studio_repo.update_studio_project(user_id, workspace_id, updates)


def delete_project(user_id: str, workspace_id: str) -> bool:
    return studio_repo.delete_studio_project(user_id, workspace_id)


def save_plan(user_id: str, workspace_id: str, plan_payload: dict) -> dict:
    """Store a proposed build plan (status 'proposed', awaiting user approval)."""
    plan = {
        "title": plan_payload["title"],
        "summary": plan_payload.get("summary", ""),
        "stack": plan_payload.get("stack", ""),
        "db_preference": plan_payload.get("db_preference", "sqlite"),
        "needs_auth": bool(plan_payload.get("needs_auth", False)),
        "files": [
            {"path": f["path"], "purpose": f.get("purpose", "")}
            for f in plan_payload.get("files", [])
        ],
        "status": "proposed",
    }
    return studio_repo.update_studio_project(
        user_id,
        workspace_id,
        {
            "plan": plan,
            "plan_status": "proposed",
            "build_status": "planned",
            "stack": plan["stack"] or None,
            "db_preference": plan["db_preference"],
            "auth_enabled": plan["needs_auth"],
        },
    )


def set_plan_status(user_id: str, workspace_id: str, status: str) -> dict:
    """Approve or reject the pending plan."""
    project = studio_repo.get_studio_project(user_id, workspace_id)
    if not project.get("plan"):
        raise ValueError("No build plan has been proposed for this project yet.")
    return studio_repo.update_studio_project(
        user_id,
        workspace_id,
        {"plan_status": status},
    )


def write_batch_files(user_id: str, workspace_id: str, files: list[dict]) -> dict:
    """Write a batch of {path, content} files into a studio project (build phase)."""
    from app.services.studio.constants import (
        MAX_BATCH_FILES,
        MAX_BATCH_TOTAL_BYTES,
        MAX_FILE_CONTENT_BYTES,
    )

    if not files:
        raise ValueError("No files provided.")
    if len(files) > MAX_BATCH_FILES:
        raise ValueError(f"Batches are limited to {MAX_BATCH_FILES} files per request.")
    total_bytes = sum(len(f.get("content", "")) for f in files)
    if total_bytes > MAX_BATCH_TOTAL_BYTES:
        raise ValueError(f"Batch too large: {total_bytes} bytes.")
    for entry in files:
        if len(entry.get("content", "")) > MAX_FILE_CONTENT_BYTES:
            raise ValueError(f"File '{entry['path']}' exceeds the per-file size cap.")

    written = 0
    errors: list[str] = []
    for entry in files:
        try:
            ws_repo.write_file(
                user_id, entry["path"], entry.get("content", ""), workspace_id=workspace_id
            )
            written += 1
        except (ValueError, OSError) as error:
            errors.append(f"{entry['path']}: {error}")

    if written:
        studio_repo.update_studio_project(
            user_id, workspace_id, {"build_status": "building"}
        )
    return {"written": written, "errors": errors}


def publish_template(user_id: str, workspace_id: str) -> dict:
    """Publish a studio project as a personal reusable template."""
    template_id = studio_repo.publish_as_template(user_id, workspace_id)
    return {"template_id": template_id}


def remix_template(user_id: str, template_id: str, new_name: str) -> dict:
    """Create a new studio project from a curated or custom template."""
    from app.schemas.studio import StudioProjectCreateRequest

    request = StudioProjectCreateRequest(
        name=new_name,
        description=f"Remixed from template '{template_id}'.",
        template_id=template_id,
    )
    return create_project(user_id, request)
