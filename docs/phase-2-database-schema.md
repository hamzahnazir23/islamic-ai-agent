# Phase 2 Database Schema

**Status:** Locked  
**Phase:** Phase 2 – Data & Database  
**Purpose:** Authoritative storage of Qur’an verses and Hadith records

---

## Overview

This document defines the database schema used in Phase 2 of the Islamic AI Agent project.

The schema is designed to store Qur’an verses and Hadith as discrete, authoritative records, with strict traceability and support for future semantic retrieval via vector embeddings.

No additional tables or fields may be introduced during Phase 2 without formal review.

---

## Table: sources

### Purpose

The `sources` table stores all Qur’an verses and Hadith as individual, authoritative records.

Each row represents **exactly one Qur’anic verse OR one Hadith**.  
No row may contain multiple verses or multiple Hadith.

This table serves as the **single source of truth** for all religious text used by the system.

---

### Fields

**id**  
- Unique identifier  
- Primary key  

**source_type**  
- Enum or text  
- Allowed values: `quran`, `bukhari`, `muslim`  
- Used for system logic and filtering  

**collection**  
- Text  
- Human-readable source name  
- Examples: `Qur’an`, `Sahih al-Bukhari`, `Sahih Muslim`  

**book_name**  
- Text  
- Surah name (Qur’an) or Book name (Hadith)  

**book_number**  
- Integer  
- Surah number (Qur’an) or Hadith book number  

**chapter_name**  
- Text (nullable)  
- Hadith chapter name, if applicable  

**chapter_number**  
- Integer (nullable)  

**verse_or_hadith_number**  
- Integer  
- Ayah number (Qur’an) or Hadith number  

**text_ar**  
- Text  
- Original Arabic text  

**text_en**  
- Text  
- Approved English translation  

**authenticity**  
- Text  
- Example values: `quran`, `sahih`  
- Qur’an records must explicitly indicate Qur’anic authenticity  

**language_pair**  
- Text  
- Example: `ar-en`  

**created_at**  
- Timestamp  
- Record creation time  

---

## Table: embeddings

### Purpose

The `embeddings` table stores vector embeddings used for semantic search and Retrieval-Augmented Generation (RAG).

Each embedding record corresponds to **exactly one source record**.

No embedding may exist without a valid source record.

---

### Fields

**id**  
- Unique identifier  
- Primary key  

**source_id**  
- Foreign key → `sources.id`  
- Enforces one-to-one relationship between source and embedding  

**embedding**  
- Vector type  
- Stores the semantic representation of the source text  

**model_name**  
- Text  
- Example: `text-embedding-3-large`  

**created_at**  
- Timestamp  

---

## Design Constraints

- One verse or Hadith per row (no aggregation)
- No modification of stored text after ingestion
- All records must include full metadata
- All religious logic operates on top of this schema
- Frontend has no direct write access to these tables

---

## Lock Statement

This Phase 2 database schema is locked as of the date defined in the Phase 2 Data Scope.

No structural changes, additional tables, or field modifications are permitted until Phase 2 is completed and formally reviewed.

Any future changes require explicit documentation and approval.
