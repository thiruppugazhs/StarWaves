from datetime import datetime

from pydantic import BaseModel, Field


class DocumentUpsert(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(default="General", max_length=80)
    description: str = Field(default="", max_length=2000)
    tags: list[str] = Field(default_factory=list, max_length=30)
    type: str = Field(default="FILE", max_length=80)
    size: str = Field(default="Unknown", max_length=80)
    modified_at: datetime
    url: str = Field(max_length=2048)
    drive_file_id: str | None = Field(default=None, max_length=255)


class DocumentResponse(DocumentUpsert):
    id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
