"""Text-to-speech via OpenRouter's /audio/speech endpoint (Fish Audio)."""

from collections.abc import Generator
from typing import Any

import httpx

from app.core.config import settings
from app.services.speech._shared import SpeechServiceError

OPENROUTER_DEFAULT_URL = "https://openrouter.ai/api/v1"
OPENROUTER_TTS_HEADERS = {"Content-Type": "application/json"}


def _build_openrouter_payload(text: str, voice: str | None, rate: float) -> dict[str, Any]:
    model = settings.openrouter_tts_model or "fish-audio/s2.1-pro-free:free"
    resolved_voice = (voice or settings.openrouter_tts_voice or "alloy").strip() or "alloy"
    payload: dict[str, Any] = {
        "model": model,
        "input": text,
        "voice": resolved_voice,
        "response_format": "mp3",
    }
    if rate != 1.0:
        payload["speed"] = max(0.25, min(4.0, float(rate)))
    return payload


def _openrouter_headers() -> dict[str, str]:
    return {
        **OPENROUTER_TTS_HEADERS,
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "HTTP-Referer": settings.frontend_url or "https://starwaves.susindran.in",
        "X-Title": "StarWaves Eve TTS",
    }


def _openrouter_url() -> str:
    base_url = (settings.openrouter_tts_url or settings.openrouter_url or OPENROUTER_DEFAULT_URL).rstrip("/")
    return f"{base_url}/audio/speech"


def _openrouter_available() -> bool:
    return bool(settings.openrouter_api_key)


def synthesize_speech_openrouter(
    text: str,
    language: str,  # noqa: ARG001 — kept for call-site parity with google_tts
    voice: str | None,
    rate: float = 1.0,
    pitch: float = 0.0,  # noqa: ARG001 — pitch not forwarded (Fish/OpenRouter ignores it)
) -> tuple[bytes, str]:
    """Synthesize speech via OpenRouter and return (audio_bytes, media_type)."""
    if not settings.openrouter_api_key:
        raise SpeechServiceError("OpenRouter TTS is not configured on the server.")
    if not text.strip():
        raise SpeechServiceError("No text to synthesize.")
    payload = _build_openrouter_payload(text, voice, rate)
    url = _openrouter_url()
    headers = _openrouter_headers()
    try:
        response = httpx.post(url, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        detail = ""
        try:
            data = error.response.json()
            # OpenRouter errors: {error: {message, ...}} or {success:false, error:{message}}
            if isinstance(data, dict):
                err = data.get("error")
                if isinstance(err, dict):
                    detail = err.get("message") or err.get("detail") or ""
                elif isinstance(err, str):
                    detail = err
                detail = detail or data.get("detail") or data.get("message") or ""
        except Exception:
            detail = error.response.text[:500] if error.response is not None else ""
        msg = f"OpenRouter TTS failed ({error.response.status_code if error.response is not None else 'error'}): {detail or error}".strip()
        raise SpeechServiceError(msg) from error
    except httpx.HTTPError as error:
        raise SpeechServiceError(f"OpenRouter TTS failed: {error}") from error

    content_type = response.headers.get("Content-Type", "") or "audio/mpeg"
    audio_bytes = response.content
    if not audio_bytes:
        raise SpeechServiceError("OpenRouter TTS returned empty audio.")
    # Normalize media type for callers: mp3 -> audio/mpeg, pcm -> preserve headers
    media_type = "audio/mpeg"
    if "pcm" in content_type.lower():
        media_type = content_type
    elif "mpeg" in content_type.lower() or "mp3" in content_type.lower():
        media_type = "audio/mpeg"
    return audio_bytes, media_type


def stream_speech_openrouter(
    text: str,
    language: str,  # noqa: ARG001
    voice: str | None,
    rate: float = 1.0,
    pitch: float = 0.0,  # noqa: ARG001
) -> Generator[bytes, None, None]:
    """Stream speech bytes from OpenRouter — yields chunks as they arrive.

    Uses httpx.stream() so the first audio bytes (TTFA ~100ms for Fish) are
    forwarded immediately instead of buffering the whole MP3. Callers should
    wrap this in a StreamingResponse with `X-Accel-Buffering: no`.
    """
    if not settings.openrouter_api_key:
        raise SpeechServiceError("OpenRouter TTS is not configured on the server.")
    if not text.strip():
        raise SpeechServiceError("No text to synthesize.")
    payload = _build_openrouter_payload(text, voice, rate)
    url = _openrouter_url()
    headers = _openrouter_headers()
    try:
        with httpx.stream("POST", url, headers=headers, json=payload, timeout=30.0) as response:
            response.raise_for_status()
            yielded = False
            for chunk in response.iter_bytes(chunk_size=8192):
                if chunk:
                    yielded = True
                    yield chunk
            if not yielded:
                raise SpeechServiceError("OpenRouter TTS returned empty audio.")
    except SpeechServiceError:
        raise
    except httpx.HTTPStatusError as error:
        detail = ""
        try:
            # stream error body may not be JSON — try to read
            body = error.response.read() if hasattr(error.response, "read") else b""
            if body:
                import json as _json

                try:
                    data = _json.loads(body.decode("utf-8", errors="ignore"))
                    if isinstance(data, dict):
                        err = data.get("error")
                        if isinstance(err, dict):
                            detail = err.get("message") or ""
                        elif isinstance(err, str):
                            detail = err
                        detail = detail or data.get("detail") or ""
                except Exception:
                    detail = body.decode("utf-8", errors="ignore")[:500]
        except Exception:
            detail = ""
        msg = f"OpenRouter TTS failed ({error.response.status_code if error.response is not None else 'error'}): {detail or error}".strip()
        raise SpeechServiceError(msg) from error
    except httpx.HTTPError as error:
        raise SpeechServiceError(f"OpenRouter TTS failed: {error}") from error
