-- AALIM corpus schema
--
-- Idempotent: safe to run against an empty or an existing database.
-- Apply with:  psql "$DATABASE_URL" -f backend/db/schema.sql

CREATE EXTENSION IF NOT EXISTS vector;

-- Qur'an ayat and hadith, one row per citable unit.
--
-- The Qur'an converter stores the surah in book_number; chapter_number is
-- populated to match so that citations render and the unique constraint
-- below actually de-duplicates. See load_sources.to_row().
CREATE TABLE IF NOT EXISTS sources (
    id                     bigserial PRIMARY KEY,
    source_type            text NOT NULL,
    collection             text NOT NULL,
    book_name              text,
    book_number            integer,
    chapter_name           text,
    chapter_number         integer,
    verse_or_hadith_number integer,
    text_ar                text NOT NULL,
    text_en                text,
    authenticity           text,
    language_pair          text,
    created_at             timestamp without time zone DEFAULT now()
);

-- This is a plain UNIQUE, so NULLs compare as distinct. Every column in
-- the key must be populated or ON CONFLICT silently fails to match and
-- re-running the loader duplicates rows.
ALTER TABLE sources DROP CONSTRAINT IF EXISTS unique_source_entry;
ALTER TABLE sources ADD CONSTRAINT unique_source_entry
    UNIQUE (source_type, book_number, chapter_number, verse_or_hadith_number);

CREATE TABLE IF NOT EXISTS embeddings (
    id         bigserial PRIMARY KEY,
    source_id  bigint REFERENCES sources(id) ON DELETE CASCADE,
    embedding  vector(1536),
    model      text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);

-- embed_sources.py finds unembedded rows via this join; without an index
-- on source_id that is a sequential scan of the whole table per run.
CREATE INDEX IF NOT EXISTS embeddings_source_id_idx ON embeddings (source_id);

-- search.py orders by cosine distance (<=>), so the opclass must be
-- vector_cosine_ops. Without this index the search is a sequential scan
-- over every embedding: ~130ms at 20k rows, and linear from there.
CREATE INDEX IF NOT EXISTS embeddings_embedding_hnsw_idx
    ON embeddings USING hnsw (embedding vector_cosine_ops);
