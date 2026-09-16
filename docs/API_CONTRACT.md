# Islamic AI Agent — API Contract (LOCKED)

Version: v1  
Date Locked: 2026-01-12  

Breaking this contract requires a new version (v2).

---

## 1. Overview

This API provides an evidence-based Islamic text explanation service using ONLY:

- Qur’an
- Sahih al-Bukhari
- Sahih Muslim

The API never issues rulings, opinions, or speculative answers.

All responses are either:
- A source-backed explanation, or
- A strict refusal.

---

## 2. Endpoint

POST /ask

---

## 3. Request

### Headers
Content-Type: application/json

### Body

```json
{
  "question": "string"
}