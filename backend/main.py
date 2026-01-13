from fastapi import FastAPI, HTTPException
from backend.api.schemas import QuestionRequest, AnswerResponse
from backend.respond import respond_to_question

app = FastAPI(
    title="Islamic AI Agent",
    version="1.0.0",
)


@app.post("/ask", response_model=AnswerResponse)
def ask_question(payload: QuestionRequest):
    question = payload.question.strip()

    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    result = respond_to_question(question)

    # REFUSAL
    if not result["sources"]:
        return AnswerResponse(
            status="refusal",
            answer=None,
            sources=None,
            message=result["answer"],
        )

    # SUCCESS
    return AnswerResponse(
        status="ok",
        answer=result["answer"],
        sources=result["sources"],
        message=None,
    )