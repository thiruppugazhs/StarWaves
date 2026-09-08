"""Password recovery: forgot-password, verify-reset-code, and reset-password."""

import hashlib
import hmac
import logging
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, status
from app.db import SqlClient, get_firestore
from itsdangerous import BadSignature, SignatureExpired
from pydantic import BaseModel, EmailStr

from app.api.routes.auth._shared import state_serializer
from app.core.cache import cache_delete, cache_get, cache_set
from app.repositories.users import get_user_by_email, update_user_password
from app.services.email import EmailDeliveryError, send_password_reset_email

router = APIRouter(prefix="/auth")

logger = logging.getLogger(__name__)

# Server-side OTP store: cache-backed with 10 min TTL, attempt counter,
# and single-use consumption. No OTP ever leaves the server in a token.
_OTP_TTL = 600  # 10 minutes
_OTP_MAX_ATTEMPTS = 5
_OTP_PREFIX = "pwdreset:otp"
_VERIFIED_PREFIX = "pwdreset:verified"


def _otp_key(uid: str) -> str:
    return f"{_OTP_PREFIX}:{uid}"


def _verified_key(jti: str) -> str:
    return f"{_VERIFIED_PREFIX}:{jti}"


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str
    token: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
    database: SqlClient = Depends(get_firestore),
):
    user_record = get_user_by_email(database, payload.email)
    if user_record:
        # Generate a 6-digit OTP code (cryptographically secure) and store
        # only a hash server-side. The emailed token carries a random jti
        # but NEVER the OTP itself.
        otp_code = str(secrets.randbelow(900000) + 100000)
        jti = secrets.token_urlsafe(16)
        token = state_serializer().dumps({
            "uid": user_record["uid"],
            "email": user_record["email"],
            "action": "reset_password",
            "jti": jti,
        })
        # Server-side store: hash + attempts + expiry via cache TTL
        cache_set(_otp_key(user_record["uid"]), {
            "hash": _hash_otp(otp_code),
            "jti": jti,
            "attempts": 0,
            "created_at": time.monotonic(),
        }, ttl=_OTP_TTL)
        try:
            send_password_reset_email(user_record["email"], token, otp_code)
        except EmailDeliveryError as exc:
            logger.warning("Password reset email to %s could not be delivered: %s", user_record["email"], exc)

    return {
        "message": "If an account exists with that email, a password reset code has been sent via email.",
    }


@router.post("/verify-reset-code")
def verify_reset_code(
    payload: VerifyResetCodeRequest,
    database: SqlClient = Depends(get_firestore),
):
    clean_code = payload.code.strip()
    if len(clean_code) != 6 or not clean_code.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code must be a 6-digit number.",
        )

    user_record = get_user_by_email(database, payload.email)
    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with that email address.",
        )

    if not payload.token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token is required.",
        )
    try:
        data = state_serializer().loads(payload.token, max_age=3600)
        if data.get("action") != "reset_password" or not data.get("jti") or data.get("uid") != user_record["uid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification session token.",
            )
    except SignatureExpired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        ) from None
    except BadSignature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification session token.",
        ) from None
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification session token.",
        ) from None

    # Server-side check: hash + attempt counting + jti binding
    stored = cache_get(_otp_key(user_record["uid"]))
    if not stored or stored.get("jti") != data.get("jti"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )
    attempts = int(stored.get("attempts", 0))
    if attempts >= _OTP_MAX_ATTEMPTS:
        cache_delete(_otp_key(user_record["uid"]))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many failed attempts. Please request a new code.",
        )
    if not hmac.compare_digest(str(stored.get("hash", "")), _hash_otp(clean_code)):
        stored["attempts"] = attempts + 1
        # keep original TTL window — re-set with remaining budget
        cache_set(_otp_key(user_record["uid"]), stored, ttl=_OTP_TTL)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please check your email and try again.",
        )

    # Success: consume OTP (single-use) and mint a verified token bound to a new jti
    cache_delete(_otp_key(user_record["uid"]))
    verified_jti = secrets.token_urlsafe(16)
    verified_token = state_serializer().dumps({
        "uid": user_record["uid"],
        "email": user_record["email"],
        "action": "reset_password_verified",
        "jti": verified_jti,
    })
    # Mark verified jti as single-use with 10 min window
    cache_set(_verified_key(verified_jti), {"uid": user_record["uid"]}, ttl=_OTP_TTL)

    return {
        "message": "Verification code successfully verified.",
        "reset_token": verified_token,
    }


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    database: SqlClient = Depends(get_firestore),
):
    if len(payload.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long.",
        )

    try:
        data = state_serializer().loads(payload.token, max_age=3600)
    except SignatureExpired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset session has expired. Please request a new code.",
        ) from None
    except BadSignature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset session token.",
        ) from None

    if data.get("action") != "reset_password_verified" or not data.get("uid") or not data.get("jti"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token payload.",
        )

    # Single-use enforcement: verified jti must exist and be unconsumed
    verified = cache_get(_verified_key(data["jti"]))
    if not verified or verified.get("uid") != data["uid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset session has expired or was already used. Please request a new code.",
        )
    # Consume immediately to prevent double-use race
    cache_delete(_verified_key(data["jti"]))

    updated = update_user_password(database, data["uid"], payload.password)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User record not found.",
        )
    return {"message": "Your password has been reset successfully. You can now log in with your new password."}

