import os

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.schemas import QuestionRequest, AnswerResponse
from ratelimit import enforce_rate_limit
from respond import respond_to_question

app = FastAPI(
    title="AALIM API",
    version="1.0.0",
)

# CORS (Next.js)
#
# allow_origins=["*"] with allow_credentials=True does not fail loudly:
# Starlette reflects whichever Origin the caller sent, so every site on
# the internet was an allowed origin. Set ALLOWED_ORIGINS in the
# deployment environment as a comma-separated list.
DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "https://islamic-ai-agent-production.up.railway.app",
]

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", ",".join(DEFAULT_ORIGINS)).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    return {"status": "ok"}

@app.post(
    "/ask",
    response_model=AnswerResponse,
    dependencies=[Depends(enforce_rate_limit)],
)
def ask_question(payload: QuestionRequest):
    question = payload.question.strip()
    history = [m.model_dump() for m in payload.history]
    language = payload.language or "en"
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    result = respond_to_question(question, history, language)

    # 🚫 REFUSAL
    if result["sources"] == [] and "only according to Sunni Islam" in result["answer"]:
        return {
            "status": "refusal",
            "answer": result["answer"],
            "sources": [],
            "message": None,
        }

    # 💬 GENERAL ANSWER (may still have retrievable sources)
    if not result["sources"]:
        return {
            "status": "general",
            "answer": result["answer"],
            "sources": result.get("sources", []),
            "message": None,
    }

    # 📚 CITED ANSWER
    return {
        "status": "ok",
        "answer": result["answer"],
        "sources": result["sources"],
        "message": None,
    }