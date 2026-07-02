# Environment Setup

Env files come in two flavours. **Templates** (`*.example`) are committed and contain
**no secrets** — copy them and fill in as needed. Real `.env` files are gitignored and
never leave your machine.

| Template (committed) | Copy to | Used for |
|---|---|---|
| `.env.example` | `.env` | Optional AI keys for the Docker stack |
| `backend/.env.example` | `backend/.env` | Running the backend **natively** (local, safe defaults) |
| `backend/.env.production.example` | *(host env / server)* | **Deploy** reference — real secrets, never commit |
| `frontend/.env.example` | `frontend/.env.local` | Frontend API URL |

## For a teammate starting local dev

### Option A — Docker (recommended, matches production topology)
Nothing to configure — `docker-compose` supplies local Postgres, Redis and MinIO.
```powershell
docker compose up -d --build
docker compose exec backend1 python manage.py migrate
docker compose exec backend1 python manage.py seed_demo
cd frontend
Copy-Item .env.example .env.local     # VITE_API_URL=http://localhost:8000
npm install
npm run dev                            # http://localhost:5173
```
(Optional: `Copy-Item .env.example .env` in the repo root and add an `OPENROUTER_API_KEY`
/ `HF_TOKEN` to enable real LLM review panels + higher Try-On quota.)

### Option B — Native backend (fast Python reload, no Docker)
```powershell
cd backend
Copy-Item .env.example .env            # SQLite + no Redis/S3 — fully local, safe
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```
In another terminal:
```powershell
cd frontend
Copy-Item .env.example .env.local
npm run dev
```
Native mode is the monolith fallback: Try-On runs in a background thread, uploads go to
the local `media/` folder, and the return fan-out needs Redis (so it no-ops without it).
Use Docker when you need the full microservice behaviour.

## Rules
- **Never commit a real `.env`.** `.gitignore` blocks every `.env*` except the `*.example` templates.
- Real production secrets live only on the host (e.g. the Render dashboard), filled from
  `backend/.env.production.example`.
- In production the **tryon-service needs its own Redis DB/instance**, separate from Django's,
  or the two Celery workers collide (see the note in `.env.production.example`).
