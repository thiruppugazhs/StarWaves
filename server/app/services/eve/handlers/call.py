"""Call handlers — single responsibility: Eve voice call trigger (dual provider)."""

from app.db import ArrayUnion, Query, SERVER_TIMESTAMP, SqlClient


def handle_trigger_eve_call(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, dict]:
    from app.core.config import settings
    from app.repositories.calls import CallRepository
    from app.repositories.users import get_user_by_id
    from app.schemas.call import CallUser
    from app.services.notifications import send_call_notification

    provider = arguments.get("provider", "in_app")
    phone_number = arguments.get("phone_number")

    # Twilio path: validate and initiate PSTN
    if provider == "twilio":
        if not phone_number:
            return {"error": "phone_number is required for Twilio calls (E.164)."}, None, {"type": "trigger_eve_call", "error": "missing_phone"}
        from app.services.twilio.client import TwilioError, initiate_twilio_call

        if not settings.twilio_account_sid:
            return {"error": "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER."}, None, {"type": "trigger_eve_call", "error": "twilio_not_configured"}
        user_record = get_user_by_id(database, user_id) or {"uid": user_id, "display_name": "User", "email": ""}
        callee_user = CallUser(uid=user_id, name=user_record.get("display_name") or "User", email=user_record.get("email") or "")
        repo = CallRepository(database)
        call = repo.create(caller=CallUser(uid="eve-bot", name="Eve AI Assistant", email="eve@starwaves.app"), callee=callee_user, mode=arguments.get("mode", "audio"), provider="twilio", phone_number=phone_number)
        prompt = arguments.get("prompt") or "Hello, this is Eve from StarWaves. How can I help you today?"
        base = (settings.twilio_callback_base_url or "").rstrip("/") or "http://127.0.0.1:8000"
        twiml_url = f"{base}/api/v1/calls/twilio/relay-twiml/{call['id']}"
        status_cb = f"{base}/api/v1/calls/twilio/status"
        try:
            tw = initiate_twilio_call(phone_number, twiml_url, status_cb)
            sid = tw.get("sid") or ""
            if sid:
                repo.set_external_sid(call["id"], sid)
        except TwilioError as e:
            return {"error": str(e), "call_id": call["id"]}, None, {"type": "trigger_eve_call", "error": str(e)}
        send_call_notification(database=database, target_user_id=user_id, title="Incoming Eve Call (Twilio)", message=f"Eve is calling your phone {phone_number}", notification_type="call_incoming", call_id=call["id"])
        return {"call_id": call["id"], "provider": "twilio", "phone_number": phone_number, "status": "ringing", "message": f"Eve is calling {phone_number} via Twilio."}, None, {"type": "trigger_eve_call", "call_id": call["id"], "provider": "twilio"}

    # In-app WebRTC path (default)
    user_record = get_user_by_id(database, user_id) or {"uid": user_id, "display_name": "User", "email": ""}
    callee_user = CallUser(
        uid=user_id,
        name=user_record.get("display_name") or "User",
        email=user_record.get("email") or "",
    )
    repo = CallRepository(database)
    call = repo.create(
        caller=CallUser(uid="eve-bot", name="Eve AI Assistant", email="eve@starwaves.app"),
        callee=callee_user,
        mode=arguments.get("mode", "audio"),
        provider="in_app",
    )
    send_call_notification(
        database=database,
        target_user_id=user_id,
        title="Incoming Eve Call",
        message="Incoming voice call from Eve AI Assistant",
        notification_type="call_incoming",
        call_id=call["id"],
    )
    return {
        "call_id": call["id"],
        "status": "ringing",
        "provider": "in_app",
        "message": "Eve is initiating a voice call to you now.",
    }, None, {"type": "trigger_eve_call", "call_id": call["id"]}


def handle_make_twilio_call(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, dict]:
    from app.core.config import settings
    from app.repositories.calls import CallRepository
    from app.schemas.call import CallUser
    from app.services.notifications import send_call_notification
    from app.services.twilio.client import TwilioError, initiate_twilio_call

    phone = arguments.get("phone_number")
    if not phone:
        return {"error": "phone_number required"}, None, {"type": "make_twilio_call", "error": "missing_phone"}
    if not settings.twilio_account_sid:
        return {"error": "Twilio not configured"}, None, {"type": "make_twilio_call", "error": "not_configured"}
    repo = CallRepository(database)
    me = CallUser(uid=user_id, name="User", email="")
    callee = CallUser(uid=f"phone:{phone}", name=phone, email="")
    call = repo.create(caller=me, callee=callee, mode=arguments.get("mode", "audio"), provider="twilio", phone_number=phone)
    message = arguments.get("message")
    if message:

        try:
            repo._document(call["id"]).update({"messages": ArrayUnion([{"id": "say", "from_uid": user_id, "type": "say", "payload": message[:500], "created_at": call["created_at"]}])})
        except Exception:
            pass
    base = (settings.twilio_callback_base_url or "").rstrip("/") or "http://127.0.0.1:8000"
    twiml_url = f"{base}/api/v1/calls/twilio/relay-twiml/{call['id']}"
    status_cb = f"{base}/api/v1/calls/twilio/status"
    try:
        tw = initiate_twilio_call(phone, twiml_url, status_cb)
        sid = tw.get("sid") or ""
        if sid:
            repo.set_external_sid(call["id"], sid)
            call["external_sid"] = sid
    except TwilioError as e:
        repo.update_status(call["id"], "missed")
        return {"error": str(e), "call_id": call["id"]}, None, {"type": "make_twilio_call", "error": str(e)}
    send_call_notification(database=database, target_user_id=user_id, title="Twilio Call Initiated", message=f"Calling {phone} via Twilio", notification_type="call_incoming", call_id=call["id"])
    return {"call_id": call["id"], "provider": "twilio", "phone_number": phone, "status": "ringing"}, None, {"type": "make_twilio_call", "call_id": call["id"]}
