from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from psycopg2.errors import UniqueViolation

from api.schemas import LoginRequest, RegisterRequest, UserResponse
from auth import (
    SESSION_COOKIE,
    CurrentUser,
    clear_session_cookie,
    create_session,
    destroy_session,
    hash_password,
    needs_rehash,
    normalize_email,
    require_user,
    set_session_cookie,
    verify_password,
)
from database import db_cursor
from ratelimit import clear_login_attempts, enforce_login_rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(payload: RegisterRequest, request: Request, response: Response):
    email = normalize_email(payload.email)
    password_hash = hash_password(payload.password)

    try:
        with db_cursor(commit=True) as cur:
            cur.execute(
                """
                INSERT INTO users (email, password_hash)
                VALUES (%s, %s)
                RETURNING id, email
                """,
                (email, password_hash),
            )
            user_id, user_email = cur.fetchone()
    except UniqueViolation:
        # The unique index on lower(email) is the real guard: checking for
        # an existing row first would leave a race between the check and
        # the insert.
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    token = create_session(user_id)
    set_session_cookie(response, token)
    return UserResponse(id=user_id, email=user_email)


@router.post("/login", response_model=UserResponse)
def login(payload: LoginRequest, request: Request, response: Response):
    email = normalize_email(payload.email)
    enforce_login_rate_limit(request, email)

    with db_cursor() as cur:
        cur.execute(
            "SELECT id, email, password_hash FROM users WHERE lower(email) = %s",
            (email,),
        )
        row = cur.fetchone()

    # Identical response for "no such user" and "wrong password", so the
    # endpoint cannot be used to enumerate registered emails.
    invalid = HTTPException(status_code=401, detail="Invalid email or password.")
    if row is None:
        # Spend comparable time on a miss so response latency does not
        # reveal whether the account exists.
        hash_password(payload.password)
        raise invalid

    user_id, user_email, password_hash = row
    if not verify_password(password_hash, payload.password):
        raise invalid

    if needs_rehash(password_hash):
        with db_cursor(commit=True) as cur:
            cur.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s",
                (hash_password(payload.password), user_id),
            )

    clear_login_attempts(request, email)
    token = create_session(user_id)
    set_session_cookie(response, token)
    return UserResponse(id=user_id, email=user_email)


@router.post("/logout", status_code=204)
def logout(response: Response, aalim_session: str | None = Cookie(default=None)):
    # Revoke server-side first: clearing the cookie alone would leave a
    # usable session row for anyone who captured the token.
    if aalim_session:
        destroy_session(aalim_session)
    clear_session_cookie(response)
    return Response(status_code=204)


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser = Depends(require_user)):
    return UserResponse(id=user.id, email=user.email)
