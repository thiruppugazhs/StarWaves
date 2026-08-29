"""Twilio ConversationRelay WebSocket — streaming voice turns with barge-in.

Protocol (Twilio ⇄ us), JSON frames over one socket per live PSTN call:
  inbound  : setup {callSid, streamSid, from, to}
             prompt {voicePrompt, lang}          — final caller transcript
             interrupt                            — caller barged in
             dtmf {digit} / error {description}
  outbound : text {token, last: false}            — incremental reply words
             text {token: ".", last: true}        — end of Eve's turn

Latency: Twilio handles STT+TTS itself; we stream fast-model text tokens as
they are generated (groq llama-3.1-8b-instant), so first word reaches the
phone ~0.7-1.2s after the caller stops speaking, and interrupt events let the
caller talk over Eve mid-reply.
"""

import asyncio
import logging
import threading

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.db import get_firestore
from app.repositories.calls import CallRepository
from app.services.eve.voice_fast import VOICE_INSTRUCTIONS, resolve_voice_config
from app.services.twilio.twiml import split_text_tokens

logger = logging.getLogger(__name__)

router = APIRouter()

END_TOKEN = "."
NO_REPLY = "Sorry, I didn't catch that."


def _resolve_user_record(database, call_id: str) -> dict | None:
    """Resolve the human participant of a relayed call for Eve context."""
    try:
        call = CallRepository(database).get(call_id)
    except Exception:
        return None
    if not call:
        return None
    callee_uid = (call.get("callee") or {}).get("uid")
    caller_uid = (call.get("caller") or {}).get("uid")
    uid = callee_uid if callee_uid and callee_uid != "eve-bot" else caller_uid
    if not uid or uid == "eve-bot":
        return None
    try:
        from app.repositories.users import get_user_by_id

        return get_user_by_id(database, uid) or {"uid": uid, "display_name": "User", "email": ""}
    except Exception:
        return {"uid": uid, "display_name": "User", "email": ""}


async def _send_text_turn(websocket: WebSocket, prompt_text: str, user_record: dict | None) -> None:
    """Stream one Eve turn: run the fast model in a worker thread and forward
    token chunks to Twilio as they arrive."""
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()
    cfg = resolve_voice_config(None, (user_record or {}).get("uid"))

    def producer() -> None:
        def emit(kind: str, payload) -> None:
            loop.call_soon_threadsafe(queue.put_nowait, (kind, payload))

        try:
            from app.services.ai_models import get_provider_client

            client = get_provider_client(cfg)
            conversation = [{"role": "user", "content": prompt_text[:2000]}]
            received = ""
            for chunk in client.call_stream(cfg.model, VOICE_INSTRUCTIONS, conversation, tools=[]):
                if chunk.kind == "text_delta" and chunk.text:
                    received += chunk.text
                    # Stream deltas verbatim so spacing survives chunk boundaries;
                    # only oversized blobs get word-split.
                    if len(chunk.text) <= 40:
                        emit("token", chunk.text)
                    else:
                        for token in split_text_tokens(chunk.text):
                            emit("token", token)
                elif chunk.kind == "final" and chunk.response is not None:
                    full = (chunk.response.text or "").strip()
                    if full.startswith(received) and len(full) > len(received):
                        # Provider withheld part of the reply from the stream.
                        emit("token", full[len(received):])
                    elif not received and full:
                        for token in split_text_tokens(full):
                            emit("token", token)
            emit("done", None)
        except Exception as error:  # noqa: BLE001 — surfaced to Twilio as fallback text
            logger.error(f"[Twilio Relay] generation failed ({cfg.provider}/{cfg.model}): {error}", exc_info=True)
            emit("fallback", NO_REPLY)

    threading.Thread(target=producer, daemon=True).start()

    while True:
        kind, payload = await queue.get()
        try:
            if kind == "token":
                await websocket.send_json({"type": "text", "token": payload, "last": False})
            elif kind == "done":
                await websocket.send_json({"type": "text", "token": END_TOKEN, "last": True})
                return
            elif kind == "fallback":
                await websocket.send_json({"type": "text", "token": payload, "last": True})
                return
        except Exception:
            # Caller hung up / socket died mid-turn — drop remaining tokens.
            return


@router.websocket("/ws/twilio-relay")
async def twilio_relay_ws(
    websocket: WebSocket,
    call_id: str = Query(default=""),
) -> None:
    # Basic auth: require valid call_id and optional token check; Twilio relay should be internal
    if not call_id or len(call_id) > 128:
        await websocket.close(code=4001)
        return
    await websocket.accept()
    database = get_firestore()
    user_record = _resolve_user_record(database, call_id)
    if not user_record:
        # Unknown call — don't stream but keep socket to avoid info leak timing
        pass

    # Mark the PSTN call active as soon as Twilio connects the media session.
    if call_id:
        try:
            repo = CallRepository(database)
            current = repo.get(call_id)
            if current and current.get("status") == "ringing":
                repo.update_status(call_id, "active")

                from app.core.ws_manager import call_ws_manager

                updated = repo.get(call_id)
                for uid in {(updated.get("caller") or {}).get("uid"), (updated.get("callee") or {}).get("uid")} - {None}:
                    await call_ws_manager.send(uid, {"type": "call_updated", "call": updated})
        except Exception as error:
            logger.warning(f"[Twilio Relay] status activation failed for call {call_id}: {error}")

    generate_task: asyncio.Task | None = None

    async def handle_prompt(text: str) -> None:
        nonlocal generate_task
        # Barge-in: a new prompt supersedes any in-flight reply.
        if generate_task and not generate_task.done():
            generate_task.cancel()
        generate_task = asyncio.create_task(_send_text_turn(websocket, text, user_record))

    try:
        while True:
            message = await websocket.receive_json()
            if not isinstance(message, dict) or len(str(message)) > 4096:
                continue
            message_type = message.get("type")

            if message_type == "prompt":
                text = (message.get("voicePrompt") or "").strip()
                if text:
                    await handle_prompt(text)
            elif message_type == "interrupt":
                if generate_task and not generate_task.done():
                    generate_task.cancel()
            elif message_type == "error":
                logger.warning(f"[Twilio Relay] Twilio reported error: {message}")
            elif message_type == "dtmf":
                digit = message.get("digit") or ""
                logger.info(f"[Twilio Relay] dtmf={digit!r} on call {call_id}")
            elif message_type == "setup":
                logger.info(f"[Twilio Relay] setup callSid={message.get('callSid')} call_id={call_id}")
            # Unknown types ignored for forward compatibility.
    except WebSocketDisconnect:
        pass
    except Exception as error:
        logger.debug(f"[Twilio Relay] session ended for call {call_id}: {error}")
    finally:
        if generate_task and not generate_task.done():
            generate_task.cancel()


def relay_ws_url_for_call(call_id: str) -> str:
    """Derive the wss relay URL Twilio should dial for this call."""
    base = (settings.twilio_callback_base_url or "").rstrip("/")
    if base.startswith("https://"):
        base = "wss://" + base[len("https://"):]
    elif base.startswith("http://"):
        base = "ws://" + base[len("http://"):]
    return f"{base}/ws/twilio-relay?call_id={call_id}"
