from pydantic import BaseModel
from typing import List, Optional


class QuestionRequest(BaseModel):
    question: str


class Source(BaseModel):
    source_type: str
    reference: str
    text: str
    similarity: float


class AnswerResponse(BaseModel):
    status: str                    # "ok" | "refusal"
    answer: Optional[str] = None
    sources: Optional[List[Source]] = None
    message: Optional[str] = None