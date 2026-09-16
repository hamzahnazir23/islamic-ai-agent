"""
Test harness.

Runs against a scratch database (islamic_ai_test) created and dropped per
session, so the development corpus in islamic_ai is never touched. The
model is stubbed: no test spends money or needs network access.
"""
import os
import subprocess
from pathlib import Path

import psycopg2
import pytest

BACKEND = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND.parent
TEST_DB = os.getenv("TEST_PGDATABASE", "islamic_ai_test")

# Must be set before importing any application module: search.py builds an
# OpenAI client at import time and raises without a key.
os.environ.setdefault("OPENAI_API_KEY", "sk-test-not-a-real-key")
os.environ["PGDATABASE"] = TEST_DB
os.environ.pop("DATABASE_URL", None)
# Keep the generic /ask limiter out of the way; it has its own test.
os.environ["RATE_LIMIT_PER_MINUTE"] = "1000"
os.environ["RATE_LIMIT_PER_DAY"] = "10000"


def _admin_connection():
    conn = psycopg2.connect(
        dbname="postgres",
        user=os.getenv("PGUSER", os.getenv("USER")),
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
    )
    conn.autocommit = True
    return conn


@pytest.fixture(scope="session", autouse=True)
def test_database():
    conn = _admin_connection()
    with conn.cursor() as cur:
        cur.execute(f'DROP DATABASE IF EXISTS "{TEST_DB}"')
        cur.execute(f'CREATE DATABASE "{TEST_DB}"')
    conn.close()

    for sql_file in [
        BACKEND / "db" / "schema.sql",
        BACKEND / "db" / "migrations" / "002_auth_and_chat.sql",
    ]:
        subprocess.run(
            ["psql", "-q", "-v", "ON_ERROR_STOP=1", "-d", TEST_DB, "-f", str(sql_file)],
            check=True,
            capture_output=True,
        )

    yield

    import database
    database.reset_pool()
    conn = _admin_connection()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            "WHERE datname = %s AND pid <> pg_backend_pid()",
            (TEST_DB,),
        )
        cur.execute(f'DROP DATABASE IF EXISTS "{TEST_DB}"')
    conn.close()


@pytest.fixture(autouse=True)
def clean_state():
    """Truncate user data and reset rate-limit counters between tests."""
    import database
    import ratelimit

    database.reset_pool()
    with database.db_cursor(commit=True) as cur:
        cur.execute("TRUNCATE users, sessions, conversations, messages CASCADE")
    ratelimit._reset_all()
    yield


@pytest.fixture
def stub_model(monkeypatch):
    """
    Replace the model call. Returns a cited answer by default; tests that
    need another shape override `reply`.
    """
    import main

    state = {
        "reply": {
            "status": "ok",
            "answer": "Patience is enjoined in the Qur'an.",
            "sources": [
                {
                    "source_type": "quran",
                    "reference": "Qur'an 2:153",
                    "text": "Seek help through patience and prayer.",
                    "similarity": 0.61,
                }
            ],
            "message": None,
        },
        "calls": [],
    }

    def fake_respond(question, history, language="en", k=5):
        state["calls"].append(
            {"question": question, "history": history, "language": language}
        )
        return state["reply"]

    monkeypatch.setattr(main, "respond_to_question", fake_respond)
    return state


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    import main

    with TestClient(main.app) as c:
        yield c


def register(client, email="user@example.com", password="correct-horse-1"):
    return client.post(
        "/auth/register", json={"email": email, "password": password}
    )


@pytest.fixture
def user_client():
    """A TestClient already holding a logged-in session cookie."""
    from fastapi.testclient import TestClient
    import main

    def _make(email):
        c = TestClient(main.app)
        resp = c.post(
            "/auth/register", json={"email": email, "password": "correct-horse-1"}
        )
        assert resp.status_code == 201, resp.text
        return c

    return _make
