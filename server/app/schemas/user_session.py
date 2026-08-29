"""Pydantic schemas for multi-device user sessions."""

from pydantic import BaseModel, Field


class DeviceSessionResponse(BaseModel):
    id: str
    device_id: str
    device_name: str
    user_agent: str | None = None
    ip_address: str | None = None
    token_jti: str
    expires_at: str | None = None
    revoked: bool = False
    revoked_at: str | None = None
    last_seen_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    is_current: bool = False
    is_expired: bool = False


class DeviceSessionListResponse(BaseModel):
    sessions: list[DeviceSessionResponse]
    current_jti: str | None = None


class UpdateDeviceNameRequest(BaseModel):
    device_name: str = Field(min_length=1, max_length=255)


class RevokeOthersResponse(BaseModel):
    revoked_count: int
