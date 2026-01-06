import json
from pathlib import Path

# File paths
AR_FILE = Path("data/raw/quran/quran-uthmani.txt")
EN_FILE = Path("data/raw/quran/en.sahih.txt")
OUT_FILE = Path("data/processed/quran/quran-ar-en.json")

# Ensure output directory exists
OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

def load_tanzil_file(path):
    records = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            parts = line.split("|", 2)
            if len(parts) != 3:
                raise ValueError(f"Invalid line format: {line}")

            surah = int(parts[0])
            ayah = int(parts[1])
            text = parts[2]

            records[(surah, ayah)] = text
    return records

# Load files
arabic = load_tanzil_file(AR_FILE)
english = load_tanzil_file(EN_FILE)

# Sanity check
if len(arabic) != len(english):
    raise ValueError("Arabic and English files have different ayah counts")

# Merge records
output = []

for key in sorted(arabic.keys()):
    surah, ayah = key

    record = {
        "source_type": "quran",
        "collection": "Qur’an",
        "book_name": None,              # filled later if desired
        "book_number": surah,
        "verse_or_hadith_number": ayah,
        "text_ar": arabic[key],
        "text_en": english[key],
        "authenticity": "quran",
        "language_pair": "ar-en"
    }

    output.append(record)

# Write output
with open(OUT_FILE, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"Converted {len(output)} ayahs → {OUT_FILE}")