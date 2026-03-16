# PrepOS

FastAPI + async SQLAlchemy backend for tracking **coding interview prep problems** and your **attempts** at solving them.

## What exists so far

- **REST API** with two resources:
  - **Problems**: metadata you want to practice (title, url, topic, difficulty, tags, notes).
  - **Attempts**: each time you try a problem (solved, time spent, mistakes, timestamp).
- **Postgres persistence** via **SQLAlchemy 2.0 (async)** + `asyncpg`.
- **Migrations** via **Alembic** (initial migration creates `problems` + `attempts` tables).
- **Health check** endpoint: `GET /health`
- **Interactive API docs** (FastAPI): `GET /docs`

## Tech stack

- **FastAPI**
- **Uvicorn**
- **SQLAlchemy (async)**
- **Postgres** (`asyncpg`)
- **Alembic**
- **pydantic-settings** + `.env`

## Project layout

```
app/
  main.py              # FastAPI app + router registration
  config.py            # Settings (reads .env)
  database.py          # Async engine/session + Base + dependency
  models/              # SQLAlchemy models (Problem, Attempt)
  schemas/             # Pydantic schemas for API I/O
  routers/             # FastAPI routers (/problems, /attempts)
  services/            # CRUD logic used by routers
alembic/               # Alembic env + versions
alembic.ini
requirements.txt
.env
```

## Setup

### 1) Create a virtualenv and install dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Configure the database URL

This project expects `DATABASE_URL` to be set (loaded from `.env`).

Current `.env` example:

```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/prepos
```

Make sure Postgres is running and the database exists (e.g. create `prepos`).

## Database migrations (Alembic)

Run migrations to create the tables:

```bash
alembic upgrade head
```

## Run the API

```bash
uvicorn app.main:app --reload
```

Then open:

- **Swagger UI**: `http://127.0.0.1:8000/docs`
- **Health**: `http://127.0.0.1:8000/health`

## API endpoints

### Problems

- `GET /problems` — list all problems
- `GET /problems/{problem_id}` — get one problem
- `POST /problems` — create a problem
- `PATCH /problems/{problem_id}` — update a problem (partial)
- `DELETE /problems/{problem_id}` — delete a problem

#### Problem fields

- **title** (required)
- **url** (optional)
- **topic** (optional)
- **difficulty** (optional)
- **tags** (optional, currently stored as text)
- **notes** (optional)

### Attempts

- `GET /attempts` — list all attempts
- `GET /attempts/{attempt_id}` — get one attempt
- `POST /attempts` — create an attempt
- `PATCH /attempts/{attempt_id}` — update an attempt (partial)
- `DELETE /attempts/{attempt_id}` — delete an attempt

#### Attempt fields

- **problem_id** (required)
- **solved** (default `false`)
- **time_to_solve_minutes** (optional int)
- **mistakes** (optional text)
- **attempted_at** is set automatically by the DB

## Attempts API — curl examples

> Nested under `/problems/{id}/attempts`. All examples assume the server is running on `http://localhost:8000`.

### Log a new attempt (minimal)

```bash
curl -s -X POST http://localhost:8000/problems/1/attempts \
  -H "Content-Type: application/json" \
  -d '{"solved": true, "time_to_solve_minutes": 18}' | jq
```

### Log a backfilled attempt with a specific timestamp

```bash
curl -s -X POST http://localhost:8000/problems/1/attempts \
  -H "Content-Type: application/json" \
  -d '{
    "solved": false,
    "time_to_solve_minutes": 45,
    "mistakes": "Off-by-one in the sliding window bounds",
    "attempted_at": "2026-03-10T14:30:00Z"
  }' | jq
```

### List all attempts for a problem (sorted most-recent first)

```bash
curl -s http://localhost:8000/problems/1/attempts | jq
```

### Problem response now includes computed stats

```bash
curl -s http://localhost:8000/problems/1 | jq '.attempt_count, .last_attempted_at, .success_rate'
# 3
# "2026-03-16T10:00:00+00:00"
# 66.7
```

### Error: attempt on a non-existent problem

```bash
curl -s -X POST http://localhost:8000/problems/999/attempts \
  -H "Content-Type: application/json" \
  -d '{"solved": true}' | jq
# {"detail": "Problem not found"}
```

---

## Problems API — curl examples

> Assumes the server is running on `http://localhost:8000`.

### Create a problem

```bash
curl -s -X POST http://localhost:8000/problems \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Two Sum",
    "url": "https://leetcode.com/problems/two-sum/",
    "topic": "arrays",
    "difficulty": "easy",
    "tags": "hash-map,arrays",
    "notes": "Classic O(n) hash map solution"
  }' | jq
```

### List all problems

```bash
curl -s http://localhost:8000/problems | jq
```

### List problems with filters

```bash
# By topic
curl -s "http://localhost:8000/problems?topic=arrays" | jq

# By difficulty
curl -s "http://localhost:8000/problems?difficulty=easy" | jq

# By tag (substring match)
curl -s "http://localhost:8000/problems?tag=hash-map" | jq

# Combined filters
curl -s "http://localhost:8000/problems?topic=arrays&difficulty=easy" | jq
```

### Get a single problem

```bash
curl -s http://localhost:8000/problems/1 | jq
```

### Update a problem (partial)

```bash
curl -s -X PATCH http://localhost:8000/problems/1 \
  -H "Content-Type: application/json" \
  -d '{"difficulty": "medium", "notes": "Updated notes"}' | jq
```

### Delete a problem

```bash
curl -s -X DELETE http://localhost:8000/problems/1 -o /dev/null -w "%{http_code}\n"
# Returns 204 on success
```

### Error responses

**Not found (404)**
```bash
curl -s http://localhost:8000/problems/999 | jq
# {"detail": "Problem not found"}
```

**Validation error (422)** — e.g. missing required `title`
```bash
curl -s -X POST http://localhost:8000/problems \
  -H "Content-Type: application/json" \
  -d '{}' | jq
# {
#   "detail": "Validation error",
#   "errors": [{"field": "title", "message": "Field required"}]
# }
```

## Notes / current behavior

- The DB engine is created with `echo=True`, so SQL statements will be logged to the console.
- If a requested `problem_id`/`attempt_id` doesn’t exist, the API returns **404** with `detail` of `"Problem not found"` / `"Attempt not found"`.

## Next likely steps

- Filter attempts by problem (e.g. `GET /problems/{id}/attempts`) and/or join responses.
- Normalize tags (store as array or separate table instead of text).
- Add Docker/dev compose for Postgres + API.
- Add validation/constraints (difficulty enum, URL format, etc.).

