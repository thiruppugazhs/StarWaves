"""Schemas for authenticated 3D modeling projects and their assets."""

from typing import Any

from pydantic import BaseModel, Field


class ModelingProjectCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    workspace_id: str = Field(default="default", min_length=1, max_length=80)


class ModelingProjectUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)


class ModelingVersionCreateRequest(BaseModel):
    scene: dict[str, Any] = Field(default_factory=dict)
    message: str = Field(default="Manual save", max_length=240)


class ModelingAssetResponse(BaseModel):
    id: str
    filename: str
    relative_path: str
    content_type: str
    size: int
    asset_set_id: str | None = None
    url: str
    created_at: str


class ModelingVersionResponse(BaseModel):
    id: str
    message: str
    created_at: str
    scene: dict[str, Any]


class ModelingProjectResponse(BaseModel):
    id: str
    name: str
    workspace_id: str
    schema_version: int
    created_at: str
    updated_at: str
    current_version_id: str | None = None
    scene: dict[str, Any] = Field(default_factory=dict)
    assets: list[ModelingAssetResponse] = Field(default_factory=list)


class ModelingProjectListResponse(BaseModel):
    projects: list[ModelingProjectResponse]
