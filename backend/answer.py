import os
from openai import OpenAI
from backend.search import semantic_search

# ---- CONFIG ----
MODEL = "gpt-4.1-mini"
TOP_K = 5
SYSTEM_PROMPT_PATH = "backend/prompt/system_prompt.txt"
# ----------------

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Load system prompt once
with open(SYSTEM_PROMPT_PATH, "r", encoding="utf-8") as f:
    SYSTEM_PROMPT = f.read()


def build_context(results):
    """
    Convert retrieved DB rows into strict evidence blocks.
    """
    blocks = []

    for r in results:
        (
            source_type,
            collection,
            book_name,
            chapter_name,
            chapter_number,
            number,
            text_en,
            similarity,
        ) = r

        citation = (
            f"Qur’an {chapter_number}:{number}"
            if source_type == "quran"
            else f"{collection} {number}"
        )

        block = f"""
SOURCE:
{citation}

TEXT:
{text_en}
""".strip()

        blocks.append(block)

    return "\n\n---\n\n".join(blocks)


def answer_question(question: str, k: int = TOP_K):
    # 1️⃣ Retrieve sources
    results = semantic_search(question, k)

    if not results:
        return {
            "answer": "Based on the available sources, there is insufficient evidence to provide a reliable answer.",
            "sources": [],
        }

    # 2️⃣ Build controlled context
    context = build_context(results)

    # 3️⃣ Call model with HARD constraints
    response = client.responses.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"""
QUESTION:
{question}

EVIDENCE:
{context}
"""
            },
        ],
    )

    answer_text = response.output_text.strip()

    # 4️⃣ Refusal safeguard
    if "insufficient evidence" in answer_text.lower():
        return {
            "answer": "Based on the available sources, there is insufficient evidence to provide a reliable answer.",
            "sources": [],
        }

    return {
        "answer": answer_text,
        "sources": results,
    }


if __name__ == "__main__":
    q = "What does Islam say about patience?"
    out = answer_question(q)

    print("\nANSWER:\n")
    print(out["answer"])