"""
core/storage.py
---------------
Presigned upload helpers for S3-compatible object storage (AWS S3 or local MinIO).

A presigned POST lets the browser upload an image *directly* to object storage.
Django only signs a short-lived permission slip — it never receives the image
bytes, so a returns/upload surge cannot tie up web workers on file I/O.

Same code works against MinIO locally and AWS S3 in production; only the
endpoint URL and credentials (read from settings / env) change.
"""
from __future__ import annotations

import os
import uuid

import boto3
from botocore.config import Config
from django.conf import settings


def storage_configured() -> bool:
    """True when a bucket is configured (i.e. we are not on local filesystem storage)."""
    return bool(getattr(settings, 'AWS_STORAGE_BUCKET_NAME', ''))


def to_internal_url(url: str) -> str:
    """
    Rewrite a public storage URL (browser-facing, e.g. http://localhost:9000/…)
    to the internal endpoint (e.g. http://minio:9000/…) so a server-side worker
    can fetch it from inside the docker network. No-op for real AWS (where the
    public and internal endpoints are the same).
    """
    if not url:
        return url
    public = getattr(settings, 'AWS_S3_PUBLIC_ENDPOINT_URL', None)
    internal = getattr(settings, 'AWS_S3_ENDPOINT_URL', None)
    if public and internal and url.startswith(public):
        return internal + url[len(public):]
    return url


def _presign_client():
    """
    boto3 S3 client used only for presigning.

    It targets the *public* endpoint (e.g. http://localhost:9000) so the signature
    matches the host the browser will POST to. For real AWS the public endpoint is
    None, so boto3 uses the default AWS endpoint with virtual-hosted addressing.
    """
    endpoint = getattr(settings, 'AWS_S3_PUBLIC_ENDPOINT_URL', None)
    addressing = 'path' if endpoint else 'auto'
    return boto3.client(
        's3',
        region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'us-east-1'),
        endpoint_url=endpoint,
        config=Config(signature_version='s3v4', s3={'addressing_style': addressing}),
    )


def generate_presigned_upload(
    filename: str,
    content_type: str = 'image/jpeg',
    prefix: str = 'listings',
    max_mb: int = 15,
    expires: int = 300,
) -> dict | None:
    """
    Create a presigned POST for a single image upload.

    Returns a dict the browser uses to upload directly to storage:
        {
          "upload_url": "...",      # POST the multipart form here
          "fields": {...},          # include these form fields verbatim
          "s3_key": "listings/ab12…/photo.jpg",
          "file_url": "https://.../revive-media/listings/ab12…/photo.jpg"  # public URL after upload
        }
    Returns None when object storage is not configured (caller should 400).
    """
    bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', '')
    if not bucket:
        return None

    ext = (os.path.splitext(filename)[1] or '.jpg').lower()
    key = f'{prefix}/{uuid.uuid4().hex}{ext}'

    client = _presign_client()
    post = client.generate_presigned_post(
        Bucket=bucket,
        Key=key,
        Fields={'Content-Type': content_type},
        Conditions=[
            {'Content-Type': content_type},
            ['content-length-range', 1, max_mb * 1024 * 1024],
        ],
        ExpiresIn=expires,
    )

    return {
        'upload_url': post['url'],
        'fields': post['fields'],
        's3_key': key,
        'file_url': f'{settings.MEDIA_URL}{key}',
    }
