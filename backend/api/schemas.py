from pydantic import BaseModel, Field
from typing import List, Optional, Literal


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class QuestionRequest(BaseModel):
    question: str
    history: List[ChatMessage] = Field(default_factory=list)
    language: str = "en"

class Source(BaseModel):
    source_type: str
    reference: str
    text: str
    similarity: float


class AnswerResponse(BaseModel):
    status: Literal["ok", "general", "refusal"]
    answer: Optional[str] = None
    sources: List[Source] = Field(default_factory=list)
    message: Optional[str] = None