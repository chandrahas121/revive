"""
FastAPI entrypoint for the Try-On micro-service.

Contract (same paths whether reached via nginx or directly):
    POST /api/tryon/                     → 202 { job_id, status: "processing" }
    GET  /api/tryon/status/{job_id}/     → { status, result_image_b64?, latency_ms?, error? }
    GET  /health                         → liveness probe
"""
import base64
import os
import uuid

from fastapi import APIRouter, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import jobs
from .config import settings
from .schemas import JobCreated, JobStatus
from .tasks import run_tryon_task

app = FastAPI(title="REVIVE Try-On Service", version="1.0.0")

# When the browser reaches this service directly (via the nginx gateway) it is a
# cross-origin call from the SPA, so the service needs its own CORS headers.
_cors_origins = os.environ.get(
    "TRYON_CORS_ORIGINS", "http://localhost:5173,http://localhost"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix="/api/tryon")


@app.get("/health")
def health():
    return {"status": "ok", "service": "tryon", "hf_space": settings.hf_space}


@router.post("/", response_model=JobCreated, status_code=202)
async def generate(
    person_image: UploadFile = File(...),
    garment_image_url: str = Form(...),
    garment_description: str = Form("clothing item"),
):
    """Accept an upload, enqueue the try-on, and return a job id immediately."""
    person_bytes = await person_image.read()
    if not person_bytes:
        raise HTTPException(status_code=400, detail="person_image is empty.")

    job_id = uuid.uuid4().hex
    jobs.set_job(job_id, {"status": "processing"})

    run_tryon_task.delay(
        job_id=job_id,
        person_b64=base64.b64encode(person_bytes).decode("utf-8"),
        garment_url=garment_image_url,
        description=garment_description,
    )
    return JobCreated(job_id=job_id)


@router.get("/status/{job_id}/", response_model=JobStatus)
def status(job_id: str):
    """Poll a job. 404 once the id is unknown or its result has expired."""
    data = jobs.get_job(job_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    return JobStatus(**data)


app.include_router(router)
