"""Pydantic schemas for backend-hosted auto-update manifests."""

from typing import Literal

from pydantic import BaseModel, Field


class UpdateCheckResponse(BaseModel):
    updateAvailable: bool = Field(description="True if latest > currentVersion")
    latestVersion: str
    currentVersion: str
    url: str | None = None
    notes: str | None = None
    force: bool = False
    signature: str | None = None
    sha256: str | None = None
    size: int | None = None
    publishedAt: str | None = None
    platform: str
    arch: str | None = None


class TauriPlatformEntry(BaseModel):
    url: str
    signature: str


class TauriLatestResponse(BaseModel):
    version: str
    notes: str | None = None
    pub_date: str | None = None
    platforms: dict[str, TauriPlatformEntry]


class AndroidManifest(BaseModel):
    latestVersion: str
    versionCode: int
    url: str
    notes: str | None = None
    force: bool = False
    sha256: str | None = None
    size: int | None = None
    publishedAt: str | None = None


class OtaManifest(BaseModel):
    bundleId: str
    version: str
    url: str
    checksum: str | None = None
    notes: str | None = None
    publishedAt: str | None = None


PlatformLiteral = Literal["windows", "android", "linux", "macos"]
