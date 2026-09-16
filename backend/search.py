import os
from typing import List, Tuple

import psycopg2
from openai import OpenAI

# ----------------------------
# CONFIG
# ----------------------------

# MUST match the model used in embed_sources.py — mixing models silently
# produces meaningless distances.
EMBED_MODEL = "text-embedding-3-small"

# Cosine similarity in [0, 1]; higher is closer. Tune with MIN_SIMILARITY.
MIN_SIMILARITY = float(os.getenv("MIN_SIMILARITY", "0.30"))

client = OpenAI(api_key=(os.getenv("OPENAI_API_KEY") or "").strip() or None)


def get_connection():
    url = os.getenv("DATABASE_URL")
    if url:
        return psycopg2.connect(url)

    return psycopg2.connect(
        dbname=os.getenv("PGDATABASE", "islamic_ai"),
        user=os.getenv("PGUSER", "hamzahnazir"),
        password=os.getenv("PGPASSWORD") or None,
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
    )


def embed_query(query: str) -> str:
    response = client.embeddings.create(model=EMBED_MODEL, input=query)
    vector = response.data[0].embedding
    # pgvector accepts a bracketed literal, not a Python list
    return "[" + ",".join(repr(float(x)) for x in vector) + "]"


SEARCH_SQL = """
SELECT
    s.source_type,
    s.collection,
    s.book_name,
    s.chapter_name,
    COALESCE(s.chapter_number, s.book_number),
    s.verse_or_hadith_number,
    s.text_en,
    1 - (e.embedding <=> %(vector)s::vector) AS similarity
FROM embeddings e
JOIN sources s ON s.id = e.source_id
WHERE e.model = %(model)s
  AND s.text_en IS NOT NULL
ORDER BY e.embedding <=> %(vector)s::vector
LIMIT %(k)s
"""


def semantic_search(query: str, k: int) -> List[Tuple]:
    """
    Nearest-neighbour search over the pgvector embeddings.

    Returns rows shaped exactly as respond.py unpacks them:
        (source_type, collection, book_name, chapter_name,
         chapter_number, verse_or_hadith_number, text_en, similarity)

    Returns [] on any failure so the caller falls back to a general
    answer instead of surfacing a 500.
    """
    query = (query or "").strip()
    if not query:
        return []

    try:
        vector = embed_query(query)
    except Exception as exc:
        print(f"[search] embedding failed: {exc}")
        return []

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    SEARCH_SQL,
                    {"vector": vector, "model": EMBED_MODEL, "k": k},
                )
                rows = cur.fetchall()
    except Exception as exc:
        print(f"[search] query failed: {exc}")
        return []

    return [r for r in rows if r[-1] >= MIN_SIMILARITY]
