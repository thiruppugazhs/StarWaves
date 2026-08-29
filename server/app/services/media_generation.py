"""Media generation service — images, videos, and audio artifacts for Eve tools.

Image/video generation falls back across providers in order (openai → gemini →
openrouter for images; gemini only for video) using the server's configured API
keys. TTS/STT reuse the existing `app.services.speech` providers.
"""

import base64
import logging
import time

from app.core.config import settings
from app.core.http import create_sync_client
from app.services.ai_models.config import effective_api_key, effective_base_url

logger = logging.getLogger(__name__)

IMAGE_PROVIDER_ORDER = ("openai", "gemini", "openrouter")
OPENAI_IMAGE_MODEL = "gpt-image-1"
GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"
GEMINI_VIDEO_MODEL = "veo-3.0-fast-generate-001"
OPENROUTER_IMAGE_MODEL = "google/gemini-2.5-flash-image-preview"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
IMAGE_SIZE_OPTIONS = ("1024x1024", "1024x1536", "1536x1024")
VIDEO_MAX_WAIT_SECONDS = 240
VIDEO_POLL_INTERVAL_SECONDS = 8


class MediaGenerationError(RuntimeError):
    """Raised when media generation cannot be completed with any provider."""


def _available_image_providers() -> list[str]:
    return [p for p in IMAGE_PROVIDER_ORDER if effective_api_key(p, {})]


def _generate_image_openai(prompt: str, size: str) -> bytes:
    from openai import OpenAI

    client = OpenAI(
        api_key=settings.openai_api_key,
        base_url=effective_base_url("openai"),
    )
    result = client.images.generate(
        model=OPENAI_IMAGE_MODEL,
        prompt=prompt,
        size=size,
        n=1,
    )
    data = result.data[0]
    if getattr(data, "b64_json", None):
        return base64.b64decode(data.b64_json)
    if getattr(data, "url", None):
        with create_sync_client() as http:
            response = http.get(data.url)
        response.raise_for_status()
        return response.content
    raise MediaGenerationError("OpenAI returned no image data.")


def _generate_image_gemini(prompt: str) -> bytes:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.models.generate_images(
        model=GEMINI_IMAGE_MODEL,
        prompt=prompt,
        config=types.GenerateImagesConfig(number_of_images=1),
    )
    for image in response.generated_images or []:
        if image.image and image.image.image_bytes:
            return image.image.image_bytes
    raise MediaGenerationError("Gemini returned no image data.")


def _generate_image_openrouter(prompt: str) -> bytes:
    with create_sync_client() as http:
        response = http.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
            json={
                "model": OPENROUTER_IMAGE_MODEL,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=120,
        )
    response.raise_for_status()
    payload = response.json()
    message = payload["choices"][0]["message"]
    for image in message.get("images") or []:
        data_url = image.get("image_url") or image.get("url") or ""
        if data_url.startswith("data:"):
            return base64.b64decode(data_url.split(",", 1)[1])
    raise MediaGenerationError("OpenRouter returned no image data.")


def generate_image(prompt: str, size: str = "1024x1024") -> bytes:
    """Generate an image from a prompt, trying each configured provider in order."""
    if size not in IMAGE_SIZE_OPTIONS:
        size = "1024x1024"
    errors: list[str] = []
    for provider in _available_image_providers():
        try:
            if provider == "openai":
                return _generate_image_openai(prompt, size)
            if provider == "gemini":
                return _generate_image_gemini(prompt)
            return _generate_image_openrouter(prompt)
        except Exception as exc:
            errors.append(f"{provider}: {exc}")
            logger.warning("Image generation via %s failed: %s", provider, exc)
    detail = "; ".join(errors) or "no image provider API key configured"
    raise MediaGenerationError(f"Image generation failed ({detail}).")


def generate_video(prompt: str) -> bytes:
    """Generate a short video clip with Gemini Veo. Blocks until the job finishes."""
    if not effective_api_key("gemini", {}):
        raise MediaGenerationError(
            "Video generation requires a Gemini API key (veo). Configure GEMINI_API_KEY."
        )
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    operation = client.models.generate_videos(
        model=GEMINI_VIDEO_MODEL,
        prompt=prompt,
        config=types.GenerateVideosConfig(number_of_videos=1),
    )
    deadline = time.monotonic() + VIDEO_MAX_WAIT_SECONDS
    while not operation.done and time.monotonic() < deadline:
        time.sleep(VIDEO_POLL_INTERVAL_SECONDS)
        operation = client.operations.get(operation)
    if not operation.done:
        raise MediaGenerationError("Video generation timed out. Try a simpler prompt.")
    video = operation.response.generated_videos[0]
    file_bytes = client.files.download(file=video.video)
    if not file_bytes:
        raise MediaGenerationError("Gemini returned no video data.")
    return file_bytes


def synthesize_audio(database, user_id: str, text: str) -> tuple[bytes, str]:
    """Render text to an audio file using the user's configured TTS engine."""
    from app.services.speech import (
        SpeechServiceError,
        resolve_tts_engine,
        synthesize_speech,
        synthesize_speech_openrouter,
    )

    provider, voice = resolve_tts_engine(database, user_id)
    if provider == "google":
        return synthesize_speech(text, language="en-US", voice=voice or "en-US-Standard-A")
    if provider == "openrouter":
        return synthesize_speech_openrouter(text, language="en-US", voice=voice)
    if provider == "browser":
        raise SpeechServiceError(
            "The browser TTS engine cannot produce audio files. "
            "Switch the Eve voice TTS provider to Google or OpenRouter in Settings."
        )
    raise SpeechServiceError(f"TTS provider '{provider}' cannot produce audio files.")


def fetch_audio_bytes(user_id: str, source: str) -> tuple[bytes, str]:
    """Load audio bytes from a workspace file path or an external URL."""
    from app.services.source_files import fetch_source_bytes

    try:
        return fetch_source_bytes(user_id, source)
    except FileNotFoundError as exc:
        raise MediaGenerationError(f"Audio file not found: {source}") from exc


def transcribe_audio(database, user_id: str, source: str) -> str:
    """Transcribe an audio file (workspace path or URL) to text via the user's STT engine."""
    from app.services.speech import (
        SpeechServiceError,
        resolve_stt_engine,
        transcribe_audio as groq_transcribe,
        transcribe_audio_deepgram,
    )

    provider, model = resolve_stt_engine(database, user_id)
    audio_bytes, content_type = fetch_audio_bytes(user_id, source)
    if provider == "groq":
        return groq_transcribe(audio_bytes, content_type, "en", model or "whisper-large-v3")
    if provider == "deepgram":
        return transcribe_audio_deepgram(
            audio_bytes, content_type, "en-US", model or "nova-2"
        )
    if provider == "browser":
        raise SpeechServiceError(
            "The browser STT engine cannot transcribe files. "
            "Switch the Eve voice STT provider to Deepgram or Groq in Settings."
        )
    raise SpeechServiceError(f"STT provider '{provider}' cannot transcribe files.")
