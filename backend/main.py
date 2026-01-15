from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.schemas import QuestionRequest, AnswerResponse
from respond import respond_to_question

app = FastAPI(
    title="MuftiGPT API",
    version="1.0.0",
)

# CORS (Next.js)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/ask", response_model=AnswerResponse)
def ask_question(payload: QuestionRequest):
    question = payload.question.strip()
    history = payload.history  # ✅ NEW

    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # ✅ pass history through
    result = respond_to_question(
        question=question,
        history=history,
    )

    # REFUSAL
    if not result["sources"]:
        return {
            "status": "refusal",
            "answer": None,
            "sources": [],
            "message": result["answer"],
        }

    # SUCCESS
    return {
        "status": "ok",
        "answer": result["answer"],
        "sources": result["sources"],
        "message": None,
    }