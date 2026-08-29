-- ============================================================================
-- Starwaves · Idempotent migrations for pre-existing deployments
--
-- The project has no Alembic migrations; init_db (server/app/db/session.py)
-- backfills columns on databases created before these columns existed.
-- create_all only creates missing tables, so existing tables need ALTERs.
--
-- Run order: extensions.sql -> schema.sql -> migrations.sql -> indexes.sql
-- Every statement is idempotent; fresh databases may skip this file.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- calls.messages (Firestore-shaped call transcript documents)
-- ---------------------------------------------------------------------------

ALTER TABLE calls ADD COLUMN IF NOT EXISTS messages JSON NOT NULL DEFAULT '[]';

-- ---------------------------------------------------------------------------
-- whatsapp_messages backfills
-- ---------------------------------------------------------------------------

ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sender_avatar_url TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS reactions JSON DEFAULT '[]';
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN DEFAULT FALSE;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- whatsapp_chats backfills
-- ---------------------------------------------------------------------------

ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS participants JSON DEFAULT '[]';
ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;
ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS last_message JSON;
ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT FALSE;
ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE whatsapp_chats ADD COLUMN IF NOT EXISTS eve_auto_reply BOOLEAN DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- eve_memories embedding column (pgvector 1536-dim, text-embedding-3-small)
-- ---------------------------------------------------------------------------

ALTER TABLE eve_memories ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- ---------------------------------------------------------------------------
-- documents metadata backfills (persist url/type/size/drive id from schema)
-- ---------------------------------------------------------------------------

ALTER TABLE documents ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type VARCHAR(80) DEFAULT 'FILE';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS size_label VARCHAR(80) DEFAULT 'Unknown';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(255);

-- ---------------------------------------------------------------------------
-- hackathons structured schedule/details backfills
-- ---------------------------------------------------------------------------

ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS mode VARCHAR(64);
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS team_size VARCHAR(32);
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS tags JSON DEFAULT '[]';

-- ---------------------------------------------------------------------------
-- notifications display-time backfill
-- ---------------------------------------------------------------------------

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_time VARCHAR(32);

-- ---------------------------------------------------------------------------
-- eve_schedules Firestore-shaped scheduling backfills
-- ---------------------------------------------------------------------------

ALTER TABLE eve_schedules ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE eve_schedules ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(32);
ALTER TABLE eve_schedules ADD COLUMN IF NOT EXISTS execute_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE eve_schedules ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP WITH TIME ZONE;

-- ---------------------------------------------------------------------------
-- user_sessions (multi-device) backfills — mirrors sql/schema.sql + models
-- ---------------------------------------------------------------------------

ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device_id VARCHAR(64);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device_name VARCHAR(255);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS token_jti VARCHAR(64);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS revoked BOOLEAN DEFAULT FALSE;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;

-- ---------------------------------------------------------------------------
-- Row-Level Security (RLS) — defense-in-depth for multi-tenant isolation
-- Requires app to SET LOCAL app.current_user_id = '<uid>' per request.
-- See server/app/db/session.py get_session().
-- ---------------------------------------------------------------------------

-- Enable RLS on user-scoped tables (idempotent via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_isolation_todos') THEN
    ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
    CREATE POLICY user_isolation_todos ON todos USING (user_id = current_setting('app.current_user_id', true)) WITH CHECK (user_id = current_setting('app.current_user_id', true));
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_isolation_projects') THEN
    ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY user_isolation_projects ON projects USING (user_id = current_setting('app.current_user_id', true)) WITH CHECK (user_id = current_setting('app.current_user_id', true));
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_isolation_documents') THEN
    ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
    CREATE POLICY user_isolation_documents ON documents USING (user_id = current_setting('app.current_user_id', true)) WITH CHECK (user_id = current_setting('app.current_user_id', true));
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Least-privilege application role (idempotent)
-- Run manually: CREATE USER starwaves_app WITH PASSWORD '...'; then use DATABASE_URL with starwaves_app
-- Grants below allow the app to work without superuser.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'starwaves_app') THEN
    CREATE ROLE starwaves_app LOGIN;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
GRANT USAGE ON SCHEMA public TO starwaves_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO starwaves_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO starwaves_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO starwaves_app;
