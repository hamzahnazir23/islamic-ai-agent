# Deployment

The API is useless without its corpus. `search.py` degrades to an empty
result set when it cannot reach Postgres, and the app then answers from
the model's own knowledge with no citations — the same behaviour as a
question with no good matches. **A missing database does not raise an
error; it silently removes every citation.** Verify step 5 after any
deploy.

## 1. Provision Postgres with pgvector

Railway: add a Postgres service, then confirm the extension is
available. `pgvector` ships with Railway's image; other providers may
need it enabled explicitly.

```bash
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

## 2. Apply the schema

```bash
psql "$DATABASE_URL" -f backend/db/schema.sql
```

Idempotent — safe to re-run on every deploy.

## 3. Load and embed the corpus

Run locally against the remote database. `data/processed/` is
gitignored, so this cannot run from a deployed container.

```bash
cd backend
export DATABASE_URL="postgresql://..."
export OPENAI_API_KEY="sk-..."

python load_sources.py    # ~20,880 rows, idempotent
python embed_sources.py   # embeds only rows with no embedding yet
```

`embed_sources.py` is resumable: it commits per batch of 100 and skips
already-embedded rows, so an interrupted run can simply be restarted.
Cost is a few cents at current `text-embedding-3-small` pricing.

Expected final state:

```
sources     20,880   (quran 6,236 / bukhari 7,277 / muslim 7,367)
embeddings  20,879   (Bukhari 6857 has no English text and is skipped)
```

## 4. Configure the environment

See `backend/.env.example` for all twelve variables. The two that are
most often wrong:

- `ALLOWED_ORIGINS` must be the **frontend** origin, not the API's own
  URL. Wrong value = every browser request fails CORS.
- `TRUST_PROXY=true` on Railway. Left false, its proxy makes all traffic
  appear to come from one IP and every user shares a single rate-limit
  budget.

Start command, from `backend/`:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

## 5. Verify the deploy

`GET /health` only proves the process is up. It does not touch the
database, so it passes even when retrieval is completely broken. To
confirm the corpus is actually reachable, check that a question that
should cite returns `status: "ok"` with a non-empty `sources` array:

```bash
curl -s -X POST "$API_URL/ask" \
  -H 'Content-Type: application/json' \
  -d '{"question":"What does the Quran say about patience?","history":[],"language":"en"}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['status'], len(d['sources']), 'sources')"
```

Expected: `ok 5 sources`. If it prints `general 0 sources`, the database
is unreachable or unpopulated.
