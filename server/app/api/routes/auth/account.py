"""User account management: profile retrieval/update and account deletion."""

from fastapi import APIRouter, Depends, HTTPException, status
from app.db import SqlClient, get_firestore
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.cache import CACHE_TTL_LONG, cache_invalidate_prefix, cached
from app.repositories.account_deletion import delete_user_account
from app.repositories.users import get_user_by_id, update_user_profile as update_profile_in_db

router = APIRouter(prefix="/auth")

_AUTH_ME_PREFIX = "auth:me"


def _invalidate_auth_me(user_id: str) -> None:
    cache_invalidate_prefix(f"{_AUTH_ME_PREFIX}:{user_id}")


class ProfileUpdateRequest(BaseModel):
    displayName: str


@router.delete("/account")
def delete_account(
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    deleted = delete_user_account(database, user["uid"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )
    return {"message": "Your StarWaves account and all associated data have been deleted."}


@router.get("/me")
@cached(ttl=CACHE_TTL_LONG, prefix=_AUTH_ME_PREFIX)
def get_me(
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    user_record = get_user_by_id(database, user["uid"])
    if user_record:
        display_name = user_record.get("display_name")
        email = user_record.get("email")
        email_verified = bool(user_record.get("email_verified") or user_record.get("google_auth"))
    else:
        display_name = user.get("name")
        email = user.get("email")
        email_verified = bool(user.get("email_verified") or user.get("google_auth"))

    return {
        "uid": user["uid"],
        "email": email,
        "displayName": display_name or (email.split("@")[0] if email else "User"),
        "emailVerified": email_verified,
    }


@router.patch("/profile")
def update_user_profile(
    payload: ProfileUpdateRequest,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    try:
        user_record = update_profile_in_db(
            database=database,
            uid=user["uid"],
            display_name=payload.displayName,
        )
        _invalidate_auth_me(user["uid"])
        return {
            "uid": user_record["uid"],
            "email": user_record["email"],
            "displayName": user_record["display_name"],
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from None
