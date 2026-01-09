from backend.search import semantic_search
from openai import OpenAI

MODEL = "gpt-4.1-mini"
TOP_K = 5

SIMILARITY_THRESHOLD = 0.80   # lower = more relevant
MIN_SOURCES = 2               # minimum evidence requirement

client = OpenAI()


def load_system_prompt():
    with open("backend/prompt/system_prompt.txt", "r", encoding="utf-8") as f:
        return f.read()


def refusal_response():
    """
    Single canonical refusal.
    NO SOURCES. EVER.
    """
    return {
        "answer": "Based on the available sources, there is insufficient evidence to provide a reliable answer.",
        "sources": [],
    }


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
            label = (
                f"[{collection} | {book_name} | {chapter_name} | "
                f"Hadith {verse_or_hadith_number}]"
            )

        context_blocks.append(f"{label}\n{text}")

    context = "\n\n".join(context_blocks)

    return f"""{system_prompt}

Question:
{question}

Sources:
{context}

Answer:
"""


def respond_to_question(question, k=TOP_K):
    # 1️⃣ Retrieve
    results = semantic_search(question, k)

    # 2️⃣ Hard refusal gates (PRE-LLM)
    if not results or len(results) < MIN_SOURCES:
        return refusal_response()

    best_score = results[0][-1]
    if best_score > SIMILARITY_THRESHOLD:
        return refusal_response()

    # 3️⃣ Build prompt
    prompt = build_prompt(question, results)

    # 4️⃣ Call model
    response = client.responses.create(
        model=MODEL,
        input=prompt,
    )

    answer_text = response.output_text.strip()

    # 5️⃣ POST-LLM ENFORCEMENT (CRITICAL)
    refusal_triggers = [
        "insufficient",
        "no clear answer",
        "do not contain",
        "cannot be determined",
        "not addressed",
    ]

    if (
        not answer_text
        or any(trigger in answer_text.lower() for trigger in refusal_triggers)
    ):
        return refusal_response()

    # 6️⃣ Success path ONLY
    return {
        "answer": answer_text,
        "sources": results,
    }


# ----------------------------
# Local test (dev only)
# ----------------------------
if __name__ == "__main__":
    q = "What does Islam say about patience?"
    out = respond_to_question(q)

    print("\nANSWER:\n")
    print(out["answer"])

    if out["sources"]:
        print("\nSOURCES:\n")
        for r in out["sources"]:
            print(r)