from datetime import datetime

from pydantic import BaseModel, Field


class CompetitiveCodingProfileUpdate(BaseModel):
    codeforces: str = Field(default="", max_length=300)
    codechef: str = Field(default="", max_length=300)
    leetcode: str = Field(default="", max_length=300)


class CompetitiveCodingProfileResponse(CompetitiveCodingProfileUpdate):
    updated_at: datetime | None = None
