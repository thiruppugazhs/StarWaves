from datetime import datetime, timezone

from app.db import ArrayUnion, Query, SERVER_TIMESTAMP, SqlClient

from app.schemas.profile import ProfileCreate, ProfileResponse, ProfileUpdate

COLLECTION = "profiles"


def _profile_from_snapshot(snapshot) -> ProfileResponse:
    data = dict(snapshot.to_dict() or {})
    data.setdefault("id", snapshot.id)
    return ProfileResponse(**data)


def create_profile(database: SqlClient, profile: ProfileCreate) -> ProfileResponse:
    document = database.collection(COLLECTION).document()
    now = datetime.now(timezone.utc).isoformat()
    data = profile.model_dump(mode="json")
    document.set(
        {
            **data,
            "created_at": SERVER_TIMESTAMP,
            "updated_at": SERVER_TIMESTAMP,
        },
    )
    return ProfileResponse(id=document.id, **data, created_at=now, updated_at=now)


def get_profile(database: SqlClient, profile_id: str) -> ProfileResponse | None:
    snapshot = database.collection(COLLECTION).document(profile_id).get()
    return _profile_from_snapshot(snapshot) if snapshot.exists else None


def list_profiles(database: SqlClient, limit: int) -> list[ProfileResponse]:
    query = database.collection(COLLECTION).limit(limit)
    return [_profile_from_snapshot(snapshot) for snapshot in query.stream()]


def update_profile(
    database: SqlClient,
    profile_id: str,
    changes: ProfileUpdate,
) -> ProfileResponse | None:
    document = database.collection(COLLECTION).document(profile_id)
    try:
        document.update(
            {
                **changes.model_dump(exclude_unset=True, mode="json"),
                "updated_at": SERVER_TIMESTAMP,
            },
        )
    except Exception:
        return None
    return _profile_from_snapshot(document.get())


def delete_profile(database: SqlClient, profile_id: str) -> bool:
    snapshot = database.collection(COLLECTION).document(profile_id).get()
    if not snapshot.exists:
        return False
    # SqlSnapshot exposes no .reference (Firestore-only API); delete via doc ref.
    database.collection(COLLECTION).document(profile_id).delete()
    return True

