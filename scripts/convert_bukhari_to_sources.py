import json
from pathlib import Path
from datetime import datetime, timezone

# Paths
IN_FILE = Path("data/processed/bukhari/bukhari-normalized.json")
OUT_FILE = Path("data/processed/bukhari/bukhari-sources.json")

OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

with open(IN_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

chapters = {c["id"]: c for c in data.get("chapters", [])}
hadiths = data.get("hadiths", [])

records = []
now = datetime.now(timezone.utc).isoformat()

for h in hadiths:
    chapter = chapters.get(h["chapterId"])

    if chapter is None:
        raise ValueError(f"Hadith {h['id']} references missing chapter {h['chapterId']}")

    record = {
        "source_type": "bukhari",
        "collection": "Sahih al-Bukhari",
        "book_name": chapter.get("english"),
        "book_number": h.get("bookId"),
        "chapter_name": chapter.get("english"),
        "chapter_number": chapter.get("id"),
        "verse_or_hadith_number": h.get("idInBook"),
        "text_ar": h.get("arabic"),
        "text_en": h.get("english", {}).get("text") or None,
        "authenticity": "sahih",
        "language_pair": "ar-en",
        "created_at": now
    }

    # HARD validation — Arabic must exist, English optional
    for field in [
        "book_number",
        "chapter_number",
        "verse_or_hadith_number",
        "text_ar"
    ]:
        if not record[field]:
            raise ValueError(f"Missing {field} in hadith {h['id']}")

    records.append(record)

with open(OUT_FILE, "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"Converted {len(records)} hadiths → {OUT_FILE}")