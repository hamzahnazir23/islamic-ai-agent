import json
from pathlib import Path

# Paths
RAW_FILE = Path("data/raw/bukhari/bukhari.json")
OUT_FILE = Path("data/processed/bukhari/bukhari-metadata-fixed.json")

# Ensure output directory exists
OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

# Load raw data
with open(RAW_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

# Fix metadata
metadata = data.get("metadata", {})

# Rename ambiguous length field
if "length" in metadata:
    metadata["hadith_count"] = metadata.pop("length")

# Add explicit source attribution
metadata["collection"] = "Sahih al-Bukhari"
metadata["author"] = "Imam Muhammad ibn Ismail al-Bukhari"
metadata["source"] = {
    "website": "https://sunnah.com",
    "language": ["ar", "en"],
    "translator": "USC-MSA",
    "extraction_method": "structured JSON export"
}

# Save back
data["metadata"] = metadata

# Write fixed file
with open(OUT_FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Metadata fixed → {OUT_FILE}")