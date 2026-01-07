import os
import psycopg2
from psycopg2.extras import execute_batch
from openai import OpenAI

# ---- CONFIG ----
DB_NAME = "islamic_ai"
DB_USER = "hamzahnazir"
DB_HOST = "localhost"
DB_PORT = 5432

EMBED_MODEL = "text-embedding-3-small"
BATCH_SIZE = 100
VECTOR_DIM = 1536  # MUST match pgvector column
# ----------------

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_connection():
    return psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        host=DB_HOST,
        port=DB_PORT,
    )

def embed_texts(texts):
    response = client.embeddings.create(
        model=EMBED_MODEL,
        input=texts,
    )
    # Truncate to match VECTOR(1536)
    return [e.embedding[:VECTOR_DIM] for e in response.data]

def main():
    conn = get_connection()
    cur = conn.cursor()

    # Fetch sources that are NOT embedded yet
    cur.execute("""
        SELECT s.id, s.text_en
        FROM sources s
        LEFT JOIN embeddings e ON e.source_id = s.id
        WHERE e.source_id IS NULL
          AND s.text_en IS NOT NULL
        ORDER BY s.id
    """)

    rows = cur.fetchall()
    total = len(rows)

    if total == 0:
        print("✅ No new sources to embed")
        return

    print(f"Embedding {total} sources…")

    for i in range(0, total, BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        ids = [r[0] for r in batch]
        texts = [r[1] for r in batch]

        vectors = embed_texts(texts)

        records = [
            (sid, vec, EMBED_MODEL)
            for sid, vec in zip(ids, vectors)
        ]

        execute_batch(
            cur,
            """
            INSERT INTO embeddings (source_id, embedding, model)
            VALUES (%s, %s, %s)
            """,
            records,
        )

        conn.commit()
        print(f"Embedded {min(i + BATCH_SIZE, total)} / {total}")

    cur.close()
    conn.close()
    print("✅ Embedding complete")

if __name__ == "__main__":
    main()