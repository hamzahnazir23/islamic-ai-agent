import json
from pathlib import Path
from datetime import datetime, timezone

# Paths
IN_FILE = Path("data/processed/muslim/muslim-normalized.json")
OUT_FILE = Path("data/processed/muslim/muslim-sources.json")

# Ensure output directory exists
OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

# Load normalized Muslim data
with open(IN_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

chapters = {c["id"]: c for c in data.get("chapters", [])}
hadiths = data.get("hadiths", [])

records = []
now = datetime.now(timezone.utc).isoformat()

for h in hadiths:
    chapter = chapters.get(h.get("chapterId"))

    # Skip hadiths referencing missing chapters
    if chapter is None:
        continue

    record = {
        "source_type": "muslim",
        "collection": "Sahih Muslim",
        "book_name": chapter.get("english"),
        "book_number": h.get("bookId"),
        "chapter_name": chapter.get("english"),
        "chapter_number": chapter.get("id"),
        "verse_or_hadith_number": h.get("idInBook"),
        "text_ar": h.get("arabic"),
        "text_en": h.get("english", {}).get("text"),
        "authenticity": "sahih",
        "language_pair": "ar-en",
        "created_at": now
    }

    # Skip hadiths missing Arabic or English text
    if not record["text_ar"] or not record["text_en"]:
        continue

    records.append(record)

# Write output
with open(OUT_FILE, "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Converted {len(records)} hadiths → {OUT_FILE}")