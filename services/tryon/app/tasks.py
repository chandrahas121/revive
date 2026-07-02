"""
Celery task: fetch the garment image, run try-on, store the result in Redis.
"""
import base64
import logging
import time
import urllib.request

from .celery_app import celery_app
from .config import settings
from . import jobs
from .engine import virtual_tryon_b64

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=2, soft_time_limit=180, name="tryon.run")
def run_tryon_task(self, job_id: str, person_b64: str, garment_url: str, description: str):
    """Produce the try-on image for one job and write the outcome to the job store."""
    try:
        person_bytes = base64.b64decode(person_b64)

        req = urllib.request.Request(garment_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=settings.fetch_timeout) as resp:
            garment_bytes = resp.read()

        t0 = time.time()
        result_b64 = virtual_tryon_b64(person_bytes, garment_bytes, description)
        jobs.set_job(job_id, {
            "status": "done",
            "result_image_b64": result_b64,
            "latency_ms": int((time.time() - t0) * 1000),
        })
    except Exception as exc:
        if self.request.retries < self.max_retries:
            logger.warning("[tryon] job %s retry %s: %s", job_id, self.request.retries + 1, exc)
            raise self.retry(exc=exc, countdown=8)
        logger.error("[tryon] job %s failed: %s", job_id, exc)
        jobs.set_job(job_id, {
            "status": "error",
            "error": str(exc) or "Virtual try-on failed. Please try again.",
        })
