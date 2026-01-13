from pydantic import BaseModel
from typing import List, Optional, Literal


class QuestionRequest(BaseModel):
    question: str


class Source(BaseModel):
    source_type: str
    reference: str
    text: str
    similarity: float


class AnswerResponse(BaseModel):
    status: Literal["ok", "refusal"]
    answer: Optional[str] = None
    sources: Optional[List[Source]] = None
    message: Optional[str] = None