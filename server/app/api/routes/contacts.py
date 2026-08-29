import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from app.db import SqlClient, get_firestore

from app.core.auth import get_current_user
from app.core.cache import CACHE_TTL_MEDIUM, CACHE_TTL_SHORT, cache_invalidate_prefix, cached
from app.repositories import contacts
from app.schemas.contact import ContactCreate, ContactResponse, ContactUpdate

router = APIRouter(prefix="/contacts")

_CONTACTS_PREFIX = "contacts"


def _invalidate_contacts(user_id: str) -> None:
    cache_invalidate_prefix(f"{_CONTACTS_PREFIX}:{user_id}")


@router.get("")
@cached(ttl=CACHE_TTL_SHORT, prefix=_CONTACTS_PREFIX)
async def list_contacts(
    cursor: str | None = None,
    limit: int | None = Query(default=None, ge=1, le=50),
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    if cursor is not None or limit is not None:
        eff_limit = limit or 20
        items, next_cursor, has_more = await asyncio.to_thread(contacts.list_contacts_page, database, user["uid"], cursor, eff_limit)
        return {"items": items, "next_cursor": next_cursor, "has_more": has_more}
    return await asyncio.to_thread(contacts.list_contacts, database, user["uid"])


@router.get("/{contact_id}", response_model=ContactResponse)
@cached(ttl=CACHE_TTL_MEDIUM, prefix=_CONTACTS_PREFIX)
async def get_contact(
    contact_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    contact = await asyncio.to_thread(contacts.get_contact, database, user["uid"], contact_id)
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found.")
    return contact


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    contact: ContactCreate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    result = await asyncio.to_thread(contacts.create_contact, database, user["uid"], contact)
    _invalidate_contacts(user["uid"])
    return result


@router.patch("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: str,
    changes: ContactUpdate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    contact = await asyncio.to_thread(contacts.update_contact, database, user["uid"], contact_id, changes)
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found.")
    _invalidate_contacts(user["uid"])
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    ok = await asyncio.to_thread(contacts.delete_contact, database, user["uid"], contact_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Contact not found.")
    _invalidate_contacts(user["uid"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{contact_id}/restore", response_model=ContactResponse)
async def restore_contact(
    contact_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    ok = await asyncio.to_thread(contacts.restore_contact, database, user["uid"], contact_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Contact not found.")
    contact = await asyncio.to_thread(contacts.get_contact, database, user["uid"], contact_id)
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found.")
    _invalidate_contacts(user["uid"])
    return contact
