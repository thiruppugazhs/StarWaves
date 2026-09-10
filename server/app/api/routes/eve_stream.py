"""Eve chat SSE streaming endpoint - single responsibility: stream
stream_chat_with_eve events to the client as server-sent events."""

import asyncio
import json
import logging
import threading

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.db import SqlClient, get_firestore

from app.core.auth import get_current_user
from app.schemas.eve import EveChatRequest
from app.services.eve import stream_chat_with_eve
from app.services.eve.voice_fast import stream_voice_reply
from app.services.speech._shared import resolve_speech_preference

logger = logging.getLogger(__name__)

_SENTINEL = object()

router = APIRouter(prefix="/eve")

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _run_producer_thread(target, loop, async_q):
    def post(item):
        loop.call_soon_threadsafe(async_q.put_nowait, item)

    def run():
        try:
            for item in target():
                post(item)
        except Exception as error:
            logger.error("[Eve SSE Producer] Unhandled error: %s: %s", type(error).__name__, error, exc_info=True)
            post(f"data: {json.dumps({'type': 'error', 'detail': 'Eve stream failed unexpectedly.'})}\n\n")
        finally:
            post(_SENTINEL)

    threading.Thread(target=run, daemon=True).start()


async def _consume_queue(async_q):
    while True:
        item = await async_q.get()
        if item is _SENTINEL:
            break
        yield item
    yield "data: [DONE]\n\n"


@router.post("/chat/stream")
async def chat_stream(
    payload: EveChatRequest,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    messages = [item.model_dump() for item in payload.messages]
    session_id = payload.session_id
    loop = asyncio.get_event_loop()
    async_q: asyncio.Queue = asyncio.Queue()

    def _iter_events():
        if payload.editor_context is not None:
            if payload.provider or payload.model:
                stream = stream_chat_with_eve(
                    database, user, messages, session_id,
                    payload.provider, payload.model, payload.editor_context,
                )
            else:
                stream = stream_chat_with_eve(
                    database, user, messages, session_id,
                    editor_context=payload.editor_context,
                )
        else:
            if payload.provider or payload.model:
                stream = stream_chat_with_eve(
                    database, user, messages, session_id,
                    payload.provider, payload.model,
                )
            else:
                stream = stream_chat_with_eve(
                    database, user, messages, session_id,
                )
        for event in stream:
            yield f"data: {json.dumps(event, default=str)}\n\n"

    _run_producer_thread(_iter_events, loop, async_q)
    return StreamingResponse(_consume_queue(async_q), media_type="text/event-stream", headers=SSE_HEADERS)


@router.post("/voice/stream")
async def voice_stream(
    payload: EveChatRequest,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    last_message = next((m.content for m in reversed(payload.messages) if m.role == "user"), "")
    speech = await asyncio.to_thread(resolve_speech_preference, database, user["uid"])
    session_id = payload.session_id
    tts_provider = speech.get("tts_provider")
    tts_voice = speech.get("tts_voice")
    loop = asyncio.get_event_loop()
    async_q: asyncio.Queue = asyncio.Queue()

    def _iter_events():
        for event in stream_voice_reply(
            database, user, last_message,
            session_id=session_id, tts_provider=tts_provider, tts_voice=tts_voice,
        ):
            yield f"data: {json.dumps(event, default=str)}\n\n"

    _run_producer_thread(_iter_events, loop, async_q)
    return StreamingResponse(_consume_queue(async_q), media_type="text/event-stream", headers=SSE_HEADERS)
