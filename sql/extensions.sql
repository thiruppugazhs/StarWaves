-- ============================================================================
-- Starwaves · PostgreSQL extensions
-- Run FIRST (requires superuser on first run; the pgvector/pgvector image
-- ships the extension preinstalled).
--
-- Source of truth: server/app/db/session.py -> _ensure_eve_memory_embedding
-- Dialect: PostgreSQL 16 (docker-compose: pgvector/pgvector:0.8.0-pg16)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
