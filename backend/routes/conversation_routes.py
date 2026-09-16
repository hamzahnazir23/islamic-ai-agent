import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from api.schemas import (
    ConversationDetail,
    ConversationSummary,
    Source,
    StoredMessage,
)
from auth import CurrentUser, require_user
from database import db_cursor

router = APIRouter(prefix="/conversations", tags=["conversations"])

TITLE_MAX_CHARS = 60


def assert_owned(cur, conversation_id: int, user_id: int) -> None:
    """
    Ownership gate for every conversation-scoped operation.

    Raises 404 rather than 403 on someone else's conversation: a 403 would
    confirm that the id exists, letting a caller enumerate other users'
    conversations by probing ids.
    """
    cur.execute(
        "SELECT 1 FROM conversations WHERE id = %s AND user_id = %s",
        (conversation_id, user_id),
    )
    if cur.fetchone() is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")


def create_conversation(cur, user_id: int, title: str) -> int:
    title = (title or "").strip() or "New conversation"
    if len(title) > TITLE_MAX_CHARS:
        title = title[: TITLE_MAX_CHARS - 1].rstrip() + "…"
    cur.execute(
        "INSERT INTO conversations (user_id, title) VALUES (%s, %s) RETURNING id",
        (user_id, title),
    )
    return cur.fetchone()[0]


def append_message(
    cur,
    conversation_id: int,
    role: str,
    content: str,
    status: Optional[str] = None,
    sources: Optional[list] = None,
) -> None:
    cur.execute(
        """
        INSERT INTO messages (conversation_id, role, content, status, sources)
        VALUES (%s, %s, %s, %s, %s::jsonb)
        """,
        (conversation_id, role, content, status, json.dumps(sources or [])),
    )
    cur.execute(
        "UPDATE conversations SET updated_at = now() WHERE id = %s",
        (conversation_id,),
    )


@router.get("", response_model=List[ConversationSummary])
def list_conversations(user: CurrentUser = Depends(require_user)):
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, title, created_at, updated_at
            FROM conversations
            WHERE user_id = %s
            ORDER BY updated_at DESC
            LIMIT 100
            """,
            (user.id,),
        )
        rows = cur.fetchall()

    return [
        ConversationSummary(
            id=r[0], title=r[1], created_at=r[2], updated_at=r[3]
        )
        for r in rows
    ]


@router.post("", response_model=ConversationDetail, status_code=201)
def new_conversation(user: CurrentUser = Depends(require_user)):
    with db_cursor(commit=True) as cur:
        conversation_id = create_conversation(cur, user.id, "New conversation")
        cur.execute(
            "SELECT id, title, created_at, updated_at FROM conversations WHERE id = %s",
            (conversation_id,),
        )
        r = cur.fetchone()

    return ConversationDetail(
        id=r[0], title=r[1], created_at=r[2], updated_at=r[3], messages=[]
    )


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: int, user: CurrentUser = Depends(require_user)
):
    with db_cursor() as cur:
        assert_owned(cur, conversation_id, user.id)

        cur.execute(
            "SELECT id, title, created_at, updated_at FROM conversations WHERE id = %s",
            (conversation_id,),
        )
        convo = cur.fetchone()

        cur.execute(
            """
            SELECT id, role, content, status, sources, created_at
            FROM messages
            WHERE conversation_id = %s
            ORDER BY id
            """,
            (conversation_id,),
        )
        rows = cur.fetchall()

    return ConversationDetail(
        id=convo[0],
        title=convo[1],
        created_at=convo[2],
        updated_at=convo[3],
        messages=[
            StoredMessage(
                id=r[0],
                role=r[1],
                content=r[2],
                status=r[3],
                sources=[Source(**s) for s in (r[4] or [])],
                created_at=r[5],
            )
            for r in rows
        ],
    )


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: int, user: CurrentUser = Depends(require_user)
):
    with db_cursor(commit=True) as cur:
        assert_owned(cur, conversation_id, user.id)
        # Scoped by user_id again, so the delete itself cannot act on
        # another user's row even if the check above were bypassed.
        cur.execute(
            "DELETE FROM conversations WHERE id = %s AND user_id = %s",
            (conversation_id, user.id),
        )
    return None
