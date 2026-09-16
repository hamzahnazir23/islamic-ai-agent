"""Registration, login, logout, and password storage."""
import database
from tests.conftest import register


def test_register_creates_user_and_session(client):
    resp = register(client)
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "user@example.com"
    assert "password" not in body
    assert client.cookies.get("aalim_session")

    # The new session works immediately.
    assert client.get("/auth/me").json()["email"] == "user@example.com"


def test_password_is_hashed_not_stored_plaintext(client):
    register(client, password="super-secret-value")

    with database.db_cursor() as cur:
        cur.execute("SELECT password_hash FROM users")
        stored = cur.fetchone()[0]

    assert "super-secret-value" not in stored
    assert stored.startswith("$argon2id$")


def test_session_cookie_is_httponly_and_not_the_raw_token(client):
    register(client)
    raw_cookie = client.cookies.get("aalim_session")

    set_cookie_header = ""
    resp = client.post(
        "/auth/login",
        json={"email": "user@example.com", "password": "correct-horse-1"},
    )
    set_cookie_header = resp.headers.get("set-cookie", "")
    assert "HttpOnly" in set_cookie_header

    # Only a hash of the token reaches the database.
    with database.db_cursor() as cur:
        cur.execute("SELECT token_hash FROM sessions")
        hashes = [r[0] for r in cur.fetchall()]
    assert raw_cookie not in hashes


def test_duplicate_email_is_rejected(client):
    assert register(client).status_code == 201
    dup = register(client)
    assert dup.status_code == 409
    assert "already exists" in dup.json()["detail"]


def test_duplicate_email_is_case_insensitive(client):
    register(client, email="Someone@Example.com")
    dup = register(client, email="someone@example.COM")
    assert dup.status_code == 409


def test_invalid_email_and_short_password_rejected(client):
    assert register(client, email="not-an-email").status_code == 422
    assert register(client, email="a@b.com", password="short").status_code == 422


def test_login_succeeds_and_rejects_bad_password(client):
    register(client)
    client.cookies.clear()

    ok = client.post(
        "/auth/login",
        json={"email": "user@example.com", "password": "correct-horse-1"},
    )
    assert ok.status_code == 200

    bad = client.post(
        "/auth/login",
        json={"email": "user@example.com", "password": "wrong-password"},
    )
    assert bad.status_code == 401


def test_login_does_not_reveal_whether_account_exists(client):
    register(client)
    unknown = client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "correct-horse-1"},
    )
    wrong = client.post(
        "/auth/login",
        json={"email": "user@example.com", "password": "wrong-password"},
    )
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["detail"] == wrong.json()["detail"]


def test_logout_revokes_the_session_server_side(client):
    register(client)
    stolen_token = client.cookies.get("aalim_session")
    assert client.get("/auth/me").status_code == 200

    assert client.post("/auth/logout").status_code == 204
    assert client.get("/auth/me").status_code == 401

    # Replaying the captured token must also fail: the row is gone, not
    # merely the browser's copy of the cookie.
    client.cookies.set("aalim_session", stolen_token)
    assert client.get("/auth/me").status_code == 401


def test_expired_session_is_rejected(client):
    register(client)
    with database.db_cursor(commit=True) as cur:
        cur.execute("UPDATE sessions SET expires_at = now() - interval '1 day'")
    assert client.get("/auth/me").status_code == 401
