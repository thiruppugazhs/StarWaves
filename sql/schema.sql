-- ============================================================================
-- Starwaves · Database schema (PostgreSQL 16)
--
-- Mirror of the SQLAlchemy declarative models in
-- server/app/models/__init__.py (Base.metadata.create_all).
--
-- Run order: extensions.sql -> schema.sql -> migrations.sql -> indexes.sql
-- (every statement is idempotent; safe on fresh and existing databases)
--
-- Notes:
-- - Primary-key UUIDs and created_at/updated_at timestamps are Python-side
--   defaults applied by SQLAlchemy on INSERT, so no DEFAULT clauses appear.
-- - Server-side defaults added by init_db backfills live in migrations.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
	id VARCHAR(64) NOT NULL,
	email VARCHAR(255) NOT NULL,
	name VARCHAR(255),
	display_name VARCHAR(255),
	avatar_url TEXT,
	password_hash VARCHAR(255),
	password_salt VARCHAR(255),
	google_auth JSON,
	combined_accounts JSON NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS jobs (
	id VARCHAR(64) NOT NULL,
	user_id VARCHAR(64) NOT NULL,
	company VARCHAR(255) NOT NULL,
	role VARCHAR(255) NOT NULL,
	status VARCHAR(64) NOT NULL,
	location VARCHAR(255),
	work_type VARCHAR(64),
	salary VARCHAR(128),
	applied_date VARCHAR(64),
	resume_id VARCHAR(64),
	job_url TEXT,
	notes TEXT,
	deleted BOOLEAN NOT NULL,
	deleted_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
	id VARCHAR(64) NOT NULL,
	user_id VARCHAR(64) NOT NULL,
	name VARCHAR(255) NOT NULL,
	description TEXT,
	status VARCHAR(64) NOT NULL,
	progress INTEGER NOT NULL,
	members INTEGER NOT NULL,
	technologies JSON NOT NULL,
	lifecycle_phase VARCHAR(64) NOT NULL,
	deleted BOOLEAN NOT NULL,
	deleted_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hackathons (
	id VARCHAR(64) NOT NULL,
	user_id VARCHAR(64) NOT NULL,
	title VARCHAR(255) NOT NULL,
	organizer VARCHAR(255),
	location VARCHAR(255),
	dates VARCHAR(255),
	prize VARCHAR(128),
	status VARCHAR(64) NOT NULL,
	hackathon_url TEXT,
	source VARCHAR(128),
	notes TEXT,
	starts_at TIMESTAMP WITH TIME ZONE,
	ends_at TIMESTAMP WITH TIME ZONE,
	mode VARCHAR(64),
	team_size VARCHAR(32),
	tags JSON DEFAULT '[]',
	deleted BOOLEAN NOT NULL,
	deleted_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS todos (
	id VARCHAR(64) NOT NULL,
	user_id VARCHAR(64) NOT NULL,
	title VARCHAR(255) NOT NULL,
	completed BOOLEAN NOT NULL,
	due_date VARCHAR(64),
	priority VARCHAR(32) NOT NULL,
	deleted BOOLEAN NOT NULL,
	deleted_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
	id VARCHAR(64) NOT NULL,
	user_id VARCHAR(64) NOT NULL,
	title VARCHAR(255) NOT NULL,
	content TEXT NOT NULL,
	folder VARCHAR(255) NOT NULL,
	tags JSON NOT NULL,
	url TEXT,
	doc_type VARCHAR(80),
	size_label VARCHAR(80),
	drive_file_id VARCHAR(255),
	deleted BOOLEAN NOT NULL,
	deleted_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contacts (
	id VARCHAR(64) NOT NULL,
	user_id VARCHAR(64) NOT NULL,
	name VARCHAR(255) NOT NULL,
	email VARCHAR(255),
	phone VARCHAR(64),
	role VARCHAR(128),
	company VARCHAR(128),
	notes TEXT,
	deleted BOOLEAN NOT NULL,
	deleted_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
	id VARCHAR(64) NOT NULL,
	user_id VARCHAR(64) NOT NULL,
	title VARCHAR(255) NOT NULL,
	body TEXT NOT NULL,
	type VARCHAR(64) NOT NULL,
	read BOOLEAN NOT NULL,
	data JSON NOT NULL,
	deleted BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calls (
	id VARCHAR(64) NOT NULL,
	caller_id VARCHAR(64) NOT NULL,
	receiver_id VARCHAR(64) NOT NULL,
	status VARCHAR(64) NOT NULL,
	call_type VARCHAR(32) NOT NULL,
	duration INTEGER NOT NULL,
	messages JSON NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS eve_sessions (
	id VARCHAR(64) NOT NULL,
	user_id VARCHAR(64) NOT NULL,
	title VARCHAR(255) NOT NULL,
	messages JSON NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS eve_memories (
	id VARCHAR(64) NOT NULL,
	user_id VARCHAR(64) NOT NULL,
	content TEXT NOT NULL,
	embedding VECTOR(1536),
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS eve_schedules (
	id VARCHAR(64) NOT NULL,
	user_id VARCHAR(64) NOT NULL,
	action_type VARCHAR(64) NOT NULL,
	cron_expression VARCHAR(128),
	scheduled_time TIMESTAMP WITH TIME ZONE,
	prompt TEXT,
	title VARCHAR(255),
	schedule_type VARCHAR(32),
	execute_at TIMESTAMP WITH TIME ZONE,
	next_run_at TIMESTAMP WITH TIME ZONE,
	enabled BOOLEAN NOT NULL,
	last_run_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_settings (
	id VARCHAR(64) NOT NULL,
	user_id VARCHAR(64) NOT NULL,
	category VARCHAR(128) NOT NULL,
	settings JSON NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workspace_files (
	id VARCHAR(64) NOT NULL,
	user_id VARCHAR(64) NOT NULL,
	path VARCHAR(1024) NOT NULL,
	content TEXT NOT NULL,
	is_directory BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS whatsapp_chats (
	id VARCHAR(128) NOT NULL,
	user_id VARCHAR(64) NOT NULL,
	name VARCHAR(255) NOT NULL,
	phone_number VARCHAR(64),
	avatar_url TEXT,
	is_group BOOLEAN NOT NULL,
	participants JSON,
	description TEXT,
	unread_count INTEGER NOT NULL,
	last_message JSON,
	is_pinned BOOLEAN NOT NULL,
	is_muted BOOLEAN NOT NULL,
	is_archived BOOLEAN NOT NULL,
	eve_auto_reply BOOLEAN NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
	id VARCHAR(128) NOT NULL,
	user_id VARCHAR(64) NOT NULL,
	chat_id VARCHAR(128) NOT NULL,
	sender_id VARCHAR(128) NOT NULL,
	sender_name VARCHAR(255),
	is_from_me BOOLEAN NOT NULL,
	is_eve BOOLEAN NOT NULL,
	content TEXT NOT NULL,
	timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
	status VARCHAR(64) NOT NULL,
	media JSON,
	reply_to_message_id VARCHAR(128),
	reactions JSON,
	is_forwarded BOOLEAN NOT NULL,
	is_starred BOOLEAN NOT NULL,
	is_pinned BOOLEAN NOT NULL,
	sender_avatar_url TEXT,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_sessions (
	id VARCHAR(64) NOT NULL PRIMARY KEY,
	user_id VARCHAR(64) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	device_id VARCHAR(64) NOT NULL,
	device_name VARCHAR(255) NOT NULL,
	user_agent TEXT,
	ip_address VARCHAR(64),
	token_jti VARCHAR(64) NOT NULL UNIQUE,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	revoked BOOLEAN NOT NULL DEFAULT FALSE,
	revoked_at TIMESTAMP WITH TIME ZONE,
	last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_usage (
	id VARCHAR(64) NOT NULL PRIMARY KEY,
	user_id VARCHAR(64) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	provider VARCHAR(64) NOT NULL,
	model VARCHAR(128) NOT NULL,
	kind VARCHAR(32) NOT NULL DEFAULT 'chat',
	prompt_tokens INTEGER NOT NULL DEFAULT 0,
	completion_tokens INTEGER NOT NULL DEFAULT 0,
	total_tokens INTEGER NOT NULL DEFAULT 0,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
