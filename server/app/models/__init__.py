"""SQLAlchemy Declarative Models for Starwaves."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

try:
    from pgvector.sqlalchemy import Vector  # type: ignore
except Exception:  # fallback for sqlite tests without pgvector
    Vector = None  # type: ignore

from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=True)
    display_name = Column(String(255), nullable=True)
    avatar_url = Column(Text, nullable=True)
    password_hash = Column(String(255), nullable=True)
    password_salt = Column(String(255), nullable=True)
    google_auth = Column(JSON, nullable=True)
    combined_accounts = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    jobs = relationship("Job", back_populates="user", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    hackathons = relationship("Hackathon", back_populates="user", cascade="all, delete-orphan")
    todos = relationship("Todo", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    contacts = relationship("Contact", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    eve_sessions = relationship("EveSession", back_populates="user", cascade="all, delete-orphan")
    eve_memories = relationship("EveMemory", back_populates="user", cascade="all, delete-orphan")
    eve_schedules = relationship("EveSchedule", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSetting", back_populates="user", cascade="all, delete-orphan")
    user_sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    company = Column(String(255), nullable=False)
    role = Column(String(255), nullable=False)
    status = Column(String(64), default="Applied", nullable=False)
    location = Column(String(255), nullable=True)
    work_type = Column(String(64), nullable=True)
    salary = Column(String(128), nullable=True)
    applied_date = Column(String(64), nullable=True)
    resume_id = Column(String(64), nullable=True)
    job_url = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="jobs")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(64), default="Planning", nullable=False)
    progress = Column(Integer, default=0, nullable=False)
    members = Column(Integer, default=1, nullable=False)
    technologies = Column(JSON, default=list, nullable=False)
    lifecycle_phase = Column(String(64), default="idea", nullable=False)
    deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="projects")


class Hackathon(Base):
    __tablename__ = "hackathons"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    organizer = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    dates = Column(String(255), nullable=True)
    prize = Column(String(128), nullable=True)
    status = Column(String(64), default="Registered", nullable=False)
    hackathon_url = Column(Text, nullable=True)
    source = Column(String(128), nullable=True)
    notes = Column(Text, nullable=True)
    # Structured schedule/details persisted since the SQL migration (required by
    # HackathonResponse; previously dropped silently on write).
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    mode = Column(String(64), nullable=True)
    team_size = Column(String(32), nullable=True)
    tags = Column(JSON, default=list, nullable=False)
    deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="hackathons")


class Todo(Base):
    __tablename__ = "todos"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    due_date = Column(String(64), nullable=True)
    priority = Column(String(32), default="medium", nullable=False)
    deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="todos")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, default="", nullable=False)
    folder = Column(String(255), default="General", nullable=False)
    tags = Column(JSON, default=list, nullable=False)
    # Drive/document metadata persisted since the SQL migration (previously
    # dropped silently when coming from the schema-shaped DocumentUpsert).
    url = Column(Text, nullable=True)
    doc_type = Column(String(80), nullable=True)
    size_label = Column(String(80), nullable=True)
    drive_file_id = Column(String(255), nullable=True)
    deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="documents")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(64), nullable=True)
    role = Column(String(128), nullable=True)
    company = Column(String(128), nullable=True)
    notes = Column(Text, nullable=True)
    deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="contacts")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    type = Column(String(64), default="system", nullable=False)
    read = Column(Boolean, default=False, nullable=False)
    data = Column(JSON, default=dict, nullable=False)
    # Display timestamp label (e.g. "3:45 PM") persisted from Firestore-shaped docs
    notification_time = Column(String(32), name="notification_time", nullable=True)
    deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="notifications")


class Call(Base):
    __tablename__ = "calls"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    caller_id = Column(String(64), index=True, nullable=False)
    receiver_id = Column(String(64), index=True, nullable=False)
    status = Column(String(64), default="initiated", nullable=False)  # initiated, ringing, accepted, declined, ended
    call_type = Column(String(32), default="voice", nullable=False)    # voice, video
    provider = Column(String(32), default="in_app", nullable=False)    # in_app, twilio
    external_sid = Column(String(64), nullable=True, index=True)       # Twilio SID when provider=twilio
    phone_number = Column(String(32), nullable=True)                    # PSTN E.164 when provider=twilio
    duration = Column(Integer, default=0, nullable=False)
    messages = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class EveSession(Base):
    __tablename__ = "eve_sessions"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String(255), default="New chat", nullable=False)
    messages = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="eve_sessions")


class EveMemory(Base):
    __tablename__ = "eve_memories"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    content = Column(Text, nullable=False)
    # pgvector 1536-dim (text-embedding-3-small) for semantic recall; falls back to JSON on SQLite/tests
    embedding = Column(Vector(1536) if Vector else JSON, nullable=True)  # type: ignore
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="eve_memories")


class EveSchedule(Base):
    __tablename__ = "eve_schedules"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    action_type = Column(String(64), default="prompt", nullable=False)  # prompt, voice_call
    cron_expression = Column(String(128), nullable=True)
    scheduled_time = Column(DateTime(timezone=True), nullable=True)
    prompt = Column(Text, nullable=True)
    # Firestore-shaped scheduling fields persisted since the SQL migration
    title = Column(String(255), nullable=True)
    schedule_type = Column(String(32), nullable=True)  # one_time, recurring
    execute_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="eve_schedules")


class UserSetting(Base):
    __tablename__ = "user_settings"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    category = Column(String(128), nullable=False)  # e.g., "ai-models", "eve-speech", "github", "google"
    settings = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        Index("ix_user_settings_user_cat", "user_id", "category", unique=True),
    )

    user = relationship("User", back_populates="settings")


class WorkspaceFile(Base):
    __tablename__ = "workspace_files"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    path = Column(String(1024), nullable=False)
    content = Column(Text, default="", nullable=False)
    is_directory = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        Index("ix_workspace_files_user_path", "user_id", "path", unique=True),
    )


class WhatsAppChat(Base):
    __tablename__ = "whatsapp_chats"

    id = Column(String(128), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    phone_number = Column(String(64), nullable=True)
    avatar_url = Column(Text, nullable=True)
    is_group = Column(Boolean, default=False, nullable=False)
    participants = Column(JSON, default=list, nullable=True)
    description = Column(Text, nullable=True)
    unread_count = Column(Integer, default=0, nullable=False)
    last_message = Column(JSON, nullable=True)
    is_pinned = Column(Boolean, default=False, nullable=False)
    is_muted = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    eve_auto_reply = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id = Column(String(128), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    chat_id = Column(String(128), index=True, nullable=False)
    sender_id = Column(String(128), nullable=False)
    sender_name = Column(String(255), nullable=True)
    is_from_me = Column(Boolean, default=False, nullable=False)
    is_eve = Column(Boolean, default=False, nullable=False)
    content = Column(Text, default="", nullable=False)
    timestamp = Column(DateTime(timezone=True), index=True, nullable=False)
    status = Column(String(64), default="delivered", nullable=False)
    media = Column(JSON, nullable=True)
    reply_to_message_id = Column(String(128), nullable=True)
    reactions = Column(JSON, default=list, nullable=True)
    is_forwarded = Column(Boolean, default=False, nullable=False)
    is_starred = Column(Boolean, default=False, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    sender_avatar_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        Index("ix_whatsapp_messages_chat_ts", "chat_id", "timestamp"),
    )


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    device_id = Column(String(64), nullable=False)
    device_name = Column(String(255), default="Unknown device", nullable=False)
    user_agent = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)
    token_jti = Column(String(64), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    last_seen_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="user_sessions")

    __table_args__ = (
        Index("ix_user_sessions_user_created", "user_id", "created_at", "id"),
        Index("ix_user_sessions_user_last_seen", "user_id", "last_seen_at"),
        Index("ix_user_sessions_jti", "token_jti", unique=True),
        Index("ix_user_sessions_user_device", "user_id", "device_id"),
    )


class AiUsage(Base):
    __tablename__ = "ai_usage"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    provider = Column(String(64), nullable=False)
    model = Column(String(128), nullable=False)
    kind = Column(String(32), default="chat", nullable=False)
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    user = relationship("User")

    __table_args__ = (
        Index("ix_ai_usage_user_created", "user_id", "created_at"),
        Index("ix_ai_usage_provider_model", "provider", "model"),
    )

