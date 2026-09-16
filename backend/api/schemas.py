from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, EmailStr, Field

# Caps bound the token spend per request. Only the last 6 history
# messages are ever sent to the model, but an uncapped body still lets a
# caller push an arbitrarily large payload through the endpoint.
MAX_QUESTION_CHARS = 2000
MAX_MESSAGE_CHARS = 4000
MAX_HISTORY_MESSAGES = 20

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=MAX_MESSAGE_CHARS)


class QuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=MAX_QUESTION_CHARS)
    history: List[ChatMessage] = Field(
        default_factory=list, max_length=MAX_HISTORY_MESSAGES
    )
    language: str = Field(default="en", max_length=32)
    # Which conversation to append to. Omitted means "start a new one".
    # Ownership is checked server-side against the session user; this id
    # never identifies a user.
    conversation_id: Optional[int] = None


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
    conversation_id: Optional[int] = None


# ----------------------------
# AUTH
# ----------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    # Upper bound is a denial-of-service guard: Argon2 cost scales with
    # input length, so an unbounded password is an unbounded CPU cost.
    password: str = Field(
        min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class UserResponse(BaseModel):
    id: int
    email: str


# ----------------------------
# CONVERSATIONS
# ----------------------------

class ConversationSummary(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime


class StoredMessage(BaseModel):
    id: int
    role: Literal["user", "assistant"]
    content: str
    status: Optional[str] = None
    sources: List[Source] = Field(default_factory=list)
    created_at: datetime


class ConversationDetail(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[StoredMessage] = Field(default_factory=list)
