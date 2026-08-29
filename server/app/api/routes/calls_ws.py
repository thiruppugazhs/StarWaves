"""WebSocket endpoint for real-time call signaling.

One persistent connection per authenticated user at ``/ws/calls``.
The server pushes events to the client instead of the client polling:

  { "type": "incoming_call",  "call": { ...CallResponse } }
  { "type": "call_signal",    "call": { ...CallResponse } }
  { "type": "call_updated",   "call": { ...CallResponse } }
  { "type": "ping" }

Authentication uses the same Starwaves token passed as a ``token`` query
parameter (identical token format validated by ``app.core.auth``).
"""

import asyncio
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.auth import get_current_user_from_token
from app.core.ws_manager import call_ws_manager
from app.db import get_firestore
from app.repositories.calls import CallRepository
from app.schemas.call import CallResponse

logger = logging.getLogger(__name__)

router = APIRouter()

PING_INTERVAL_S = 25


def _serialize_call(call: dict) -> dict:
    call["messages"] = call.get("messages") or []
    return call


@router.websocket("/ws/calls")
async def calls_websocket(
    websocket: WebSocket,
    token: str = Query(..., description="Starwaves auth token"),
) -> None:
    """Persistent WebSocket connection for call signaling events."""
    # Origin check — block cross-site WebSocket hijack
    origin = websocket.headers.get("origin")
    if origin:
        from app.core.cors import is_allowed_origin

        if not is_allowed_origin(origin):
            await websocket.close(code=4003)
            return
    if len(token) > 2048:
        await websocket.close(code=4001)
        return
    try:
        user = get_current_user_from_token(token)
    except Exception:
        await websocket.close(code=4001)
        return

    uid = user["uid"]
    await call_ws_manager.connect(uid, websocket)

    # Send any already-ringing calls so the client isn't blind during reconnects.
    try:
        database = get_firestore()
        repository = CallRepository(database)
        repository.expire_stale_ringing(uid)
        ringing = repository.list_incoming(uid)
        for call in ringing:
            await websocket.send_json(
                {"type": "incoming_call", "call": _serialize_call(call)}
            )
    except Exception as err:
        logger.warning("Failed to flush ringing calls for uid=%s: %s", uid, err)

    try:
        while True:
            # Keep the connection alive with server-side pings.
            # We also drain any client messages (pong / keep-alive) without acting on them.
            try:
                text = await asyncio.wait_for(websocket.receive_text(), timeout=PING_INTERVAL_S)
                if len(text) > 8192:
                    await websocket.close(code=1009)
                    break
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    except Exception as err:
        logger.debug("WS session ended for uid=%s: %s", uid, err)
    finally:
        call_ws_manager.disconnect(uid, websocket)
