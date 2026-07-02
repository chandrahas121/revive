"""
Celery application for the Try-On service.

The slow diffusion call (15-60s) runs here, in a worker process, so the FastAPI
request thread is never blocked — the whole point of splitting Try-On out.
"""
from celery import Celery

from .config import settings

celery_app = Celery(
    "tryon",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_track_started=True,
    task_soft_time_limit=180,          # diffusion can be slow; hard cap 3 min
    worker_prefetch_multiplier=1,      # one heavy job at a time per worker
)

# Import tasks so the worker registers them. Placed after app creation to avoid
# a circular import (tasks.py imports celery_app from here).
from . import tasks  # noqa: E402,F401
