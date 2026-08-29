"""Speech-to-text via Deepgram's REST API — fastest cloud ASR (~200-300ms).

Uses raw-body POST to /v1/listen with Token auth. Raises SpeechServiceError on
any failure so callers can translate it into an HTTP error without leaking
provider internals.
"""

import httpx

from app.core.config import settings
from app.services.speech._shared import DEEPGRAM_STT_MODELS, SpeechServiceError

DEEPGRAM_TIMEOUT = httpx.Timeout(10.0, connect=4.0)


def _model_available(model: str | None) -> bool:
    if not model:
        return True
    return any(item["id"] == model for item in DEEPGRAM_STT_MODELS)


def transcribe_audio_deepgram(
    audio_bytes: bytes,
    content_type: str | None,
    language: str | None,
    model: str | None,
) -> str:
    """Transcribe audio bytes via Deepgram and return the transcript text."""
    if not settings.deepgram_api_key:
        raise SpeechServiceError("Deepgram is not configured on the server.")
    if not audio_bytes:
        raise SpeechServiceError("No audio received.")
    if not _model_available(model):
        raise SpeechServiceError("Unknown Deepgram transcription model.")

    params: dict[str, str] = {
        "model": model or settings.deepgram_stt_model,
        "smart_format": "true",
    }
    if language:
        params["language"] = language
    headers = {
        "Authorization": f"Token {settings.deepgram_api_key}",
        "Content-Type": content_type or "audio/wav",
    }
    try:
        response = httpx.post(
            settings.deepgram_stt_url,
            params=params,
            headers=headers,
            content=audio_bytes,
            timeout=DEEPGRAM_TIMEOUT,
        )
    except httpx.RequestError as error:
        raise SpeechServiceError(f"Deepgram request failed: {error}") from error

    if response.status_code >= 400:
        raise SpeechServiceError(f"Deepgram API {response.status_code}: {response.text[:300]}")

    try:
        data = response.json()
        transcript = (
            data["results"]["channels"][0]["alternatives"][0]["transcript"] or ""
        ).strip()
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise SpeechServiceError(f"Unexpected Deepgram response shape: {error}") from error

    if not transcript:
        raise SpeechServiceError("Deepgram returned an empty transcript.")
    return transcript
