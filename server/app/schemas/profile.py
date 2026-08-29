from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class ProfileFields(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    first_name: str = Field(min_length=1, max_length=60)
    initials: str = Field(min_length=1, max_length=4)
    email: EmailStr
    role: str = Field(min_length=1, max_length=50)
    role_label: str = Field(min_length=1, max_length=80)


class ProfileCreate(ProfileFields):
    pass


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    first_name: str | None = Field(default=None, min_length=1, max_length=60)
    initials: str | None = Field(default=None, min_length=1, max_length=4)
    email: EmailStr | None = None
    role: str | None = Field(default=None, min_length=1, max_length=50)
    role_label: str | None = Field(default=None, min_length=1, max_length=80)

    @model_validator(mode="after")
    def require_a_change(self) -> "ProfileUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one profile field is required.")
        return self


class ProfileResponse(ProfileFields):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None

