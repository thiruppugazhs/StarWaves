from datetime import date, datetime

from pydantic import BaseModel, Field


class JobCreate(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=200)
    status: str = Field(default="Saved", max_length=50)
    location: str = Field(default="", max_length=200)
    work_type: str = Field(default="Full-time", max_length=80)
    salary: str = Field(default="", max_length=100)
    applied_date: date | None = None
    interview_date: date | None = None
    deadline: date | None = None
    resume_id: str = Field(default="", max_length=300)
    job_url: str = Field(default="", max_length=2048)
    notes: str = Field(default="", max_length=5000)


class JobResponse(JobCreate):
    id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class HackathonCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    organizer: str = Field(default="", max_length=200)
    starts_at: datetime
    ends_at: datetime
    mode: str = Field(default="Online", max_length=80)
    team_size: str = Field(default="", max_length=80)
    tags: list[str] = Field(default_factory=list, max_length=30)
    url: str = Field(default="", max_length=2048)


class HackathonResponse(HackathonCreate):
    id: str
    source: str = "manual"
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    description: str = Field(default="", max_length=3000)
    status: str = Field(default="Planning", max_length=80)
    progress: int = Field(default=0, ge=0, le=100)
    members: int = Field(default=1, ge=1, le=10000)
    technologies: list[str] = Field(default_factory=list, max_length=50)
    github_url: str = Field(default="", max_length=2048)
    live_url: str = Field(default="", max_length=2048)
    lifecycle_phase: str = Field(default="idea", max_length=40)


class ProjectResponse(ProjectCreate):
    id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    time: str
    unread: bool
    created_at: datetime | None = None


class NotificationUpdate(BaseModel):
    unread: bool


class PageResponse(BaseModel):
    items: list
    next_cursor: str | None = None
    has_more: bool = False


class JobUpdate(BaseModel):
    company: str | None = Field(default=None, min_length=1, max_length=200)
    role: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = Field(default=None, max_length=50)
    location: str | None = Field(default=None, max_length=200)
    work_type: str | None = Field(default=None, max_length=80)
    salary: str | None = Field(default=None, max_length=100)
    applied_date: date | None = None
    interview_date: date | None = None
    deadline: date | None = None
    resume_id: str | None = Field(default=None, max_length=300)
    job_url: str | None = Field(default=None, max_length=2048)
    notes: str | None = Field(default=None, max_length=5000)


class HackathonUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    organizer: str | None = Field(default=None, max_length=200)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    mode: str | None = Field(default=None, max_length=80)
    team_size: str | None = Field(default=None, max_length=80)
    tags: list[str] | None = Field(default=None, max_length=30)
    url: str | None = Field(default=None, max_length=2048)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=3000)
    status: str | None = Field(default=None, max_length=80)
    progress: int | None = Field(default=None, ge=0, le=100)
    members: int | None = Field(default=None, ge=1, le=10000)
    technologies: list[str] | None = Field(default=None, max_length=50)
    github_url: str | None = Field(default=None, max_length=2048)
    live_url: str | None = Field(default=None, max_length=2048)
    lifecycle_phase: str | None = Field(default=None, max_length=40)
