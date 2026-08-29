from pydantic import BaseModel, Field


class AiModelPreferenceUpdate(BaseModel):
    provider: str = Field(min_length=1, max_length=64)
    model: str = Field(min_length=1, max_length=128)
    api_key: str | None = Field(default=None, max_length=512)
    assistant_name: str | None = Field(default=None, max_length=64)


class AiModelDescriptor(BaseModel):
    id: str
    label: str
    is_default: bool = False


class AiProviderDescriptor(BaseModel):
    id: str
    label: str
    available: bool
    env_configured: bool = False
    is_default: bool = False
    has_user_key: bool = False
    default_model: str | None = None
    models: list[AiModelDescriptor]


class AiModelPreferenceResponse(BaseModel):
    provider: str
    model: str
    has_api_key: bool = False
    assistant_name: str | None = None


class AiModelsResponse(BaseModel):
    providers: list[AiProviderDescriptor]
    preference: AiModelPreferenceResponse | None = None
    default_provider: str = "openai"
    default_model: str = "gpt-5-mini"
