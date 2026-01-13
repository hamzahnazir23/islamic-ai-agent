import os
import psycopg2
from openai import OpenAI

# ----------------------------
# Database config
# ----------------------------
DB_NAME = "islamic_ai"
DB_USER = "hamzahnazir"
DB_HOST = "localhost"
DB_PORT = 5432

# ----------------------------
# Embedding config
# ----------------------------
EMBED_MODEL = "text-embedding-3-small"  # 1536 dims
TOP_K = 5

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# ----------------------------
# DB connection
# ----------------------------
def get_connection():
    return psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        host=DB_HOST,
        port=DB_PORT,
    )


# ----------------------------
# Embed query
# ----------------------------
def embed_query(text: str):
    response = client.embeddings.create(
        model=EMBED_MODEL,
        input=text,
    )
    return response.data[0].embedding


# ----------------------------
# Semantic search
# ----------------------------
def semantic_search(query: str, k: int = TOP_K):
    query_vec = embed_query(query)

    sql = """
    SELECT
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
    ORDER BY e.embedding <=> %s::vector
    LIMIT %s;
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (query_vec, query_vec, k))
            return cur.fetchall()


# ----------------------------
# Local sanity test
# ----------------------------
if __name__ == "__main__":
    results = semantic_search("What does Islam say about patience?", 5)

    for r in results:
        print("SOURCE TYPE:", r[0])
        print("REFERENCE:", f"{r[4]}:{r[5]}")
        print("TEXT:", r[6][:120], "...")
        print("SIMILARITY:", round(r[7], 4))
        print("-" * 40)