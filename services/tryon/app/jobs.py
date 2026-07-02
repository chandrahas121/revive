"""
Job-status store backed by Redis.

Only small JSON status blobs live in Redis (never the image bytes on the read
path), keyed by job id with a TTL so results self-expire.
"""
import json
from typing import Optional

import redis

from .config import settings

_client = redis.from_url(settings.redis_url, decode_responses=True)

_KEY = "tryon_job:{}"


def set_job(job_id: str, data: dict, ttl: Optional[int] = None) -> None:
    _client.setex(_KEY.format(job_id), ttl or settings.job_ttl, json.dumps(data))


def get_job(job_id: str) -> Optional[dict]:
    raw = _client.get(_KEY.format(job_id))
    return json.loads(raw) if raw else None
