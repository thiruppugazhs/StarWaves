"""Eve avatar schemas — preferences + upload shapes."""

from typing import Any

from pydantic import BaseModel, Field


class EveAvatarPrefs(BaseModel):
    enabled: bool = True
    renderer: str = Field(default="auto", pattern="^(auto|vrm|live2d)$")
    modelId: str = Field(default="eve-anime-vrm", max_length=120)
    modelUrl: str | None = Field(default=None, max_length=1000)
    scale: float = Field(default=1.0, ge=0.8, le=1.2)
    zoom: float = Field(default=1.0, ge=0.3, le=3.0)
    userPan: dict[str, float] | None = None
    autoRotate: bool = False
    position: dict[str, float] | None = None
    docked: bool = True
    motion: str = Field(default="auto", pattern="^(auto|on|reduced)$")
    inlineEnabled: bool = True
    orbFallback: bool = True


class EveAvatarPrefsRequest(BaseModel):
    enabled: bool | None = None
    renderer: str | None = Field(default=None, pattern="^(auto|vrm|live2d)$")
    modelId: str | None = Field(default=None, max_length=120)
    modelUrl: str | None = Field(default=None, max_length=1000)
    scale: float | None = Field(default=None, ge=0.8, le=1.2)
    zoom: float | None = Field(default=None, ge=0.3, le=3.0)
    userPan: dict[str, float] | None = None
    autoRotate: bool | None = None
    position: dict[str, float] | None = None
    docked: bool | None = None
    motion: str | None = Field(default=None, pattern="^(auto|on|reduced)$")
    inlineEnabled: bool | None = None
    orbFallback: bool | None = None


class EveAvatarPrefsResponse(BaseModel):
    preferences: EveAvatarPrefs
    available_models: list[dict[str, Any]] = Field(default_factory=list)


class EveAvatarUploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=260)
    content_base64: str = Field(min_length=1)


class EveAvatarModelsResponse(BaseModel):
    models: list[dict[str, Any]]
    has_more: bool = False
    next_cursor: str | None = None
