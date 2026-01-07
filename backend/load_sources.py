import json
import psycopg2
from pathlib import Path

DATASETS = [
    Path("data/processed/quran/quran-ar-en.json"),
    Path("data/processed/bukhari/bukhari-sources.json"),
    Path("data/processed/muslim/muslim-sources.json"),
]

conn = psycopg2.connect(
    dbname="islamic_ai",
    user="hamzahnazir",
    password="ZNSMHNBNON2021",
    host="localhost",
    port=5432,
)

cur = conn.cursor()

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
) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s);
"""

for dataset in DATASETS:
    with open(dataset, "r", encoding="utf-8") as f:
        records = json.load(f)

    for r in records:
        cur.execute(
            INSERT_SQL,
            (
                r["source_type"],
                r["collection"],
                r.get("book_name"),
                r.get("book_number"),
                r.get("chapter_name"),
                r.get("chapter_number"),
                r.get("verse_or_hadith_number"),
                r["text_ar"],
                r["text_en"],
                r.get("authenticity"),
                r["language_pair"],
            ),
        )

    conn.commit()
    print(f"Loaded {len(records)} records from {dataset.name}")

cur.close()
conn.close()