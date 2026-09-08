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
    daily_by_model: list[dict] = []
    peak_tokens: int = 0
    longest_session_tokens: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    model_list: list[str] = []
