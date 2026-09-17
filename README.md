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

## Installing on a phone

Aalim is a Progressive Web App. The service worker is registered for
production builds only, so test it with `npm run build && npm start`
rather than `npm run dev`.

**iPhone / iPad (Safari)** — open the site, tap Share, then *Add to Home
Screen*. Chrome and Firefox on iOS cannot install a PWA; iOS only allows
it from Safari.

**Android (Chrome)** — a install prompt usually appears; otherwise use
the ⋮ menu and *Install app* / *Add to Home screen*.

**Desktop (Chrome/Edge)** — an install icon appears in the address bar.

Once installed it launches standalone, with no browser chrome. Offline,
a fallback page explains that a connection is required: answers come
from a server-side search over the corpus, and conversations are stored
on the account, so neither works without a network.

The service worker caches only the public shell (`/`, `/login`,
`/signup`, the offline page) and static build assets. It never caches
`/chat`, any authenticated API response, or chat history.

**Note for production:** the app must be served over HTTPS for the
service worker to register and for the app to be installable, and
`COOKIE_SECURE=true` is required there for sessions.

## Tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

The suite creates and drops its own `islamic_ai_test` database and stubs
the model, so it needs no API key, no network, and never touches the
development corpus.

### Frontend (Playwright)

These drive a real browser against a running stack, so start the backend
and a production frontend build first, then:

```bash
cd frontend
npm run test:mobile     # full flow at 8 viewports, 320px to desktop
node tests/pwa-check.mjs        # manifest, icons, SW caching, offline
node tests/scroll-behaviour.mjs # sticky scroll, composer visibility
node tests/content-stress.mjs   # long text, Arabic RTL, code, tables
```

They register throwaway accounts and seed fixtures in the development
database; the accounts can be removed with
`DELETE FROM users WHERE email ~ '^(pw-|pwa-|stress-|scroll-)';`

## Documentation

- `docs/DEPLOYMENT.md` — provisioning, migrations, and post-deploy verification
- `docs/API_CONTRACT.md` — request/response contract
- `docs/governance.md`, `docs/ethics-safety.md` — answer constraints
- `backend/.env.example` — every environment variable
