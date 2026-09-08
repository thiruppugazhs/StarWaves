"""Google OAuth flow helpers: config checks, token crypto/exchange, and authorize URL."""

import base64
import hashlib
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet
from itsdangerous import URLSafeTimedSerializer

from app.core.config import settings
from app.core.http import create_async_client
from app.services.oauth._shared import create_oauth_state_serializer


def require_google_oauth_config() -> None:
    if not all(
        (
            settings.google_oauth_client_id,
            settings.google_oauth_client_secret,
            settings.google_oauth_state_secret,
        ),
    ):
        raise RuntimeError("Google OAuth is not configured on the server.")


def google_oauth_state_serializer(salt: str) -> URLSafeTimedSerializer:
    require_google_oauth_config()
    return create_oauth_state_serializer(settings.google_oauth_state_secret, salt)


def google_token_cipher() -> Fernet:
    require_google_oauth_config()
    digest = hashlib.sha256(settings.google_oauth_state_secret.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_google_token(token: str) -> str:
    return google_token_cipher().encrypt(token.encode()).decode()


def decrypt_google_token(token: str) -> str:
    return google_token_cipher().decrypt(token.encode()).decode()


async def exchange_google_code(code: str, redirect_uri: str | None = None) -> dict:
    require_google_oauth_config()
    redirect_uri = redirect_uri or settings.google_oauth_callback_url
    async with create_async_client(timeout=20) as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
        )
        response.raise_for_status()
        payload = response.json()
        if not payload.get("access_token"):
            raise ValueError("Google did not return an access token.")
        return payload


async def refresh_google_token(refresh_token: str) -> str:
    require_google_oauth_config()
    async with create_async_client(timeout=20) as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
        response.raise_for_status()
        payload = response.json()
        if not payload.get("access_token"):
            raise ValueError("Google could not refresh access.")
        return payload["access_token"]


async def google_profile(access_token: str) -> dict:
    async with create_async_client(timeout=20) as client:
        response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        response.raise_for_status()
        return response.json()


def build_google_authorize_url(
    redirect_uri: str,
    scopes: str,
    state: str,
    access_type: str = "offline",
    prompt: str = "consent select_account",
    include_granted_scopes: bool = True,
) -> str:
    require_google_oauth_config()
    query = urlencode(
        {
            "client_id": settings.google_oauth_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scopes,
            "access_type": access_type,
            "prompt": prompt,
            "include_granted_scopes": "true" if include_granted_scopes else "false",
            "state": state,
        }
    )
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"
