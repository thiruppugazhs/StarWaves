-- ============================================================================
-- Starwaves · Database indexes (PostgreSQL 16)
--
-- Run order: extensions.sql -> schema.sql -> migrations.sql -> indexes.sql
-- All statements are idempotent (IF NOT EXISTS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Model-level indexes (server/app/models/__init__.py)
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email);

CREATE INDEX IF NOT EXISTS ix_jobs_user_id ON jobs (user_id);
CREATE INDEX IF NOT EXISTS ix_projects_user_id ON projects (user_id);
CREATE INDEX IF NOT EXISTS ix_hackathons_user_id ON hackathons (user_id);
CREATE INDEX IF NOT EXISTS ix_todos_user_id ON todos (user_id);
CREATE INDEX IF NOT EXISTS ix_documents_user_id ON documents (user_id);
CREATE INDEX IF NOT EXISTS ix_contacts_user_id ON contacts (user_id);
CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS ix_eve_memories_user_id ON eve_memories (user_id);
CREATE INDEX IF NOT EXISTS ix_eve_schedules_user_id ON eve_schedules (user_id);
CREATE INDEX IF NOT EXISTS ix_eve_sessions_user_id ON eve_sessions (user_id);
CREATE INDEX IF NOT EXISTS ix_user_settings_user_id ON user_settings (user_id);
CREATE INDEX IF NOT EXISTS ix_workspace_files_user_id ON workspace_files (user_id);
CREATE INDEX IF NOT EXISTS ix_whatsapp_chats_user_id ON whatsapp_chats (user_id);
CREATE INDEX IF NOT EXISTS ix_whatsapp_messages_user_id ON whatsapp_messages (user_id);

CREATE INDEX IF NOT EXISTS ix_calls_caller_id ON calls (caller_id);
CREATE INDEX IF NOT EXISTS ix_calls_receiver_id ON calls (receiver_id);

CREATE INDEX IF NOT EXISTS ix_whatsapp_messages_chat_id ON whatsapp_messages (chat_id);
CREATE INDEX IF NOT EXISTS ix_whatsapp_messages_timestamp ON whatsapp_messages (timestamp);
CREATE INDEX IF NOT EXISTS ix_whatsapp_messages_chat_ts ON whatsapp_messages (chat_id, timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS ix_user_settings_user_cat ON user_settings (user_id, category);
CREATE UNIQUE INDEX IF NOT EXISTS ix_workspace_files_user_path ON workspace_files (user_id, path);

-- ---------------------------------------------------------------------------
-- Performance composite indexes for pagination hot paths
-- (server/app/db/session.py -> _ensure_performance_indexes)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_jobs_user_deleted_created ON jobs(user_id, deleted, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_projects_user_deleted_created ON projects(user_id, deleted, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_hackathons_user_deleted_created ON hackathons(user_id, deleted, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_documents_user_deleted_updated ON documents(user_id, deleted, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_todos_user_deleted_due ON todos(user_id, deleted, due_date, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_contacts_user_deleted_name ON contacts(user_id, deleted, name);
CREATE INDEX IF NOT EXISTS ix_notifications_user_read_created ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_calls_status_updated ON calls(status, updated_at) WHERE status='ringing';
CREATE INDEX IF NOT EXISTS ix_whatsapp_messages_user_chat_ts ON whatsapp_messages(user_id, chat_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS ix_calls_participants_created ON calls(caller_id, receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_user_sessions_user_created ON user_sessions(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_user_sessions_user_last_seen ON user_sessions(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS ix_user_sessions_jti ON user_sessions(token_jti);
CREATE INDEX IF NOT EXISTS ix_user_sessions_user_device ON user_sessions(user_id, device_id);

-- ---------------------------------------------------------------------------
-- pgvector semantic recall index
-- (server/app/db/session.py -> _ensure_eve_memory_embedding; requires the
--  vector extension from extensions.sql. HNSW preferred, ivfflat fallback.)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_eve_memories_embedding ON eve_memories USING hnsw (embedding vector_cosine_ops);
-- Fallback if HNSW is unavailable:
-- CREATE INDEX IF NOT EXISTS ix_eve_memories_embedding ON eve_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
