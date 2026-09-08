"""Modeling project service boundary for project and asset operations."""

from pathlib import Path

from app.repositories import modeling_projects


def list_projects(user_id: str) -> list[dict]:
    return modeling_projects.list_projects(user_id)


def create_project(user_id: str, name: str, workspace_id: str) -> dict:
    return modeling_projects.create_project(user_id, name, workspace_id)


def get_project(user_id: str, project_id: str, workspace_id: str) -> dict:
    return modeling_projects.get_project(user_id, project_id, workspace_id)


def update_project(user_id: str, project_id: str, name: str | None, workspace_id: str) -> dict:
    return modeling_projects.update_project(user_id, project_id, name, workspace_id)


def delete_project(user_id: str, project_id: str, workspace_id: str) -> None:
    modeling_projects.delete_project(user_id, project_id, workspace_id)


def save_version(user_id: str, project_id: str, scene: dict, message: str, workspace_id: str) -> dict:
    return modeling_projects.save_version(user_id, project_id, scene, message, workspace_id)


def get_version(user_id: str, project_id: str, version_id: str, workspace_id: str) -> dict:
    return modeling_projects.get_version(user_id, project_id, version_id, workspace_id)


def save_asset(user_id: str, project_id: str, filename: str, content: bytes, content_type: str, relative_path: str | None, asset_set_id: str | None, workspace_id: str) -> dict:
    return modeling_projects.save_asset(user_id, project_id, filename, content, content_type, relative_path, asset_set_id, workspace_id)


def list_assets(user_id: str, project_id: str, workspace_id: str) -> list[dict]:
    return modeling_projects.list_assets(user_id, project_id, workspace_id)


def get_asset_path(user_id: str, project_id: str, asset_id: str, workspace_id: str) -> tuple[Path, dict]:
    return modeling_projects.get_asset_path(user_id, project_id, asset_id, workspace_id)


def delete_asset(user_id: str, project_id: str, asset_id: str, workspace_id: str) -> None:
    modeling_projects.delete_asset(user_id, project_id, asset_id, workspace_id)
