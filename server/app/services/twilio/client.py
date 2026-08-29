"""Twilio REST client — lean httpx wrapper (no twilio SDK)."""

import base64
import logging
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TWILIO_API_BASE = "https://api.twilio.com/2010-04-01"


class TwilioError(RuntimeError):
    pass


def is_twilio_configured() -> bool:
    return bool(settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_phone_number)


def get_twilio_client() -> tuple[str, str, str]:
    if not is_twilio_configured():
        raise TwilioError("Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.")
    return settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_phone_number  # type: ignore


def _auth_header(sid: str, token: str) -> str:
    raw = f"{sid}:{token}".encode()
    return "Basic " + base64.b64encode(raw).decode()


def initiate_twilio_call(to_number: str, twiml_url: str, status_callback_url: str | None = None) -> dict:
    """POST /Accounts/{Sid}/Calls.json — returns Twilio Call resource."""
    sid, token, from_number = get_twilio_client()
    url = f"{TWILIO_API_BASE}/Accounts/{sid}/Calls.json"
    data = {
        "To": to_number,
        "From": from_number,
        "Url": twiml_url,
        "Method": "POST",
    }
    if status_callback_url:
        data["StatusCallback"] = status_callback_url
        data["StatusCallbackMethod"] = "POST"
        data["StatusCallbackEvent"] = "initiated,ringing,answered,completed"
    headers = {"Authorization": _auth_header(sid, token)}
    try:
        with httpx.Client(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
            resp = client.post(url, data=data, headers=headers)
            if resp.status_code >= 400:
                raise TwilioError(f"Twilio API {resp.status_code}: {resp.text[:400]}")
            return resp.json()
    except httpx.RequestError as e:
        raise TwilioError(f"Twilio request failed: {e}") from e


def fetch_twilio_call(sid_call: str) -> dict:
    sid, token, _ = get_twilio_client()
    url = f"{TWILIO_API_BASE}/Accounts/{sid}/Calls/{sid_call}.json"
    headers = {"Authorization": _auth_header(sid, token)}
    with httpx.Client(timeout=httpx.Timeout(8.0, connect=3.0)) as client:
        resp = client.get(url, headers=headers)
        if resp.status_code >= 400:
            raise TwilioError(f"Twilio fetch {resp.status_code}: {resp.text[:300]}")
        return resp.json()


# Twilio status → internal call status mapping
TWILIO_TO_INTERNAL = {
    "queued": "ringing",
    "initiated": "ringing",
    "ringing": "ringing",
    "in-progress": "active",
    "answered": "active",
    "completed": "ended",
    "busy": "declined",
    "failed": "missed",
    "no-answer": "missed",
    "canceled": "ended",
}


def map_twilio_status(twilio_status: str) -> str:
    return TWILIO_TO_INTERNAL.get((twilio_status or "").lower(), "ringing")
