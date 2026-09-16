# islamic-ai-agent

AI agent for Qur'an, Sunnah, and Hadith-based religious queries.

Answers are retrieved from a pgvector corpus of the Qur'an, Sahih
al-Bukhari, and Sahih Muslim, and every cited source is returned to the
client. Accounts are required: conversations are stored per user.

## Running locally

**Prerequisites:** Python 3.11+, Node 20+, PostgreSQL with the `pgvector`
extension, and an OpenAI API key.

### 1. Database

```bash
createdb islamic_ai
psql -d islamic_ai -f backend/db/schema.sql
psql -d islamic_ai -f backend/db/migrations/002_auth_and_chat.sql
```

Load and embed the corpus (once; ~20,880 rows, a few cents in embedding
calls). Both scripts are idempotent and resumable:

```bash
cd backend
python load_sources.py
python embed_sources.py
```

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env     # then fill in OPENAI_API_KEY and PG* / DATABASE_URL
export $(grep -v '^#' .env | xargs)

uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000.

> **Use `localhost`, not `127.0.0.1`.** The session cookie is issued for
> the API's host. `localhost:3000 → localhost:8000` is same-site, so the
> `SameSite=Lax` cookie is sent; mixing the two hostnames makes every
> authenticated request fail with 401.

## Tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

The suite creates and drops its own `islamic_ai_test` database and stubs
the model, so it needs no API key, no network, and never touches the
development corpus.

## Documentation

- `docs/DEPLOYMENT.md` — provisioning, migrations, and post-deploy verification
- `docs/API_CONTRACT.md` — request/response contract
- `docs/governance.md`, `docs/ethics-safety.md` — answer constraints
- `backend/.env.example` — every environment variable
