"""Google OAuth authentication: login redirect and callback."""

import asyncio
import json
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from app.db import SqlClient, get_firestore
from app.core.http import create_async_client
from itsdangerous import BadSignature, SignatureExpired

from app.api.routes.auth._shared import _send_welcome_email_best_effort, state_serializer
from app.core.auth import create_session_token
from app.core.config import settings
from app.core.cors import is_allowed_origin as _is_allowed_origin
from app.repositories.users import get_or_create_google_user

router = APIRouter(prefix="/auth")


@router.get("/google/login")
def google_login(
    request: Request,
    origin: str | None = None,
    device_id: str | None = None,
    device_name: str | None = None,
    platform: str | None = None,
):
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

    # Persist device context + platform through OAuth state so callback can create
    # device-bound session and deep-link back to the correct scheme (android/tauri/web).
    did = (device_id or request.headers.get("X-Device-Id") or request.headers.get("x-device-id") or "")[:64]
    dname = (device_name or request.headers.get("X-Device-Name") or request.headers.get("x-device-name") or "")[:255]
    plat = (platform or request.query_params.get("platform") or request.headers.get("X-Platform") or "").strip().lower()
    # Normalize aliases
    if plat in ("capacitor", "com.starwaves.app"):
        plat = "android"
    elif plat in ("tauri", "desktop", "app.starwaves.workspace"):
        plat = "tauri"
    elif plat not in ("android", "tauri", "web"):
        # Infer from origin scheme if platform not explicit
        if client_origin.startswith("capacitor://") or client_origin.startswith("com.starwaves.app://"):
            plat = "android"
        elif client_origin.startswith("tauri://") or client_origin.startswith("app.starwaves.workspace://") or client_origin.startswith("https://tauri.localhost"):
            plat = "tauri"
        elif plat:
            plat = plat[:16]
        else:
            plat = ""
    state_payload: dict = {"action": "google-auth", "origin": client_origin}
    if did:
        state_payload["did"] = did
    if dname:
        state_payload["dname"] = dname
    if plat:
        state_payload["platform"] = plat
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

    async with create_async_client() as client:
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
        # Also allow native schemes even if regex misses (they are allowlisted explicitly)
        if not (target_origin.startswith("capacitor://") or target_origin.startswith("tauri://") or target_origin.startswith("com.starwaves.app://") or target_origin.startswith("app.starwaves.workspace://")):
            target_origin = settings.frontend_url
    # Deep-link handling for native apps: redirect to custom scheme with token in URL.
    # Web flow keeps postMessage HTML to avoid token in history; native cannot use postMessage across Browser → WebView, so we use a 302 to the app scheme.
    platform = (state_data.get("platform") if isinstance(state_data, dict) else None) or ""
    platform = platform.lower().strip()
    # Fallback inference from target_origin if platform missing
    if not platform:
        if target_origin.startswith("capacitor://") or target_origin.startswith("com.starwaves.app://"):
            platform = "android"
        elif target_origin.startswith("tauri://") or target_origin.startswith("app.starwaves.workspace://") or target_origin.startswith("https://tauri.localhost"):
            platform = "tauri"
    if platform == "android":
        # Prefer the configured Android scheme (default com.starwaves.app)
        scheme = getattr(settings, "native_app_scheme_android", "com.starwaves.app")
        # Token in query + hash for compatibility with appUrlOpen listeners that parse either
        qs = urlencode({"token": token, "uid": user_record["uid"], "email": user_record["email"]})
        deep_link = f"{scheme}://auth?{qs}#token={token}"
        return RedirectResponse(url=deep_link, status_code=302)
    if platform == "tauri":
        scheme = getattr(settings, "native_app_scheme_tauri", "app.starwaves.workspace")
        qs = urlencode({"token": token, "uid": user_record["uid"]})
        deep_link = f"{scheme}://auth?{qs}#token={token}"
        return RedirectResponse(url=deep_link, status_code=302)
    # Also handle case where target_origin itself is a native scheme but platform was not set (direct deep-link return to same scheme)
    if target_origin.startswith("capacitor://") or target_origin.startswith("com.starwaves.app://") or target_origin.startswith("tauri://") or target_origin.startswith("app.starwaves.workspace://"):
        # Echo back to the exact origin with token
        sep = "&" if "?" in target_origin else "?"
        # Use hash fragment to avoid server log leakage, but also query for listeners that inspect search
        return RedirectResponse(url=f"{target_origin}{sep}token={token}#token={token}", status_code=302)

    token_json = json.dumps(token)
    uid_json = json.dumps(user_record["uid"])
    email_json = json.dumps(user_record["email"])
    display_json = json.dumps(user_record.get("display_name") or name)
    origin_json = json.dumps(target_origin)
    redirect_target = f"{target_origin.rstrip('/')}/#token={token}"
    redirect_target_json = json.dumps(redirect_target)

    # Token is delivered via postMessage (if popup flow) or via URL fragment (#token=...)
    # for same-tab redirect. The URL fragment is never transmitted over HTTP to servers,
    # and is consumed and cleared from history immediately by consumeAuthTokenFromHash().
    html_content = f"""
    <!DOCTYPE html>
    <html>
      <head>
        <title>Authentication Successful</title>
      </head>
      <body>
        <script>
          const authData = {{
            token: {token_json},
            user: {{
              uid: {uid_json},
              email: {email_json},
              displayName: {display_json},
              emailVerified: true
            }}
          }};
          const targetOrigin = {origin_json};
          const redirectTarget = {redirect_target_json};
          let delivered = false;
          try {{
            if (window.opener) {{
              window.opener.postMessage({{ type: "STARWAVES_AUTH_SUCCESS", data: authData }}, targetOrigin);
              delivered = true;
              setTimeout(() => {{ try {{ window.close(); }} catch(e) {{}} }}, 150);
            }}
          }} catch (e) {{}}
          if (!delivered) {{
            window.location.replace(redirectTarget);
          }}
        </script>
        <p>Authentication successful. Redirecting to StarWaves...</p>
      </body>
    </html>
    """
    return HTMLResponse(content=html_content)
