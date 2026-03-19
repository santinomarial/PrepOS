# PrepOS

A full-stack coding interview prep tracker. Log problems, record attempts, and let the SM-2 spaced-repetition algorithm tell you what to review next. Built for engineers who treat interview prep like a system.

## Stack

| Layer | Tech |
|---|---|
| API | FastAPI 0.115, Python 3.14 |
| ORM | SQLAlchemy 2.0 (async) + asyncpg |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt |
| Database | PostgreSQL |
| Frontend | React 18, Vite 5, Tailwind CSS 3, Recharts |

## Features

- **Problems CRUD** — title, url, topic, difficulty, tags, notes
- **Attempt logging** — solved flag, time to solve, mistakes, timestamp
- **SM-2 spaced repetition** — `GET /problems/due` returns problems due for review, sorted by priority score
- **Analytics** — weakness scores per topic/tag, streak, success rate
- **Recommender** — composite scoring (topic weakness × overdue × difficulty fit × recency)
- **JWT auth** — all data scoped per user; register/login return a Bearer token
- **React frontend** — dark terminal-aesthetic UI with dashboard, problems table, and problem detail page

## Project layout

```
app/
  main.py              # FastAPI app, CORS, router registration
  config.py            # pydantic-settings (.env)
  database.py          # async engine + get_db dependency
  models/              # User, Problem, Attempt ORM models
  schemas/             # Pydantic schemas (request/response)
  routers/             # auth, problems, attempts, analytics, recommender
  services/            # business logic (scheduler, analytics, recommender, auth)
alembic/               # async-aware env.py + migration versions
client/
  src/
    api.js             # fetch wrapper (JWT, error handling)
    App.jsx            # React Router + ProtectedRoute
    components/        # Layout, ProtectedRoute
    pages/             # Login, Register, Dashboard, Problems, ProblemDetail
requirements.txt
ALGORITHM.md           # recommender scoring formula
```

## Setup

### 1. Install Python dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> **Note:** This project runs on Python 3.14. `asyncpg` must be installed from source (no wheel yet for 3.14).

### 2. Configure environment

Create a `.env` file in the project root:

```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/prepos
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
```

### 3. Run migrations

```bash
alembic upgrade head
```

### 4. Start the API

```bash
uvicorn app.main:app --reload
```

API available at `http://localhost:8000` — interactive docs at `http://localhost:8000/docs`.

### 5. Start the frontend

```bash
cd client
npm install
npm run dev
```

Frontend available at `http://localhost:5173`.

## API reference

All endpoints except `/auth/register` and `/auth/login` require a Bearer token:

```
Authorization: Bearer <token>
```

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account → returns JWT |
| POST | `/auth/login` | Login (form-encoded) → returns JWT |
| GET | `/auth/me` | Current user |

**Register / Login:**
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "yourpassword"}'

curl -X POST http://localhost:8000/auth/login \
  -d "username=you@example.com&password=yourpassword"
```

### Problems

| Method | Path | Description |
|---|---|---|
| GET | `/problems/` | List problems (filters: `topic`, `difficulty`, `tag`) |
| POST | `/problems/` | Create a problem |
| GET | `/problems/due` | Problems due for review today, sorted by priority |
| GET | `/problems/{id}` | Get problem with computed stats |
| PATCH | `/problems/{id}` | Partial update |
| DELETE | `/problems/{id}` | Delete |
| GET | `/problems/{id}/attempts` | Attempt history |
| POST | `/problems/{id}/attempts` | Log a new attempt |

**Problem response includes computed fields:** `attempt_count`, `last_attempted_at`, `success_rate`, `next_review_date`, `priority_score`.

### Analytics

| Method | Path | Description |
|---|---|---|
| GET | `/analytics/summary` | Total problems, attempts, streak, avg success rate, strongest/weakest topic |
| GET | `/analytics/weaknesses` | Topics and tags ranked by weakness score |

Weakness score: `(1 - success_rate) × 0.6 + normalized_avg_time × 0.4`

### Recommender

| Method | Path | Description |
|---|---|---|
| GET | `/recommend/` | Top N problems to study now (default `?top_n=5`) |

Composite score: `0.4 × topic_weakness + 0.3 × overdue_score + 0.2 × difficulty_fit + 0.1 × recency_penalty`. See [ALGORITHM.md](ALGORITHM.md) for full details.

## Running tests

```bash
pytest tests/
```

Tests cover the SM-2 scheduler logic (9 cases: no attempts, interval growth, failure reset, overdue priority, EF clamping, etc.).
