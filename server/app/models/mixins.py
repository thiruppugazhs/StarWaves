"""Reusable SQLAlchemy mixins — timestamps and soft-delete.

Columns use the plain ``Column`` declaration style consistent with every model
in ``app/models/__init__.py``; ``Mapped[]`` annotation-based declarations fail
to resolve under Python 3.14's lazy annotation evaluation (PEP 649) when mixed
into declarative bases.
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class SoftDeleteMixin:
    deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)


class UserOwnedMixin:
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)