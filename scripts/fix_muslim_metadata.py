import json
from pathlib import Path

IN_FILE = Path("data/raw/muslim/muslim.json")
OUT_FILE = Path("data/processed/muslim/muslim-metadata-fixed.json")

OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

with open(IN_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

# Remove introduction chapter (id == 0)
chapters = [c for c in data["chapters"] if c.get("id") != 0]

valid_chapter_ids = {c["id"] for c in chapters}

# Filter hadiths that reference valid chapters
hadiths = [
    h for h in data["hadiths"]
    if h.get("chapterId") in valid_chapter_ids
]

fixed = {
    "metadata": data.get("metadata"),
    "chapters": chapters,
    "hadiths": hadiths
}

with open(OUT_FILE, "w", encoding="utf-8") as f:
    json.dump(fixed, f, ensure_ascii=False, indent=2)

print(f"Fixed metadata → {OUT_FILE}")
print(f"Chapters: {len(chapters)}")
print(f"Hadiths: {len(hadiths)}")