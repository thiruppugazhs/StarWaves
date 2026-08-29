from datetime import datetime

from pydantic import BaseModel, Field


class EveMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)


class EveChatRequest(BaseModel):
    messages: list[EveMessage] = Field(min_length=1, max_length=60)
    session_id: str | None = Field(default=None, max_length=200)


class EveChatResponse(BaseModel):
    message: str
    changed_resources: list[str] = Field(default_factory=list)
    actions: list[dict] = Field(default_factory=list)


class EveDeleteRequest(BaseModel):
    resource: str = Field(
        pattern="^(todos|projects|jobs|hackathons|documents|notifications)$",
    )
    record_id: str = Field(min_length=1, max_length=300)


class EveDeleteResponse(BaseModel):
    message: str
    changed_resources: list[str] = Field(default_factory=list)


class EveRestoreRequest(BaseModel):
    resource: str = Field(
        pattern="^(todos|projects|jobs|hackathons|documents|notifications)$",
    )
    record_id: str = Field(min_length=1, max_length=300)


class EveRestoreResponse(BaseModel):
    message: str
    changed_resources: list[str] = Field(default_factory=list)


class EveSessionCreateRequest(BaseModel):
    messages: list[EveMessage] = Field(default_factory=list, max_length=60)


class EveSessionResponse(BaseModel):
    session: dict


class EveSessionListResponse(BaseModel):
    sessions: list[dict]


class EveMemory(BaseModel):
    id: str
    content: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class EveMemoryCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class EveMemoriesResponse(BaseModel):
    memories: list[EveMemory]


class EveMemoryDeleteResponse(BaseModel):
    message: str


class EveMemorySettingsUpdate(BaseModel):
    auto_remember: bool


class EveMemorySettingsResponse(BaseModel):
    auto_remember: bool
