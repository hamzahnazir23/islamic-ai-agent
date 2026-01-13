import os
from backend.search import semantic_search
from backend.logger import log_event
from openai import OpenAI

# ----------------------------
# CONFIG
# ----------------------------

MODEL = "gpt-4.1-mini"
TOP_K = 5

# Cosine distance: lower = better
SIMILARITY_THRESHOLD = 1.10
MIN_SOURCES = 1

# Explicit concept allowlist (Phase 5 MVP)
TERM_MAP = {
    "patience": ["patience", "sabr"],
    "prayer": ["prayer", "salah", "salat"],
}

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ----------------------------
# HELPERS
# ----------------------------

def load_system_prompt():
    with open("backend/prompt/system_prompt.txt", "r", encoding="utf-8") as f:
        return f.read()


def refusal_response():
    return {
        "answer": "Based on the available sources, there is insufficient evidence to provide a reliable answer.",
        "sources": [],
    }


def detect_concept(question: str):
    q = question.lower()
    for concept, terms in TERM_MAP.items():
        if any(term in q for term in terms):
            return concept
    return None


def extract_source_types(results):
    return sorted({r[0] for r in results})


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

        if source_type == "quran":
            reference = f"Qur’an {chapter_number}:{verse_or_hadith_number}"
        else:
            reference = f"{collection} {verse_or_hadith_number}"

        formatted.append({
            "source_type": source_type,
            "reference": reference,
            "text": text_en,
            "similarity": round(similarity, 4),
        })

    return formatted


def build_prompt(question, results):
    system_prompt = load_system_prompt()
    context_blocks = []

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

        if source_type == "quran":
            label = f"[Qur’an {chapter_number}:{verse_or_hadith_number}]"
        else:
            label = f"[{collection} | {book_name} | {chapter_name} | Hadith {verse_or_hadith_number}]"

        context_blocks.append(f"{label}\n{text_en}")

    context = "\n\n".join(context_blocks)

    return f"""{system_prompt}

Question:
{question}

Sources:
{context}

Answer:
"""


# ----------------------------
# CORE FUNCTION
# ----------------------------

def respond_to_question(question: str, k: int = TOP_K):

    print("QUESTION RECEIVED:", question)

    # --- CONCEPT GATE ---
    concept = detect_concept(question)
    print("DETECTED CONCEPT:", concept)

    if concept is None:
        log_event(
            question=question,
            status="refusal",
            refusal_reason="unsupported_concept",
            num_sources=0,
            top_similarity=None,
            source_types=[],
            model=MODEL,
        )
        return refusal_response()

    # --- RETRIEVAL ---
    results = semantic_search(question, k)

    if not results:
        log_event(
            question=question,
            status="refusal",
            refusal_reason="no_results",
            num_sources=0,
            top_similarity=None,
            source_types=[],
            model=MODEL,
        )
        return refusal_response()

    best_distance = results[0][-1]
    print("BEST COSINE DISTANCE:", best_distance)

    source_types = extract_source_types(results)

    # --- MINIMUM EVIDENCE ---
    if len(results) < MIN_SOURCES:
        log_event(
            question=question,
            status="refusal",
            refusal_reason="insufficient_sources",
            num_sources=len(results),
            top_similarity=best_distance,
            source_types=source_types,
            model=MODEL,
        )
        return refusal_response()

    # --- SEMANTIC RELEVANCE ---
    if best_distance > SIMILARITY_THRESHOLD:
        log_event(
            question=question,
            status="refusal",
            refusal_reason="weak_semantic_match",
            num_sources=len(results),
            top_similarity=best_distance,
            source_types=source_types,
            model=MODEL,
        )
        return refusal_response()

    # --- BUILD PROMPT ---
    prompt = build_prompt(question, results)

    response = client.responses.create(
        model=MODEL,
        input=prompt,
    )

    answer_text = response.output_text.strip()

    if not answer_text:
        log_event(
            question=question,
            status="refusal",
            refusal_reason="empty_model_output",
            num_sources=len(results),
            top_similarity=best_distance,
            source_types=source_types,
            model=MODEL,
        )
        return refusal_response()

    # --- SUCCESS ---
    log_event(
        question=question,
        status="ok",
        refusal_reason="none",
        num_sources=len(results),
        top_similarity=best_distance,
        source_types=source_types,
        model=MODEL,
    )

    return {
        "answer": answer_text,
        "sources": format_sources(results),
    }


# ----------------------------
# LOCAL TEST
# ----------------------------

if __name__ == "__main__":
    q = "What does Islam say about prayer?"
    print(respond_to_question(q))