"""User account CRUD: lookup, creation (password & Google), and profile updates."""

import uuid

from app.db import ArrayUnion, FieldFilter, Query, SERVER_TIMESTAMP, SqlClient


from app.repositories.password import hash_password


def get_users_collection(database: SqlClient):
    return database.collection("users")


def merge_duplicate_user_accounts(database: SqlClient, email: str | None = None) -> list[dict]:
    """Merges duplicate user documents sharing the same email into a single primary record."""
    users_coll = get_users_collection(database)
    all_docs = list(users_coll.stream())

    email_groups: dict[str, list[dict]] = {}
    for doc in all_docs:
        d = doc.to_dict() or {}
        doc_email = (d.get("email") or "").lower().strip()
        if not doc_email:
            continue
        if email and doc_email != email.lower().strip():
            continue
        d["uid"] = doc.id
        email_groups.setdefault(doc_email, []).append(d)

    merged_primary_users = []

    for _, docs in email_groups.items():
        if len(docs) <= 1:
            if docs:
                merged_primary_users.append(docs[0])
            continue

        primary = docs[0]
        for candidate in docs[1:]:
            if (not primary.get("password_hash") and candidate.get("password_hash")) or \
               (not primary.get("google_auth") and candidate.get("google_auth")):
                primary = candidate

        primary_uid = primary["uid"]
        updates = {"updated_at": SERVER_TIMESTAMP}
        combined_accounts = list(primary.get("combined_accounts") or [])

        for second in docs:
            if second["uid"] == primary_uid:
                continue

            if not primary.get("password_hash") and second.get("password_hash"):
                updates["password_hash"] = second["password_hash"]
                updates["password_salt"] = second.get("password_salt", "")
                primary["password_hash"] = second["password_hash"]
                primary["password_salt"] = second.get("password_salt", "")

            if second.get("google_auth"):
                updates["google_auth"] = True
                primary["google_auth"] = True

            if not primary.get("display_name") and second.get("display_name"):
                updates["display_name"] = second["display_name"]
                primary["display_name"] = second["display_name"]

            if not primary.get("picture") and second.get("picture"):
                updates["picture"] = second["picture"]
                primary["picture"] = second["picture"]

            if second.get("email_verified"):
                updates["email_verified"] = True
                primary["email_verified"] = True

            for acc in second.get("combined_accounts") or []:
                if not any(a.get("email") == acc.get("email") or (a.get("uid") and a.get("uid") == acc.get("uid")) for a in combined_accounts):
                    combined_accounts.append(acc)

            users_coll.document(second["uid"]).delete()

        if combined_accounts != list(primary.get("combined_accounts") or []):
            updates["combined_accounts"] = combined_accounts
            primary["combined_accounts"] = combined_accounts

        if len(updates) > 1:
            users_coll.document(primary_uid).update(updates)

        merged_primary_users.append(primary)

    return merged_primary_users


def get_user_by_email(database: SqlClient, email: str) -> dict | None:
    normalized_email = email.lower().strip()
    query = get_users_collection(database).where(filter=FieldFilter("email", "==", normalized_email))
    docs = list(query.stream())
    if len(docs) > 1:
        merged_list = merge_duplicate_user_accounts(database, email=normalized_email)
        return merged_list[0] if merged_list else None

    if not docs:
        for doc in get_users_collection(database).limit(100).stream():
            d = doc.to_dict() or {}
            if (d.get("email") or "").lower().strip() == normalized_email:
                d["uid"] = doc.id
                return d
        return None
    data = docs[0].to_dict()
    data["uid"] = docs[0].id
    return data


def get_user_by_id(database: SqlClient, uid: str) -> dict | None:
    doc = get_users_collection(database).document(uid).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["uid"] = doc.id
    return data


def create_user_with_password(
    database: SqlClient,
    email: str,
    password: str,
    name: str | None = None,
) -> dict:
    normalized_email = email.lower().strip()
    existing = get_user_by_email(database, normalized_email)
    pwd_hash, pwd_salt = hash_password(password)
    display_name = name.strip() if name and name.strip() else normalized_email.split("@")[0]

    if existing:
        if not existing.get("password_hash"):
            updates = {
                "password_hash": pwd_hash,
                "password_salt": pwd_salt,
                "updated_at": SERVER_TIMESTAMP,
            }
            if display_name and not existing.get("display_name"):
                updates["display_name"] = display_name
                existing["display_name"] = display_name
            get_users_collection(database).document(existing["uid"]).update(updates)
            existing.update(updates)
            return existing

        raise ValueError("An account already exists for this email.")

    uid = str(uuid.uuid4())
    user_data = {
        "uid": uid,
        "email": normalized_email,
        "display_name": display_name,
        "password_hash": pwd_hash,
        "password_salt": pwd_salt,
        "email_verified": False,
        "created_at": SERVER_TIMESTAMP,
        "updated_at": SERVER_TIMESTAMP,
    }

    get_users_collection(database).document(uid).set(user_data)
    return user_data


def get_or_create_google_user(
    database: SqlClient,
    email: str,
    name: str | None = None,
    picture: str | None = None,
) -> dict:
    normalized_email = email.lower().strip()
    existing = get_user_by_email(database, normalized_email)

    display_name = name.strip() if name and name.strip() else normalized_email.split("@")[0]

    if existing:
        updates = {"google_auth": True, "updated_at": SERVER_TIMESTAMP}
        if picture and not existing.get("picture"):
            updates["picture"] = picture
        if display_name and not existing.get("display_name"):
            updates["display_name"] = display_name
        get_users_collection(database).document(existing["uid"]).update(updates)
        existing.update(updates)
        return existing

    uid = str(uuid.uuid4())
    user_data = {
        "uid": uid,
        "email": normalized_email,
        "display_name": display_name,
        "picture": picture or "",
        "google_auth": True,
        "created_at": SERVER_TIMESTAMP,
        "updated_at": SERVER_TIMESTAMP,
    }
    get_users_collection(database).document(uid).set(user_data)
    user_data["is_new"] = True
    return user_data


def mark_email_verified(database: SqlClient, uid: str) -> bool:
    doc_ref = get_users_collection(database).document(uid)
    doc = doc_ref.get()
    if not doc.exists:
        return False
    doc_ref.update({
        "email_verified": True,
        "email_verified_at": SERVER_TIMESTAMP,
        "updated_at": SERVER_TIMESTAMP,
    })
    return True


def create_email_otp(database: SqlClient, email: str) -> str:
    import secrets
    from datetime import datetime, timezone, timedelta

    normalized_email = email.lower().strip()
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    otp_data = {
        "email": normalized_email,
        "otp_code": otp_code,
        "expires_at": expires_at.isoformat(),
        "created_at": SERVER_TIMESTAMP,
    }
    database.collection("email_otps").document(normalized_email).set(otp_data)

    user = get_user_by_email(database, normalized_email)
    if user:
        get_users_collection(database).document(user["uid"]).update({
            "otp_code": otp_code,
            "otp_expires_at": expires_at.isoformat(),
            "updated_at": SERVER_TIMESTAMP,
        })

    return otp_code


def verify_email_otp(database: SqlClient, email: str, otp_code: str) -> tuple[bool, str | None]:
    """Verify 6-digit OTP code for email. Returns (success, error_message)."""
    from datetime import datetime, timezone

    normalized_email = email.lower().strip()
    clean_otp = (otp_code or "").strip()

    if len(clean_otp) != 6 or not clean_otp.isdigit():
        return False, "Verification code must be 6 digits."

    otp_doc_ref = database.collection("email_otps").document(normalized_email)
    otp_doc = otp_doc_ref.get()

    stored_otp = None
    expires_at_str = None

    if otp_doc.exists:
        d = otp_doc.to_dict() or {}
        stored_otp = d.get("otp_code")
        expires_at_str = d.get("expires_at")
    else:
        user = get_user_by_email(database, normalized_email)
        if user:
            stored_otp = user.get("otp_code")
            expires_at_str = user.get("otp_expires_at")

    if not stored_otp or not expires_at_str:
        return False, "No active verification code found. Please request a new code."

    try:
        exp = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > exp:
            return False, "Verification code has expired. Please request a new code."
    except Exception:
        return False, "Invalid verification code state. Please request a new code."

    if stored_otp != clean_otp:
        return False, "Incorrect verification code. Please try again."

    # Mark verified
    user = get_user_by_email(database, normalized_email)
    if user:
        mark_email_verified(database, user["uid"])
        get_users_collection(database).document(user["uid"]).update({
            "otp_code": None,
            "otp_expires_at": None,
        })

    try:
        otp_doc_ref.delete()
    except Exception:
        pass

    return True, None


def update_user_password(database: SqlClient, uid: str, new_password: str) -> bool:
    doc_ref = get_users_collection(database).document(uid)
    doc = doc_ref.get()
    if not doc.exists:
        return False
    pwd_hash, pwd_salt = hash_password(new_password)
    doc_ref.update({
        "password_hash": pwd_hash,
        "password_salt": pwd_salt,
        "updated_at": SERVER_TIMESTAMP,
    })
    return True


def update_user_profile(database: SqlClient, uid: str, display_name: str, email: str | None = None, assistant_name: str | None = None) -> dict:
    doc_ref = get_users_collection(database).document(uid)
    doc = doc_ref.get()
    clean_name = display_name.strip()
    if not doc.exists:
        data = {
            "uid": uid,
            "email": email or "",
            "display_name": clean_name,
            "created_at": SERVER_TIMESTAMP,
            "updated_at": SERVER_TIMESTAMP,
        }
        if assistant_name:
            data["assistant_name"] = assistant_name.strip()
        doc_ref.set(data)
        return data

    updates = {
        "display_name": clean_name,
        "updated_at": SERVER_TIMESTAMP,
    }
    if assistant_name:
        updates["assistant_name"] = assistant_name.strip()
    doc_ref.update(updates)
    data = doc.to_dict()
    data["uid"] = uid
    data["display_name"] = clean_name
    if assistant_name:
        data["assistant_name"] = assistant_name.strip()
    return data
