"""RLS context helper — sets per-transaction GUC for row-level security.

Usage: call set_rls_user(session, user_id) at start of any user-scoped query.
No-op on SQLite (tests) and when role is superuser (still harmless).
"""
from sqlalchemy import text
from sqlalchemy.orm import Session


def set_rls_user(session: Session, user_id: str | None) -> None:
    if not user_id:
        return
    try:
        # SET LOCAL is transaction-scoped; safe to call even if RLS not enabled
        session.execute(text("SET LOCAL app.current_user_id = :uid"), {"uid": user_id})
    except Exception:
        # SQLite or missing GUC — ignore for tests/dev
        pass
