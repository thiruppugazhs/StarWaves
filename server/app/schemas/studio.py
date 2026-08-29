"""Studio (Eve Builder) API schemas — single responsibility: request/response models."""

from pydantic import BaseModel, Field

STUDIO_BUILD_STATUSES = ("draft", "planned", "building", "ready", "error")
STUDIO_DB_PREFERENCES = ("sqlite", "postgres", "supabase", "mongodb", "none")
STUDIO_PLAN_STATUSES = ("none", "proposed", "approved", "rejected")


class StudioProjectCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    template_id: str | None = Field(default=None, max_length=64)
    stack: str = Field(default="", max_length=64)
    db_preference: str = Field(default="sqlite", pattern="^(sqlite|postgres|supabase|mongodb|none)$")
    auth_enabled: bool = False


class StudioProjectUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    db_preference: str | None = Field(
        default=None, pattern="^(sqlite|postgres|supabase|mongodb|none)$"
    )
    auth_enabled: bool | None = None
    build_status: str | None = Field(
        default=None, pattern="^(draft|planned|building|ready|error)$"
    )


class StudioPlanFileEntry(BaseModel):
    path: str = Field(min_length=1, max_length=1000)
    purpose: str = Field(default="", max_length=300)


class StudioBuildPlanPayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(default="", max_length=4000)
    stack: str = Field(default="", max_length=120)
    db_preference: str = Field(default="sqlite", max_length=32)
    needs_auth: bool = False
    files: list[StudioPlanFileEntry] = Field(default_factory=list, max_length=200)


class StudioPlanStatusRequest(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")


class StudioCommandRequest(BaseModel):
    command: str = Field(min_length=1, max_length=2000)
    timeout_seconds: int = Field(default=300, ge=5, le=600)


class StudioGitConnectRequest(BaseModel):
    repo_url: str = Field(min_length=8, max_length=300, pattern=r"^(https://|git@)")


class StudioGitCommitRequest(BaseModel):
    message: str = Field(min_length=1, max_length=300)


class StudioTemplateSummary(BaseModel):
    id: str
    name: str
    description: str = ""
    stack: str = ""
    kind: str = "curated"
    source_project_id: str | None = None


class StudioTemplateListResponse(BaseModel):
    templates: list[StudioTemplateSummary]


class StudioProjectResponse(BaseModel):
    id: str
    name: str
    description: str = ""
    type: str = "studio"
    template_id: str | None = None
    stack: str = ""
    db_preference: str = "sqlite"
    auth_enabled: bool = False
    build_status: str = "draft"
    plan_status: str = "none"
    plan: dict | None = None
    git_initialized: bool = False
    github_repo_url: str | None = None
    published_template_id: str | None = None
    file_count: int = 0
    created_at: str
    updated_at: str


class StudioProjectListResponse(BaseModel):
    projects: list[StudioProjectResponse]


class StudioPreviewResponse(BaseModel):
    preview_url: str
    has_build_output: bool


class StudioCommandResponse(BaseModel):
    command: str
    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool = False


class StudioGitStatusResponse(BaseModel):
    initialized: bool
    branch: str | None = None
    changed_files: list[str] = Field(default_factory=list)
    ahead: int = 0
    remote_url: str | None = None


class StudioMessageResponse(BaseModel):
    ok: bool
    detail: str = ""
