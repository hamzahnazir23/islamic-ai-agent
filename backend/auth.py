import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Cookie, Depends, HTTPException, Response

from database import db_cursor

# ----------------------------
# CONFIG
# ----------------------------

SESSION_COOKIE = "aalim_session"
SESSION_TTL_DAYS = int(os.getenv("SESSION_TTL_DAYS", "30"))

# Cross-site cookies need SameSite=None + Secure. Same-site deployments
# (and localhost:3000 -> localhost:8000, which is same-site because the
# registrable domain matches) work with Lax, which is the safer default.
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").lower()
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN") or None

MIN_PASSWORD_LENGTH = 8

_hasher = PasswordHasher()


# ----------------------------
# PASSWORDS
# ----------------------------

def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        _hasher.verify(password_hash, password)
        return True
    except (VerifyMismatchError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return False


def normalize_email(email: str) -> str:
    return email.strip().lower()


# ----------------------------
# SESSIONS
# ----------------------------

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(user_id: int) -> str:
    """Mint a session and return the raw token (only its hash is stored)."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)

    with db_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO sessions (token_hash, user_id, expires_at)
            VALUES (%s, %s, %s)
            """,
            (_hash_token(token), user_id, expires_at),
        )
    return token


def destroy_session(token: str) -> None:
    with db_cursor(commit=True) as cur:
        cur.execute(
            "DELETE FROM sessions WHERE token_hash = %s", (_hash_token(token),)
        )


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        domain=COOKIE_DOMAIN,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        domain=COOKIE_DOMAIN,
        path="/",
    )


# ----------------------------
# DEPENDENCIES
# ----------------------------

class CurrentUser:
    def __init__(self, id: int, email: str):
        self.id = id
        self.email = email


def _lookup_session(token: str) -> Optional[CurrentUser]:
    with db_cursor(commit=True) as cur:
        # Expiry is enforced in SQL so a stale row can never authenticate,
        # regardless of the application clock.
        cur.execute(
            """
            SELECT u.id, u.email
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = %s
              AND s.expires_at > now()
            """,
            (_hash_token(token),),
        )
        row = cur.fetchone()
        if not row:
            return None

        cur.execute(
            "UPDATE sessions SET last_seen_at = now() WHERE token_hash = %s",
            (_hash_token(token),),
        )
        return CurrentUser(id=row[0], email=row[1])


def optional_user(
    aalim_session: Optional[str] = Cookie(default=None),
) -> Optional[CurrentUser]:
    if not aalim_session:
        return None
    return _lookup_session(aalim_session)


def require_user(
    user: Optional[CurrentUser] = Depends(optional_user),
) -> CurrentUser:
    """
    Identity comes only from the session cookie. No endpoint accepts a
    user id from the client, so a caller cannot act as another user by
    editing a request body or URL.
    """
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
