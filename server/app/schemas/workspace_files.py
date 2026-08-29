from pydantic import BaseModel, Field


class WorkspaceFileNode(BaseModel):
    path: str
    name: str
    is_directory: bool = False
    size: int = 0
    modified_at: str | None = None
    mime_type: str | None = None
    children: list["WorkspaceFileNode"] | None = None


class WorkspaceTreeResponse(BaseModel):
    root: str
    files: list[WorkspaceFileNode]


class WorkspaceFileReadResponse(BaseModel):
    path: str
    content: str
    encoding: str = "utf-8"
    size: int = 0


class WorkspaceFileWriteRequest(BaseModel):
    content: str = Field(max_length=5_000_000)
    encoding: str = Field(default="utf-8", pattern="^(utf-8|base64)$")


class WorkspaceSyncEntry(BaseModel):
    path: str = Field(min_length=1, max_length=1000)
    content: str
    encoding: str = Field(default="utf-8", pattern="^(utf-8|base64)$")


class WorkspaceSyncRequest(BaseModel):
    files: list[WorkspaceSyncEntry] = Field(min_length=1, max_length=100)


class WorkspaceSyncResponse(BaseModel):
    synced: int
    errors: list[str] = Field(default_factory=list)


class WorkspaceItem(BaseModel):
    id: str
    name: str
    created_at: str
    updated_at: str
    file_count: int = 0


class WorkspaceListResponse(BaseModel):
    workspaces: list[WorkspaceItem]
    active_id: str = "default"


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class WorkspaceRenameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)

