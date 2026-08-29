"""Twilio PSTN routes — dual call option (in_app WebRTC vs Twilio PSTN)."""

import asyncio
import logging
from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import PlainTextResponse

from app.core.auth import get_current_user
from app.core.config import settings
from app.db import ArrayUnion, SERVER_TIMESTAMP, SqlClient, get_firestore
from app.repositories.calls import CallRepository
from app.repositories.users import get_user_by_id
from app.schemas.call import CallResponse, CallUser, EveTwilioCallRequest, TwilioCallCreate
from app.services.notifications import send_call_notification
from app.services.twilio.client import TwilioError, initiate_twilio_call, is_twilio_configured, map_twilio_status
from app.services.twilio.twiml import build_eve_twiml, build_human_twiml, build_relay_twiml

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calls")


def _twilio_base() -> str:
    base = (settings.twilio_callback_base_url or "").rstrip("/")
    if not base:
        base = f"http://127.0.0.1:8000"
    return base


def _relay_ws_url(call_id: str) -> str:
    """wss relay URL for ConversationRelay (https→wss, http→ws)."""
    from app.api.routes.twilio_relay import relay_ws_url_for_call

    return relay_ws_url_for_call(call_id)


@router.get("/twilio/config")
def twilio_config(user: dict = Depends(get_current_user)):
    return {
        "enabled": is_twilio_configured(),
        "from_number": settings.twilio_phone_number if is_twilio_configured() else None,
        "configured": is_twilio_configured(),
    }


@router.post("/twilio", response_model=CallResponse)
async def create_twilio_call(payload: TwilioCallCreate, database: SqlClient = Depends(get_firestore), user: dict = Depends(get_current_user)):
    if not is_twilio_configured():
        raise HTTPException(status_code=503, detail="Twilio PSTN calling is not configured on the server. Set TWILIO_* env vars.")
    repo = CallRepository(database)
    # Create internal call record with provider=twilio
    caller = CallUser(uid=user["uid"], name=user.get("name") or user.get("display_name") or "", email=user.get("email") or "")
    # For PSTN, callee is synthetic phone identity
    callee = CallUser(uid=f"phone:{payload.phone_number}", name=payload.phone_number, email="")
    call = repo.create(caller=caller, callee=callee, mode=payload.mode, provider="twilio", phone_number=payload.phone_number)
    # ConversationRelay: Twilio opens /ws/twilio-relay?call_id=... and we stream text tokens
    twiml_url = f"{_twilio_base()}/api/v1/calls/twilio/relay-twiml/{call['id']}"
    status_cb = f"{_twilio_base()}/api/v1/calls/twilio/status"
    # Store message as first Say text if provided
    if payload.message:
        call["messages"] = [{"id": "twilio-say", "from_uid": user["uid"], "type": "say", "payload": payload.message[:500], "created_at": call["created_at"]}]
    try:
        tw = initiate_twilio_call(payload.phone_number, twiml_url, status_cb)
        sid = tw.get("sid") or tw.get("sid", "")
        if sid:
            repo.set_external_sid(call["id"], sid)
            call["external_sid"] = sid
    except TwilioError as e:
        logger.error(f"Twilio initiate failed for {payload.phone_number}: {e}")
        # mark call as missed/failed but still return record for UI
        repo.update_status(call["id"], "missed")
        call["status"] = "missed"
        raise HTTPException(status_code=502, detail=str(e)) from e
    send_call_notification(database=database, target_user_id=user["uid"], title="Twilio Call Initiated", message=f"Calling {payload.phone_number} via Twilio", notification_type="call_incoming", call_id=call["id"])
    return call


@router.post("/trigger-eve-twilio", response_model=CallResponse)
async def trigger_eve_twilio_call(payload: EveTwilioCallRequest, database: SqlClient = Depends(get_firestore), user: dict = Depends(get_current_user)):
    if not is_twilio_configured():
        raise HTTPException(status_code=503, detail="Twilio not configured.")
    repo = CallRepository(database)
    user_rec = get_user_by_id(database, user["uid"]) or user
    callee = CallUser(uid=user["uid"], name=user_rec.get("display_name") or user_rec.get("name") or "User", email=user_rec.get("email") or "")
    eve = CallUser(uid="eve-bot", name="Eve AI Assistant", email="eve@starwaves.app")
    call = repo.create(caller=eve, callee=callee, mode=payload.mode, provider="twilio", phone_number=payload.phone_number)
    # prompt stored as Say text
    prompt = payload.prompt or "Hello, this is Eve from StarWaves. How can I help you today?"
    # Update call with say payload so twiml can render it
    try:
        # Use messages array to carry prompt
        repo._document(call["id"]).update({"messages": ArrayUnion([{"id": "eve-prompt", "from_uid": "eve-bot", "type": "say", "payload": prompt[:500], "created_at": call["created_at"]}])})
        call["messages"] = [{"id": "eve-prompt", "from_uid": "eve-bot", "type": "say", "payload": prompt[:500], "created_at": call["created_at"]}]
    except Exception:
        pass
    twiml_url = f"{_twilio_base()}/api/v1/calls/twilio/relay-twiml/{call['id']}"
    status_cb = f"{_twilio_base()}/api/v1/calls/twilio/status"
    try:
        tw = initiate_twilio_call(payload.phone_number, twiml_url, status_cb)
        sid = tw.get("sid") or ""
        if sid:
            repo.set_external_sid(call["id"], sid)
            call["external_sid"] = sid
    except TwilioError as e:
        logger.error(f"Eve Twilio failed for {payload.phone_number}: {e}")
        repo.update_status(call["id"], "missed")
        raise HTTPException(status_code=502, detail=str(e)) from e
    send_call_notification(database=database, target_user_id=user["uid"], title="Incoming Eve Call (Twilio)", message=f"Eve is calling your phone {payload.phone_number}", notification_type="call_incoming", call_id=call["id"])
    return call


@router.get("/twilio/relay-twiml/{call_id}", response_class=PlainTextResponse)
async def twilio_relay_twiml(call_id: str):
    """ConversationRelay TwiML — Twilio opens our WebSocket and streams JSON.

    The greeting is spoken on answer; subsequent turns stream over
    /ws/twilio-relay with barge-in support."""
    # Greeting comes from the call record when present (Eve prompt / say text).
    greeting = None
    try:
        call = CallRepository(get_firestore()).get(call_id)
        for message in (call or {}).get("messages") or []:
            if message.get("type") == "say":
                greeting = message.get("payload")
                break
    except Exception as error:
        logger.warning(f"relay-twiml lookup failed for {call_id}: {error}")
    twiml = build_relay_twiml(_relay_ws_url(call_id), greeting=greeting)
    return PlainTextResponse(twiml, media_type="application/xml")


@router.get("/twilio/twiml/{call_id}", response_class=PlainTextResponse)
async def twilio_twiml(call_id: str, database: SqlClient = Depends(get_firestore)):
    # Rely on unguessable UUID; Twilio GET has no signature body, so soft check
    # Twilio fetches this without auth — return TwiML
    repo = CallRepository(database)
    call = repo.get(call_id)
    if not call:
        return PlainTextResponse('<?xml version="1.0"?><Response><Say>Call not found.</Say><Hangup/></Response>', media_type="application/xml")
    # Determine Eve vs human by caller
    is_eve = call.get("caller", {}).get("uid") == "eve-bot" or call.get("callee", {}).get("uid") == "eve-bot"
    # Pull Say payload from messages if present
    say_text = None
    for m in (call.get("messages") or []):
        if m.get("type") == "say":
            say_text = m.get("payload")
            break
    if is_eve:
        twiml = build_eve_twiml(say_text or "Hello, this is Eve from StarWaves.", gather=True)
    else:
        twiml = build_human_twiml(say_text, None)
    return PlainTextResponse(twiml, media_type="application/xml")


@router.post("/twilio/gather", response_class=PlainTextResponse)
async def twilio_gather(request: Request, database: SqlClient = Depends(get_firestore)):
    from app.services.twilio.verify import verify_twilio_request
    await verify_twilio_request(request)
    # Twilio Gather speech result — we echo and hang up for MVP; future: pipe to Eve LLM
    form = await request.form()
    speech = form.get("SpeechResult") or form.get("speechResult") or ""
    call_sid = form.get("CallSid") or ""
    logger.info(f"Twilio gather sid={call_sid} speech={speech[:200]}")
    # For now, if speech provided, synthesize Eve reply via chat_with_eve if available
    reply = None
    if speech:
        try:
            # Attempt Eve chat for the caller of this Twilio call
            # Find call by external_sid
            from app.db.sql.client import get_db_client  # local import to avoid cycle
            # Fallback scan: search calls by external_sid
            # Since Calls collection is top-level, we can brute force via repository
            # Use Firestore query if available
            repo = CallRepository(database)
            # Try to find call with this SID by scanning recent calls via private API
            # For MVP, just echo via chat_with_eve if we can resolve user
            # Lookup calls where external_sid == call_sid
            # Simulate via direct Firestore where if SqlClient else in-memory
            try:
                docs = database.collection("calls").where("external_sid", "==", call_sid).limit(1).stream()
                for doc in docs:
                    data = doc.to_dict() or {}
                    uid = data.get("receiver_id") or data.get("callee", {}).get("uid")
                    if uid and uid != "eve-bot":
                        from app.services.eve import chat_with_eve
                        from app.repositories.users import get_user_by_id as _get_user
                        user_rec = _get_user(database, uid) or {"uid": uid, "display_name": "User", "email": ""}
                        eve_reply, _, _ = chat_with_eve(database, user_rec, [{"role": "user", "content": speech}])
                        reply = eve_reply
                        break
            except Exception as e:
                logger.warning(f"Gather Eve lookup failed: {e}")
        except Exception as e:
            logger.warning(f"Gather Eve chat failed: {e}")
    if reply:
        from app.services.twilio.twiml import build_echo_twiml
        # Use Eve reply as Say
        twiml = build_eve_twiml(reply[:800], gather=False)
        return PlainTextResponse(twiml, media_type="application/xml")
    # fallback echo
    from app.services.twilio.twiml import build_echo_twiml
    twiml = build_echo_twiml(speech or "I didn't catch that")
    return PlainTextResponse(twiml, media_type="application/xml")


@router.post("/twilio/status", response_class=PlainTextResponse)
async def twilio_status_callback(request: Request, database: SqlClient = Depends(get_firestore)):
    from app.services.twilio.verify import verify_twilio_request
    await verify_twilio_request(request)
    form = await request.form()
    # Twilio sends as form-encoded
    sid = form.get("CallSid") or form.get("Sid") or ""
    status = form.get("CallStatus") or form.get("Status") or ""
    # also handle JSON if Twilio configured differently
    if not sid:
        try:
            body = await request.json()
            sid = body.get("CallSid") or body.get("sid") or sid
            status = body.get("CallStatus") or body.get("status") or status
        except Exception:
            pass
    if sid and status:
        internal = map_twilio_status(status)
        # Find call by external_sid
        try:
            # Use streaming query to find matching call
            found = None
            try:
                q = database.collection("calls").where("external_sid", "==", sid).limit(1).stream()
                for doc in q:
                    found = doc.id
                    break
            except Exception:
                # fallback brute force scan of recent calls (e2-micro bounded)
                pass
            if found:
                repo = CallRepository(database)
                repo.update_status(found, internal)
                # push WS to participants
                call = repo.get(found)
                if call:
                    from app.core.ws_manager import call_ws_manager
                    for uid in set([call.get("caller", {}).get("uid"), call.get("callee", {}).get("uid")] ) - {None}:
                        await call_ws_manager.send(uid, {"type": "call_updated", "call": call})
        except Exception as e:
            logger.warning(f"Twilio status update failed sid={sid} status={status}: {e}")
    return PlainTextResponse('<?xml version="1.0"?><Response/>', media_type="application/xml")


@router.post("/twilio/gather-fast", response_class=PlainTextResponse)
async def twilio_gather_fast(request: Request, database: SqlClient = Depends(get_firestore)):
    from app.services.twilio.verify import verify_twilio_request
    await verify_twilio_request(request)
    """Fast gather path: fast model, no tools/RAG — targets <1s Eve TwiML reply.

    Twilio posts SpeechResult here when <Gather action=.../gather-fast>. We resolve
    the caller from CallSid → calls.external_sid, run the one-shot voice reply,
    and return a short <Say> TwiML.
    """
    form = await request.form()
    speech = form.get("SpeechResult") or form.get("speechResult") or ""
    call_sid = form.get("CallSid") or ""
    if not speech:
        return PlainTextResponse(
            '<?xml version="1.0"?><Response><Say>I didn\'t catch that. Goodbye.</Say><Hangup/></Response>',
            media_type="application/xml",
        )
    uid = None
    try:
        for doc in database.collection("calls").where("external_sid", "==", call_sid).limit(1).stream():
            data = doc.to_dict() or {}
            uid = data.get("callee", {}).get("uid")
            if uid == "eve-bot":
                uid = data.get("caller", {}).get("uid")
            break
    except Exception as e:
        logger.warning(f"gather-fast lookup failed sid={call_sid}: {e}")
    user_rec = {"uid": uid} if uid else None
    from app.services.eve.voice_fast import voice_reply_blocking

    reply = await asyncio.to_thread(voice_reply_blocking, database, user_rec, speech) or "Sorry, I couldn't process that."
    from html import escape

    safe_reply = escape(reply[:800])
    twiml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n'
        f'    <Say voice="alice">{safe_reply}</Say>\n'
        '    <Gather input="speech" speechTimeout="auto" action="/api/v1/calls/twilio/gather-fast" method="POST"/>\n'
        '    <Say voice="alice">Goodbye.</Say>\n'
        '    <Hangup/>\n'
        '</Response>'
    )
    return PlainTextResponse(twiml, media_type="application/xml")
