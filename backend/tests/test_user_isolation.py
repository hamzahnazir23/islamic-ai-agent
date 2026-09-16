"""
Two users must never see or modify each other's conversations.

Each test drives the attack the requirement names: changing a URL or a
request id to reach another account's data.
"""
import database


def _conversation_for(client, stub_model, question="Private question"):
    return client.post(
        "/ask", json={"question": question, "history": [], "language": "en"}
    ).json()["conversation_id"]


def test_user_cannot_read_another_users_conversation(user_client, stub_model):
    alice = user_client("alice@example.com")
    bob = user_client("bob@example.com")

    alice_convo = _conversation_for(alice, stub_model, "Alice's private question")

    resp = bob.get(f"/conversations/{alice_convo}")
    assert resp.status_code == 404
    assert "Alice" not in resp.text


def test_user_cannot_delete_another_users_conversation(user_client, stub_model):
    alice = user_client("alice@example.com")
    bob = user_client("bob@example.com")

    alice_convo = _conversation_for(alice, stub_model)

    assert bob.delete(f"/conversations/{alice_convo}").status_code == 404
    # Alice's conversation survived.
    assert alice.get(f"/conversations/{alice_convo}").status_code == 200


def test_user_cannot_append_to_another_users_conversation(user_client, stub_model):
    alice = user_client("alice@example.com")
    bob = user_client("bob@example.com")

    alice_convo = _conversation_for(alice, stub_model)
    before = len(alice.get(f"/conversations/{alice_convo}").json()["messages"])

    resp = bob.post(
        "/ask",
        json={"question": "Injected", "history": [], "language": "en",
              "conversation_id": alice_convo},
    )
    assert resp.status_code == 404

    after = len(alice.get(f"/conversations/{alice_convo}").json()["messages"])
    assert after == before, "another user's message was written into the conversation"


def test_rejected_append_does_not_call_the_model(user_client, stub_model):
    """Ownership is checked before the expensive call, not after."""
    alice = user_client("alice@example.com")
    bob = user_client("bob@example.com")
    alice_convo = _conversation_for(alice, stub_model)

    calls_before = len(stub_model["calls"])
    bob.post("/ask", json={"question": "Injected", "history": [],
                           "language": "en", "conversation_id": alice_convo})
    assert len(stub_model["calls"]) == calls_before


def test_listing_only_returns_your_own_conversations(user_client, stub_model):
    alice = user_client("alice@example.com")
    bob = user_client("bob@example.com")

    alice_convo = _conversation_for(alice, stub_model, "Alice topic")
    bob_convo = _conversation_for(bob, stub_model, "Bob topic")

    alice_ids = [c["id"] for c in alice.get("/conversations").json()]
    bob_ids = [c["id"] for c in bob.get("/conversations").json()]

    assert alice_ids == [alice_convo]
    assert bob_ids == [bob_convo]
    assert bob_convo not in alice_ids


def test_identity_comes_from_the_session_not_the_request(user_client, stub_model):
    """
    A client-supplied user id must be ignored. Bob sends Alice's user id in
    the body; the message must still be attributed to Bob.
    """
    alice = user_client("alice@example.com")
    bob = user_client("bob@example.com")

    with database.db_cursor() as cur:
        cur.execute("SELECT id FROM users WHERE email = 'alice@example.com'")
        alice_id = cur.fetchone()[0]

    body = bob.post(
        "/ask",
        json={"question": "Whose is this?", "history": [], "language": "en",
              "user_id": alice_id},
    ).json()

    with database.db_cursor() as cur:
        cur.execute(
            "SELECT user_id FROM conversations WHERE id = %s",
            (body["conversation_id"],),
        )
        owner = cur.fetchone()[0]

    assert owner != alice_id
    assert body["conversation_id"] not in [
        c["id"] for c in alice.get("/conversations").json()
    ]


def test_session_of_deleted_user_stops_working(user_client, stub_model):
    alice = user_client("alice@example.com")
    assert alice.get("/auth/me").status_code == 200

    with database.db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM users WHERE email = 'alice@example.com'")

    assert alice.get("/auth/me").status_code == 401
