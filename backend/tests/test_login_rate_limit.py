"""Brute-force protection on the login endpoint."""
import ratelimit
from tests.conftest import register


def test_repeated_failures_are_rate_limited(client, monkeypatch):
    monkeypatch.setattr(ratelimit, "LOGIN_PER_15_MIN", 3)
    register(client)

    codes = []
    for _ in range(5):
        codes.append(
            client.post(
                "/auth/login",
                json={"email": "user@example.com", "password": "wrong"},
            ).status_code
        )

    assert codes[:3] == [401, 401, 401]
    assert codes[3] == 429, codes
    assert codes[4] == 429


def test_rate_limit_applies_to_unknown_accounts_too(client, monkeypatch):
    """Otherwise the endpoint is a free account-enumeration oracle."""
    monkeypatch.setattr(ratelimit, "LOGIN_PER_15_MIN", 2)

    codes = [
        client.post(
            "/auth/login",
            json={"email": "nobody@example.com", "password": "guess"},
        ).status_code
        for _ in range(4)
    ]
    assert 429 in codes


def test_limit_is_per_email_not_global(client, monkeypatch):
    monkeypatch.setattr(ratelimit, "LOGIN_PER_15_MIN", 2)
    register(client, email="victim@example.com")
    register(client, email="other@example.com")

    for _ in range(3):
        client.post("/auth/login",
                    json={"email": "victim@example.com", "password": "wrong"})

    # A different account is still able to log in.
    ok = client.post(
        "/auth/login",
        json={"email": "other@example.com", "password": "correct-horse-1"},
    )
    assert ok.status_code == 200


def test_successful_login_clears_the_failure_count(client, monkeypatch):
    monkeypatch.setattr(ratelimit, "LOGIN_PER_15_MIN", 3)
    register(client, email="user@example.com")

    for _ in range(2):
        client.post("/auth/login",
                    json={"email": "user@example.com", "password": "wrong"})

    good = client.post(
        "/auth/login",
        json={"email": "user@example.com", "password": "correct-horse-1"},
    )
    assert good.status_code == 200

    # Budget was reset, so two more failures do not trip the limit.
    again = client.post("/auth/login",
                        json={"email": "user@example.com", "password": "wrong"})
    assert again.status_code == 401
