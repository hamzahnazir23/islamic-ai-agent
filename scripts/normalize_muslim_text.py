import json
from pathlib import Path
import re

IN_FILE = Path("data/processed/muslim/muslim-metadata-fixed.json")
OUT_FILE = Path("data/processed/muslim/muslim-normalized.json")

OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

def normalize_whitespace(text):
    if not text:
        return text
    text = re.sub(r"\s+", " ", text)
    return text.strip()

with open(IN_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

# Normalize chapters
for c in data.get("chapters", []):
    c["arabic"] = normalize_whitespace(c.get("arabic"))
    c["english"] = normalize_whitespace(c.get("english"))

# Normalize hadiths
for h in data.get("hadiths", []):
    h["arabic"] = normalize_whitespace(h.get("arabic"))

    eng = h.get("english", {})
    eng["narrator"] = normalize_whitespace(eng.get("narrator"))
    eng["text"] = normalize_whitespace(eng.get("text"))
    h["english"] = eng

with open(OUT_FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Normalized text → {OUT_FILE}")
print(f"Chapters: {len(data.get('chapters', []))}")
print(f"Hadiths: {len(data.get('hadiths', []))}")