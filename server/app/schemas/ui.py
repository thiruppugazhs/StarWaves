"""UI preferences schemas — single responsibility: Eve-driven UI customization shapes."""

from typing import Any

from pydantic import BaseModel, Field


class UiPreferencesSnapshot(BaseModel):
    version: int = Field(ge=1)
    global_tokens: dict[str, str] = Field(default_factory=dict)
    global_css: str = Field(default="")
    pages: dict[str, Any] = Field(default_factory=dict)
    history: list[dict[str, Any]] = Field(default_factory=list)
    updated_at: str | None = None


class UiPreferencesResponse(BaseModel):
    preferences: UiPreferencesSnapshot
    available_pages: list[str] = Field(default_factory=list)


class UiUpdateTokensRequest(BaseModel):
    tokens: dict[str, str] = Field(default_factory=dict)
    page: str | None = Field(default=None, max_length=100)
    reason: str | None = Field(default=None, max_length=500)


class UiUpdateCssRequest(BaseModel):
    css: str = Field(min_length=1, max_length=5000)
    page: str | None = Field(default=None, max_length=100)


class UiVisibilityRequest(BaseModel):
    target: str = Field(min_length=1, max_length=100)
    visible: bool
    page: str | None = Field(default=None, max_length=100)


class UiResetRequest(BaseModel):
    page: str | None = Field(default=None, max_length=100)
    version: int | None = Field(default=None, ge=1)


class UiRestoreRequest(BaseModel):
    version: int = Field(ge=1)


class UiHistoryResponse(BaseModel):
    history: list[dict[str, Any]]
    current_version: int
