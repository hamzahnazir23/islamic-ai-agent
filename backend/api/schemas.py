from pydantic import BaseModel, Field
from typing import List, Optional


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class QuestionRequest(BaseModel):
    question: str
    history: List[ChatMessage] = Field(default_factory=list)


class Source(BaseModel):
    source_type: str
    reference: str
    text: str
    similarity: float


class AnswerResponse(BaseModel):
    status: str
    answer: Optional[str]
    sources: List[Source]
    message: Optional[str]