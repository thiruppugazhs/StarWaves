from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from app.db import SqlClient, get_firestore

from app.core.cache import CACHE_TTL_MEDIUM, CACHE_TTL_SHORT, cache_invalidate_prefix, cached
from app.repositories import profiles
from app.schemas.profile import ProfileCreate, ProfileResponse, ProfileUpdate

router = APIRouter(prefix="/profiles")

_PROFILES_PREFIX = "profiles"


def _invalidate_profiles() -> None:
    cache_invalidate_prefix(_PROFILES_PREFIX)


@router.post(
    "",
    response_model=ProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_profile(
    profile: ProfileCreate,
    database: SqlClient = Depends(get_firestore),
) -> ProfileResponse:
    result = profiles.create_profile(database, profile)
    _invalidate_profiles()
    return result


@router.get("", response_model=list[ProfileResponse])
@cached(ttl=CACHE_TTL_SHORT, prefix=_PROFILES_PREFIX)
def list_profiles(
    limit: int = Query(default=20, ge=1, le=100),
    database: SqlClient = Depends(get_firestore),
) -> list[ProfileResponse]:
    return profiles.list_profiles(database, limit)


@router.get("/{profile_id}", response_model=ProfileResponse)
@cached(ttl=CACHE_TTL_MEDIUM, prefix=_PROFILES_PREFIX)
def get_profile(
    profile_id: str,
    database: SqlClient = Depends(get_firestore),
) -> ProfileResponse:
    profile = profiles.get_profile(database, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return profile


@router.patch("/{profile_id}", response_model=ProfileResponse)
def update_profile(
    profile_id: str,
    changes: ProfileUpdate,
    database: SqlClient = Depends(get_firestore),
) -> ProfileResponse:
    profile = profiles.update_profile(database, profile_id, changes)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    _invalidate_profiles()
    return profile


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(
    profile_id: str,
    database: SqlClient = Depends(get_firestore),
) -> Response:
    if not profiles.delete_profile(database, profile_id):
        raise HTTPException(status_code=404, detail="Profile not found.")
    _invalidate_profiles()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

