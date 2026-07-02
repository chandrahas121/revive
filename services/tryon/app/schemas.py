"""Pydantic response models — the public contract of the service."""
from typing import Optional

from pydantic import BaseModel


class JobCreated(BaseModel):
    """Returned immediately from POST /api/tryon/ — the request never blocks."""
    job_id: str
    status: str = "processing"


class JobStatus(BaseModel):
    """Returned from GET /api/tryon/status/{job_id}/ while polling."""
    status: str                              # "processing" | "done" | "error"
    result_image_b64: Optional[str] = None   # present when status == "done"
    latency_ms: Optional[int] = None
    error: Optional[str] = None              # present when status == "error"
