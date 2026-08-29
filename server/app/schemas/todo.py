from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator


class TodoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    completed: bool = False
    due_date: date | None = None


class TodoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    completed: bool | None = None
    due_date: date | None = None

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("At least one todo field is required.")
        return self


class TodoResponse(TodoCreate):
    id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
