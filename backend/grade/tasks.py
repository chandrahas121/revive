import base64
import logging

from celery import shared_task
from django.core.cache import cache

logger = logging.getLogger(__name__)

_FALLBACK = {
    "grade": "B",
    "confidence": 0.75,
    "defects": [],
    "completeness": 0.9,
    "condition_summary": "Item appears to be in good condition. Manual review recommended.",
    "functional": True,
    "latency_ms": 0,
    "model_version": "fallback-v0",
    "from_cache": False,
}


@shared_task(bind=True, max_retries=2, soft_time_limit=120)
def grade_image_task(self, image_b64: str, product_id: str, category: str, operator: str, job_id: str):
    """
    Celery task that runs the ML grading pipeline in a separate worker process.

    Flow:
      AsyncGradeView (Django)  →  Redis queue  →  this task (Celery worker)
                                                         ↓
                                              result stored in Redis
                                                         ↓
                              GradeStatusView polls until status == "done"

    Retries up to 2 times (5-second delay each) before falling back to grade B.
    Image bytes are base64-encoded for JSON-safe transport through the queue.
    """
    image_bytes = base64.b64decode(image_b64)
    try:
        from ml.grade import grade_image
        result = grade_image(
            image_bytes=image_bytes,
            product_id=product_id,
            operator=operator,
            category=category,
            use_cache=True,
        )
        result['status'] = 'done'
        result['job_id'] = job_id
    except Exception as exc:
        if self.request.retries < self.max_retries:
            logger.warning(f"[grade_image_task] retry {self.request.retries + 1}: {exc}")
            raise self.retry(exc=exc, countdown=5)
        logger.error(f"[grade_image_task] all retries exhausted, using fallback: {exc}")
        result = {**_FALLBACK, 'status': 'done', 'job_id': job_id, 'error': str(exc)}

    cache.set(f'grade_job:{job_id}', result, 3600)
    return job_id


@shared_task(bind=True, max_retries=1, soft_time_limit=150)
def seller_inspect_task(self, images_b64: list, slots: list, category: str,
                        expected_title: str, product_id: str, operator: str,
                        geohash5: str, mrp: float, job_id: str):
    """
    Async multi-angle seller grade + route (see grade/inspect.run_seller_grade).

    AsyncInspectView pushes a job here so the web worker returns a job_id in <100ms
    instead of blocking for the multi-second ML. Images arrive base64-encoded for
    JSON-safe transport through the queue (same pattern as grade_image_task).
    """
    try:
        images = [base64.b64decode(b) for b in images_b64]
        from grade.inspect import run_seller_grade
        result = run_seller_grade(
            images=images, slots=list(slots), category=category,
            expected_title=expected_title, product_id=product_id,
            operator=operator, geohash5=geohash5, mrp=float(mrp),
        )
        result['status'] = 'done'
        result['job_id'] = job_id
    except Exception as exc:
        logger.error(f"[seller_inspect_task] failed: {exc}")
        result = {
            'status': 'done', 'job_id': job_id, 'grade': None,
            'message': 'AI grading is temporarily unavailable — you can still submit manually.',
            'error': str(exc),
        }

    cache.set(f'inspect_job:{job_id}', result, 3600)
    return job_id


@shared_task(bind=True, max_retries=1, soft_time_limit=180)
def return_inspect_task(self, images_b64: list, video_url: str, video_b64: str,
                        video_suffix: str, slots: list, category: str,
                        expected_title: str, product_id: str, operator: str,
                        geohash5: str, mrp: float, job_id: str):
    """
    Async RETURN inspection (keeps fraud gates — see grade/inspect.run_return_inspect).

    Video, if any, arrives as a presigned storage URL that the worker fetches over
    the internal endpoint (so the large file never travels through Redis); a raw
    base64 video is only used as a fallback when storage isn't configured.
    """
    try:
        images = [base64.b64decode(b) for b in images_b64]

        video_bytes = None
        if video_url:
            import urllib.request
            from core.storage import to_internal_url
            req = urllib.request.Request(to_internal_url(video_url),
                                         headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=30) as resp:
                video_bytes = resp.read()
        elif video_b64:
            video_bytes = base64.b64decode(video_b64)

        from grade.inspect import run_return_inspect
        result = run_return_inspect(
            images=images, slots=list(slots), category=category,
            expected_title=expected_title, product_id=product_id, operator=operator,
            geohash5=geohash5, mrp=float(mrp), skip_match=False,
            video_bytes=video_bytes, video_suffix=video_suffix or '.mp4',
        )
        result['status'] = 'done'
        result['job_id'] = job_id
    except Exception as exc:
        logger.error(f"[return_inspect_task] failed: {exc}")
        result = {
            'status': 'done', 'job_id': job_id, 'grade': None,
            'message': 'AI grading is temporarily unavailable — showing the last verified grade.',
            'error': str(exc),
        }

    cache.set(f'inspect_job:{job_id}', result, 3600)
    return job_id
