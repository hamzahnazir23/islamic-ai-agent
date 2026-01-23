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

SIMILARITY_THRESHOLD = 1.25
MIN_SOURCES = 1

TERM_MAP = {
    "worship": ["prayer", "salah", "salat", "wudu", "fasting", "zakat", "hajj"],
    "belief": ["allah", "god", "tawhid", "iman", "faith"],
    "ethics": ["patience", "sabr", "honesty", "justice", "kindness"],
    "daily_life": ["halal", "haram", "food", "marriage", "family"],
}

NON_SUNNI_TERMS = [
    "shia", "shi'a", "rafidi",
    "ahmadi", "qadiani",
    "ismaili", "zaidi",
    "twelver", "imamate",
    "wilayat", "ghaibat",
    "twelve imams",
    "imams are infallible",
]

QUOTE_TRIGGERS = [
    "what does the quran say",
    "quran say",
    "hadith say",
    "which verse",
    "which ayah",
    "specific hadith",
    "show me",
    "give me",
    "cite",
    "source",
]

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ----------------------------
# HELPERS
# ----------------------------

def load_system_prompt():
    with open("prompt/system_prompt.txt", "r", encoding="utf-8") as f:
        return f.read()


def contains_non_sunni_terms(question: str) -> bool:
    q = question.lower()
    return any(term in q for term in NON_SUNNI_TERMS)


def detect_concept(question: str):
    q = question.lower()
    for concept, terms in TERM_MAP.items():
        if any(term in q for term in terms):
            return concept
    return None


def is_quote_request(question: str) -> bool:
    q = question.lower()
    return any(trigger in q for trigger in QUOTE_TRIGGERS)


# ✅ NEW (ONLY ADDITION)
def resolve_retrieval_question(question: str, history: List[Dict]) -> str:
    """
    If the user asks for sources / verses, reuse the last
    substantive user question for retrieval.
    """
    if is_quote_request(question):
        for msg in reversed(history):
            if msg["role"] == "user":
                return msg["content"]
    return question


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


def generate_general_islamic_answer(question: str, history: List[Dict]) -> str:
    system_prompt = """
You are MuftiGPT, a Sunni Islamic AI assistant (Ahl al-Sunnah wal-Jama‘ah).

Rules:
- Do NOT imply citations unless sources are provided.
- Speak generally and cautiously.
- Do NOT issue rulings or fatwas.
- Do NOT reference non-Sunni beliefs.
"""

    messages = [{"role": "system", "content": system_prompt}]

    for msg in history[-6:]:
        messages.append(msg)

    messages.append({"role": "user", "content": question})

    response = client.responses.create(
        model=MODEL,
        input=messages,
    )

    return response.output_text.strip()


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

    messages = [{"role": "system", "content": system_prompt}]

    for msg in history[-6:]:
        messages.append(msg)

    messages.append({
    "role": "user",
    "content": f"""
Using ONLY the sources below, respond in a calm, conversational tone.
Use short sentences.
Do not write a paragraph.
Stop once the sources are explained.

Question:
{question}

Sources:
{context}
"""
})

    return messages


# ----------------------------
# CORE FUNCTION
# ----------------------------

def respond_to_question(question: str, history: List[Dict], k: int = TOP_K):

    # 🚫 Hard block: non-Sunni content ONLY
    if contains_non_sunni_terms(question):
        log_event(question, "refusal", "non_sunni_request")
        return {
            "status": "refusal",
            "answer": "MuftiGPT answers only according to Sunni Islam (Ahl al-Sunnah wal-Jama‘ah).",
            "sources": [],
            "message": None,
        }

    quote_request = is_quote_request(question)

    # ✅ Resolve retrieval target ONCE
    retrieval_question = resolve_retrieval_question(question, history)
    results = semantic_search(retrieval_question, k)

    # 🔹 If NO sources found → true general answer
    if not results:
        return {
            "status": "general",
            "answer": generate_general_islamic_answer(question, history),
            "sources": [],
            "message": None,
        }

    # 🔹 Sources FOUND → ALWAYS cite them
    messages = build_prompt(retrieval_question, results, history)

    response = client.responses.create(
        model=MODEL,
        input=messages,
    )

    answer_text = response.output_text.strip()

    # 🔹 If model fails, still return sources
    if not answer_text:
        return {
            "status": "ok",
            "answer": generate_general_islamic_answer(question, history),
            "sources": format_sources(results),
            "message": None,
        }

    # ✅ SUCCESS: cited answer
    return {
        "status": "ok",
        "answer": answer_text,
        "sources": format_sources(results),
        "message": None,
    }