from backend.search import semantic_search
from backend.logger import log_event
from openai import OpenAI

MODEL = "gpt-4.1-mini"
TOP_K = 5

SIMILARITY_THRESHOLD = 0.80   # lower = more relevant
MIN_SOURCES = 2              # minimum evidence requirement

# Explicit term enforcement (Phase 5 MVP)
TERM_MAP = {
    "patience": ["patience", "sabr"],
    "prayer": ["prayer", "salah", "salat"],
}

client = OpenAI()


def load_system_prompt():
    with open("backend/prompt/system_prompt.txt", "r", encoding="utf-8") as f:
        return f.read()


def refusal_response():
    """Single canonical refusal. NEVER include sources."""
    return {
        "answer": "Based on the available sources, there is insufficient evidence to provide a reliable answer.",
        "sources": [],
    }


def extract_source_types(results):
    return sorted({r[0] for r in results})


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
            text,
            score,
        ) = r

        if source_type == "quran":
            label = f"[Qur’an {chapter_number}:{verse_or_hadith_number}]"
        else:
            label = f"[{collection} | {book_name} | {chapter_name} | Hadith {verse_or_hadith_number}]"

        context_blocks.append(f"{label}\n{text}")

    context = "\n\n".join(context_blocks)

    return f"""{system_prompt}

Question:
{question}

Sources:
{context}

Answer:
"""


def respond_to_question(question: str, k: int = TOP_K):
    results = semantic_search(question, k)

    # --- NO RESULTS ---
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

    source_types = extract_source_types(results)

    # --- MINIMUM EVIDENCE GATE ---
    if len(results) < MIN_SOURCES:
        log_event(
            question=question,
            status="refusal",
            refusal_reason="insufficient_sources",
            num_sources=len(results),
            top_similarity=results[0][-1],
            source_types=source_types,
            model=MODEL,
        )
        return refusal_response()

    # --- RELEVANCE GATE ---
    best_score = results[0][-1]
    if best_score > SIMILARITY_THRESHOLD:
        log_event(
            question=question,
            status="refusal",
            refusal_reason="low_similarity",
            num_sources=len(results),
            top_similarity=best_score,
            source_types=source_types,
            model=MODEL,
        )
        return refusal_response()

    # --- EXPLICIT TERM GATE ---
    question_lower = question.lower()
    combined_text = " ".join(r[6].lower() for r in results)

    for _, terms in TERM_MAP.items():
        if any(term in question_lower for term in terms):
            if not any(term in combined_text for term in terms):
                log_event(
                    question=question,
                    status="refusal",
                    refusal_reason="missing_explicit_term",
                    num_sources=len(results),
                    top_similarity=best_score,
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

    # --- EMPTY MODEL OUTPUT ---
    if not answer_text:
        log_event(
            question=question,
            status="refusal",
            refusal_reason="empty_model_output",
            num_sources=len(results),
            top_similarity=best_score,
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
        top_similarity=best_score,
        source_types=source_types,
        model=MODEL,
    )

    return {
        "answer": answer_text,
        "sources": results,
    }


# ----------------------------
# Local dev test
# ----------------------------
if __name__ == "__main__":
    q = "What does Islam say about prayer?"
    out = respond_to_question(q)
    print(out["answer"])