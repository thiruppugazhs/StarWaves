"""Unit tests for models.mixins — timestamp, soft-delete, and user-ownership columns."""

from datetime import datetime, timezone

from sqlalchemy import Column, Integer, create_engine
from sqlalchemy.orm import DeclarativeBase, Session

from app.models.mixins import SoftDeleteMixin, TimestampMixin, UserOwnedMixin, utc_now
from app.db.session import Base as AppBase


def test_utc_now_is_timezone_aware():
    now = utc_now()
    assert now.tzinfo is timezone.utc


class TestMixinBehavior:
    def test_timestamps_and_soft_delete_defaults_on_insert(self):
        engine = create_engine("sqlite://")

        class Stub(AppBase, TimestampMixin, SoftDeleteMixin):
            __tablename__ = "stub_rows"
            id = Column(Integer, primary_key=True)

        AppBase.metadata.create_all(engine)
        try:
            with Session(engine) as session:
                row = Stub()
                session.add(row)
                session.commit()
                fetched = session.get(Stub, row.id)
                assert isinstance(fetched.created_at, datetime)
                assert isinstance(fetched.updated_at, datetime)
                assert fetched.deleted is False
                assert fetched.deleted_at is None
        finally:
            AppBase.metadata.remove(Stub.__table__)

    def test_mixin_columns_declared(self):
        for column in ("created_at", "updated_at"):
            assert hasattr(TimestampMixin, column)
        for column in ("deleted", "deleted_at"):
            assert hasattr(SoftDeleteMixin, column)

    def test_user_owned_column_has_foreign_key_to_users(self):
        column = UserOwnedMixin.__dict__["user_id"]
        foreign_keys = list(column.foreign_keys)
        assert len(foreign_keys) == 1
        assert foreign_keys[0].target_fullname.endswith("users.id")


class TestAppBaseShared:
    def test_mixins_compatible_with_app_metadata(self):
        """Mixins must work against the same declarative base the models use."""
        assert issubclass(AppBase, DeclarativeBase)
