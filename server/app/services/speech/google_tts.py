"""Text-to-speech via the Google Cloud Text-to-Speech REST API."""

import base64
from typing import Any

import httpx

from app.core.config import settings
from app.services.speech._shared import GOOGLE_TTS_VOICES, SpeechServiceError

GOOGLE_TTS_DEFAULT_URL = "https://texttospeech.googleapis.com/v1"
GOOGLE_TTS_HEADERS = {"Content-Type": "application/json; charset=utf-8"}


def _voice_available(voice: str | None) -> bool:
    if not voice:
        return True
    return any(item["id"] == voice for item in GOOGLE_TTS_VOICES)


def synthesize_speech(
    text: str,
    language: str,
    voice: str | None,
    rate: float = 1.0,
    pitch: float = 0.0,
) -> tuple[bytes, str]:
    """Synthesize speech and return (audio_bytes, media_type).

    voice: the Google Cloud voice name (e.g. "en-US-Standard-C"). When None the
    server default voice is used. rate/pitch are passed straight to the Google
    Cloud TTS API (speakingRate range 0.25-4.0, pitch range -20.0 to 20.0).
    """
    if not settings.google_cloud_tts_api_key:
        raise SpeechServiceError("Google Cloud TTS is not configured on the server.")
    if not text.strip():
        raise SpeechServiceError("No text to synthesize.")
    if not _voice_available(voice):
        raise SpeechServiceError("Unknown Google Cloud TTS voice.")
    payload: dict[str, Any] = {
        "input": {"text": text},
        "voice": {
            "languageCode": language,
            "name": voice or settings.google_cloud_tts_voice,
        },
        "audioConfig": {
            "audioEncoding": "MP3",
            "speakingRate": rate,
            "pitch": pitch,
        },
    }
    url = f"{settings.google_cloud_tts_url or GOOGLE_TTS_DEFAULT_URL}/text:synthesize"
    try:
        response = httpx.post(
            url,
            params={"key": settings.google_cloud_tts_api_key},
            headers=GOOGLE_TTS_HEADERS,
            json=payload,
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
    except httpx.HTTPError as error:
        raise SpeechServiceError(f"Google Cloud TTS failed: {error}") from error
    except ValueError as error:
        raise SpeechServiceError("Google Cloud TTS returned an invalid response.") from error
    audio_content = data.get("audioContent")
    if not audio_content:
        raise SpeechServiceError("Google Cloud TTS returned no audio content.")
    try:
        audio_bytes = base64.b64decode(audio_content)
    except (ValueError, TypeError) as error:
        raise SpeechServiceError("Google Cloud TTS returned invalid audio.") from error
    if not audio_bytes:
        raise SpeechServiceError("Google Cloud TTS returned empty audio.")
    return audio_bytes, "audio/mpeg"