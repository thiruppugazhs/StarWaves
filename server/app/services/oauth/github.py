"""GitHub OAuth flow helpers: config checks, token crypto/exchange, and authorize URL."""

import base64
import hashlib
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet
from itsdangerous import URLSafeTimedSerializer

from app.core.config import settings
from app.services.oauth._shared import create_oauth_state_serializer


def require_oauth_config() -> None:
    if not all(
        (
            settings.github_oauth_client_id,
            settings.github_oauth_client_secret,
            settings.github_oauth_state_secret,
        ),
    ):
        raise RuntimeError("GitHub OAuth is not configured on the server.")


def github_state_serializer() -> URLSafeTimedSerializer:
    require_oauth_config()
    return create_oauth_state_serializer(
        settings.github_oauth_state_secret,
        salt="starwaves-github-oauth",
    )


def github_token_cipher() -> Fernet:
    require_oauth_config()
    digest = hashlib.sha256(settings.github_oauth_state_secret.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_token(token: str) -> str:
    return github_token_cipher().encrypt(token.encode()).decode()


def decrypt_token(token: str) -> str:
    return github_token_cipher().decrypt(token.encode()).decode()


async def exchange_code(code: str) -> dict:
    require_oauth_config()
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_oauth_client_id,
                "client_secret": settings.github_oauth_client_secret,
                "code": code,
                "redirect_uri": settings.github_oauth_callback_url,
            },
        )
        response.raise_for_status()
        payload = response.json()
        if not payload.get("access_token"):
            raise ValueError(payload.get("error_description", "GitHub rejected the OAuth code."))
        return payload


def build_github_authorize_url(redirect_uri: str, scopes: str, state: str) -> str:
    require_oauth_config()
    query = urlencode(
        {
            "client_id": settings.github_oauth_client_id,
            "redirect_uri": redirect_uri,
            "scope": scopes,
            "state": state,
        },
    )
    return f"https://github.com/login/oauth/authorize?{query}"
