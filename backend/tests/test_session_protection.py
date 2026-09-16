"""Every non-public endpoint must refuse an unauthenticated caller."""
import pytest

PROTECTED = [
    ("post", "/ask", {"question": "hi", "history": [], "language": "en"}),
    ("get", "/conversations", None),
    ("post", "/conversations", None),
    ("get", "/conversations/1", None),
    ("delete", "/conversations/1", None),
    ("get", "/auth/me", None),
]


@pytest.mark.parametrize("method,path,body", PROTECTED)
def test_requires_authentication(client, method, path, body):
    call = getattr(client, method)
    resp = call(path, json=body) if body is not None else call(path)
    assert resp.status_code == 401, f"{method.upper()} {path} was not protected"


def test_public_endpoints_stay_public(client):
    assert client.get("/health").status_code == 200


def test_garbage_session_cookie_is_rejected(client):
    client.cookies.set("aalim_session", "not-a-real-token")
    assert client.get("/auth/me").status_code == 401
    assert client.get("/conversations").status_code == 401


def test_ask_does_not_call_the_model_when_unauthenticated(client, stub_model):
    resp = client.post(
        "/ask", json={"question": "hi", "history": [], "language": "en"}
    )
    assert resp.status_code == 401
    # Auth runs before any spend.
    assert stub_model["calls"] == []
