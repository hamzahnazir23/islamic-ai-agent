import os
from typing import List, Dict
from openai import OpenAI

from search import semantic_search
from logger import log_event

# ----------------------------
# CONFIG
# ----------------------------

MODEL = "gpt-4.1-mini"
TOP_K = 5

# Cosine distance: lower = better
SIMILARITY_THRESHOLD = 1.10
MIN_SOURCES = 1

# Broad Islamic concept coverage
TERM_MAP = {
    "worship": ["prayer", "salah", "salat", "wudu", "fasting", "zakat", "hajj"],
    "belief": ["allah", "god", "tawhid", "iman", "faith"],
    "ethics": ["patience", "sabr", "honesty", "justice", "kindness"],
    "daily_life": ["halal", "haram", "food", "marriage", "family"],
}

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ----------------------------
# HELPERS
# ----------------------------

def load_system_prompt():
    with open("prompt/system_prompt.txt", "r", encoding="utf-8") as f:
        return f.read()


def detect_concept(question: str):
    q = question.lower()
    for concept, terms in TERM_MAP.items():
        if any(term in q for term in terms):
            return concept
    return None


def refusal_response():
    return {
        "answer": "Based on the available sources, there is insufficient evidence to provide a reliable answer.",
        "sources": [],
    }


def generate_general_islamic_answer(question: str, history: List[Dict]):
    """
    Safe fallback when sources are missing or weak.
    NO fabricated citations.
    Uses history ONLY for conversational continuity.
    """
    system_prompt = """
You are MuftiGPT, a conservative Islamic AI assistant.

Rules:
- Do NOT fabricate Qur’an verses or Hadith.
- Do NOT imply citations when none are provided.
- Speak generally and cautiously.
- Do NOT issue rulings or fatwas.
"""

    messages = [{"role": "system", "content": system_prompt}]

    # Inject prior conversation (context only)
    for msg in history[-6:]:
        messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    messages.append({
        "role": "user",
        "content": question
    })

    response = client.responses.create(
        model=MODEL,
        input=messages,
    )

    return response.output_text.strip()


def format_sources(results):
    formatted = []

    for r in results:
        (
            source_type,
            collection,
            book_name,
            chapter_name,
            chapter_number,
            verse_or_hadith_number,
            text_en,
            similarity,
        ) = r

        reference = (
            f"Qur’an {chapter_number}:{verse_or_hadith_number}"
            if source_type == "quran"
            else f"{collection} {verse_or_hadith_number}"
        )

        formatted.append({
            "source_type": source_type,
            "reference": reference,
            "text": text_en,
            "similarity": round(similarity, 4),
        })

    return formatted


def build_prompt(question: str, results, history: List[Dict]):
    system_prompt = load_system_prompt()
    blocks = []

    for r in results:
        (
            source_type,
            collection,
            book_name,
            chapter_name,
            chapter_number,
            verse_or_hadith_number,
            text_en,
            _,
        ) = r

        label = (
            f"[Qur’an {chapter_number}:{verse_or_hadith_number}]"
            if source_type == "quran"
            else f"[{collection} | Hadith {verse_or_hadith_number}]"
        )

        blocks.append(f"{label}\n{text_en}")

    context = "\n\n".join(blocks)

    messages = [
        {"role": "system", "content": system_prompt},
    ]

    # Conversation history (context only, not evidence)
    for msg in history[-6:]:
        messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    messages.append({
        "role": "user",
        "content": f"""Question:
{question}

Sources:
{context}

Answer:"""
    })

    return messages


# ----------------------------
# CORE FUNCTION
# ----------------------------

def respond_to_question(question: str, history: List[Dict], k: int = TOP_K):
    concept = detect_concept(question)

    # Unsupported concept → GENERAL answer
    if concept is None:
        log_event(question, "general", "unsupported_concept")
        return {
            "answer": generate_general_islamic_answer(question, history),
            "sources": [],
        }

    # Retrieval
    results = semantic_search(question, k)

    if not results:
        log_event(question, "general", "no_results")
        return {
            "answer": generate_general_islamic_answer(question, history),
            "sources": [],
        }

    best_distance = results[0][-1]

    # Weak evidence → GENERAL answer
    if len(results) < MIN_SOURCES or best_distance > SIMILARITY_THRESHOLD:
        log_event(question, "general", "weak_evidence")
        return {
            "answer": generate_general_islamic_answer(question, history),
            "sources": [],
        }

    # Strong evidence → CITED answer
    messages = build_prompt(question, results, history)

    response = client.responses.create(
        model=MODEL,
        input=messages,
    )

    answer_text = response.output_text.strip()

    if not answer_text:
        log_event(question, "general", "empty_model_output")
        return {
            "answer": generate_general_islamic_answer(question, history),
            "sources": [],
        }

    log_event(question, "ok", "cited_answer")

    return {
        "answer": answer_text,
        "sources": format_sources(results),
    }