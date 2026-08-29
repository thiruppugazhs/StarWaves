"""Email/password credential authentication: signup, login, and OTP verification."""

import logging
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from app.db import SqlClient, get_firestore
from pydantic import BaseModel, EmailStr

from app.api.routes.auth._shared import _send_welcome_email_best_effort
from app.core.auth import create_session_token
from app.core.config import settings
from app.repositories.password import verify_password
from app.repositories.users import (
    create_email_otp,
    create_user_with_password,
    get_user_by_email,
    verify_email_otp,
)
from app.services.email import send_otp_email

router = APIRouter(prefix="/auth")
logger = logging.getLogger(__name__)


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str


class ResendOtpRequest(BaseModel):
    email: EmailStr


@router.post("/signup")
def signup(
    payload: SignupRequest,
    database: SqlClient = Depends(get_firestore),
):
    try:
        user_record = create_user_with_password(
            database=database,
            email=payload.email,
            password=payload.password,
            name=payload.name,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None

    # Generate 6-digit verification OTP
    otp_code = create_email_otp(database, user_record["email"])
    logger.info("Verification OTP for signup %s: %s", user_record["email"], otp_code)

    try:
        send_otp_email(
            to_email=user_record["email"],
            user_name=user_record["display_name"],
            otp_code=otp_code,
        )
    except Exception as exc:
        logger.warning("Could not send signup verification email to %s: %s", user_record["email"], exc)

    res = {
        "status": "otp_required",
        "email": user_record["email"],
        "message": "A 6-digit verification code has been sent to your email.",
    }
    if not settings.smtp_host or settings.app_env != "production":
        res["dev_otp"] = otp_code
    return res


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    database: SqlClient = Depends(get_firestore),
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
    x_device_name: str | None = Header(default=None, alias="X-Device-Name"),
):
    clean_email = payload.email.lower().strip()
    try:
        user_record = get_user_by_email(database, clean_email)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database service unavailable. Could not verify account details.",
        ) from exc

    if not user_record or not user_record.get("password_hash") or not user_record.get("password_salt"):
        logger.warning("Login failed for %s: Account record or password credentials missing.", clean_email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The email or password is incorrect.",
        ) from None

    try:
        is_valid = verify_password(payload.password, user_record["password_hash"], user_record["password_salt"])
    except Exception as exc:
        logger.warning("Error verifying password for %s: %s", clean_email, exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The email or password is incorrect.",
        ) from None

    if not is_valid:
        logger.warning("Login failed for %s: Password mismatch.", clean_email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The email or password is incorrect.",
        ) from None

    # Check if user needs email OTP verification
    is_verified = bool(user_record.get("email_verified") or user_record.get("google_auth"))
    if not is_verified:
        otp_code = create_email_otp(database, clean_email)
        logger.info("Verification OTP for unverified login %s: %s", clean_email, otp_code)
        try:
            send_otp_email(
                to_email=user_record["email"],
                user_name=user_record.get("display_name") or clean_email.split("@")[0],
                otp_code=otp_code,
            )
        except Exception as exc:
            logger.warning("Could not send login verification email to %s: %s", clean_email, exc)

        res = {
            "status": "otp_required",
            "email": user_record["email"],
            "message": "Please verify your email address. A 6-digit verification code has been sent to your email.",
        }
        if not settings.smtp_host or settings.app_env != "production":
            res["dev_otp"] = otp_code
        return res

    try:
        device_id = (x_device_id or uuid.uuid4().hex)[:64]
        ua = request.headers.get("user-agent")
        ip = request.client.host if request.client else None
        token = create_session_token(
            {
                "uid": user_record["uid"],
                "email": user_record["email"],
                "name": user_record.get("display_name"),
            },
            device_id=device_id,
            device_name=x_device_name,
            user_agent=ua,
            ip_address=ip,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate authentication token.",
        ) from exc

    return {
        "status": "authenticated",
        "token": token,
        "user": {
            "uid": user_record["uid"],
            "email": user_record["email"],
            "displayName": user_record.get("display_name") or user_record["email"].split("@")[0],
            "emailVerified": True,
        },
    }


@router.post("/verify-otp")
def verify_otp(
    payload: VerifyOtpRequest,
    request: Request,
    database: SqlClient = Depends(get_firestore),
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
    x_device_name: str | None = Header(default=None, alias="X-Device-Name"),
):
    clean_email = payload.email.lower().strip()
    is_valid, err_msg = verify_email_otp(database, clean_email, payload.otp)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg or "Invalid verification code.",
        )

    user_record = get_user_by_email(database, clean_email)
    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found.",
        )

    _send_welcome_email_best_effort(
        to_email=user_record["email"],
        user_name=user_record.get("display_name") or clean_email.split("@")[0],
    )

    device_id = (x_device_id or uuid.uuid4().hex)[:64]
    ua = request.headers.get("user-agent")
    ip = request.client.host if request.client else None
    token = create_session_token(
        {
            "uid": user_record["uid"],
            "email": user_record["email"],
            "name": user_record.get("display_name"),
        },
        device_id=device_id,
        device_name=x_device_name,
        user_agent=ua,
        ip_address=ip,
    )

    return {
        "status": "verified",
        "token": token,
        "user": {
            "uid": user_record["uid"],
            "email": user_record["email"],
            "displayName": user_record.get("display_name") or clean_email.split("@")[0],
            "emailVerified": True,
            "needsOnboarding": True,
        },
    }


@router.post("/resend-otp")
def resend_otp(
    payload: ResendOtpRequest,
    database: SqlClient = Depends(get_firestore),
):
    clean_email = payload.email.lower().strip()
    user_record = get_user_by_email(database, clean_email)
    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found for this email address.",
        )

    otp_code = create_email_otp(database, clean_email)
    logger.info("Resent verification OTP for %s: %s", clean_email, otp_code)
    try:
        send_otp_email(
            to_email=user_record["email"],
            user_name=user_record.get("display_name") or clean_email.split("@")[0],
            otp_code=otp_code,
        )
    except Exception as exc:
        logger.warning("Could not resend OTP to %s: %s", clean_email, exc)

    res = {
        "status": "sent",
        "message": "A new 6-digit verification code has been sent to your email.",
    }
    if not settings.smtp_host or settings.app_env != "production":
        res["dev_otp"] = otp_code
    return res
