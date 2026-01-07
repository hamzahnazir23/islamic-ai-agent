# Phase 2 Data Preparation Notes

## Target Datasets
- Qur’an (Arabic + English)
- Sahih al-Bukhari
- Sahih Muslim

## Requirements
- Machine-readable (JSON or CSV)
- One verse or hadith per record
- Includes Arabic and English text
- Includes full metadata
- No modification of original text

## Validation Rules
- No missing verse/hadith numbers
- No merged records
- No paraphrasing

## Sahih al-Bukhari — Data Source Lock

**Source:** Sunnah.com  
**Languages:** Arabic and English  
**Granularity:** One hadith per record  
**Phase:** Phase 2  
**Status:** Locked  

---

### Description

Sahih al-Bukhari data for Phase 2 will be sourced exclusively from datasets derived from Sunnah.com.

The dataset must contain:
- Authentic (sahih) hadith only
- Arabic and English text for each hadith
- Stable book and hadith numbering
- One hadith per record with no aggregation

No commentary, interpretation, or non-canonical material is permitted.

---

### Enforcement

This source selection is locked for Phase 2.

No alternative datasets, collections, or translations may be introduced until Phase 2 is completed and formally reviewed.

## Sahih al-Bukhari — Data Source Lock (Phase 2)

**Source:** Structured JSON dataset derived from Sunnah.com  
**Languages:** Arabic and English  
**Granularity:** One hadith per record  
**Structure:** Book → Chapter → Hadith  
**Chapter Numbering:** `chapters.id` treated as canonical  
**Status:** Locked for Phase 2

# Phase 2 — Sahih al-Bukhari Data Lock

Status: Locked  
Source: Sunnah.com (JSON dataset)  
Language: Arabic + English  
Granularity: One hadith per record  

Total Records: 7,277

Notes:
- Arabic text is authoritative
- English translation is included where available
- Records with missing English were preserved without modification
- No tafsir, commentary, or secondary sources included

This dataset is finalized for Phase 2.
No changes permitted until Phase 3.