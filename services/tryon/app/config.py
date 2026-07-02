"""
Configuration — all from environment variables so the service is 12-factor and
runs identically in docker-compose and in the cloud.
"""
import os


class Settings:
    # Redis is both the Celery broker and the job-status store.
    redis_url: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    # HuggingFace Space that hosts the IDM-VTON diffusion model.
    hf_space: str = os.environ.get("TRYON_HF_SPACE", "yisol/IDM-VTON")
    hf_token: str = os.environ.get("HF_TOKEN", "")

    # How long a finished/failed job result stays readable (seconds).
    job_ttl: int = int(os.environ.get("TRYON_JOB_TTL", "3600"))

    # Timeout for fetching the garment image from its URL (seconds).
    fetch_timeout: int = int(os.environ.get("TRYON_FETCH_TIMEOUT", "20"))


settings = Settings()
