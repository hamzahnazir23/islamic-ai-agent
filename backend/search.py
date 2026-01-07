import os
import psycopg2
from openai import OpenAI

DB_NAME = "islamic_ai"
DB_USER = "hamzahnazir"
DB_HOST = "localhost"
DB_PORT = 5432

EMBED_MODEL = "text-embedding-3-small"  # 1536 dims
TOP_K = 5

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def get_connection():
    return psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        host=DB_HOST,
        port=DB_PORT,
    )


def embed_query(text: str):
    res = client.embeddings.create(
        model=EMBED_MODEL,
        input=text,
    )
    return res.data[0].embedding


def semantic_search(query: str, k: int = TOP_K):
    query_vec = embed_query(query)

    sql = """
    SELECT DISTINCT ON (
        s.source_type,
        s.chapter_number,
        s.verse_or_hadith_number
    )
        s.source_type,
        s.collection,
        s.book_name,
        s.chapter_name,
        s.chapter_number,
        s.verse_or_hadith_number,
        s.text_en,
        1 - (e.embedding <=> %s::vector) AS similarity
    FROM embeddings e
    JOIN sources s ON s.id = e.source_id
    ORDER BY
        s.source_type,
        s.chapter_number,
        s.verse_or_hadith_number,
        e.embedding <=> %s::vector
    LIMIT %s;
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (query_vec, query_vec, k))
            return cur.fetchall()


if __name__ == "__main__":
    results = semantic_search("What does Islam say about patience?", 5)
    for r in results:
        print(r)