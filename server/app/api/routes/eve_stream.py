"""Eve chat SSE streaming endpoint — single responsibility: stream
stream_chat_with_eve events to the client as server-sent events."""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.db import SqlClient, get_firestore

from app.core.auth import get_current_user
from app.schemas.eve import EveChatRequest
from app.services.eve import stream_chat_with_eve
from app.services.eve.voice_fast import stream_voice_reply
from app.services.speech._shared import resolve_speech_preference

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/eve")

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


@router.post("/chat/stream")
async def chat_stream(
    payload: EveChatRequest,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    """Stream an Eve chat response as server-sent events.

    Emits `data: {json event}\\n\\n` frames (delta / tool_start / tool_end /
    done / error) terminated by a final `data: [DONE]` frame.
    """

    def event_source():
        try:
            for event in stream_chat_with_eve(
                database,
                user,
                [item.model_dump() for item in payload.messages],
                payload.session_id,
            ):
                yield f"data: {json.dumps(event, default=str)}\n\n"
        except Exception as error:
            # Never terminate the stream without an in-band error frame.
            logger.error(f"[Eve Chat Stream] Unhandled stream failure: {type(error).__name__}: {error}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'detail': 'Eve stream failed unexpectedly.'})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_source(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.post("/voice/stream")
async def voice_stream(
    payload: EveChatRequest,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    """Ultra low-latency Eve voice turn (<1s first audio).

    Skips RAG/tool loop; uses fast model (groq 8b-instant) streaming and
    synthesizes TTS per sentence as deltas arrive. Events mirror chat stream
    plus `audio` frames carrying base64 MP3 (or provider=browser when no
    server TTS is available — client speaks via SpeechSynthesis).
    """
    last_message = next((m.content for m in reversed(payload.messages) if m.role == "user"), "")
    speech = await asyncio.to_thread(resolve_speech_preference, database, user["uid"])

    def event_source():
        try:
            for event in stream_voice_reply(
                database,
                user,
                last_message,
                session_id=payload.session_id,
                tts_provider=speech.get("tts_provider"),
                tts_voice=speech.get("tts_voice"),
            ):
                yield f"data: {json.dumps(event, default=str)}\n\n"
        except Exception as error:
            logger.error(f"[Eve Voice Stream] Unhandled failure: {type(error).__name__}: {error}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'detail': 'Voice stream failed unexpectedly.'})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_source(), media_type="text/event-stream", headers=SSE_HEADERS)
