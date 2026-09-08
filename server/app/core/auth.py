from fastapi import Header, HTTPException, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.core.config import settings


_serializer: URLSafeTimedSerializer | None = None


def auth_serializer() -> URLSafeTimedSerializer:
    global _serializer
    if _serializer is None:
        _serializer = URLSafeTimedSerializer(
            settings.auth_secret_key,
            salt="starwaves-auth-token",
        )
    return _serializer


def create_user_token(user_data: dict, device_id: str | None = None, jti: str | None = None) -> str:
    payload: dict = {
        "uid": user_data["uid"],
        "email": user_data.get("email"),
        "name": user_data.get("name") or user_data.get("display_name"),
    }
    if jti:
        payload["jti"] = jti
    if device_id:
        payload["did"] = device_id
    return auth_serializer().dumps(payload)


def _is_jti_revoked_sync(jti: str) -> bool:
    """Sync helper — blocking. Use _is_jti_revoked_async when in async context."""
    try:
        from app.core.cache import cache_get, cache_set
        cache_key = f"session_revoked:{jti}"
        cached = cache_get(cache_key)
        if cached is not None:
            return bool(cached)
        from app.db.session import sync_engine
        from sqlalchemy import text

        with sync_engine.connect() as conn:
            row = conn.execute(
                text("SELECT revoked, expires_at FROM user_sessions WHERE token_jti=:jti"),
                {"jti": jti},
            ).first()
            if row is None:
                cache_set(cache_key, False, ttl=60)
                return False
            revoked = bool(row[0])
            expires_at = row[1]
            if revoked:
                cache_set(cache_key, True, ttl=60)
                return True
            if expires_at is not None:
                try:
                    from datetime import datetime, timezone

                    if isinstance(expires_at, str):
                        exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                    else:
                        exp = expires_at
                    if exp.tzinfo is None:
                        exp = exp.replace(tzinfo=timezone.utc)
                    if exp < datetime.now(timezone.utc):
                        cache_set(cache_key, True, ttl=60)
                        return True
                except Exception:
                    pass
            cache_set(cache_key, False, ttl=60)
            return False
    except Exception:
        return False


def _is_jti_revoked(jti: str) -> bool:
    """Backward-compat sync wrapper — delegates to _is_jti_revoked_sync."""
    return _is_jti_revoked_sync(jti)


async def _is_jti_revoked_async(jti: str) -> bool:
    """Non-blocking variant for async request path (offloads sync DB via to_thread)."""
    try:
        import asyncio
        from app.core.cache import cache_get
        cache_key = f"session_revoked:{jti}"
        cached = cache_get(cache_key)
        if cached is not None:
            return bool(cached)
        return await asyncio.to_thread(_is_jti_revoked_sync, jti)
    except Exception:
        return False


def _touch_jti_sync(jti: str) -> None:
    try:
        from app.db.session import sync_engine
        from sqlalchemy import text
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        with sync_engine.connect() as conn:
            conn.execute(
                text("UPDATE user_sessions SET last_seen_at=:now, updated_at=:now WHERE token_jti=:jti"),
                {"now": now, "jti": jti},
            )
            conn.commit()
    except Exception:
        pass


def _touch_jti(jti: str) -> None:
    return _touch_jti_sync(jti)


def _touch_jti_async(jti: str) -> None:
    """Fire-and-forget background touch that never blocks the event loop."""
    try:
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.run_in_executor(None, _touch_jti_sync, jti)
        except RuntimeError:
            _touch_jti_sync(jti)
    except Exception:
        pass


def _validate_token_payload(token: str) -> dict | None:
    try:
        data = auth_serializer().loads(token, max_age=86400 * 30)
        if isinstance(data, dict) and "uid" in data:
            jti = data.get("jti")
            if jti and isinstance(jti, str):
                if _is_jti_revoked(jti):
                    return None
                # best-effort touch — fire-and-forget off the event loop
                try:
                    _touch_jti_async(jti)
                except Exception:
                    pass
            return data
    except (BadSignature, SignatureExpired):
        pass
    return None


async def _validate_token_payload_async(token: str) -> dict | None:
    """Async counterpart that does not block the event loop."""
    try:
        data = auth_serializer().loads(token, max_age=86400 * 30)
        if isinstance(data, dict) and "uid" in data:
            jti = data.get("jti")
            if jti and isinstance(jti, str):
                if await _is_jti_revoked_async(jti):
                    return None
                try:
                    _touch_jti_async(jti)
                except Exception:
                    pass
            return data
    except (BadSignature, SignatureExpired):
        pass
    return None


def get_current_user_from_token(token: str) -> dict:
    """Validate a raw Starwaves token string and return the user payload.

    Used by the WebSocket endpoint where the token arrives as a query
    parameter rather than an Authorization header.

    Raises ``HTTPException(401)`` on invalid or expired tokens.
    """
    data = _validate_token_payload(token)
    if data is not None:
        return data
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="The authentication token is invalid or expired.",
    )


async def get_current_user_from_token_async(token: str) -> dict:
    data = await _validate_token_payload_async(token)
    if data is not None:
        return data
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="The authentication token is invalid or expired.",
    )


async def get_current_user(
    authorization: str | None = Header(default=None),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="An authentication token is required.",
        )
    token = authorization.removeprefix("Bearer ").strip()
    data = await _validate_token_payload_async(token)
    if data is not None:
        return data
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="The authentication token is invalid or expired.",
    )


# Keep sync alias for tests / non-async callers (backward-compatible)
def get_current_user_sync(
    authorization: str | None = Header(default=None),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="An authentication token is required.",
        )
    token = authorization.removeprefix("Bearer ").strip()
    data = _validate_token_payload(token)
    if data is not None:
        return data
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="The authentication token is invalid or expired.",
    )


def try_get_user_from_token(token: str) -> dict | None:
    """Non-raising variant — returns None on invalid/expired token."""
    return _validate_token_payload(token)


def create_session_token(
    user_data: dict,
    device_id: str | None = None,
    device_name: str | None = None,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> str:
    """Create a device-bound token and persist a user_sessions row.

    Falls back to legacy stateless token if DB is unavailable.
    """
    import uuid
    from datetime import datetime, timezone, timedelta

    jti = uuid.uuid4().hex
    did = (device_id or "unknown")[:64]
    name = (device_name or "Unknown device")[:255]
    # Sanitize name
    name = name.replace("<", "").replace(">", "")
    if "javascript:" in name.lower():
        name = "Unknown device"
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    try:
        from app.db.session import sync_engine
        from app.db.sql.user_sessions import create_user_session
        from sqlalchemy.orm import Session

        with Session(sync_engine) as s:
            create_user_session(
                s,
                user_id=user_data["uid"],
                device_id=did,
                device_name=name,
                user_agent=user_agent,
                ip_address=ip_address,
                token_jti=jti,
                expires_at=expires_at,
            )
    except Exception:
        # DB unavailable (e.g. tests with empty DB) — still issue token with jti
        pass
    return create_user_token(user_data, device_id=did, jti=jti)


def create_serializer(salt: str) -> URLSafeTimedSerializer:
    """Factory for ITS token serializers with shared secret."""
    return URLSafeTimedSerializer(settings.auth_secret_key, salt=salt)


