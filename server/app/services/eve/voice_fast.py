"""Voice fast path — ultra low latency (<1s) Eve voice reply.

Bypasses heavy RAG/tool loop. Provider priority: Ollama (local, OLLAMA_URL) >
groq 8b instant > gpt-4o-mini > user's resolved config. Streaming + sentence-
chunked TTS so first audio plays ~500-700ms after STT.
"""

import base64
import logging
import re

from app.db import SqlClient

from app.core.config import settings
from app.services.ai_models.catalog import DEFAULT_PROVIDER
from app.services.ai_models.config import build_ai_config, has_server_key
from app.services.ai_models.contracts import AiConfig

logger = logging.getLogger(__name__)

VOICE_INSTRUCTIONS = (
    "You are Eve, a warm concise voice assistant for StarWaves. "
    "Reply in 1-2 short sentences, max 25 words, friendly and helpful. "
    "No preamble, no markdown, plain speech."
)

# Sentence boundary for chunked TTS
_SENTENCE_RE = re.compile(r"[^.!?]+[.!?]+[\s]*")


def resolve_voice_config(database: SqlClient | None, user_uid: str | None) -> AiConfig:
    """Pick fastest available model for voice: ollama > groq 8b instant > gpt-4o-mini > user default."""
    # Prefer Ollama when a local URL is configured — no API key required
    if has_server_key("ollama"):
        model = settings.ollama_model or "llama3.1"
        try:
            return build_ai_config("ollama", model)
        except Exception:
            pass
    # Prefer groq 8b instant if groq key exists (fastest ~250ms TTFT)
    if has_server_key("groq"):
        model = settings.groq_voice_model or "llama-3.1-8b-instant"
        try:
            return build_ai_config("groq", model)
        except Exception:
            pass
    # Fallback to openai gpt-4o-mini only when the server key is present AND
    # no custom base URL is configured (custom endpoints may not carry that model)
    if has_server_key("openai") and not settings.openai_url:
        try:
            return build_ai_config("openai", "gpt-4o-mini")
        except Exception:
            pass
    # Fallback to the user's resolved AI config (respects their chosen provider/model)
    if database is not None and user_uid:
        from app.services.ai_models.config import resolve_ai_config

        try:
            return resolve_ai_config(database, user_uid)
        except Exception:
            pass
    return build_ai_config(DEFAULT_PROVIDER)


def _choose_tts(sentence: str, tts_provider: str | None, tts_voice: str | None, language: str = "en-US"):
    """Synthesize one sentence via fastest available server TTS, return (b64, mime, provider_used)."""
    # Try ElevenLabs, then openrouter fish, then google, else none
    try:
        if tts_provider == "elevenlabs" or (tts_provider is None and settings.elevenlabs_api_key):
            from app.services.speech.elevenlabs import synthesize_speech_elevenlabs

            voice = tts_voice or settings.elevenlabs_voice_id or "21m00Tcm4TlvDq8ikWAM"
            audio, mime = synthesize_speech_elevenlabs(sentence, language, voice, 1.0, 0.0)
            return base64.b64encode(audio).decode(), mime, "elevenlabs"
    except Exception as e:
        logger.debug(f"voice_fast TTS elevenlabs failed: {e}")
    try:
        if tts_provider == "openrouter" or (tts_provider is None and settings.openrouter_api_key):
            from app.services.speech.openrouter_tts import synthesize_speech_openrouter

            voice = tts_voice or settings.openrouter_tts_voice or "alloy"
            audio, mime = synthesize_speech_openrouter(sentence, language, voice, 1.0, 0.0)
            return base64.b64encode(audio).decode(), mime, "openrouter"
    except Exception as e:
        logger.debug(f"voice_fast TTS openrouter failed: {e}")
    try:
        if tts_provider == "google" or (tts_provider is None and settings.google_cloud_tts_api_key):
            from app.services.speech.google_tts import synthesize_speech

            voice = tts_voice or settings.google_cloud_tts_voice or "en-US-Standard-C"
            audio, mime = synthesize_speech(sentence, language, voice, 1.0, 0.0)
            return base64.b64encode(audio).decode(), mime, "google"
    except Exception as e:
        logger.debug(f"voice_fast TTS google failed: {e}")
    # No server TTS available -> browser will handle via SpeechSynthesis
    return None, None, "browser"


def stream_voice_reply(
    database: SqlClient | None,
    user: dict | None,
    prompt_text: str,
    session_id: str | None = None,
    tts_provider: str | None = None,
    tts_voice: str | None = None,
    language: str = "en-US",
):
    """Yield SSE events for voice: delta -> audio per sentence -> done.

    Events:
      {"type":"delta","text":str}
      {"type":"audio","sentence":str,"audio_base64":str,"mime":str}
      {"type":"done","message":str}
    """
    from app.services.ai_models import get_provider_client  # local to avoid cycle

    user_uid = (user or {}).get("uid")
    cfg = resolve_voice_config(database, user_uid if isinstance(database, Client) else None)

    # Build minimal conversation — last prompt only, no history for speed (optionally include last 2)
    conversation = [{"role": "user", "content": prompt_text[:2000]}]

    try:
        client = get_provider_client(cfg)
    except Exception as e:
        yield {"type": "error", "detail": f"Voice provider unavailable: {e}"}
        return

    buffer = ""
    full_text = ""
    # Use streaming call with no tools
    try:
        for chunk in client.call_stream(cfg.model, VOICE_INSTRUCTIONS, conversation, tools=[]):
            if chunk.kind == "text_delta" and chunk.text:
                txt = chunk.text
                buffer += txt
                full_text += txt
                yield {"type": "delta", "text": txt}
                # Check for sentence boundary
                # Extract complete sentences
                while True:
                    m = _SENTENCE_RE.match(buffer)
                    if not m:
                        # also handle buffer > 80 chars without punctuation (force chunk)
                        if len(buffer) > 80 and " " in buffer:
                            # force split at last space
                            idx = buffer.rfind(" ", 0, 80)
                            if idx > 20:
                                sentence = buffer[:idx].strip()
                                buffer = buffer[idx:].lstrip()
                                if sentence:
                                    b64, mime, prov = _choose_tts(sentence, tts_provider, tts_voice, language)
                                    if b64:
                                        yield {"type": "audio", "sentence": sentence, "audio_base64": b64, "mime": mime, "provider": prov}
                                    else:
                                        yield {"type": "audio", "sentence": sentence, "audio_base64": None, "mime": None, "provider": "browser", "text": sentence}
                                continue
                        break
                    sentence = m.group(0).strip()
                    buffer = buffer[m.end():].lstrip()
                    if not sentence:
                        continue
                    b64, mime, prov = _choose_tts(sentence, tts_provider, tts_voice, language)
                    if b64:
                        yield {"type": "audio", "sentence": sentence, "audio_base64": b64, "mime": mime, "provider": prov}
                    else:
                        yield {"type": "audio", "sentence": sentence, "audio_base64": None, "mime": None, "provider": "browser", "text": sentence}
            elif chunk.kind == "final" and chunk.response is not None:
                # Flush remaining buffer
                remainder = buffer.strip()
                if remainder:
                    full_text = full_text  # already includes remainder
                    b64, mime, prov = _choose_tts(remainder, tts_provider, tts_voice, language)
                    if b64:
                        yield {"type": "audio", "sentence": remainder, "audio_base64": b64, "mime": mime, "provider": prov}
                    else:
                        yield {"type": "audio", "sentence": remainder, "audio_base64": None, "mime": None, "provider": "browser", "text": remainder}
                # Also ensure final text from response if buffer was empty but response has full text longer than streamed? Use response text as source if not yielded
                resp_text = (chunk.response.text or "").strip()
                if resp_text and len(resp_text) > len(full_text) + 5 and not full_text:
                    # fallback: chunk streaming didn't yield deltas, synthesize whole
                    b64, mime, prov = _choose_tts(resp_text, tts_provider, tts_voice, language)
                    if b64:
                        yield {"type": "audio", "sentence": resp_text, "audio_base64": b64, "mime": mime, "provider": prov}
                    else:
                        yield {"type": "audio", "sentence": resp_text, "audio_base64": None, "mime": None, "provider": "browser", "text": resp_text}
                    full_text = resp_text
                break
    except Exception as e:
        logger.error(f"voice_fast stream failed {cfg.provider}/{cfg.model}: {e}", exc_info=True)
        yield {"type": "error", "detail": f"Voice stream failed ({cfg.provider}/{cfg.model}): {e}"}
        return

    yield {"type": "done", "message": full_text.strip() or "Sorry, I couldn't generate a response."}


def voice_reply_blocking(
    database: SqlClient | None,
    user: dict | None,
    prompt_text: str,
) -> str:
    """One-shot fast voice reply (no tools, no RAG) — used by Twilio TwiML where
    the whole reply must be known before rendering XML. ~300-600ms with groq 8b."""
    cfg = resolve_voice_config(database if isinstance(database, Client) else None, (user or {}).get("uid"))
    conversation = [{"role": "user", "content": prompt_text[:2000]}]
    try:
        from app.services.ai_models import get_provider_client, run_tool_loop

        client = get_provider_client(cfg)
        text, _, _ = run_tool_loop(client, cfg, VOICE_INSTRUCTIONS, conversation, tools=[])
        return text
    except Exception as e:
        logger.error(f"voice_reply_blocking failed {cfg.provider}/{cfg.model}: {e}", exc_info=True)
        return "Sorry, I didn't catch that. Could you say it again?"
