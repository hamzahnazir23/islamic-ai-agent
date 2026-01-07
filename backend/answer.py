import os
import psycopg2
from openai import OpenAI
from backend.search import semantic_search

# ---- CONFIG ----
DB_NAME = "islamic_ai"
DB_USER = "hamzahnazir"
DB_HOST = "localhost"
DB_PORT = 5432

MODEL = "gpt-4.1-mini"
TOP_K = 5
# ----------------

client = OpenAI()

def build_prompt(question, results):
    context_blocks = []

    for r in results:
        source_type, book, chapter, num, text, score = r
        label = f"[{source_type} | {book or 'Qur’an'} | {chapter or ''} | #{num}]"
        context_blocks.append(f"{label}\n{text}")

    context = "\n\n".join(context_blocks)

    return f"""
You are an Islamic knowledge assistant.

Rules:
- Answer ONLY using the provided sources.
- Do NOT add outside knowledge.
- If the sources do not fully answer the question, say so.
- Be concise, clear, and respectful.

Question:
{question}

Sources:
{context}

Answer:
"""

def answer_question(question, k=TOP_K):
    results = semantic_search(question, k)
    prompt = build_prompt(question, results)

    response = client.responses.create(
        model=MODEL,
        input=prompt,
    )

    return {
        "answer": response.output_text,
        "sources": results,
    }

if __name__ == "__main__":
    q = "What does Islam say about patience?"
    out = answer_question(q)

    print("\nANSWER:\n")
    print(out["answer"])

    print("\nSOURCES:\n")
    for s in out["sources"]:
        print(s)