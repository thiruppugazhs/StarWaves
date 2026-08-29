from typing import Literal
from pydantic import BaseModel, Field


class EveScheduleCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    prompt: str = Field(..., min_length=1, max_length=2000)
    schedule_type: Literal["one_time", "recurring"] = "one_time"
    action_type: Literal["chat_prompt", "voice_call"] = "chat_prompt"
    execute_at: str | None = None  # ISO 8601 string for one_time
    cron_expression: str | None = None  # e.g. "0 9 * * *" for 9am daily
    enabled: bool = True


class EveScheduleUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=120)
    prompt: str | None = Field(None, min_length=1, max_length=2000)
    schedule_type: Literal["one_time", "recurring"] | None = None
    action_type: Literal["chat_prompt", "voice_call"] | None = None
    execute_at: str | None = None
    cron_expression: str | None = None
    enabled: bool | None = None


class EveScheduleResponse(BaseModel):
    id: str
    user_id: str
    title: str
    prompt: str
    schedule_type: str
    action_type: str
    execute_at: str | None = None
    cron_expression: str | None = None
    enabled: bool
    last_run_at: str | None = None
    next_run_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class EveScheduleListResponse(BaseModel):
    schedules: list[EveScheduleResponse]
