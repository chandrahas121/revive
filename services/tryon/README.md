# tryon-service

Independent micro-service for **Virtual Try-On** (IDM-VTON via HuggingFace).

It is split out of the Django monolith because its work is slow (15-60s GPU
diffusion) and bursty — running it inline blocks web workers and freezes the
storefront. As its own service it scales on its own metric (worker/GPU queue
depth) without touching catalog or checkout traffic.

## Contract

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/tryon/` | multipart: `person_image`, `garment_image_url`, `garment_description` → `202 {job_id}` |
| `GET`  | `/api/tryon/status/{job_id}/` | poll → `{status, result_image_b64?, latency_ms?, error?}` |
| `GET`  | `/health` | liveness |

The request never blocks: `POST` enqueues a Celery job and returns a `job_id`
instantly; the worker runs the diffusion call and writes the result to Redis;
the client polls `status` until `done`.

## Layout

```
app/
├── main.py         FastAPI routes (the contract above)
├── config.py       env-driven settings (12-factor)
├── schemas.py      Pydantic request/response models
├── celery_app.py   Celery application
├── tasks.py        run_tryon_task — fetch garment, run try-on, store result
├── jobs.py         Redis-backed job-status store
└── engine.py       self-contained IDM-VTON call (no Django import)
```

## Run

Via the repo's docker-compose (recommended — starts API + worker + Redis):

```bash
docker compose up --build tryon tryon-worker redis
```

Standalone:

```bash
cd services/tryon
pip install -r requirements.txt
export REDIS_URL=redis://localhost:6379/0
uvicorn app.main:app --port 8001            # API
celery -A app.celery_app worker -l info     # worker (separate terminal)
```

## Env

| Var | Default | Notes |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379/0` | broker + job store |
| `TRYON_HF_SPACE` | `yisol/IDM-VTON` | HuggingFace Space |
| `HF_TOKEN` | _(empty)_ | free token lifts ZeroGPU quota 60s→~1000s/day |
| `TRYON_JOB_TTL` | `3600` | seconds a result stays readable |
| `TRYON_FETCH_TIMEOUT` | `20` | garment-image fetch timeout |

## Deploy (free tier)

Push this folder to a Render web service (API) + background worker, both pointed
at the same Upstash Redis. No code change — env vars only.
