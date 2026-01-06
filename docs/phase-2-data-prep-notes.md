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

