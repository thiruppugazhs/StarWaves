"""Google OAuth authentication: login redirect and callback."""

import asyncio
import json
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse
from app.db import SqlClient, get_firestore
from itsdangerous import BadSignature, SignatureExpired

from app.api.routes.auth._shared import _send_welcome_email_best_effort, state_serializer
from app.core.auth import create_session_token
from app.core.config import settings
from app.core.cors import is_allowed_origin as _is_allowed_origin
from app.repositories.users import get_or_create_google_user

router = APIRouter(prefix="/auth")


@router.get("/google/login")
def google_login(request: Request, origin: str | None = None, device_id: str | None = None, device_name: str | None = None):
    if not settings.google_oauth_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured on the server.",
        )

    raw_origin = origin or request.headers.get("referer") or request.headers.get("origin") or settings.frontend_url
    try:
        parsed = urlparse(raw_origin)
        if parsed.scheme and parsed.netloc:
            client_origin = f"{parsed.scheme}://{parsed.netloc}"
        else:
            client_origin = settings.frontend_url
    except Exception:
        client_origin = settings.frontend_url
    # Validate against allowlist — prevent open-redirect token theft via evil.vercel.app
    if not _is_allowed_origin(client_origin):
        client_origin = settings.frontend_url

    # Persist device context through OAuth state so callback can create device-bound session
    did = (device_id or request.headers.get("X-Device-Id") or request.headers.get("x-device-id") or "")[:64]
    dname = (device_name or request.headers.get("X-Device-Name") or request.headers.get("x-device-name") or "")[:255]
    state_payload: dict = {"action": "google-auth", "origin": client_origin}
    if did:
        state_payload["did"] = did
    if dname:
        state_payload["dname"] = dname
    state = state_serializer().dumps(state_payload)
    query = urlencode(
        {
            "client_id": settings.google_oauth_client_id,
            "redirect_uri": settings.auth_google_callback_url,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "online",
            "state": state,
            "prompt": "select_account",
        },
    )
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{query}"}


@router.get("/google/callback", response_class=HTMLResponse)
async def google_callback(
    code: str = Query(...),
    state: str = Query(...),
    database: SqlClient = Depends(get_firestore),
):
    try:
        state_data = state_serializer().loads(state, max_age=600)
    except (BadSignature, SignatureExpired):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google OAuth state token is invalid or expired.",
        ) from None

    target_origin = (state_data.get("origin") if isinstance(state_data, dict) else None) or settings.frontend_url

    if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not properly configured.",
        )

    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.auth_google_callback_url,
            },
        )
        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange authorization code with Google.",
            )
        tokens = token_response.json()

        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        if userinfo_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to fetch Google user profile.",
            )
        google_user = userinfo_response.json()

    email = google_user.get("email")
    name = google_user.get("name") or google_user.get("given_name") or (email.split("@")[0] if email else "")
    picture = google_user.get("picture")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account did not return an email address.",
        )

    user_record = get_or_create_google_user(
        database=database,
        email=email,
        name=name,
        picture=picture,
    )

    if user_record.get("is_new"):
        await asyncio.to_thread(
            _send_welcome_email_best_effort,
            user_record["email"],
            user_record.get("display_name") or name,
        )

    # Restore device context from state if present
    did = state_data.get("did") if isinstance(state_data, dict) else None
    dname = state_data.get("dname") if isinstance(state_data, dict) else None
    token = create_session_token(
        {
            "uid": user_record["uid"],
            "email": user_record["email"],
            "name": user_record.get("display_name") or name,
        },
        device_id=did,
        device_name=dname,
        user_agent=None,
        ip_address=None,
    )

    # Validate target_origin again at callback time (defense-in-depth)
    if not _is_allowed_origin(target_origin):
        target_origin = settings.frontend_url
    token_json = json.dumps(token)
    uid_json = json.dumps(user_record["uid"])
    email_json = json.dumps(user_record["email"])
    display_json = json.dumps(user_record.get("display_name") or name)
    origin_json = json.dumps(target_origin)

    html_content = f"""
    <!DOCTYPE html>
    <html>
      <head>
        <title>Authentication Successful</title>
        <meta http-equiv="refresh" content="0; url={target_origin}/#token={token}" />
      </head>
      <body>
        <script>
          const authData = {{
            token: {token_json},
            user: {{
              uid: {uid_json},
              email: {email_json},
              displayName: {display_json},
              emailVerified: true,
              needsOnboarding: {"true" if user_record.get("is_new") else "false"}
            }}
          }};
          const targetOrigin = {origin_json};
          try {{
            if (window.opener) {{
              window.opener.postMessage({{ type: "STARWAVES_AUTH_SUCCESS", data: authData }}, targetOrigin);
              setTimeout(() => {{ try {{ window.close(); }} catch(e) {{}} }}, 100);
            }}
          }} catch (e) {{}}
          window.location.replace(targetOrigin + "/#token=" + encodeURIComponent({token_json}));
        </script>
        <p>Authentication successful. Redirecting to StarWaves...</p>
      </body>
    </html>
    """
    return HTMLResponse(content=html_content)
