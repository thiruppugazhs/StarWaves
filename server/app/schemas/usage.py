from pydantic import BaseModel


class UsageEntry(BaseModel):
    id: str
    provider: str
    model: str
    kind: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    created_at: str

    class Config:
        from_attributes = True


class UsageSummary(BaseModel):
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    total_requests: int
    by_provider: list[dict]
    by_model: list[dict]
    daily: list[dict]
