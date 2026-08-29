"""Password recovery: forgot-password, verify-reset-code, and reset-password."""

import hmac
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from app.db import SqlClient, get_firestore
from itsdangerous import BadSignature, SignatureExpired
from pydantic import BaseModel, EmailStr

from app.api.routes.auth._shared import state_serializer
from app.repositories.users import get_user_by_email, update_user_password
from app.services.email import EmailDeliveryError, send_password_reset_email

router = APIRouter(prefix="/auth")

logger = logging.getLogger(__name__)


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
        # Generate a 6-digit OTP code for step 2 verification (cryptographically secure)
        otp_code = str(secrets.randbelow(900000) + 100000)
        token = state_serializer().dumps({
            "uid": user_record["uid"],
            "email": user_record["email"],
            "action": "reset_password",
            "otp": otp_code,
        })
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

    # Validate that the entered OTP code matches the token's embedded OTP — token is now mandatory
    if not payload.token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token is required.",
        )
    try:
        data = state_serializer().loads(payload.token, max_age=3600)
        expected_otp = data.get("otp")
        if not expected_otp or not hmac.compare_digest(str(expected_otp), clean_code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code. Please check your email and try again.",
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

    verified_token = state_serializer().dumps({
        "uid": user_record["uid"],
        "email": user_record["email"],
        "action": "reset_password_verified",
    })

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

    if data.get("action") != "reset_password_verified" or not data.get("uid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token payload.",
        )

    updated = update_user_password(database, data["uid"], payload.password)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User record not found.",
        )
    return {"message": "Your password has been reset successfully. You can now log in with your new password."}

