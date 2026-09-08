from typing import Literal

from pydantic import BaseModel


class DependencyStatus(BaseModel):
    status: Literal["ok", "degraded", "error", "unknown"]
    latency_ms: int | None = None
    detail: str | None = None


class EndpointInfo(BaseModel):
    path: str
    methods: list[str]
    tag: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "error"]
    service: str
    environment: str
    version: str = "0.1.0"
    uptime_seconds: float | None = None
    timestamp: str | None = None
    checks: dict[str, DependencyStatus] | None = None
    endpoints: list[EndpointInfo] | None = None
    endpoint_count: int | None = None
    summary: str | None = None
    took_ms: int | None = None
