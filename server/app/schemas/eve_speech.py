from pydantic import BaseModel, Field


class EveSpeechPreferenceUpdate(BaseModel):
    stt_provider: str = Field(min_length=1, max_length=64)
    stt_model: str = Field(default="", max_length=128)
    tts_provider: str = Field(min_length=1, max_length=64)
    tts_voice: str = Field(default="", max_length=128)


class SpeechModelDescriptor(BaseModel):
    id: str
    label: str


class SpeechVoiceDescriptor(BaseModel):
    id: str
    label: str
    language: str


class SpeechProviderDescriptor(BaseModel):
    id: str
    label: str
    available: bool
    models: list[SpeechModelDescriptor] = []
    voices: list[SpeechVoiceDescriptor] = []


class EveSpeechResponse(BaseModel):
    stt_providers: list[SpeechProviderDescriptor]
    tts_providers: list[SpeechProviderDescriptor]
    preference: EveSpeechPreferenceUpdate | None = None


class EveTranscribeResponse(BaseModel):
    text: str


class EveSynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language: str = Field(default="en-US", min_length=2, max_length=16)
    voice: str | None = Field(default=None, max_length=128)
    rate: float = Field(default=1.0, ge=0.25, le=4.0)
    pitch: float = Field(default=0.0, ge=-20.0, le=20.0)
