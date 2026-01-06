import json
from pathlib import Path

# Paths
IN_FILE = Path("data/processed/bukhari/bukhari-metadata-fixed.json")
OUT_FILE = Path("data/processed/bukhari/bukhari-normalized.json")

OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

def normalize_text(text: str) -> str:
    if not text:
        return text
    # Replace newlines with spaces, collapse whitespace
    text = text.replace("\n", " ")
    text = " ".join(text.split())
    return text.strip()

with open(IN_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

# Normalize chapter titles
for chapter in data.get("chapters", []):
    chapter["arabic"] = normalize_text(chapter.get("arabic"))
    chapter["english"] = normalize_text(chapter.get("english"))

# Normalize hadith text
for hadith in data.get("hadiths", []):
    hadith["arabic"] = normalize_text(hadith.get("arabic"))

    english = hadith.get("english", {})
    english["narrator"] = normalize_text(english.get("narrator"))
    english["text"] = normalize_text(english.get("text"))
    hadith["english"] = english

with open(OUT_FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Text normalized → {OUT_FILE}")