"""Account combining: pending requests, confirmation, unlink, and info."""

from datetime import datetime, timezone

from app.db import ArrayUnion, Query, SERVER_TIMESTAMP, SqlClient

from app.repositories.users import get_user_by_email, get_users_collection


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def add_pending_combine_request(database: SqlClient, owner_uid: str, target_email: str) -> None:
    owner_ref = get_users_collection(database).document(owner_uid)
    doc = owner_ref.get()
    if not doc.exists:
        raise ValueError("User not found.")
    data = doc.to_dict() or {}
    pending = data.get("pending_combine_requests", [])
    normalized_target = target_email.lower().strip()

    if not any(req.get("email") == normalized_target for req in pending):
        pending.append({
            "email": normalized_target,
            "requested_at": _now_utc(),
        })
        owner_ref.update({"pending_combine_requests": pending, "updated_at": SERVER_TIMESTAMP})


def confirm_combine_accounts(
    database: SqlClient,
    owner_uid: str,
    target_email: str,
    target_uid: str | None = None,
) -> dict:
    normalized_target = target_email.lower().strip()
    owner_ref = get_users_collection(database).document(owner_uid)
    owner_doc = owner_ref.get()
    if not owner_doc.exists:
        raise ValueError("Owner account not found.")
    owner_data = owner_doc.to_dict() or {}

    # If target_uid wasn't provided, try resolving from email
    if not target_uid:
        target_user = get_user_by_email(database, normalized_target)
        if target_user:
            target_uid = target_user["uid"]

    # 1. Update owner's combined_accounts
    combined = owner_data.get("combined_accounts", [])
    if not any(acc.get("email") == normalized_target or (target_uid and acc.get("uid") == target_uid) for acc in combined):
        combined.append({
            "email": normalized_target,
            "uid": target_uid or "",
            "linked_at": _now_utc(),
        })

    # Remove from pending requests
    pending = [req for req in owner_data.get("pending_combine_requests", []) if req.get("email") != normalized_target]
    owner_ref.update({
        "combined_accounts": combined,
        "pending_combine_requests": pending,
        "updated_at": SERVER_TIMESTAMP,
    })

    # 2. If target user exists in DB, also update their document with owner's link
    if target_uid and target_uid != owner_uid:
        target_ref = get_users_collection(database).document(target_uid)
        target_doc = target_ref.get()
        if target_doc.exists:
            target_data = target_doc.to_dict() or {}
            target_combined = target_data.get("combined_accounts", [])
            owner_email = owner_data.get("email", "")
            if not any(acc.get("uid") == owner_uid or acc.get("email") == owner_email for acc in target_combined):
                target_combined.append({
                    "email": owner_email,
                    "uid": owner_uid,
                    "linked_at": _now_utc(),
                })
                target_ref.update({
                    "combined_accounts": target_combined,
                    "updated_at": SERVER_TIMESTAMP,
                })

    return {
        "owner_uid": owner_uid,
        "target_email": normalized_target,
        "target_uid": target_uid,
    }


def remove_combined_account(database: SqlClient, uid: str, target_identifier: str) -> None:
    doc_ref = get_users_collection(database).document(uid)
    doc = doc_ref.get()
    if not doc.exists:
        raise ValueError("User not found.")
    data = doc.to_dict() or {}
    clean_target = target_identifier.lower().strip()

    # Find the account entry to remove
    combined = data.get("combined_accounts", [])
    removed_entry = None
    new_combined = []

    for acc in combined:
        if acc.get("uid") == target_identifier or acc.get("email") == clean_target:
            removed_entry = acc
        else:
            new_combined.append(acc)

    pending = [req for req in data.get("pending_combine_requests", []) if req.get("email") != clean_target]

    doc_ref.update({
        "combined_accounts": new_combined,
        "pending_combine_requests": pending,
        "updated_at": SERVER_TIMESTAMP,
    })

    # Also remove reciprocal link from the target user doc if found
    if removed_entry:
        other_uid = removed_entry.get("uid")
        other_email = removed_entry.get("email")
        if other_uid:
            other_ref = get_users_collection(database).document(other_uid)
            other_doc = other_ref.get()
            if other_doc.exists:
                other_data = other_doc.to_dict() or {}
                user_email = data.get("email", "")
                other_combined = [
                    acc for acc in other_data.get("combined_accounts", [])
                    if acc.get("uid") != uid and acc.get("email") != user_email
                ]
                other_ref.update({
                    "combined_accounts": other_combined,
                    "updated_at": SERVER_TIMESTAMP,
                })
        elif other_email:
            other_user = get_user_by_email(database, other_email)
            if other_user:
                other_ref = get_users_collection(database).document(other_user["uid"])
                other_doc = other_ref.get()
                if other_doc.exists:
                    other_data = other_doc.to_dict() or {}
                    user_email = data.get("email", "")
                    other_combined = [
                        acc for acc in other_data.get("combined_accounts", [])
                        if acc.get("uid") != uid and acc.get("email") != user_email
                    ]
                    other_ref.update({
                        "combined_accounts": other_combined,
                        "updated_at": SERVER_TIMESTAMP,
                    })


def get_combined_accounts_info(database: SqlClient, uid: str) -> dict:
    doc = get_users_collection(database).document(uid).get()
    if not doc.exists:
        return {"combined_accounts": [], "pending_combine_requests": []}
    data = doc.to_dict() or {}

    combined = []
    for item in data.get("combined_accounts", []):
        combined.append({
            "uid": item.get("uid", ""),
            "email": item.get("email", ""),
            "linked_at": item.get("linked_at").isoformat() if hasattr(item.get("linked_at"), "isoformat") else str(item.get("linked_at") or ""),
        })

    pending = []
    for item in data.get("pending_combine_requests", []):
        pending.append({
            "email": item.get("email", ""),
            "requested_at": item.get("requested_at").isoformat() if hasattr(item.get("requested_at"), "isoformat") else str(item.get("requested_at") or ""),
        })

    return {
        "combined_accounts": combined,
        "pending_combine_requests": pending,
    }
