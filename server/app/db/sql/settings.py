"""SQL handlers for user settings and integrations ('users/{user_id}/settings' and 'users/{user_id}/integrations')."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.sql._shared import json_safe
from app.db.sql.query import SqlSnapshot
from app.models import UserSetting


def get_setting_doc(session: Session, user_id: str, kind: str, doc_id: str) -> SqlSnapshot:
    """Fetch user setting or integration credentials."""
    category_key = doc_id if kind == "settings" else f"integration:{doc_id}"
    stmt = select(UserSetting).where(UserSetting.user_id == user_id, UserSetting.category == category_key)
    setting = session.scalar(stmt)
    if not setting:
        return SqlSnapshot(doc_id, None, exists=False)
    return SqlSnapshot(doc_id, setting.settings or {})


def set_setting_doc(
    session: Session,
    user_id: str,
    kind: str,
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
) -> None:
    """Create or update user setting or integration credentials."""
    category_key = doc_id if kind == "settings" else f"integration:{doc_id}"
    stmt = select(UserSetting).where(UserSetting.user_id == user_id, UserSetting.category == category_key)
    # settings/integrations persist into a JSON column — datetimes and Firestore
    # sentinel artifacts must become JSON-safe primitives before the flush.
    data = json_safe(data)
    setting = session.scalar(stmt)
    if not setting:
        setting = UserSetting(user_id=user_id, category=category_key, settings=data)
        session.add(setting)
    else:
        setting.settings = json_safe({**(setting.settings or {}), **data}) if merge else data
    session.commit()


def delete_setting_doc(session: Session, user_id: str, kind: str, doc_id: str) -> None:
    """Delete user setting or integration credentials."""
    category_key = doc_id if kind == "settings" else f"integration:{doc_id}"
    stmt = select(UserSetting).where(UserSetting.user_id == user_id, UserSetting.category == category_key)
    setting = session.scalar(stmt)
    if setting:
        session.delete(setting)
        session.commit()
