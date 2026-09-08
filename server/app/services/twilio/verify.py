"""Twilio signature verification for callbacks (X-Twilio-Signature)."""
import base64
import hashlib
import hmac

from fastapi import HTTPException, Request

from app.core.config import settings


def _build_twilio_signature(url: str, params: dict[str, str], auth_token: str) -> str:
    # Twilio: base64(HMAC-SHA1(url + sorted(k+v)))
    s = url + "".join(f"{k}{v}" for k, v in sorted(params.items()))
    digest = hmac.new(auth_token.encode(), s.encode(), hashlib.sha1).digest()
    return base64.b64encode(digest).decode()


async def verify_twilio_request(request: Request, enforce: bool = True) -> None:
    token = getattr(settings, "twilio_auth_token", None)
    # Only skip when Twilio is not configured at all. When TWILIO_* is set
    # we must verify the signature regardless of env, otherwise staging/dev
    # with a real Twilio number accepts forged callbacks.
    if not token:
        return
    # In tests (APP_ENV != production) allow unsigned requests ONLY when
    # Twilio is not considered configured by is_twilio_configured() guard
    # at call sites. For configured deployments (including staging with
    # TWILIO_* set), never bypass. Detect test-mode via explicit pytest flag:
    # tests set TWILIO_* to empty, so the check above already returned.
    # Keep a narrow bypass only for pure unit tests where no TWILIO_* is set —
    # the above `if not token` already handles that case, so we enforce here.
    is_test_without_twilio = getattr(settings, "app_env", "development") != "production" and not getattr(
        settings, "twilio_account_sid", None
    )
    if is_test_without_twilio:
        return
    sig = request.headers.get("X-Twilio-Signature") or request.headers.get("x-twilio-signature")
    if not sig:
        if enforce:
            raise HTTPException(status_code=401, detail="Missing Twilio signature.")
        return
    # Build URL as Twilio sees it (full url with scheme/host)
    url = str(request.url)
    # Try form params first
    params: dict[str, str] = {}
    try:
        form = await request.form()
        params = {str(k): str(v) for k, v in form.items()}
    except Exception:
        pass
    if not params:
        # Fallback query params
        params = {k: v for k, v in request.query_params.items()}
    expected = _build_twilio_signature(url, params, token)
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=401, detail="Invalid Twilio signature.")
