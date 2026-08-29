"""Speech-to-text via Groq's OpenAI-compatible Whisper endpoint."""

from openai import OpenAI, OpenAIError

from app.core.config import settings
from app.services.speech._shared import GROQ_STT_MODELS, SpeechServiceError

GROQ_DEFAULT_URL = "https://api.groq.com/openai/v1"


def _client() -> OpenAI:
    if not settings.groq_api_key:
        raise SpeechServiceError("Groq is not configured on the server.")
    return OpenAI(
        api_key=settings.groq_api_key,
        base_url=settings.groq_url or GROQ_DEFAULT_URL,
    )


def _model_available(model: str | None) -> bool:
    if not model:
        return True
    return any(item["id"] == model for item in GROQ_STT_MODELS)


def transcribe_audio(
    audio_bytes: bytes,
    content_type: str | None,
    language: str | None,
    model: str | None,
) -> str:
    """Transcribe audio bytes and return the transcript text.

    Raises SpeechServiceError on any failure so callers can translate it into
    an HTTP error without leaking provider internals.
    """
    if not audio_bytes:
        raise SpeechServiceError("No audio received.")
    if not _model_available(model):
        raise SpeechServiceError("Unknown Groq transcription model.")
    extension = _extension_for_content_type(content_type)
    request = {
        "model": model or settings.groq_stt_model,
        "file": (f"audio{extension}", audio_bytes, content_type or "audio/wav"),
    }
    if language:
        request["language"] = language
    try:
        response = _client().audio.transcriptions.create(**request)
    except OpenAIError as error:
        raise SpeechServiceError(f"Groq transcription failed: {error}") from error
    text = (getattr(response, "text", "") or "").strip()
    if not text:
        raise SpeechServiceError("Groq returned an empty transcript.")
    return text


def _extension_for_content_type(content_type: str | None) -> str:
    if not content_type:
        return ".wav"
    if content_type.endswith("mp3") or content_type.endswith("mpeg"):
        return ".mp3"
    if content_type.endswith("webm"):
        return ".webm"
    if content_type.endswith("ogg"):
        return ".ogg"
    return ".wav"