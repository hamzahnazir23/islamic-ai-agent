# Source Boundaries Policy

## Purpose
This document defines the authoritative religious sources permitted for use by the Islamic AI Agent. The system is strictly limited to these sources. Any content outside these boundaries is treated as invalid and must not be referenced, inferred, or cited.

These boundaries exist to preserve religious integrity, prevent misinformation, and eliminate speculative or unauthenticated material.

---

## 1. Approved Primary Sources (Version 1)

The following sources are explicitly approved for use in Version 1 of the system.

### Qur’an
- Arabic text of the Qur’an
- One approved English translation
- Each verse stored as a standalone record
- Arabic text is treated as the primary reference

### Hadith Collections (Sahih Only)
- Sahih al-Bukhari
- Sahih Muslim

Only hadith classified as authentic (sahih) within these collections are permitted.

---

## 2. Translation Policy

- English translations must be from a recognized and reliable translator
- Translations are treated as explanatory aids, not replacements for Arabic
- Arabic text is always stored and referenced alongside translations
- No paraphrased or simplified translations are allowed

---

## 3. Metadata Requirements

Every Qur’anic verse or hadith must include the following metadata:

- Source (Qur’an, Sahih Bukhari, Sahih Muslim)
- Book name
- Chapter name or number
- Verse number or hadith number
- Authenticity classification
- Language identifier (Arabic / English)
- Topic tags (for retrieval only)

Records missing required metadata are invalid and must not be used.

---

## 4. Rejected Sources (Explicit)

The following are explicitly excluded from the system:

- Weak (da‘if) or fabricated (mawdu‘) hadith
- Unverified online sources
- Modern opinion pieces
- Blogs, forums, or social media content
- AI-generated religious material
- Contemporary reinterpretations without classical grounding

Any attempt to reference excluded sources must result in refusal.

---

## 5. Handling Conflicting Evidence

When multiple authentic narrations or interpretations exist:

- All must be presented clearly
- No single opinion is asserted unless consensus exists
- Differences are labeled neutrally
- The system does not resolve disputes beyond presenting evidence

---

## 6. Source Expansion Policy (Future Phases)

Additional sources may be added only after formal review and approval, including:

- Secondary hadith collections
- Classical tafsir
- Recognized fiqh texts

All expansions must be documented, versioned, and approved before ingestion.

---

## 7. Enforcement

- The backend must reject any output referencing non-approved sources
- The AI model is not permitted to introduce external knowledge
- All answers must trace directly to stored source records

This policy is binding for all phases unless formally revised.
