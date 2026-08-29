"""Shared OAuth helpers for Google and GitHub integrations.

``_shared`` owns provider-agnostic utilities (error formatting, state-serializer
factories, account-id hashing, Firestore reference builders, and the callback
HTML snippet). ``google`` and ``github`` own provider-specific flows.
"""

from app.services.oauth._shared import (
    create_oauth_state_serializer,
    format_oauth_error,
    integration_account_id,
    integration_accounts_reference,
    oauth_callback_html,
)
from app.services.oauth.google import (
    build_google_authorize_url,
    decrypt_google_token,
    encrypt_google_token,
    exchange_google_code,
    google_oauth_state_serializer,
    google_profile,
    google_token_cipher,
    refresh_google_token,
    require_google_oauth_config,
)
from app.services.oauth.github import (
    build_github_authorize_url,
    decrypt_token,
    encrypt_token,
    exchange_code,
    github_state_serializer,
    github_token_cipher,
    require_oauth_config,
)

__all__ = [
    "create_oauth_state_serializer",
    "format_oauth_error",
    "integration_account_id",
    "integration_accounts_reference",
    "oauth_callback_html",
    "build_google_authorize_url",
    "decrypt_google_token",
    "encrypt_google_token",
    "exchange_google_code",
    "google_oauth_state_serializer",
    "google_profile",
    "google_token_cipher",
    "refresh_google_token",
    "require_google_oauth_config",
    "build_github_authorize_url",
    "decrypt_token",
    "encrypt_token",
    "exchange_code",
    "github_state_serializer",
    "github_token_cipher",
    "require_oauth_config",
]
