"""Account combining: request, verify, list, and unlink combined accounts."""

from fastapi import APIRouter, Depends, Query
from app.db import SqlClient, get_firestore
from itsdangerous import BadSignature, SignatureExpired
from pydantic import BaseModel, EmailStr

from app.api.routes.auth._shared import combine_token_serializer, get_current_user_optional
from app.core.auth import get_current_user
from app.core.errors import bad_gateway, bad_request
from app.repositories.account_combine import (
    add_pending_combine_request,
    confirm_combine_accounts,
    get_combined_accounts_info,
    remove_combined_account,
)
from app.services.email import EmailDeliveryError, send_account_combine_email

router = APIRouter(prefix="/auth")


class CombineAccountRequest(BaseModel):
    target_email: EmailStr


class VerifyCombineTokenRequest(BaseModel):
    token: str


@router.post("/combine-account/request")
def request_combine_account(
    payload: CombineAccountRequest,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    owner_email = user.get("email")
    if not owner_email:
        raise bad_request("Current user email is not available.")

    target_email = payload.target_email.lower().strip()
    if target_email == owner_email.lower().strip():
        raise bad_request("Cannot combine an account with its own email address.")

    try:
        add_pending_combine_request(database, user["uid"], target_email)
        token = combine_token_serializer().dumps({
            "owner_uid": user["uid"],
            "owner_email": owner_email,
            "target_email": target_email,
        })
        sent = send_account_combine_email(target_email, owner_email, token)
        if not sent:
            raise bad_gateway(f"Failed to send verification email to {target_email}. Please try again later.")
        return {"message": f"Verification email sent to {target_email}."}
    except EmailDeliveryError as exc:
        raise bad_gateway(f"Failed to send verification email to {target_email}: {exc}") from exc
    except Exception as exc:
        raise bad_request(str(exc),
        ) from None


@router.post("/combine-account/verify")
def verify_combine_account(
    payload: VerifyCombineTokenRequest,
    user: dict | None = Depends(get_current_user_optional),
    database: SqlClient = Depends(get_firestore),
):
    try:
        data = combine_token_serializer().loads(payload.token, max_age=86400)
    except (BadSignature, SignatureExpired):
        raise bad_request("The verification link is invalid or has expired.") from None

    owner_uid = data["owner_uid"]
    target_email = data["target_email"]
    target_uid = user.get("uid") if user else None

    try:
        result = confirm_combine_accounts(
            database=database,
            owner_uid=owner_uid,
            target_email=target_email,
            target_uid=target_uid,
        )
        return {
            "message": f"Accounts successfully combined for {target_email}!",
            "owner_uid": result["owner_uid"],
            "target_email": result["target_email"],
        }
    except Exception as exc:
        raise bad_request(str(exc),
        ) from None


@router.get("/combine-account/list")
def list_combined_accounts(
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    return get_combined_accounts_info(database, user["uid"])


@router.delete("/combine-account/unlink")
def unlink_combined_account(
    target_identifier: str = Query(...),
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    try:
        remove_combined_account(database, user["uid"], target_identifier)
        return {"message": "Account unlinked successfully."}
    except Exception as exc:
        raise bad_request(str(exc),
        ) from None


@router.post("/merge-accounts")
def merge_accounts(
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    from app.repositories.users import merge_duplicate_user_accounts

    email = user.get("email")
    if not email:
        raise bad_request("Current user email is not available.")

    merged = merge_duplicate_user_accounts(database, email=email)
    return {
        "message": "Duplicate accounts merged successfully into one single account.",
        "primary_account": merged[0] if merged else user,
    }

