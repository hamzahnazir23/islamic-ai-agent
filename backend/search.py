import psycopg2
from openai import OpenAI

DB_NAME = "islamic_ai"
DB_USER = "hamzahnazir"
DB_HOST = "localhost"
DB_PORT = 5432

EMBED_MODEL = "text-embedding-3-small"

client = OpenAI()

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
        input=text
    )
    return res.data[0].embedding

def semantic_search(query: str, k: int = 5):
    query_vec = embed_query(query)

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            s.collection,
            s.book_name,
            s.chapter_name,
            s.verse_or_hadith_number,
            s.text_en,
            1 - (e.embedding <=> %s::vector) AS similarity
        FROM embeddings e
        JOIN sources s ON s.id = e.source_id
        ORDER BY e.embedding <=> %s::vector
        LIMIT %s
        """,
        (query_vec, query_vec, k)
    )

    rows = cur.fetchall()
    conn.close()
    return rows

if __name__ == "__main__":
    results = semantic_search(
        "What does Islam say about patience?",
        5
    )
    for r in results:
        print(r)