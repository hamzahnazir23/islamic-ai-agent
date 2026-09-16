import os

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.schemas import AnswerResponse, QuestionRequest
from auth import CurrentUser, require_user
from database import db_cursor
from ratelimit import enforce_rate_limit
from respond import respond_to_question
from routes.auth_routes import router as auth_router
from routes.conversation_routes import (
    append_message,
    assert_owned,
    create_conversation,
    router as conversation_router,
)

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
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(auth_router)
app.include_router(conversation_router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post(
    "/ask",
    response_model=AnswerResponse,
    dependencies=[Depends(enforce_rate_limit)],
)
def ask_question(
    payload: QuestionRequest,
    user: CurrentUser = Depends(require_user),
):
    question = payload.question.strip()
    history = [m.model_dump() for m in payload.history]
    language = payload.language or "en"
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # Resolve the conversation before spending money on the model, so an
    # unauthorized conversation_id fails fast instead of after an API call.
    with db_cursor(commit=True) as cur:
        if payload.conversation_id is not None:
            assert_owned(cur, payload.conversation_id, user.id)
            conversation_id = payload.conversation_id
        else:
            # The first question becomes the conversation's title.
            conversation_id = create_conversation(cur, user.id, question)

        append_message(cur, conversation_id, "user", question)

    result = respond_to_question(question, history, language)

    # 🚫 REFUSAL
    if result["sources"] == [] and "only according to Sunni Islam" in result["answer"]:
        status, sources = "refusal", []
    # 💬 GENERAL ANSWER (may still have retrievable sources)
    elif not result["sources"]:
        status, sources = "general", result.get("sources", [])
    # 📚 CITED ANSWER
    else:
        status, sources = "ok", result["sources"]

    with db_cursor(commit=True) as cur:
        append_message(
            cur,
            conversation_id,
            "assistant",
            result["answer"],
            status=status,
            sources=sources,
        )

    return {
        "status": status,
        "answer": result["answer"],
        "sources": sources,
        "message": None,
        "conversation_id": conversation_id,
    }
