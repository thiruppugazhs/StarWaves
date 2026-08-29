import asyncio
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from app.db import SqlClient, get_firestore

logger = logging.getLogger(__name__)

from app.core.auth import get_current_user
from app.core.cache import CACHE_TTL_MEDIUM, CACHE_TTL_SHORT, cache_invalidate_prefix, cached
from app.repositories import eve_sessions
from app.repositories.eve import add_memory, delete_memory, list_memories, search_memories
from app.schemas.eve import (
    EveChatRequest,
    EveChatResponse,
    EveDeleteRequest,
    EveDeleteResponse,
    EveMemoriesResponse,
    EveMemoryCreate,
    EveMemoryDeleteResponse,
    EveRestoreRequest,
    EveRestoreResponse,
    EveSessionCreateRequest,
    EveSessionListResponse,
    EveSessionResponse,
)
from app.schemas.eve_speech import (
    EveSynthesizeRequest,
    EveTranscribeResponse,
)
from app.services.eve import chat_with_eve, delete_workspace_record, restore_workspace_record
from app.services.speech import (
    SpeechServiceError,
    resolve_stt_engine,
    resolve_tts_engine,
    stream_speech_openrouter,
    synthesize_speech,
    synthesize_speech_elevenlabs,
    synthesize_speech_openrouter,
    transcribe_audio,
    transcribe_audio_deepgram,
)

router = APIRouter(prefix="/eve")

_EVE_SESSIONS_PREFIX = "eve:sessions"
_EVE_MEMORIES_PREFIX = "eve:memories"


def _invalidate_eve(user_id: str) -> None:
    cache_invalidate_prefix(f"{_EVE_SESSIONS_PREFIX}:{user_id}")
    cache_invalidate_prefix(f"{_EVE_MEMORIES_PREFIX}:{user_id}")


# Server STT engines → transcriber. One entry per provider avoids mode-flag branching.
_STT_TRANSCRIBERS = {
    "groq": transcribe_audio,
    "deepgram": transcribe_audio_deepgram,
}


@router.post("/transcribe", response_model=EveTranscribeResponse)
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    engine, model = await asyncio.to_thread(resolve_stt_engine, database, user["uid"])
    transcriber = _STT_TRANSCRIBERS.get(engine)
    if transcriber is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No server speech-to-text provider is configured. Select a server STT provider or use browser voice.",
        )
    audio_bytes = await file.read()
    try:
        text = await asyncio.to_thread(
            transcriber,
            audio_bytes,
            file.content_type,
            language,
            model,
        )
    except SpeechServiceError as error:
        logger.error(f"[Eve Transcribe] Transcription failed for user {user.get('uid')}: {error}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Speech transcription failed: {error}",
        ) from error
    return {"text": text}


@router.post("/synthesize")
async def synthesize(
    payload: EveSynthesizeRequest,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    engine, voice = await asyncio.to_thread(resolve_tts_engine, database, user["uid"])
    if engine not in ("elevenlabs", "google", "openrouter"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Server text-to-speech is not configured. Select a server TTS provider or use browser voice.",
        )
    try:
        if engine == "elevenlabs":
            audio_bytes, media_type = await asyncio.to_thread(
                synthesize_speech_elevenlabs,
                payload.text,
                payload.language,
                payload.voice or voice,
                payload.rate,
                payload.pitch,
            )
        elif engine == "openrouter":
            audio_bytes, media_type = await asyncio.to_thread(
                synthesize_speech_openrouter,
                payload.text,
                payload.language,
                payload.voice or voice,
                payload.rate,
                payload.pitch,
            )
        else:
            audio_bytes, media_type = await asyncio.to_thread(
                synthesize_speech,
                payload.text,
                payload.language,
                payload.voice or voice,
                payload.rate,
                payload.pitch,
            )
    except SpeechServiceError as error:
        logger.error(f"[Eve Synthesize] Speech synthesis failed for user {user.get('uid')}: {error}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Speech synthesis failed: {error}",
        ) from error
    return Response(content=audio_bytes, media_type=media_type)


@router.post("/synthesize/stream")
async def synthesize_stream(
    payload: EveSynthesizeRequest,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    """Stream TTS audio — chunked transfer, no buffering (TTFA ~100ms for Fish).

    Only OpenRouter supports true streaming; Google falls back to buffered
    response via the same chunked envelope so callers can always use this route.
    """
    engine, voice = await asyncio.to_thread(resolve_tts_engine, database, user["uid"])
    if engine not in ("google", "openrouter"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Server text-to-speech is not configured. Select a server TTS provider or use browser voice.",
        )
    if engine == "openrouter":
        try:
            # Offload the httpx.stream generator to a thread; StreamingResponse will
            # pull from it synchronously. Wrap in a generator that yields bytes.
            def _generator():
                try:
                    yield from stream_speech_openrouter(
                        payload.text,
                        payload.language,
                        payload.voice or voice,
                        payload.rate,
                        payload.pitch,
                    )
                except SpeechServiceError as error:
                    logger.error(f"[Eve Synthesize Stream] OpenRouter stream failed for user {user.get('uid')}: {error}", exc_info=True)
                    # Cannot raise HTTPException mid-stream; just stop.
                    return

            return StreamingResponse(
                _generator(),
                media_type="audio/mpeg",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                    "X-Content-Type-Options": "nosniff",
                },
            )
        except SpeechServiceError as error:
            logger.error(f"[Eve Synthesize Stream] Speech synthesis failed for user {user.get('uid')}: {error}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Speech synthesis failed: {error}",
            ) from error

    # Google: no true streaming — buffer then stream as single chunk so callers
    # get a uniform streaming interface regardless of provider.
    try:
        audio_bytes, media_type = await asyncio.to_thread(
            synthesize_speech,
            payload.text,
            payload.language,
            payload.voice or voice,
            payload.rate,
            payload.pitch,
        )
    except SpeechServiceError as error:
        logger.error(f"[Eve Synthesize Stream] Speech synthesis failed for user {user.get('uid')}: {error}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Speech synthesis failed: {error}",
        ) from error

    def _buffered_stream():
        yield audio_bytes

    return StreamingResponse(
        _buffered_stream(),
        media_type=media_type,
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat", response_model=EveChatResponse)
async def chat(
    payload: EveChatRequest,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    # Offload heavy LLM + tool loop to thread to keep event loop responsive; LLM calls are sync httpx
    message, changed_resources, actions = await asyncio.to_thread(
        chat_with_eve,
        database,
        user,
        [item.model_dump() for item in payload.messages],
        payload.session_id,
    )
    return {"message": message, "changed_resources": changed_resources, "actions": actions}


@router.get("/sessions", response_model=EveSessionListResponse)
@cached(ttl=CACHE_TTL_SHORT, prefix=_EVE_SESSIONS_PREFIX)
async def list_sessions(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    sessions = await asyncio.to_thread(eve_sessions.list_sessions, database, user["uid"])
    return {"sessions": sessions}


@router.post("/sessions", response_model=EveSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: EveSessionCreateRequest,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    session = await asyncio.to_thread(
        eve_sessions.create_session,
        database,
        user["uid"],
        [item.model_dump() for item in payload.messages],
    )
    _invalidate_eve(user["uid"])
    return {"session": session}


@router.get("/sessions/{session_id}", response_model=EveSessionResponse)
@cached(ttl=CACHE_TTL_MEDIUM, prefix=_EVE_SESSIONS_PREFIX)
async def get_session(
    session_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    try:
        session = await asyncio.to_thread(eve_sessions.get_session, database, user["uid"], session_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return {"session": session}


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    ok = await asyncio.to_thread(eve_sessions.delete_session, database, user["uid"], session_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    _invalidate_eve(user["uid"])


@router.get("/memories", response_model=EveMemoriesResponse)
@cached(ttl=CACHE_TTL_SHORT, prefix=_EVE_MEMORIES_PREFIX)
async def get_memories(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    memories = await asyncio.to_thread(list_memories, database, user["uid"])
    return {"memories": memories}


@router.get("/memories/search", response_model=EveMemoriesResponse)
@cached(ttl=10, prefix=f"{_EVE_MEMORIES_PREFIX}:search")
async def search_eve_memories_route(
    q: str,
    limit: int = 5,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    if limit < 1 or limit > 20:
        raise HTTPException(status_code=400, detail="limit must be 1..20")
    memories = await asyncio.to_thread(search_memories, database, user["uid"], q, limit)
    return {"memories": memories}


@router.post("/memories", response_model=EveMemoriesResponse, status_code=status.HTTP_201_CREATED)
async def create_memory(
    payload: EveMemoryCreate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    memory = await asyncio.to_thread(add_memory, database, user["uid"], payload.content)
    # Invalidate handled inside service, but also refresh list via thread
    memories = await asyncio.to_thread(list_memories, database, user["uid"])
    _invalidate_eve(user["uid"])
    return {"memories": [memory, *memories]}


@router.delete("/memories/{memory_id}", response_model=EveMemoryDeleteResponse)
async def remove_memory(
    memory_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    ok = await asyncio.to_thread(delete_memory, database, user["uid"], memory_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found.")
    _invalidate_eve(user["uid"])
    return {"message": "Memory removed."}


@router.post("/delete", response_model=EveDeleteResponse)
async def delete_record(
    payload: EveDeleteRequest,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    try:
        message, changed_resources = await asyncio.to_thread(
            delete_workspace_record,
            database,
            user,
            payload.resource,
            payload.record_id,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return {"message": message, "changed_resources": changed_resources}


@router.post("/restore", response_model=EveRestoreResponse)
async def restore_record(
    payload: EveRestoreRequest,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    try:
        message, changed_resources = await asyncio.to_thread(
            restore_workspace_record,
            database,
            user,
            payload.resource,
            payload.record_id,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return {"message": message, "changed_resources": changed_resources}
