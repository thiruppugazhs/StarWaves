"""Text-to-speech via the ElevenLabs REST API."""

import logging
from typing import Any

import httpx

from app.core.config import settings
from app.services.speech._shared import SpeechServiceError

logger = logging.getLogger(__name__)

ELEVENLABS_DEFAULT_VOICE_ID = "cgSgspJ2msm6clMCkdW9"  # Jessica (warm, clear, conversational female voice)
ELEVENLABS_VOICES: list[dict[str, str]] = [
    {"id": "21m00Tcm4TlvDq8ikWAM", "label": "Rachel — calm, natural (female)", "gender": "female"},
    {"id": "AZnzlk1XvdvUeBnXmlld", "label": "Domi — friendly, empathetic (female)", "gender": "female"},
    {"id": "EXAVITQu4vr4xnSDxMaL", "label": "Bella — conversational, warm (female)", "gender": "female"},
    {"id": "ErXwobaYiN019PkySvjV", "label": "Antoni — confident, well-rounded (male)", "gender": "male"},
    {"id": "VR6AewLTigWG4xSOukaG", "label": "Arnold — deep, crisp narrator (male)", "gender": "male"},
    {"id": "pNInz6obpgDQGcFmaJgB", "label": "Adam — clear, engaging (male)", "gender": "male"},
    {"id": "yoZ06aMxZJJ28mfd3POQ", "label": "Sam — dynamic, authentic (male)", "gender": "male"},
]


def synthesize_speech_elevenlabs(
    text: str,
    language: str = "en",
    voice: str | None = None,
    rate: float = 1.0,
    pitch: float = 0.0,
) -> tuple[bytes, str]:
    """Synthesize speech using ElevenLabs and return (audio_bytes, "audio/mpeg")."""
    api_key = settings.elevenlabs_api_key
    if not api_key:
        raise SpeechServiceError("ElevenLabs API key is not configured on the server.")

    clean_text = text.strip()
    if not clean_text:
        raise SpeechServiceError("No text provided to synthesize.")

    voice_id = (voice or settings.elevenlabs_voice_id or ELEVENLABS_DEFAULT_VOICE_ID).strip()
    model_id = settings.elevenlabs_model_id or "eleven_turbo_v2_5"

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload: dict[str, Any] = {
        "text": clean_text,
        "model_id": model_id,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": True,
        },
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, headers=headers, json=payload)
            if response.status_code != 200:
                err_detail = response.text[:200]
                logger.error("ElevenLabs error %s: %s", response.status_code, err_detail)
                raise SpeechServiceError(f"ElevenLabs synthesis failed ({response.status_code}): {err_detail}")

            audio_bytes = response.content
            if not audio_bytes:
                raise SpeechServiceError("ElevenLabs returned empty audio.")
            return audio_bytes, "audio/mpeg"
    except httpx.HTTPError as error:
        raise SpeechServiceError(f"ElevenLabs request failed: {error}") from error
