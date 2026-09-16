-- Migration 002: accounts, sessions, and per-user conversation history.
--
-- Idempotent. Apply with:
--   psql "$DATABASE_URL" -f backend/db/migrations/002_auth_and_chat.sql
--
-- Nothing here touches `sources` or `embeddings`. Conversations that
-- predate this migration were never persisted server-side (chat history
-- lived in React state only), so there is no prior data to assign and no
-- backfill is performed. Existing corpus rows are untouched.

CREATE TABLE IF NOT EXISTS users (
    id            bigserial PRIMARY KEY,
    email         text NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- Email is stored lowercased by the application; the functional index
-- makes that a database-level guarantee so a race between two concurrent
-- registrations cannot create duplicate accounts.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

-- The cookie carries a random token; only its SHA-256 hash is stored, so
-- a database leak does not hand over live sessions.
CREATE TABLE IF NOT EXISTS sessions (
    token_hash   text PRIMARY KEY,
    user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS conversations (
    id         bigserial PRIMARY KEY,
    user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      text NOT NULL DEFAULT 'New conversation',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Every conversation read is scoped by user_id, so the index leads with it.
CREATE INDEX IF NOT EXISTS conversations_user_updated_idx
    ON conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
    id              bigserial PRIMARY KEY,
    conversation_id bigint NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            text NOT NULL CHECK (role IN ('user', 'assistant')),
    content         text NOT NULL,
    status          text,
    sources         jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx
    ON messages (conversation_id, id);
