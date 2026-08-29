"""Shared helpers used across the authentication feature-group routes."""

import logging

from fastapi import Header
from itsdangerous import URLSafeTimedSerializer

from app.core.auth import create_serializer, try_get_user_from_token
from app.services.email import EmailDeliveryError, send_welcome_email

logger = logging.getLogger(__name__)


def _send_welcome_email_best_effort(to_email: str, user_name: str) -> None:
    try:
        send_welcome_email(to_email=to_email, user_name=user_name)
    except EmailDeliveryError as exc:
        logger.warning("Welcome email to %s could not be delivered: %s", to_email, exc)


def state_serializer() -> URLSafeTimedSerializer:
    return create_serializer("starwaves-google-auth-state")


def combine_token_serializer() -> URLSafeTimedSerializer:
    return create_serializer("starwaves-combine-account-token")


def get_current_user_optional(
    authorization: str | None = Header(default=None),
) -> dict | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    return try_get_user_from_token(token)
