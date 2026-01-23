from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.schemas import QuestionRequest, AnswerResponse
from respond import respond_to_question

app = FastAPI(
    title="AALIM API",
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
    history = [m.dict() for m in payload.history]

    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    result = respond_to_question(question, history)

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