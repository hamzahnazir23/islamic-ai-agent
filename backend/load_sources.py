import json
import os
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_batch

# Paths are resolved against the repo root, not the current directory,
# so the script runs correctly from anywhere.
REPO_ROOT = Path(__file__).resolve().parent.parent

DATASETS = [
    REPO_ROOT / "data/processed/quran/quran-ar-en.json",
    REPO_ROOT / "data/processed/bukhari/bukhari-sources.json",
    REPO_ROOT / "data/processed/muslim/muslim-sources.json",
]

BATCH_SIZE = 500


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


# ON CONFLICT makes re-runs idempotent and stops one duplicate from
# aborting the whole transaction.
INSERT_SQL = """
INSERT INTO sources (
    source_type,
    collection,
    book_name,
    book_number,
    chapter_name,
    chapter_number,
    verse_or_hadith_number,
    text_ar,
    text_en,
    authenticity,
    language_pair
) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
ON CONFLICT (source_type, book_number, chapter_number, verse_or_hadith_number)
DO NOTHING;
"""


def to_row(r):
    chapter_number = r.get("chapter_number")

    # The Qur'an converter emits the surah as book_number and leaves
    # chapter_number unset. The unique constraint treats NULLs as
    # distinct, so leaving it NULL both breaks de-duplication and makes
    # citations render as "Qur'an None:153".
    if r["source_type"] == "quran" and chapter_number is None:
        chapter_number = r.get("book_number")

    return (
        r["source_type"],
        r["collection"],
        r.get("book_name"),
        r.get("book_number"),
        r.get("chapter_name"),
        chapter_number,
        r.get("verse_or_hadith_number"),
        r["text_ar"],
        r["text_en"],
        r.get("authenticity"),
        r["language_pair"],
    )


def main():
    conn = get_connection()
    cur = conn.cursor()

    for dataset in DATASETS:
        if not dataset.exists():
            print(f"⚠️  missing dataset: {dataset}")
            continue

        with open(dataset, "r", encoding="utf-8") as f:
            records = json.load(f)

        cur.execute("SELECT count(*) FROM sources")
        before = cur.fetchone()[0]

        rows = [to_row(r) for r in records]
        for i in range(0, len(rows), BATCH_SIZE):
            execute_batch(cur, INSERT_SQL, rows[i:i + BATCH_SIZE])
        conn.commit()

        cur.execute("SELECT count(*) FROM sources")
        inserted = cur.fetchone()[0] - before

        print(
            f"{dataset.name}: {len(records)} records → "
            f"{inserted} inserted, {len(records) - inserted} already present"
        )

    cur.close()
    conn.close()
    print("✅ Load complete")


if __name__ == "__main__":
    main()
