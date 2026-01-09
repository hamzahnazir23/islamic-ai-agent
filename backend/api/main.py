from fastapi import FastAPI, HTTPException
from backend.api.schemas import QuestionRequest, AnswerResponse
from backend.respond import respond_to_question

app = FastAPI(
    title="Islamic AI Agent",
    version="1.0.0",
    description="Evidence-based Islamic AI assistant (Qur’an & Sahih Hadith only)"
)


@app.post("/ask", response_model=AnswerResponse)
def ask_question(payload: QuestionRequest):
    question = payload.question.strip()

    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    result = respond_to_question(question)

    # REFUSAL
    if result["sources"] == []:
        return {
            "status": "refusal",
            "message": result["answer"],
            "answer": None,
            "sources": None,
        }

    # SUCCESS
    return {
        "status": "ok",
        "answer": result["answer"],
        "sources": result["sources"],
        "message": None,
    }