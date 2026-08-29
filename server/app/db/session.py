"""Async database engine, session generator, and model initialization."""

import asyncio
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


from sqlalchemy import create_engine, text

class Base(DeclarativeBase):
    pass


def get_async_db_url() -> str:
    url = settings.database_url
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def get_sync_db_url() -> str:
    url = settings.database_url
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    elif url.startswith("sqlite+aiosqlite://"):
        url = url.replace("sqlite+aiosqlite://", "sqlite://", 1)
    return url


async_db_url = get_async_db_url()
sync_db_url = get_sync_db_url()
is_sqlite = sync_db_url.startswith("sqlite")

engine = create_async_engine(
    async_db_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
    **({} if is_sqlite else {"pool_size": 5, "max_overflow": 5, "pool_recycle": 300, "pool_timeout": 30}),
)

sync_engine = create_engine(
    sync_db_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
    **({} if is_sqlite else {"pool_size": 5, "max_overflow": 5, "pool_recycle": 300, "pool_timeout": 30}),
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides an asynchronous database session."""
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database tables.

    e2-micro note: _ensure_* ALTERs run off the event loop via to_thread to avoid
    blocking lifespan; create_all is already async via run_sync.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Run sync ALTERs off the loop so single worker stays responsive
    await asyncio.to_thread(_ensure_call_messages_column)
    await asyncio.to_thread(_ensure_call_provider_columns)
    await asyncio.to_thread(_ensure_whatsapp_columns)
    await asyncio.to_thread(_ensure_eve_memory_embedding)
    await asyncio.to_thread(_ensure_documents_columns)
    await asyncio.to_thread(_ensure_hackathon_columns)
    await asyncio.to_thread(_ensure_notification_columns)
    await asyncio.to_thread(_ensure_eve_schedule_columns)
    await asyncio.to_thread(_ensure_user_sessions_columns)
    # Composite indexes for pagination hot paths (lean, concurrent-safe)
    await asyncio.to_thread(_ensure_performance_indexes)


def _ensure_call_messages_column() -> None:
    """Idempotently backfill the calls.messages column on existing tables.

    create_all() only creates missing tables, and this project has no alembic
    migrations, so pre-existing deployments need an explicit ALTER TABLE.
    """
    with sync_engine.connect() as conn:
        if is_sqlite:
            columns = {row[1] for row in conn.execute(text("PRAGMA table_info(calls)"))}
            if "messages" not in columns:
                conn.execute(text("ALTER TABLE calls ADD COLUMN messages JSON NOT NULL DEFAULT '[]'"))
        else:
            conn.execute(text("ALTER TABLE calls ADD COLUMN IF NOT EXISTS messages JSON NOT NULL DEFAULT '[]'"))
        conn.commit()


def _ensure_call_provider_columns() -> None:
    """Backfill provider/external_sid/phone_number for dual call option (in_app vs twilio)."""
    with sync_engine.connect() as conn:
        if is_sqlite:
            cols = {row[1] for row in conn.execute(text("PRAGMA table_info(calls)"))}
            if "provider" not in cols:
                conn.execute(text("ALTER TABLE calls ADD COLUMN provider TEXT DEFAULT 'in_app'"))
                conn.execute(text("UPDATE calls SET provider='in_app' WHERE provider IS NULL"))
            if "external_sid" not in cols:
                conn.execute(text("ALTER TABLE calls ADD COLUMN external_sid TEXT"))
            if "phone_number" not in cols:
                conn.execute(text("ALTER TABLE calls ADD COLUMN phone_number TEXT"))
        else:
            conn.execute(text("ALTER TABLE calls ADD COLUMN IF NOT EXISTS provider VARCHAR(32) DEFAULT 'in_app'"))
            conn.execute(text("ALTER TABLE calls ADD COLUMN IF NOT EXISTS external_sid VARCHAR(64)"))
            conn.execute(text("ALTER TABLE calls ADD COLUMN IF NOT EXISTS phone_number VARCHAR(32)"))
        conn.commit()


def _ensure_whatsapp_columns() -> None:
    """Idempotently backfill WhatsApp tables columns on existing databases."""
    with sync_engine.connect() as conn:
        if is_sqlite:
            msg_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(whatsapp_messages)"))}
            if "sender_avatar_url" not in msg_cols:
                conn.execute(text("ALTER TABLE whatsapp_messages ADD COLUMN sender_avatar_url TEXT"))
            if "reactions" not in msg_cols:
                conn.execute(text("ALTER TABLE whatsapp_messages ADD COLUMN reactions JSON DEFAULT '[]'"))
            if "is_forwarded" not in msg_cols:
                conn.execute(text("ALTER TABLE whatsapp_messages ADD COLUMN is_forwarded BOOLEAN DEFAULT FALSE"))
            if "is_starred" not in msg_cols:
                conn.execute(text("ALTER TABLE whatsapp_messages ADD COLUMN is_starred BOOLEAN DEFAULT FALSE"))
            if "is_pinned" not in msg_cols:
                conn.execute(text("ALTER TABLE whatsapp_messages ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE"))

            chat_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(whatsapp_chats)"))}
            if "avatar_url" not in chat_cols:
                conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN avatar_url TEXT"))
            if "participants" not in chat_cols:
                conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN participants JSON DEFAULT '[]'"))
            if "unread_count" not in chat_cols:
                conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN unread_count INTEGER DEFAULT 0"))
            if "last_message" not in chat_cols:
                conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN last_message JSON"))
            if "is_pinned" not in chat_cols:
                conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE"))
            if "is_muted" not in chat_cols:
                conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN is_muted BOOLEAN DEFAULT FALSE"))
            if "is_archived" not in chat_cols:
                conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN is_archived BOOLEAN DEFAULT FALSE"))
            if "eve_auto_reply" not in chat_cols:
                conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN eve_auto_reply BOOLEAN DEFAULT FALSE"))
        else:
            conn.execute(text("ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sender_avatar_url TEXT"))
            conn.execute(text("ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS reactions JSON DEFAULT '[]'"))
            conn.execute(text("ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE"))

            conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS avatar_url TEXT"))
            conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS participants JSON DEFAULT '[]'"))
            conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS last_message JSON"))
            conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS eve_auto_reply BOOLEAN DEFAULT FALSE"))
        conn.commit()


def _ensure_eve_memory_embedding() -> None:
    """Enable pgvector and add embedding column + HNSW index (postgres only)."""
    if is_sqlite:
        # SQLite: create embedding as JSON text fallback (type affinity)
        with sync_engine.connect() as conn:
            cols = {row[1] for row in conn.execute(text("PRAGMA table_info(eve_memories)"))}
            if "embedding" not in cols:
                try:
                    conn.execute(text("ALTER TABLE eve_memories ADD COLUMN embedding JSON"))
                except Exception:
                    # fallback to TEXT if JSON not supported
                    try:
                        conn.execute(text("ALTER TABLE eve_memories ADD COLUMN embedding TEXT"))
                    except Exception:
                        pass
            conn.commit()
        return
    with sync_engine.connect() as conn:
        try:
            # Enable extension (requires superuser on first run; pgvector image has it preinstalled)
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        except Exception:
            pass
        # Add column if missing
        conn.execute(text("ALTER TABLE eve_memories ADD COLUMN IF NOT EXISTS embedding vector(1536)"))
        # HNSW index for cosine recall; IF NOT EXISTS safe for re-entry, small tables so no CONCURRENTLY
        try:
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_eve_memories_embedding ON eve_memories USING hnsw (embedding vector_cosine_ops)"
                )
            )
        except Exception:
            # Fallback to ivfflat if hnsw not available
            try:
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_eve_memories_embedding ON eve_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
                    )
                )
            except Exception:
                pass
        conn.commit()


def _ensure_documents_columns() -> None:
    """Backfill document metadata columns (url/type/size/drive_file_id)."""
    with sync_engine.connect() as conn:
        if is_sqlite:
            cols = {row[1] for row in conn.execute(text("PRAGMA table_info(documents)"))}
            if "documents" not in cols:
                return
            if "url" not in cols:
                conn.execute(text("ALTER TABLE documents ADD COLUMN url TEXT"))
            if "doc_type" not in cols:
                conn.execute(text("ALTER TABLE documents ADD COLUMN doc_type VARCHAR(80) DEFAULT 'FILE'"))
            if "size_label" not in cols:
                conn.execute(text("ALTER TABLE documents ADD COLUMN size_label VARCHAR(80) DEFAULT 'Unknown'"))
            if "drive_file_id" not in cols:
                conn.execute(text("ALTER TABLE documents ADD COLUMN drive_file_id VARCHAR(255)"))
        else:
            conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS url TEXT"))
            conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type VARCHAR(80) DEFAULT 'FILE'"))
            conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS size_label VARCHAR(80) DEFAULT 'Unknown'"))
            conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(255)"))
        conn.commit()


def _ensure_hackathon_columns() -> None:
    """Backfill structured hackathon columns (starts_at/ends_at/mode/team_size/tags)."""
    with sync_engine.connect() as conn:
        if is_sqlite:
            cols = {row[1] for row in conn.execute(text("PRAGMA table_info(hackathons)"))}
            if "hackathons" not in cols:
                return
            if "starts_at" not in cols:
                conn.execute(text("ALTER TABLE hackathons ADD COLUMN starts_at TIMESTAMP WITH TIME ZONE"))
            if "ends_at" not in cols:
                conn.execute(text("ALTER TABLE hackathons ADD COLUMN ends_at TIMESTAMP WITH TIME ZONE"))
            if "mode" not in cols:
                conn.execute(text("ALTER TABLE hackathons ADD COLUMN mode VARCHAR(64)"))
            if "team_size" not in cols:
                conn.execute(text("ALTER TABLE hackathons ADD COLUMN team_size VARCHAR(32)"))
            if "tags" not in cols:
                conn.execute(text("ALTER TABLE hackathons ADD COLUMN tags JSON DEFAULT '[]'"))
        else:
            conn.execute(text("ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP WITH TIME ZONE"))
            conn.execute(text("ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP WITH TIME ZONE"))
            conn.execute(text("ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS mode VARCHAR(64)"))
            conn.execute(text("ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS team_size VARCHAR(32)"))
            conn.execute(text("ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS tags JSON DEFAULT '[]'"))
        conn.commit()


def _ensure_notification_columns() -> None:
    """Backfill the notifications.notification_time display-label column."""
    with sync_engine.connect() as conn:
        if is_sqlite:
            cols = {row[1] for row in conn.execute(text("PRAGMA table_info(notifications)"))}
            if "notifications" not in cols:
                return
            if "notification_time" not in cols:
                conn.execute(text("ALTER TABLE notifications ADD COLUMN notification_time VARCHAR(32)"))
        else:
            conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_time VARCHAR(32)"))
        conn.commit()


def _ensure_eve_schedule_columns() -> None:
    """Backfill Firestore-shaped scheduling fields on eve_schedules."""
    with sync_engine.connect() as conn:
        if is_sqlite:
            cols = {row[1] for row in conn.execute(text("PRAGMA table_info(eve_schedules)"))}
            if "eve_schedules" not in cols:
                return
            if "title" not in cols:
                conn.execute(text("ALTER TABLE eve_schedules ADD COLUMN title VARCHAR(255)"))
            if "schedule_type" not in cols:
                conn.execute(text("ALTER TABLE eve_schedules ADD COLUMN schedule_type VARCHAR(32)"))
            if "execute_at" not in cols:
                conn.execute(text("ALTER TABLE eve_schedules ADD COLUMN execute_at TIMESTAMP WITH TIME ZONE"))
            if "next_run_at" not in cols:
                conn.execute(text("ALTER TABLE eve_schedules ADD COLUMN next_run_at TIMESTAMP WITH TIME ZONE"))
        else:
            conn.execute(text("ALTER TABLE eve_schedules ADD COLUMN IF NOT EXISTS title VARCHAR(255)"))
            conn.execute(text("ALTER TABLE eve_schedules ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(32)"))
            conn.execute(text("ALTER TABLE eve_schedules ADD COLUMN IF NOT EXISTS execute_at TIMESTAMP WITH TIME ZONE"))
            conn.execute(text("ALTER TABLE eve_schedules ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP WITH TIME ZONE"))
        conn.commit()


def _ensure_user_sessions_columns() -> None:
    """Backfill user_sessions columns for multi-device support."""
    with sync_engine.connect() as conn:
        if is_sqlite:
            cols = {row[1] for row in conn.execute(text("PRAGMA table_info(user_sessions)"))}
            if not cols:
                return
            if "device_id" not in cols:
                conn.execute(text("ALTER TABLE user_sessions ADD COLUMN device_id VARCHAR(64)"))
            if "device_name" not in cols:
                conn.execute(text("ALTER TABLE user_sessions ADD COLUMN device_name VARCHAR(255)"))
            if "user_agent" not in cols:
                conn.execute(text("ALTER TABLE user_sessions ADD COLUMN user_agent TEXT"))
            if "ip_address" not in cols:
                conn.execute(text("ALTER TABLE user_sessions ADD COLUMN ip_address VARCHAR(64)"))
            if "token_jti" not in cols:
                conn.execute(text("ALTER TABLE user_sessions ADD COLUMN token_jti VARCHAR(64)"))
            if "expires_at" not in cols:
                conn.execute(text("ALTER TABLE user_sessions ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE"))
            if "revoked" not in cols:
                conn.execute(text("ALTER TABLE user_sessions ADD COLUMN revoked BOOLEAN DEFAULT FALSE"))
            if "revoked_at" not in cols:
                conn.execute(text("ALTER TABLE user_sessions ADD COLUMN revoked_at TIMESTAMP WITH TIME ZONE"))
            if "last_seen_at" not in cols:
                conn.execute(text("ALTER TABLE user_sessions ADD COLUMN last_seen_at TIMESTAMP WITH TIME ZONE"))
        else:
            conn.execute(text("ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device_id VARCHAR(64)"))
            conn.execute(text("ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device_name VARCHAR(255)"))
            conn.execute(text("ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT"))
            conn.execute(text("ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64)"))
            conn.execute(text("ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS token_jti VARCHAR(64)"))
            conn.execute(text("ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE"))
            conn.execute(text("ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS revoked BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE"))
            conn.execute(text("ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE"))
        conn.commit()


def _ensure_performance_indexes() -> None:
    """Create composite indexes for pagination hot paths (lean, e2-micro safe).

    Uses IF NOT EXISTS + CONCURRENTLY avoidance (within transaction) for 1-10 users.
    For larger scale, move to Alembic migration with CONCURRENTLY outside txn.
    """
    if is_sqlite:
        # SQLite: simple indexes; sync_engine already handles it, errors ignored if exists
        stmts = [
            "CREATE INDEX IF NOT EXISTS ix_jobs_user_deleted_created ON jobs(user_id, deleted, created_at DESC, id DESC)",
            "CREATE INDEX IF NOT EXISTS ix_projects_user_deleted_created ON projects(user_id, deleted, created_at DESC, id DESC)",
            "CREATE INDEX IF NOT EXISTS ix_hackathons_user_deleted_created ON hackathons(user_id, deleted, created_at DESC, id DESC)",
            "CREATE INDEX IF NOT EXISTS ix_documents_user_deleted_updated ON documents(user_id, deleted, updated_at DESC, id DESC)",
            "CREATE INDEX IF NOT EXISTS ix_todos_user_deleted_due ON todos(user_id, deleted, due_date, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS ix_contacts_user_deleted_name ON contacts(user_id, deleted, name)",
            "CREATE INDEX IF NOT EXISTS ix_notifications_user_read_created ON notifications(user_id, read, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS ix_calls_status_updated ON calls(status, updated_at) WHERE status='ringing'",
            "CREATE INDEX IF NOT EXISTS ix_whatsapp_messages_user_chat_ts ON whatsapp_messages(user_id, chat_id, timestamp DESC)",
            "CREATE INDEX IF NOT EXISTS ix_calls_participants_created ON calls(caller_id, receiver_id, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS ix_user_sessions_user_created ON user_sessions(user_id, created_at DESC, id DESC)",
            "CREATE INDEX IF NOT EXISTS ix_user_sessions_user_last_seen ON user_sessions(user_id, last_seen_at DESC)",
            "CREATE INDEX IF NOT EXISTS ix_user_sessions_jti ON user_sessions(token_jti)",
            "CREATE INDEX IF NOT EXISTS ix_user_sessions_user_device ON user_sessions(user_id, device_id)",
        ]
        with sync_engine.connect() as conn:
            for stmt in stmts:
                try:
                    conn.execute(text(stmt))
                except Exception:
                    pass
            conn.commit()
        return
    # Postgres: IF NOT EXISTS is safe inside txn for 1-10 users; no CONCURRENTLY needed on small tables
    stmts = [
        "CREATE INDEX IF NOT EXISTS ix_jobs_user_deleted_created ON jobs(user_id, deleted, created_at DESC, id DESC)",
        "CREATE INDEX IF NOT EXISTS ix_projects_user_deleted_created ON projects(user_id, deleted, created_at DESC, id DESC)",
        "CREATE INDEX IF NOT EXISTS ix_hackathons_user_deleted_created ON hackathons(user_id, deleted, created_at DESC, id DESC)",
        "CREATE INDEX IF NOT EXISTS ix_documents_user_deleted_updated ON documents(user_id, deleted, updated_at DESC, id DESC)",
        "CREATE INDEX IF NOT EXISTS ix_todos_user_deleted_due ON todos(user_id, deleted, due_date, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS ix_contacts_user_deleted_name ON contacts(user_id, deleted, name)",
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_read_created ON notifications(user_id, read, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS ix_calls_status_updated ON calls(status, updated_at) WHERE status='ringing'",
        "CREATE INDEX IF NOT EXISTS ix_whatsapp_messages_user_chat_ts ON whatsapp_messages(user_id, chat_id, timestamp DESC)",
        "CREATE INDEX IF NOT EXISTS ix_calls_participants_created ON calls(caller_id, receiver_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS ix_user_sessions_user_created ON user_sessions(user_id, created_at DESC, id DESC)",
        "CREATE INDEX IF NOT EXISTS ix_user_sessions_user_last_seen ON user_sessions(user_id, last_seen_at DESC)",
        "CREATE INDEX IF NOT EXISTS ix_user_sessions_jti ON user_sessions(token_jti)",
        "CREATE INDEX IF NOT EXISTS ix_user_sessions_user_device ON user_sessions(user_id, device_id)",
    ]
    with sync_engine.connect() as conn:
        for stmt in stmts:
            conn.execute(text(stmt))
        conn.commit()
