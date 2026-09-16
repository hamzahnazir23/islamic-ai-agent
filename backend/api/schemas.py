from pydantic import BaseModel, Field
from typing import List, Optional, Literal


# Caps bound the token spend per request. Only the last 6 history
# messages are ever sent to the model, but an uncapped body still lets a
# caller push an arbitrarily large payload through the endpoint.
MAX_QUESTION_CHARS = 2000
MAX_MESSAGE_CHARS = 4000
MAX_HISTORY_MESSAGES = 20


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=MAX_MESSAGE_CHARS)


class QuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=MAX_QUESTION_CHARS)
    history: List[ChatMessage] = Field(
        default_factory=list, max_length=MAX_HISTORY_MESSAGES
    )
    language: str = Field(default="en", max_length=32)

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