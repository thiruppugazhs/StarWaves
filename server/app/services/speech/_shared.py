"""Shared Eve speech-provider catalog and preference resolution.

Mirrors the AI models provider pattern (`app/services/ai_models/_shared.py`):
the server holds the authoritative list of STT/TTS providers, marks which ones
are available (an API key is configured), persists the user's choice in
Firestore, and resolves it with a browser fallback when the chosen provider
cannot be used.
"""

from typing import Any

from app.db import SqlClient

from app.core.config import settings

SPEECH_SETTINGS_DOC = "eve-speech"
DEFAULT_STT_PROVIDER = "browser"
DEFAULT_TTS_PROVIDER = "browser"

# Curated Groq Whisper models exposed in the STT provider catalog.
GROQ_STT_MODELS: list[dict[str, str]] = [
    {"id": "whisper-large-v3", "label": "Whisper Large v3"},
    {"id": "whisper-large-v3-turbo", "label": "Whisper Large v3 Turbo"},
    {"id": "distil-whisper-large-v3", "label": "Distil Whisper Large v3"},
]

# Curated Deepgram models exposed in the STT provider catalog.
DEEPGRAM_STT_MODELS: list[dict[str, str]] = [
    {"id": "nova-3", "label": "Nova-3 — fastest, highest accuracy"},
    {"id": "nova-2", "label": "Nova-2"},
    {"id": "base", "label": "Base — lowest latency"},
]

# Google Cloud Standard TTS voices per supported language. Standard (non-Neural)
# voices are free within the monthly character allowance.
GOOGLE_TTS_VOICES: list[dict[str, str]] = [
    {"id": "en-US-Standard-A", "label": "English (US) Standard A — female", "language": "en-US"},
    {"id": "en-US-Standard-B", "label": "English (US) Standard B — male", "language": "en-US"},
    {"id": "en-US-Standard-C", "label": "English (US) Standard C — female", "language": "en-US"},
    {"id": "en-US-Standard-D", "label": "English (US) Standard D — male", "language": "en-US"},
    {"id": "en-US-Standard-E", "label": "English (US) Standard E — female", "language": "en-US"},
    {"id": "en-US-Standard-F", "label": "English (US) Standard F — female", "language": "en-US"},
    {"id": "en-US-Standard-G", "label": "English (US) Standard G — female", "language": "en-US"},
    {"id": "en-US-Standard-H", "label": "English (US) Standard H — male", "language": "en-US"},
    {"id": "en-GB-Standard-A", "label": "English (UK) Standard A — female", "language": "en-GB"},
    {"id": "en-GB-Standard-B", "label": "English (UK) Standard B — male", "language": "en-GB"},
    {"id": "en-GB-Standard-C", "label": "English (UK) Standard C — female", "language": "en-GB"},
    {"id": "en-GB-Standard-D", "label": "English (UK) Standard D — male", "language": "en-GB"},
    {"id": "en-GB-Standard-E", "label": "English (UK) Standard E — female", "language": "en-GB"},
    {"id": "en-GB-Standard-F", "label": "English (UK) Standard F — female", "language": "en-GB"},
    {"id": "en-AU-Standard-A", "label": "English (AU) Standard A — female", "language": "en-AU"},
    {"id": "en-AU-Standard-B", "label": "English (AU) Standard B — male", "language": "en-AU"},
    {"id": "en-AU-Standard-C", "label": "English (AU) Standard C — female", "language": "en-AU"},
    {"id": "en-AU-Standard-D", "label": "English (AU) Standard D — male", "language": "en-AU"},
    {"id": "en-CA-Standard-A", "label": "English (CA) Standard A — female", "language": "en-CA"},
    {"id": "en-CA-Standard-B", "label": "English (CA) Standard B — male", "language": "en-CA"},
    {"id": "en-CA-Standard-C", "label": "English (CA) Standard C — female", "language": "en-CA"},
    {"id": "en-CA-Standard-D", "label": "English (CA) Standard D — male", "language": "en-CA"},
    {"id": "en-IN-Standard-A", "label": "English (IN) Standard A — female", "language": "en-IN"},
    {"id": "en-IN-Standard-B", "label": "English (IN) Standard B — male", "language": "en-IN"},
    {"id": "en-IN-Standard-C", "label": "English (IN) Standard C — female", "language": "en-IN"},
    {"id": "en-IN-Standard-D", "label": "English (IN) Standard D — male", "language": "en-IN"},
    {"id": "en-IN-Standard-E", "label": "English (IN) Standard E — female", "language": "en-IN"},
    {"id": "en-IN-Standard-F", "label": "English (IN) Standard F — female", "language": "en-IN"},
    {"id": "en-NZ-Standard-A", "label": "English (NZ) Standard A — female", "language": "en-NZ"},
    {"id": "en-NZ-Standard-B", "label": "English (NZ) Standard B — male", "language": "en-NZ"},
    {"id": "en-NZ-Standard-C", "label": "English (NZ) Standard C — female", "language": "en-NZ"},
    {"id": "en-NZ-Standard-D", "label": "English (NZ) Standard D — male", "language": "en-NZ"},
    {"id": "en-ZA-Standard-A", "label": "English (ZA) Standard A — female", "language": "en-ZA"},
    {"id": "en-ZA-Standard-B", "label": "English (ZA) Standard B — male", "language": "en-ZA"},
    {"id": "en-ZA-Standard-C", "label": "English (ZA) Standard C — female", "language": "en-ZA"},
    {"id": "en-ZA-Standard-D", "label": "English (ZA) Standard D — male", "language": "en-ZA"},
]


class SpeechServiceError(RuntimeError):
    """Raised when a speech provider cannot complete a request."""


def groq_available() -> bool:
    return bool(settings.groq_api_key)


def deepgram_available() -> bool:
    return bool(settings.deepgram_api_key)


def google_tts_available() -> bool:
    return bool(settings.google_cloud_tts_api_key)


def elevenlabs_available() -> bool:
    return bool(settings.elevenlabs_api_key)


def openrouter_tts_available() -> bool:
    return bool(settings.openrouter_api_key)


ELEVENLABS_VOICES: list[dict[str, str]] = [
    {"id": "21m00Tcm4TlvDq8ikWAM", "label": "Rachel — calm, natural (female)", "gender": "female"},
    {"id": "AZnzlk1XvdvUeBnXmlld", "label": "Domi — friendly, empathetic (female)", "gender": "female"},
    {"id": "EXAVITQu4vr4xnSDxMaL", "label": "Bella — conversational, warm (female)", "gender": "female"},
    {"id": "ErXwobaYiN019PkySvjV", "label": "Antoni — confident, well-rounded (male)", "gender": "male"},
    {"id": "VR6AewLTigWG4xSOukaG", "label": "Arnold — deep, crisp narrator (male)", "gender": "male"},
    {"id": "pNInz6obpgDQGcFmaJgB", "label": "Adam — clear, engaging (male)", "gender": "male"},
    {"id": "yoZ06aMxZJJ28mfd3POQ", "label": "Sam — dynamic, authentic (male)", "gender": "male"},
]


def stt_catalog() -> list[dict[str, Any]]:
    return [
        {
            "id": "browser",
            "label": "Browser (Web Speech API)",
            "available": True,
            "models": [],
        },
        {
            "id": "deepgram",
            "label": "Deepgram Nova — fastest cloud STT",
            "available": deepgram_available(),
            "models": DEEPGRAM_STT_MODELS,
        },
        {
            "id": "groq",
            "label": "Groq Whisper",
            "available": groq_available(),
            "models": GROQ_STT_MODELS,
        },
    ]


def tts_catalog() -> list[dict[str, Any]]:
    return [
        {
            "id": "browser",
            "label": "Browser (SpeechSynthesis)",
            "available": True,
            "voices": [],
        },
        {
            "id": "elevenlabs",
            "label": "ElevenLabs (Ultra-realistic Voice)",
            "available": elevenlabs_available(),
            "voices": ELEVENLABS_VOICES,
        },
        {
            "id": "google",
            "label": "Google Cloud Standard",
            "available": google_tts_available(),
            "voices": GOOGLE_TTS_VOICES,
        },
        {
            "id": "openrouter",
            "label": "OpenRouter — Fish S2.1 Pro Free",
            "available": openrouter_tts_available(),
            "voices": [],
        },
    ]


def _valid_stt_model(provider: str, model: str) -> bool:
    if provider == "browser":
        return not model
    if provider == "deepgram":
        return any(item["id"] == model for item in DEEPGRAM_STT_MODELS)
    if provider == "groq":
        return any(item["id"] == model for item in GROQ_STT_MODELS)
    return False


def _valid_tts_voice(provider: str, voice: str) -> bool:
    if provider == "browser":
        return not voice
    if provider == "elevenlabs":
        return any(item["id"] == voice for item in ELEVENLABS_VOICES) or bool(voice)
    if provider == "google":
        return any(item["id"] == voice for item in GOOGLE_TTS_VOICES)
    if provider == "openrouter":
        # Fish via OpenRouter voices are provider-namespaced; accept any non-empty free-form id.
        return True
    return False


def validate_speech_preference(
    *,
    stt_provider: str,
    stt_model: str,
    tts_provider: str,
    tts_voice: str,
) -> bool:
    if not _valid_stt_model(stt_provider, stt_model):
        return False
    if not _valid_tts_voice(tts_provider, tts_voice):
        return False
    return True


def _preference_reference(database: SqlClient, user_uid: str):
    return (
        database.collection("users")
        .document(user_uid)
        .collection("settings")
        .document(SPEECH_SETTINGS_DOC)
    )


def load_speech_preference(database: SqlClient, user_uid: str) -> dict[str, Any] | None:
    snapshot = _preference_reference(database, user_uid).get()
    if not snapshot.exists:
        return None
    return snapshot.to_dict() or None


def resolve_speech_preference(database: SqlClient, user_uid: str) -> dict[str, str]:
    """Resolve a user's STT/TTS provider choice, falling back to browser."""
    stt_provider = DEFAULT_STT_PROVIDER
    stt_model = ""
    tts_provider = "elevenlabs" if elevenlabs_available() else DEFAULT_TTS_PROVIDER
    tts_voice = "21m00Tcm4TlvDq8ikWAM" if elevenlabs_available() else ""
    preference = load_speech_preference(database, user_uid)
    if preference:
        stt_provider = preference.get("stt_provider") or DEFAULT_STT_PROVIDER
        stt_model = preference.get("stt_model") or ""
        tts_provider = preference.get("tts_provider") or DEFAULT_TTS_PROVIDER
        tts_voice = preference.get("tts_voice") or ""
    if stt_provider == "groq" and not groq_available():
        stt_provider = DEFAULT_STT_PROVIDER
        stt_model = ""
    if stt_provider == "deepgram" and not deepgram_available():
        stt_provider = DEFAULT_STT_PROVIDER
        stt_model = ""
    if tts_provider == "elevenlabs" and not elevenlabs_available():
        tts_provider = DEFAULT_TTS_PROVIDER
        tts_voice = ""
    if tts_provider == "google" and not google_tts_available():
        tts_provider = DEFAULT_TTS_PROVIDER
        tts_voice = ""
    if tts_provider == "openrouter" and not openrouter_tts_available():
        tts_provider = DEFAULT_TTS_PROVIDER
        tts_voice = ""
    if stt_provider == "browser":
        stt_model = ""
    if tts_provider == "browser":
        tts_voice = ""
    return {
        "stt_provider": stt_provider,
        "stt_model": stt_model,
        "tts_provider": tts_provider,
        "tts_voice": tts_voice,
    }


def resolve_stt_engine(database: SqlClient, user_uid: str) -> tuple[str, str]:
    preference = resolve_speech_preference(database, user_uid)
    return preference["stt_provider"], preference["stt_model"]


def resolve_tts_engine(database: SqlClient, user_uid: str) -> tuple[str, str]:
    preference = resolve_speech_preference(database, user_uid)
    return preference["tts_provider"], preference["tts_voice"]