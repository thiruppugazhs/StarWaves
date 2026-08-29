"""SQL handlers for user_sessions (multi-device)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.db.session import Base, sync_engine
from app.models import UserSession


def _ensure_table() -> None:
    try:
        insp = inspect(sync_engine)
        if not insp.has_table("user_sessions"):
            Base.metadata.create_all(bind=sync_engine, tables=[UserSession.__table__])
    except Exception:
        try:
            Base.metadata.create_all(bind=sync_engine, tables=[UserSession.__table__])
        except Exception:
            pass


def user_session_to_dict(s: UserSession) -> dict[str, Any]:
    return {
        "id": s.id,
        "user_id": s.user_id,
        "device_id": s.device_id,
        "device_name": s.device_name,
        "user_agent": s.user_agent,
        "ip_address": s.ip_address,
        "token_jti": s.token_jti,
        "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        "revoked": bool(s.revoked),
        "revoked_at": s.revoked_at.isoformat() if s.revoked_at else None,
        "last_seen_at": s.last_seen_at.isoformat() if s.last_seen_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else "",
        "updated_at": s.updated_at.isoformat() if s.updated_at else "",
    }


def create_user_session(
    session: Session,
    user_id: str,
    device_id: str,
    device_name: str,
    user_agent: str | None,
    ip_address: str | None,
    token_jti: str,
    expires_at: datetime,
) -> UserSession:
    _ensure_table()
    now = datetime.now(timezone.utc)
    row = UserSession(
        user_id=user_id,
        device_id=device_id,
        device_name=device_name[:255] if device_name else "Unknown device",
        user_agent=(user_agent or "")[:512] if user_agent else None,
        ip_address=(ip_address or "")[:64] if ip_address else None,
        token_jti=token_jti,
        expires_at=expires_at,
        revoked=False,
        last_seen_at=now,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    # Enforce max 10 sessions per user — evict oldest revoked/expired first, then oldest last_seen
    try:
        stmt = select(UserSession).where(UserSession.user_id == user_id).order_by(UserSession.last_seen_at.asc())
        rows = session.scalars(stmt).all()
        if len(rows) > 10:
            excess = len(rows) - 10
            def _is_exp(r):
                if not r.expires_at:
                    return False
                exp = r.expires_at
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                return exp < now
            revoked = [r for r in rows if r.revoked or _is_exp(r)]
            victims = (revoked + [r for r in rows if r not in revoked])[:excess]
            for v in victims:
                session.delete(v)
            session.commit()
    except Exception:
        pass
    return row


def get_session_by_jti(session: Session, jti: str) -> UserSession | None:
    _ensure_table()
    stmt = select(UserSession).where(UserSession.token_jti == jti)
    try:
        return session.scalars(stmt).first()
    except Exception:
        return None


def list_user_sessions(session: Session, user_id: str) -> list[dict[str, Any]]:
    _ensure_table()
    stmt = select(UserSession).where(UserSession.user_id == user_id).order_by(UserSession.last_seen_at.desc())
    try:
        rows = session.scalars(stmt).all()
    except Exception:
        try:
            _ensure_table()
            rows = session.scalars(stmt).all()
        except Exception:
            return []
    now = datetime.now(timezone.utc)
    result: list[dict[str, Any]] = []
    for r in rows:
        exp = r.expires_at
        if exp is not None and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        is_expired = bool(exp and exp < now)
        d = user_session_to_dict(r)
        d["is_expired"] = is_expired
        result.append(d)
    return result


def get_user_session(session: Session, user_id: str, session_id: str) -> UserSession | None:
    row = session.get(UserSession, session_id)
    if not row or row.user_id != user_id:
        return None
    return row


def touch_session(session: Session, jti: str) -> None:
    row = get_session_by_jti(session, jti)
    if not row or row.revoked:
        return
    row.last_seen_at = datetime.now(timezone.utc)
    session.commit()


def revoke_session(session: Session, user_id: str, session_id: str) -> bool:
    row = get_user_session(session, user_id, session_id)
    if not row:
        return False
    row.revoked = True
    row.revoked_at = datetime.now(timezone.utc)
    session.commit()
    return True


def revoke_other_sessions(session: Session, user_id: str, keep_jti: str) -> int:
    stmt = select(UserSession).where(UserSession.user_id == user_id, UserSession.token_jti != keep_jti, UserSession.revoked == False)  # noqa: E712
    rows = session.scalars(stmt).all()
    now = datetime.now(timezone.utc)
    count = 0
    for r in rows:
        r.revoked = True
        r.revoked_at = now
        count += 1
    if count:
        session.commit()
    return count


def update_session_name(session: Session, user_id: str, session_id: str, device_name: str) -> bool:
    row = get_user_session(session, user_id, session_id)
    if not row:
        return False
    sanitized = device_name.strip()[:255]
    if not sanitized:
        return False
    # Block angle brackets / url schemes
    sanitized = sanitized.replace("<", "").replace(">", "")
    if "javascript:" in sanitized.lower():
        return False
    row.device_name = sanitized
    session.commit()
    return True
