"""Conversations and messages are saved and can be reopened."""
import database


def test_ask_creates_conversation_and_saves_both_messages(user_client, stub_model):
    c = user_client("a@example.com")

    resp = c.post(
        "/ask",
        json={"question": "What does the Quran say about patience?",
              "history": [], "language": "en"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["conversation_id"] is not None

    detail = c.get(f"/conversations/{body['conversation_id']}").json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant"]
    assert detail["messages"][0]["content"] == "What does the Quran say about patience?"
    assert detail["messages"][1]["status"] == "ok"
    assert detail["messages"][1]["sources"][0]["reference"] == "Qur'an 2:153"


def test_conversation_is_titled_from_the_first_question(user_client, stub_model):
    c = user_client("a@example.com")
    c.post("/ask", json={"question": "Tell me about zakat",
                         "history": [], "language": "en"})

    listed = c.get("/conversations").json()
    assert len(listed) == 1
    assert listed[0]["title"] == "Tell me about zakat"


def test_continuing_a_conversation_appends_to_it(user_client, stub_model):
    c = user_client("a@example.com")
    first = c.post("/ask", json={"question": "First question",
                                 "history": [], "language": "en"}).json()
    cid = first["conversation_id"]

    second = c.post("/ask", json={"question": "Second question",
                                  "history": [], "language": "en",
                                  "conversation_id": cid}).json()
    assert second["conversation_id"] == cid

    detail = c.get(f"/conversations/{cid}").json()
    assert len(detail["messages"]) == 4
    assert c.get("/conversations").json().__len__() == 1


def test_new_conversation_starts_empty_and_is_listed(user_client):
    c = user_client("a@example.com")
    created = c.post("/conversations").json()
    assert created["messages"] == []
    assert any(x["id"] == created["id"] for x in c.get("/conversations").json())


def test_conversations_are_listed_most_recent_first(user_client, stub_model):
    c = user_client("a@example.com")
    first = c.post("/ask", json={"question": "Older", "history": [],
                                 "language": "en"}).json()["conversation_id"]
    second = c.post("/ask", json={"question": "Newer", "history": [],
                                  "language": "en"}).json()["conversation_id"]

    # Touch the older one so it becomes the most recently updated.
    c.post("/ask", json={"question": "Bump", "history": [], "language": "en",
                         "conversation_id": first})

    ids = [x["id"] for x in c.get("/conversations").json()]
    assert ids[0] == first and second in ids


def test_refusal_is_persisted_with_its_status(user_client, stub_model):
    c = user_client("a@example.com")
    stub_model["reply"] = {
        "status": "refusal",
        "answer": "Aalim answers only according to Sunni Islam (Ahl al-Sunnah wal-Jama'ah).",
        "sources": [],
        "message": None,
    }
    body = c.post("/ask", json={"question": "twelve imams", "history": [],
                                "language": "en"}).json()
    assert body["status"] == "refusal"

    detail = c.get(f"/conversations/{body['conversation_id']}").json()
    assert detail["messages"][1]["status"] == "refusal"
    assert detail["messages"][1]["sources"] == []


def test_deleting_a_conversation_removes_its_messages(user_client, stub_model):
    c = user_client("a@example.com")
    cid = c.post("/ask", json={"question": "Q", "history": [],
                               "language": "en"}).json()["conversation_id"]

    assert c.delete(f"/conversations/{cid}").status_code == 204
    assert c.get(f"/conversations/{cid}").status_code == 404

    with database.db_cursor() as cur:
        cur.execute("SELECT count(*) FROM messages WHERE conversation_id = %s", (cid,))
        assert cur.fetchone()[0] == 0


def test_existing_corpus_tables_are_untouched_by_chat(user_client, stub_model):
    """Chat persistence must not write to the Qur'an/Hadith corpus."""
    c = user_client("a@example.com")
    with database.db_cursor() as cur:
        cur.execute("SELECT count(*) FROM sources")
        before = cur.fetchone()[0]

    c.post("/ask", json={"question": "Q", "history": [], "language": "en"})

    with database.db_cursor() as cur:
        cur.execute("SELECT count(*) FROM sources")
        assert cur.fetchone()[0] == before
